// @ts-nocheck - This file runs in Deno (Supabase Edge Functions), not Node.js
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

const BROWSER_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
};

async function generateSignature(appId: string, timestamp: number, payload: string, secret: string) {
    const baseString = `${appId}${timestamp}${payload}${secret}`;
    const encoder = new TextEncoder();
    const msgData = encoder.encode(baseString);
    const hashBuffer = await crypto.subtle.digest("SHA-256", msgData);
    return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function callShopeeGraphQL(appId: string, secret: string, payload: string) {
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = await generateSignature(appId, timestamp, payload, secret);
    const response = await fetch("https://open-api.affiliate.shopee.com.br/graphql", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `SHA256 Credential=${appId},Timestamp=${timestamp},Signature=${signature}`,
        },
        body: payload,
    });
    return response.json();
}

async function convertToShortLink(appId: string, secret: string, originUrl: string): Promise<string | null> {
    try {
        const payload = JSON.stringify({
            query: `mutation GenerateShortLink($input: GenerateShortLinkInput!) { generateShortLink(input: $input) { shortLink } }`,
            variables: { input: { originUrl } }
        });
        const result = await callShopeeGraphQL(appId, secret, payload);
        return result?.data?.generateShortLink?.shortLink || null;
    } catch (e) {
        console.error('Error generating short link:', e);
        return null;
    }
}

function getMeta(html: string, prop: string): string | null {
    const r1 = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i');
    const m1 = html.match(r1);
    const content = m1 ? m1[1] : null;
    if (content) return decodeHtmlEntities(content);

    const r2 = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`, 'i');
    const m2 = html.match(r2);
    return m2 ? decodeHtmlEntities(m2[1]) : null;
}

const BANNER_EXCLUSION_LIST = [
    '997606', // Meli+ banner
    '817663', // Meli+ Days (MLA108097331527)
    '999358', // Meli+ Day (MLA108027470033)
    '108097331527',
    '108027470033',
    'POR-APENAS', // Price banner
    'meli-days',
    'logo',
    'brand-banner'
];

function normalizeImageUrl(url: string | null): string | null {
    if (!url) return null;
    let normalized = decodeHtmlEntities(url).trim();
    if (normalized.startsWith('//')) normalized = `https:${normalized}`;
    if (!normalized.startsWith('http')) return null;

    // Reject known banners
    const lowCaseUrl = normalized.toLowerCase();
    for (const id of BANNER_EXCLUSION_LIST) {
        if (lowCaseUrl.includes(id.toLowerCase())) {
            console.log(`[fetch-metadata] Image rejected as banner: ${id}`);
            return null;
        }
    }
    
    // Reject generic brand logos or banners
    if (lowCaseUrl.includes('banner') || lowCaseUrl.includes('logo') || lowCaseUrl.includes('venda-com-a-gente')) {
        console.log(`[fetch-metadata] Image rejected as generic/banner: ${normalized}`);
        return null;
    }

    return normalized;
}

function getNordicData(html: string): { title?: string; price?: number; image?: string } | null {
    try {
        // Look for NORDIC_RENDERING_CTX in the script tags
        const match = html.match(/NORDIC_RENDERING_CTX\s*=\s*({[\s\S]*?});/);
        if (!match) return null;

        const ctx = JSON.parse(match[1]);
        // The structure can vary, so we try multiple common paths for social pages
        const state = ctx?.state;
        if (!state) return null;

        // Path for polycards in social tabs
        const components = state.tabs_content?.[0]?.components || [];
        for (const comp of components) {
            const polycards = comp.recommendation_data?.polycards || [];
            if (polycards.length > 0) {
                const pc = polycards[0];
                const title = pc.components?.find((c: any) => c.id === 'title')?.title?.text;
                const priceValue = pc.components?.find((c: any) => c.id === 'price')?.price?.value;
                const imageId = pc.pictures?.pictures?.[0]?.id;

                if (title || priceValue || imageId) {
                    return {
                        title: title || undefined,
                        price: priceValue ? parseFloat(priceValue) : undefined,
                        image: normalizeImageUrl(`https://http2.mlstatic.com/D_Q_NP_2X_${imageId}-O.webp`) || undefined
                    };
                }
            }
        }
    } catch (e) {
        console.error('[fetch-metadata] Nordic parse error:', e.message);
    }
    return null;
}

