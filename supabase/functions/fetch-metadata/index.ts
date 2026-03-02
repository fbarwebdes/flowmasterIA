// @ts-nocheck - This file runs in Deno (Supabase Edge Functions), not Node.js
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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

        console.log(`Fetching metadata for: ${url} (User: ${userId || 'anonymous'})`);

        let finalUrl = url;
        let apiTitle = null;
        let apiPrice = null;
        let apiImage = null;

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

        // --- MERCADO LIVRE SOCIAL PROFILE HANDLING ---
        if (finalUrl.includes('meli.la') || finalUrl.includes('mercadolivre.com.br/social/')) {
            try {
                const socialRes = await fetch(finalUrl, {
                    headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_8 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1' }
                });
                const socialHtml = await socialRes.text();
                const matchLink = socialHtml.match(/href="([^"]+)"[^>]*>Ir para produto<\/a>/i) ||
                    socialHtml.match(/class="[^"]*poly-component__link--action-link[^"]*"[^>]*href="([^"]+)"/i);
                if (matchLink) {
                    finalUrl = matchLink[1].split('?')[0];
                    console.log('Redirecting to real ML product URL:', finalUrl);
                }
            } catch (e) {
                console.warn('ML Social redirect failed');
            }
        }

        // --- GENERIC SCRAPING ---
        const response = await fetch(finalUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
            },
            redirect: 'follow',
        });

        finalUrl = response.url || finalUrl;
        const html = await response.text();

        // Helper to extract meta tags
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
            const tag = html.match(/<title[^>]*>([^<]+)<\/title>/i) || html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
            if (tag) title = tag[1].trim();
        }

        // Clean title
        title = title.replace(/\s*[-|:]\s*(Amazon|Mercado Livre|Shopee|Meli|Aliexpress).*$/i, '').trim();

        let image = apiImage || getMeta('og:image') || getMeta('twitter:image') || '';
        let price = apiPrice || getMeta('product:price:amount') || getMeta('og:price:amount') || null;

        // Specialized price parsing for ML and Amazon
        if (!price || price === '0' || price === '0.00') {
            // ML selectors
            const mlMatch = html.match(/"current_price"\s*:\s*\{\s*"value"\s*:\s*([\d.]+)/i) ||
                html.match(/class="andes-visual-price__amount">([\d.,]+)<\/span>/i) ||
                html.match(/itemprop="price" content="([\d.,]+)"/i);
            if (mlMatch) price = mlMatch[1];

            // Amazon selectors
            if (!price) {
                const amzMatch = html.match(/id="priceblock_ourprice"[^>]*>R\$\s*([\d.,]+)/i) ||
                    html.match(/id="priceblock_dealprice"[^>]*>R\$\s*([\d.,]+)/i) ||
                    html.match(/class="a-offscreen">R\$\s*([\d.,]+)/i);
                if (amzMatch) price = amzMatch[1];
            }
        }

        if (price) {
            price = price.replace(/[^\d.,]/g, '').replace(',', '.');
            if (price.split('.').length > 2) {
                const parts = price.split('.');
                const cents = parts.pop();
                price = parts.join('') + '.' + cents;
            }
        }

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
                finalUrl,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), { headers: corsHeaders, status: 400 });
    }
});

function decodeHtmlEntities(text: string) {
    if (!text) return text;
    return text.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n)))
        .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
}
