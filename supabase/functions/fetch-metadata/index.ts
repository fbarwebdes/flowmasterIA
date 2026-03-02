// @ts-nocheck - This file runs in Deno (Supabase Edge Functions), not Node.js
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

// Generate SHA256 signature for Shopee Affiliate API
async function generateSignature(appId: string, timestamp: number, payload: string, secret: string) {
    const baseString = `${appId}${timestamp}${payload}${secret}`;
    const encoder = new TextEncoder();
    const msgData = encoder.encode(baseString);
    const hashBuffer = await crypto.subtle.digest("SHA-256", msgData);
    return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Call Shopee Affiliate GraphQL API
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

// Convert a raw Shopee URL into a proper short affiliate link
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

// Helper to extract meta tags from HTML
function getMeta(html: string, prop: string): string | null {
    const r1 = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i');
    const m1 = html.match(r1);
    if (m1) return m1[1];
    const r2 = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`, 'i');
    const m2 = html.match(r2);
    return m2 ? m2[1] : null;
}

// Fetch HTML from a URL with browser-like headers
async function fetchPage(url: string): Promise<{ html: string; finalUrl: string }> {
    const response = await fetch(url, {
        headers: {
            'User-Agent': BROWSER_UA,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
        },
        redirect: 'follow',
    });
    return { html: await response.text(), finalUrl: response.url || url };
}

// Extract product data from a standard product page HTML
function extractProductData(html: string) {
    let title = getMeta(html, 'og:title') || getMeta(html, 'twitter:title') || getMeta(html, 'title') || '';
    if (!title || title.length < 5) {
        const tag = html.match(/<title[^>]*>([^<]+)<\/title>/i) || html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
        if (tag) title = tag[1].trim();
    }
    // Clean store names from title
    title = title.replace(/\s*[-|:]\s*(Amazon|Mercado Livre|Shopee|Meli|Aliexpress|Perfil Social).*$/i, '').trim();

    let image = getMeta(html, 'og:image') || getMeta(html, 'twitter:image') || '';

    let price: string | null = getMeta(html, 'product:price:amount') || getMeta(html, 'og:price:amount') || null;
    // Specialized price parsing
    if (!price || price === '0' || price === '0.00' || price === '') {
        const priceMatch = html.match(/"current_price"\s*:\s*\{\s*"value"\s*:\s*([\d.]+)/i) ||
            html.match(/itemprop="price" content="([\d.,]+)"/i) ||
            html.match(/class="andes-money-amount__fraction">([\d.]+)<\/span>/i) ||
            html.match(/id="priceblock_ourprice"[^>]*>R\$\s*([\d.,]+)/i) ||
            html.match(/id="priceblock_dealprice"[^>]*>R\$\s*([\d.,]+)/i) ||
            html.match(/class="a-offscreen">R\$\s*([\d.,]+)/i) ||
            html.match(/class="a-price-whole">([\d.,]+)/i);
        if (priceMatch) price = priceMatch[1];
    }

    if (price) {
        price = price.replace(/[^\d.,]/g, '').replace(',', '.');
        if (price.split('.').length > 2) {
            const parts = price.split('.');
            const cents = parts.pop();
            price = parts.join('') + '.' + cents;
        }
    }

    return { title, image, price };
}

Deno.serve(async (req: Request) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { url, userId } = await req.json();
        if (!url) throw new Error('URL is required');

        console.log(`Fetching metadata for: ${url} (User: ${userId || 'anonymous'})`);

        let finalUrl = url;
        let apiTitle: string | null = null;
        let apiPrice: string | null = null;
        let apiImage: string | null = null;

        // --- SHOPEE ID EXTRACTION ---
        if (url.includes('shopee.com.br')) {
            const match = url.match(/product\/(\d+)\/(\d+)/i) || url.match(/-i\.(\d+)\.(\d+)/i);
            if (match && userId) {
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
                            const shortLink = await convertToShortLink(appId, secret, rawProductUrl);
                            if (shortLink) {
                                finalUrl = shortLink;
                            } else {
                                const trackingId = appId.startsWith('an_') ? appId : `an_${appId}`;
                                finalUrl = `${rawProductUrl}?utm_source=${trackingId}&mmp_pid=${trackingId}&utm_medium=affiliates`;
                            }
                        }
                    }
                } catch (apiErr: any) {
                    console.error('Shopee API Error:', apiErr.message);
                }
            }
        }

        // --- MERCADO LIVRE: HANDLE SOCIAL PROFILE PAGES ---
        // meli.la links always redirect to /social/ profile pages, NOT product pages.
        // We must fetch the social page and find the real product link inside it.
        if (finalUrl.includes('meli.la') || finalUrl.includes('/social/')) {
            console.log('ML Social Profile detected, fetching social page to find product link...');
            try {
                const { html: socialHtml, finalUrl: socialFinalUrl } = await fetchPage(finalUrl);
                finalUrl = socialFinalUrl; // Update to the redirected URL

                console.log('Social page final URL:', socialFinalUrl);

                // Strategy 1: Find the "Ir para produto" link
                const productLinkMatch =
                    socialHtml.match(/href="(https?:\/\/produto\.mercadolivre\.com\.br\/[^"]+)"/i) ||
                    socialHtml.match(/href="(https?:\/\/[^"]*mercadolivre[^"]*\/MLB[^"]+)"/i) ||
                    socialHtml.match(/href="([^"]+)"[^>]*>\s*Ir para produto/i) ||
                    socialHtml.match(/poly-component__link--action-link[^>]*href="([^"]+)"/i);

                if (productLinkMatch) {
                    const realProductUrl = productLinkMatch[1].split('?')[0]; // Clean tracking params
                    console.log('Found real product URL:', realProductUrl);

                    // Now fetch the REAL product page to get proper metadata
                    const { html: productHtml, finalUrl: productFinalUrl } = await fetchPage(realProductUrl);
                    const productData = extractProductData(productHtml);

                    console.log('Product data extracted:', { title: productData.title, price: productData.price, hasImage: !!productData.image });

                    return new Response(
                        JSON.stringify({
                            title: decodeHtmlEntities(productData.title) || 'Produto sem título',
                            image: productData.image || '',
                            price: productData.price ? parseFloat(productData.price) : null,
                            platform: 'Mercado Livre',
                            finalUrl: url, // Keep the ORIGINAL meli.la link as the affiliate link
                        }),
                        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                    );
                }

                // Strategy 2: Extract product data directly from the social page HTML
                console.log('No product link found, trying to extract from social page directly...');
                const socialTitle = socialHtml.match(/class="[^"]*poly-component__title[^"]*"[^>]*>([^<]+)</i) ||
                    socialHtml.match(/class="[^"]*poly-card__title[^"]*"[^>]*>([^<]+)</i);
                const socialPrice = socialHtml.match(/class="[^"]*poly-price__current[^"]*"[^>]*>\s*\$?\s*([\d.,]+)/i) ||
                    socialHtml.match(/class="[^"]*andes-money-amount__fraction[^"]*">([\d.]+)/i);
                const socialImage = socialHtml.match(/class="[^"]*poly-component__picture[^"]*"[^>]*src="([^"]+)"/i) ||
                    socialHtml.match(/<img[^>]+class="[^"]*poly[^"]*"[^>]*src="([^"]+)"/i) ||
                    getMeta(socialHtml, 'og:image');

                if (socialTitle) {
                    return new Response(
                        JSON.stringify({
                            title: decodeHtmlEntities(socialTitle[1].trim()),
                            image: typeof socialImage === 'string' ? socialImage : (socialImage ? socialImage[1] : ''),
                            price: socialPrice ? parseFloat(socialPrice[1].replace(',', '.')) : null,
                            platform: 'Mercado Livre',
                            finalUrl: url,
                        }),
                        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                    );
                }

            } catch (socialErr: any) {
                console.error('ML Social extraction failed:', socialErr.message);
                // Fall through to generic scraping
            }
        }

        // --- GENERIC SCRAPING (for Amazon, direct ML links, etc.) ---
        const { html, finalUrl: scrapedFinalUrl } = await fetchPage(finalUrl);
        finalUrl = scrapedFinalUrl;

        const productData = extractProductData(html);
        let { title, image, price } = productData;

        // Use API data if available (for Shopee)
        title = apiTitle || title;
        image = apiImage || image;
        price = apiPrice || price;

        let platform = 'Other';
        const combined = (url + ' ' + finalUrl).toLowerCase();
        if (combined.includes('shopee')) platform = 'Shopee';
        else if (combined.includes('amazon') || combined.includes('amzn')) platform = 'Amazon';
        else if (combined.includes('mercadolivre') || combined.includes('mlb-') || combined.includes('meli.la')) platform = 'Mercado Livre';

        return new Response(
            JSON.stringify({
                title: decodeHtmlEntities(title) || 'Produto sem título',
                image: image || '',
                price: price ? parseFloat(price) : null,
                platform,
                finalUrl: (platform === 'Mercado Livre' || platform === 'Amazon') ? url : finalUrl,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    } catch (error: any) {
        console.error('Edge Function Error:', error.message);
        return new Response(JSON.stringify({ error: error.message }), { headers: corsHeaders, status: 400 });
    }
});

function decodeHtmlEntities(text: string) {
    if (!text) return text;
    return text.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n)))
        .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
}