function decodeHtmlEntities(text: string) {
    if (!text) return text;
    return text.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n)))
        .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

function extractFromSocialPageHTML(html: string): { title?: string; price?: number; image?: string } | null {
    const titleMatch = html.match(/class="[^"]*poly-component__title[^"]*"[^>]*>\s*([^<]+)/i) ||
        html.match(/class="[^"]*poly-card__title[^"]*"[^>]*>\s*([^<]+)/i) ||
        html.match(/class="[^"]*ui-search-item__title[^"]*"[^>]*>\s*([^<]+)/i);

    const priceMatch = html.match(/class="[^"]*andes-money-amount__fraction[^"]*"[^>]*>\s*(\d[\d.]*)/i);
    const centMatch = html.match(/class="[^"]*andes-money-amount__cents[^"]*"[^>]*>\s*(\d+)/i);

    const imageMatch = html.match(/data-src="(https:\/\/http2\.mlstatic\.com\/D_[^"]+)"/i) ||
        html.match(/src="(https:\/\/http2\.mlstatic\.com\/D_[^"]+)"/i);

    if (titleMatch || priceMatch || imageMatch) {
        let price: number | undefined;
        if (priceMatch) {
            const whole = priceMatch[1].replace(/\./g, '');
            const cents = centMatch ? centMatch[1] : '00';
            price = parseFloat(`${whole}.${cents}`);
        }
        return {
            title: titleMatch ? titleMatch[1].trim() : undefined,
            price,
            image: normalizeImageUrl(imageMatch ? imageMatch[1] : null) || undefined,
        };
    }
    return null;
}

