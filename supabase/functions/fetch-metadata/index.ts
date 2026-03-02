// @ts-nocheck - This file runs in Deno (Supabase Edge Functions), not Node.js
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

const BROWSER_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
};

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

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        const { url, userId } = await req.json();
        if (!url) throw new Error('URL is required');

        console.log(`[fetch-metadata] URL: ${url} | User: ${userId || 'anon'}`);

        let apiTitle: string | null = null;
        let apiPrice: string | null = null;
        let apiImage: string | null = null;
        let shopeeShortLink: string | null = null;

        // --- SHOPEE API EXTRACTION ---
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

        // --- STEP 1: Fetch the URL (follow redirects) ---
        const response = await fetch(url, { headers: BROWSER_HEADERS, redirect: 'follow' });
        let finalUrl = response.url || url;
        let html = await response.text();

        console.log(`[fetch-metadata] Final URL after redirect: ${finalUrl}`);

        // --- STEP 2: If landed on ML Social Profile, find the real product link ---
        if (finalUrl.includes('/social/') || finalUrl.includes('mercadolivre.com.br/social')) {
            console.log('[fetch-metadata] ML Social Profile detected. Extracting product link...');

            // Try multiple patterns to find the product link
            const productLinkMatch =
                html.match(/href="(https?:\/\/produto\.mercadolivre\.com\.br\/[^"]+)"/i) ||
                html.match(/href="(https?:\/\/[^"]*mercadolivre\.com\.br\/MLB[^"]+)"/i) ||
                html.match(/href="([^"]+)"[^>]*>\s*Ir para produto\s*<\/a>/i) ||
                html.match(/href="([^"]+MLB[^"]+)"/i);

            if (productLinkMatch) {
                const realProductUrl = productLinkMatch[1].split('?')[0];
                console.log(`[fetch-metadata] Found product URL: ${realProductUrl}`);

                // Fetch the REAL product page
                try {
                    const productResponse = await fetch(realProductUrl, { headers: BROWSER_HEADERS, redirect: 'follow' });
                    finalUrl = productResponse.url || realProductUrl;
                    html = await productResponse.text();
                    console.log(`[fetch-metadata] Product page fetched successfully (${html.length} bytes)`);
                } catch (e) {
                    console.error('[fetch-metadata] Failed to fetch product page:', e);
                }
            } else {
                console.log('[fetch-metadata] No product link found in social page. Trying to extract from social page directly...');
                // Try to extract from the social page's __PRELOADED_STATE__ or similar JS data
                const preloadedMatch = html.match(/__PRELOADED_STATE__\s*=\s*({[\s\S]*?});\s*<\/script>/i);
                if (preloadedMatch) {
                    try {
                        const state = JSON.parse(preloadedMatch[1]);
                        console.log('[fetch-metadata] Found __PRELOADED_STATE__');
                    } catch { }
                }
            }
        }

        // --- STEP 3: Extract metadata from the HTML ---
        const getMeta = (prop: string): string | null => {
            const r1 = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i');
            const m1 = html.match(r1);
            if (m1) return m1[1];
            const r2 = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`, 'i');
            const m2 = html.match(r2);
            return m2 ? m2[1] : null;
        };

        let title = apiTitle || getMeta('og:title') || getMeta('twitter:title') || getMeta('title') || '';
        if (!title || title.length < 5) {
            const tag = html.match(/<title[^>]*>([^<]+)<\/title>/i);
            if (tag) title = tag[1].trim();
        }
        // Special ML title extraction from the page content
        if (!title || title.includes('Perfil Social') || title.includes('Perfil social') || title.length < 5) {
            const h1 = html.match(/<h1[^>]*class="[^"]*ui-pdp-title[^"]*"[^>]*>([^<]+)<\/h1>/i) ||
                html.match(/<h1[^>]*>([^<]{10,})<\/h1>/i);
            if (h1) title = h1[1].trim();
        }
        // Clean title
        title = title.replace(/\s*[-|:]\s*(Amazon|Mercado Livre|Shopee|Meli|Aliexpress|Perfil Social|Perfil social).*$/i, '').trim();

        let image = apiImage || getMeta('og:image') || getMeta('twitter:image') || '';
        // Amazon image fallback
        if (!image) {
            const amzImg = html.match(/(https:\/\/m\.media-amazon\.com\/images\/I\/[A-Za-z0-9._%-]+\.(?:jpg|png|webp))/i);
            if (amzImg) image = amzImg[1];
        }

        // --- STEP 4: Extract price (multiple strategies) ---
        // Strategy A: JSON-LD structured data (most reliable)
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

        // Strategy B: Meta tags
        let price: string | null = apiPrice || jsonLdPrice || getMeta('product:price:amount') || getMeta('og:price:amount') || null;

        // Strategy C: Mercado Livre NORDIC_RENDERING_CTX
        if (!price || price === '0' || price === '0.00') {
            const mlMatch = html.match(/"current_price"\s*:\s*\{\s*"value"\s*:\s*([\d.]+)/i);
            if (mlMatch) price = mlMatch[1];
        }

        // Strategy D: Generic R$ price pattern (smallest price on page)
        if (!price || price === '0' || price === '0.00') {
            const priceRegex = /R\$\s?([\d.]+,\d{1,2})/gi;
            const matches = [...html.matchAll(priceRegex)];
            if (matches.length > 0) {
                const prices = matches.map(m => {
                    const cleaned = m[1].replace(/\./g, '').replace(',', '.');
                    return parseFloat(cleaned);
                }).filter(p => !isNaN(p) && p > 0);
                if (prices.length > 0) price = String(Math.min(...prices));
            }
        }

        // Normalize price
        if (price && typeof price === 'string') {
            price = price.replace(/[^\d.,]/g, '').replace(',', '.');
            if (price.split('.').length > 2) {
                const parts = price.split('.');
                const cents = parts.pop() || '';
                price = parts.join('') + '.' + cents;
            }
        }

        // --- STEP 5: Detect platform ---
        let platform = 'Other';
        const combined = (url + ' ' + finalUrl).toLowerCase();
        if (combined.includes('shopee')) platform = 'Shopee';
        else if (combined.includes('amazon') || combined.includes('amzn')) platform = 'Amazon';
        else if (combined.includes('mercadolivre') || combined.includes('mlb-') || combined.includes('meli.la')) platform = 'Mercado Livre';

        // For Shopee, use the short link; for ML/Amazon, keep the original affiliate link
        let linkForResponse = finalUrl;
        if (shopeeShortLink) linkForResponse = shopeeShortLink;
        else if (platform === 'Mercado Livre' || platform === 'Amazon') linkForResponse = url; // Keep original meli.la / amzn link

        console.log(`[fetch-metadata] Result: title="${title?.substring(0, 50)}" price=${price} platform=${platform} image=${image ? 'YES' : 'NO'}`);

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

function decodeHtmlEntities(text: string) {
    if (!text) return text;
    return text.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n)))
        .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
}