function extractPriceFromNordic(html: string): number | null {
    try {
        const match = html.match(/"current_price"\s*:\s*\{\s*"value"\s*:\s*([\d.]+)/i);
        if (match) return parseFloat(match[1]);
        const match2 = html.match(/"(?:price|amount)"\s*:\s*([\d.]+)/);
        if (match2) {
            const val = parseFloat(match2[1]);
            if (val > 0 && val < 100000) return val;
        }
    } catch { }
    return null;
}

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        const { url, userId } = await req.json();
        if (!url) throw new Error('URL is required');

        console.log(`[fetch-metadata] URL: ${url}`);

        let apiTitle: string | null = null;
        let apiPrice: string | null = null;
        let apiImage: string | null = null;
        let shopeeShortLink: string | null = null;

        // ===================== SHOPEE API =====================
        if (url.includes('shopee.com.br') && userId) {
            const match = url.match(/product\/(\d+)\/(\d+)/i) || url.match(/-i\.(\d+)\.(\d+)/i);
            if (match) {
                const shopId = match[1];
                const itemId = match[2];
                try {
                    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
                    const { data: row } = await supabase.from('app_settings').select('settings').eq('user_id', userId).single();
                    const shopeeConfig = row?.settings?.integrations?.find(i => i.id === 'shopee');
                    const appId = shopeeConfig?.credentials?.partnerId;
                    const secret = shopeeConfig?.credentials?.apiKey;

                    if (appId && secret && shopeeConfig.isEnabled) {
                        const productPayload = JSON.stringify({
                            query: `query { productOfferV2(itemId: \"${itemId}\", shopId: \"${shopId}\") { nodes { productName, price, priceMin, priceMax, imageUrl } } }`
                        });
                        const resJson = await callShopeeGraphQL(appId, secret, productPayload);
                        const node = resJson.data?.productOfferV2?.nodes?.[0];
                        if (node) {
                            apiTitle = node.productName;
                            let rawPrice = node.price || node.priceMin || node.priceMax || 0;
                            apiPrice = Number(rawPrice) > 30000 ? String(Number(rawPrice) / 100000) : String(Number(rawPrice));
                            apiImage = node.imageUrl;
                            const rawProductUrl = `https://shopee.com.br/product/${shopId}/${itemId}`;
                            shopeeShortLink = await convertToShortLink(appId, secret, rawProductUrl);
                            if (!shopeeShortLink) {
                                const trackingId = appId.startsWith('an_') ? appId : `an_${appId}`;
                                shopeeShortLink = `${rawProductUrl}?utm_source=${trackingId}&mmp_pid=${trackingId}&utm_medium=affiliates`;
                            }
                        }
                    }
                } catch (apiErr: any) {
                    console.error('Shopee API Error:', apiErr.message);
                }
            }
        }

        // ===================== FETCH THE PAGE =====================
        const response = await fetch(url, { headers: BROWSER_HEADERS, redirect: 'follow' });
        let finalUrl = response.url || url;
        let html = await response.text();

        console.log(`[fetch-metadata] Fetched: URL=${url} => finalUrl=${finalUrl} | HTML=${html.length} bytes`);

        // Handle meta-refresh/JS redirect for tiny pages (e.g., meli.la landing pages)
        if (html.length < 5000) {
            const metaRefresh = html.match(/<meta[^>]+http-equiv=["']refresh["'][^>]+content=["']\d+;\s*url=([^"'\s>]+)/i);
            const jsRedirect = html.match(/(?:window\.)?location(?:\.href)?\s*=\s*["']([^"']+["'])/i);
            const redirectTarget = metaRefresh?.[1] || jsRedirect?.[1]?.replace(/["']/g, '');

            if (redirectTarget) {
                let resolvedUrl = redirectTarget.trim();
                if (resolvedUrl.startsWith('/')) resolvedUrl = `https://www.mercadolivre.com.br${resolvedUrl}`;
                console.log(`[fetch-metadata] Following redirect from small page: ${resolvedUrl}`);
                try {
                    const r2 = await fetch(resolvedUrl, { headers: BROWSER_HEADERS, redirect: 'follow' });
                    finalUrl = r2.url || resolvedUrl;
                    html = await r2.text();
                    console.log(`[fetch-metadata] After redirect: finalUrl=${finalUrl} | HTML=${html.length} bytes`);
                } catch (e) {
                    console.error(`[fetch-metadata] Redirect follow error: ${e.message}`);
                }
            }
        }

        // ===================== ML HANDLING =====================
        // Detect ML by: original URL, final URL, or HTML content
        const isML = url.includes('meli.la') || url.includes('mercadolivre.com.br') ||
            finalUrl.includes('mercadolivre.com.br') || finalUrl.includes('meli.la') ||
            html.includes('mercadolivre.com.br') || html.includes('mlstatic.com');
        if (isML) {
            console.log('[fetch-metadata] ML page detected, extracting product data...');

            let title: string | null = null;
            let price: number | null = null;
            let image: string | null = null;

            // Strategy 0: High Priority - Extract from NORDIC_RENDERING_CTX JSON
            const nordic = getNordicData(html);
            if (nordic) {
                console.log('[fetch-metadata] Strategy 0: Data found in Nordic context');
                if (nordic.title) title = nordic.title;
                if (nordic.price) price = nordic.price;
                // Only skip if image is found (banners are NOT in Nordic thumbnails usually)
                if (nordic.image) image = nordic.image;
            }

            // Strategy 1: Extract from social page price JSON (legacy fallback)
            if (!price) {
                const nordicPrice = extractPriceFromNordic(html);
                if (nordicPrice) price = nordicPrice;
            }

            // Strategy 2: Extract from social page HTML elements
            const socialData = extractFromSocialPageHTML(html);
            if (socialData) {
                if (!title) title = socialData.title || null;
                if (!price && socialData.price) price = socialData.price;
                if (!image) {
                    image = socialData.image || null;
                }
            }

            // Strategy 2.5: Direct og:image from the current page
            const currentOgImage = normalizeImageUrl(getMeta(html, 'og:image') || getMeta(html, 'twitter:image'));
            if (currentOgImage) {
                console.log(`[fetch-metadata] Strategy 2.5: og:image found: ${currentOgImage}`);
                // If the og:image contains D_NQ_NP and the previous image didn't, upgrade it
                if (!image || (currentOgImage.includes('D_NQ_NP') && !image.includes('D_NQ_NP'))) {
                    image = currentOgImage;
                }
            }

            // Strategy 3: Find the product link and fetch the REAL product page for definitive data
            // Try multiple sources for finding the product URL
            const productLinkPatterns = [
                // Direct product links in href
                /href="(https?:\/\/(?:www\.|produto\.)?mercadolivre\.com\.br\/[^"]*\/p\/MLB\d+[^"]*?)"/i,
                /href="(https?:\/\/(?:www\.|produto\.)?mercadolivre\.com\.br\/MLB-[^"]+)"/i,
                // Any href with /p/MLB pattern
                /href="([^"]+\/p\/MLB\d+[^"]*?)"/i,
                // Any href with /MLB- pattern
                /href="([^"]+\/MLB-[^" ]+)"/i,
            ];

            let productUrl: string | null = null;
            for (const pattern of productLinkPatterns) {
                const m = html.match(pattern);
                if (m) {
                    productUrl = m[1];
                    break;
                }
            }

            // Also try og:url and canonical as product URL sources
            if (!productUrl) {
                const ogUrl = getMeta(html, 'og:url');
                if (ogUrl && (ogUrl.includes('/p/MLB') || ogUrl.includes('/MLB-'))) productUrl = ogUrl;
            }
            if (!productUrl) {
                const canonical = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i);
                if (canonical && (canonical[1].includes('/p/MLB') || canonical[1].includes('/MLB-'))) productUrl = canonical[1];
            }

            if (productUrl) {
                if (productUrl.startsWith('/')) productUrl = `https://www.mercadolivre.com.br${productUrl}`;
                productUrl = productUrl.split('?')[0];

                // Only fetch if we don't already have an image OR if we need to verify
                console.log(`[fetch-metadata] Strategy 3: Fetching real product page: ${productUrl}`);
                try {
                    const productResponse = await fetch(productUrl, { headers: BROWSER_HEADERS, redirect: 'follow' });
                    const productHtml = await productResponse.text();

                    // Definitive metadata from actual product page - THIS TAKES ABSOLUTE PRECEDENCE
                    const productOgImage = normalizeImageUrl(getMeta(productHtml, 'og:image') || getMeta(productHtml, 'twitter:image'));
                    if (productOgImage) {
                        console.log(`[fetch-metadata] DEFINITIVE image from product page: ${productOgImage}`);
                        // Prioritize high-res version if available in meta tags
                        if (productOgImage.includes('D_NQ_NP')) {
                            image = productOgImage.replace(/_(\d+x\d+)/, '_2X').replace(/(_[A-Z]\.webp)$/, '_O.webp');
                        } else {
                            image = productOgImage;
                        }
                    }

                    // Scan the product page for the main gallery image if meta failed or we want to double check
                    if (!image || !image.includes('D_NQ_NP')) {
                        const galleryMatch = productHtml.match(/src="(https:\/\/http2\.mlstatic\.com\/D_NQ_NP_[^"]+)"/i) ||
                                           productHtml.match(/data-src="(https:\/\/http2\.mlstatic\.com\/D_NQ_NP_[^"]+)"/i);
                        if (galleryMatch) {
                            const galleryImg = normalizeImageUrl(galleryMatch[1]);
                            if (galleryImg) {
                                image = galleryImg.replace(/_(\d+x\d+)/, '_2X').replace(/(_[A-Z]\.webp)$/, '_O.webp');
                                console.log(`[fetch-metadata] Gallery image found: ${image}`);
                            }
                        }
                    }

                    const productOgTitle = getMeta(productHtml, 'og:title');
                    if (productOgTitle) title = productOgTitle.replace(/\s*[-|:]\s*(Mercado Livre|MercadoLivre).*$/i, '').trim();

                    if (!price) {
                        const pPrice = extractPriceFromNordic(productHtml);
                        if (pPrice) price = pPrice;
                        else {
                            const mPrice = getMeta(productHtml, 'product:price:amount') || getMeta(productHtml, 'og:price:amount');
                            if (mPrice) price = parseFloat(mPrice);
                        }
                    }
                } catch (e) {
                    console.error(`[fetch-metadata] Strategy 3 error: ${e.message}`);
                }
            }

            // Strategy 4: Fallback R$ price
            if (!price) {
                const priceRegex = /R\$\s?([\d.]+,\d{1,2})/gi;
                const matches = [...html.matchAll(priceRegex)];
                if (matches.length > 0) {
                    const prices = matches.map(m => parseFloat(m[1].replace(/\./g, '').replace(',', '.'))).filter(p => !isNaN(p) && p > 0);
                    if (prices.length > 0) price = Math.min(...prices);
                }
            }

            // Strategy 5: Absolute Fallback image (only if still null)
            if (!image) {
                const imgMatch = html.match(/(?:data-src|src)="(https:\/\/http2\.mlstatic\.com\/D_[^"]+)"/i);
                if (imgMatch) {
                    const normalizedImg = normalizeImageUrl(imgMatch[1]);
                    const isBanner = normalizedImg?.includes('997606');
                    if (!isBanner) image = normalizedImg;
                }
            }

            return new Response(
                JSON.stringify({
                    title: decodeHtmlEntities(title || '') || 'Produto sem título',
                    image: image || '',
                    price: price || null,
                    platform: 'Mercado Livre',
                    finalUrl: url,
                }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
            );
        }

        // ===================== GENERIC EXTRACTION =====================
        let title = apiTitle || getMeta(html, 'og:title') || getMeta(html, 'twitter:title') || getMeta(html, 'title') || '';
        if (!title || title.length < 5) {
            const tag = html.match(/<title[^>]*>([^<]+)<\/title>/i);
            if (tag) title = tag[1].trim();
        }
        title = title.replace(/\s*[-|:]\s*(Amazon|Mercado Livre|Shopee|Meli|Aliexpress).*$/i, '').trim();

        let image = apiImage || normalizeImageUrl(getMeta(html, 'og:image') || getMeta(html, 'twitter:image')) || '';
        if (!image) {
            const amzImg = html.match(/(https:\/\/m\.media-amazon\.com\/images\/I\/[A-Za-z0-9._%-]+\.(?:jpg|png|webp))/i);
            if (amzImg) image = normalizeImageUrl(amzImg[1]) || '';
        }

        let jsonLdPrice: string | null = null;
        try {
            const scripts = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
            if (scripts) {
                for (const script of scripts) {
                    const content = script.replace(/<script[^>]*>|<\/script>/gi, '').trim();
                    const data = JSON.parse(content);
                    const find = (obj: any): any => {
                        if (!obj || typeof obj !== 'object') return null;
                        if (obj.price || obj.offers?.price) return String(obj.offers?.price || obj.price);
                        if (Array.isArray(obj)) { for (const item of obj) { const p = find(item); if (p) return p; } }
                        for (const k in obj) { const p = find(obj[k]); if (p) return p; }
                        return null;
                    };
                    const p = find(data);
                    if (p) { jsonLdPrice = p; break; }
                }
            }
        } catch { }

        let price: string | null = apiPrice || jsonLdPrice || getMeta(html, 'product:price:amount') || getMeta(html, 'og:price:amount') || null;

        if (!price || price === '0' || price === '0.00') {
            const mlPrice = extractPriceFromNordic(html);
            if (mlPrice) price = String(mlPrice);
        }

        if (!price || price === '0' || price === '0.00') {
            const priceRegex = /R\$\s?([\d.]+,\d{1,2})/gi;
            const matches = [...html.matchAll(priceRegex)];
            if (matches.length > 0) {
                const prices = matches.map(m => parseFloat(m[1].replace(/\./g, '').replace(',', '.'))).filter(p => !isNaN(p) && p > 0);
                if (prices.length > 0) price = String(Math.min(...prices));
            }
        }

        if (price && typeof price === 'string') {
            price = price.replace(/[^\d.,]/g, '').replace(',', '.');
            if (price.split('.').length > 2) {
                const parts = price.split('.');
                const cents = parts.pop() || '';
                price = parts.join('') + '.' + cents;
            }
        }

        let platform = 'Other';
        const combined = (url + ' ' + finalUrl).toLowerCase();
        if (combined.includes('shopee')) platform = 'Shopee';
        else if (combined.includes('amazon') || combined.includes('amzn')) platform = 'Amazon';
        else if (combined.includes('mercadolivre') || combined.includes('mlb-') || combined.includes('meli.la')) platform = 'Mercado Livre';

        let linkForResponse = finalUrl;
        if (shopeeShortLink) linkForResponse = shopeeShortLink;
        else if (platform === 'Mercado Livre' || platform === 'Amazon') linkForResponse = url;

        console.log(`[fetch-metadata] Result: title="${title?.substring(0, 50)}" price=${price} platform=${platform}`);

        return new Response(
            JSON.stringify({
                title: decodeHtmlEntities(title) || 'Produto sem título',
                image: image || '',
                price: price ? parseFloat(price) : null,
                platform,
                finalUrl: linkForResponse,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
    } catch (error: any) {
        console.error('[fetch-metadata] Error:', error.message);
        return new Response(JSON.stringify({ error: error.message }), { headers: corsHeaders, status: 400 });
    }
});
