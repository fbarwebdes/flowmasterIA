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

        let finalUrl = url; // Initialize here to use later
        console.log(`Fetching metadata for: ${url} (User: ${userId || 'anonymous'})`);

        // --- SHOPEE ID EXTRACTION ---
        let shopeeIds = null;
        if (url.includes('shopee.com.br')) {
            const p1 = url.match(/product\/(\d+)\/(\d+)/i);
            if (p1) shopeeIds = { shopId: p1[1], itemId: p1[2] };
            else {
                const p2 = url.match(/-i\.(\d+)\.(\d+)/i);
                if (p2) shopeeIds = { shopId: p2[1], itemId: p2[2] };
            }
        }

        let apiTitle = null;
        let apiPrice = null;
        let apiImage = null;

        // --- TRY SHOPEE API IF CREDENTIALS EXIST ---
        if (shopeeIds && userId) {
            try {
                const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
                const { data: row } = await supabase.from('app_settings').select('settings').eq('user_id', userId).single();
                const shopeeConfig = row?.settings?.integrations?.find(i => i.id === 'shopee');
                const appId = shopeeConfig?.credentials?.partnerId;
                const secret = shopeeConfig?.credentials?.apiKey;

                if (appId && secret && shopeeConfig.isEnabled) {
                    // 1. Fetch metadata (price, title, image)
                    const productPayload = JSON.stringify({
                        query: `query { productOfferV2(itemId: \"${shopeeIds.itemId}\", shopId: \"${shopeeIds.shopId}\") { nodes { productName, price, priceMin, priceMax, imageUrl } } }`
                    });

                    const resJson = await callShopeeGraphQL(appId, secret, productPayload);
                    const node = resJson.data?.productOfferV2?.nodes?.[0];
                    if (node) {
                        apiTitle = node.productName;
                        // Scale-Aware price extraction:
                        // Shopee API often returns prices multiplied by 100,000 (e.g. 10.50 -> 1050000).
                        let rawPrice = node.price || node.priceMin || node.priceMax || 0;
                        let finalPrice = Number(rawPrice);
                        // Raise threshold to 30000 to allow high-value items (R$ 9k+)
                        if (finalPrice > 30000) {
                            finalPrice = finalPrice / 100000;
                        }
                        apiPrice = String(finalPrice);
                        apiImage = node.imageUrl;
                        console.log(`Shopee API Hit: price=${apiPrice}`);

                        // 2. Generate tracked short link
                        const rawProductUrl = `https://shopee.com.br/product/${shopeeIds.shopId}/${shopeeIds.itemId}`;
                        const shortLink = await convertToShortLink(appId, secret, rawProductUrl);
                        if (shortLink) {
                            finalUrl = shortLink;
                            console.log(`Shopee Short Link Generated for Manual Import: ${shortLink}`);
                        } else {
                            // Fallback: use standard Shopee UTM parameters if short link fails
                            const trackingId = appId.startsWith('an_') ? appId : `an_${appId}`;
                            finalUrl = `${rawProductUrl}?utm_source=${trackingId}&mmp_pid=${trackingId}&utm_medium=affiliates`;
                        }
                    }
                }
            } catch (apiErr: any) {
                console.error('Shopee API Error:', apiErr.message);
            }
        }

        // --- SEARCH FOR MERCADO LIVRE SOCIAL LINK ---
        // If the URL is a meli.la or social profile, we need to find the "Ir para produto" link
        if (url.includes('meli.la') || url.includes('mercadolivre.com.br/social/')) {
            console.log('Detected Mercado Livre Social/Short link, fetching redirect...');
            const socialRes = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_8 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1',
                },
                redirect: 'follow',
            });
            const socialHtml = await socialRes.text();
            // Look for the "Ir para produto" link
            const match = socialHtml.match(/class="[^"]*poly-component__link--action-link[^"]*"[^>]*href="([^"]+)"/i) ||
                socialHtml.match(/href="([^"]+)"[^>]*class="[^"]*poly-component__link--action-link/i);
            if (match && match[1]) {
                const realUrl = match[1].split('?')[0]; // Clean up tracking if possible
                console.log(`Found real product URL: ${realUrl}`);
                finalUrl = realUrl;
            }
        }

        const response = await fetch(finalUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_8 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
            },
            redirect: 'follow',
        });

        if (response.status === 403) {
            throw new Error('O Mercado Livre bloqueou o acesso automático (Erro 403). Tente usar o link direto do produto ou preenchimento manual.');
        }

        finalUrl = response.url || finalUrl;
        const html = await response.text();

        // --- CHECK FOR AMAZON CAPTCHA / ANTI-BOT ---
        if (html.includes('api-services-support@amazon.com') ||
            html.includes('To discuss automated access to Amazon data please contact') ||
            html.includes('Type the characters you see in this image') ||
            html.includes('Digite os caracteres que você vê na imagem abaixo')) {
            throw new Error('Anti-bot da Amazon bloqueou a extração. Tente novamente ou use inserção manual.');
        }

        const getMeta = (prop: string): string | null => {
            const r1 = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i');
            const m1 = html.match(r1);
            if (m1) return m1[1];
            const r2 = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`, 'i');
            const m2 = html.match(r2);
            if (m2) return m2[1];
            return null;
        };

        let title = apiTitle || getMeta('og:title') || getMeta('twitter:title') || getMeta('title') || '';

        // --- SELECTOR FALLBACKS (Mercado Livre & others) ---
        if (!title || title.length < 5) {
            // Try common title classes
            const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
            if (h1Match) title = h1Match[1].replace(/<[^>]+>/g, '').trim();
        }

        if (!title || title.length < 5) {
            const tag = html.match(/<title[^>]*>([^<]+)<\/title>/i);
            if (tag) title = tag[1].trim()
                .replace(/\s*[-|:]\s*Amazon\.com.*$/i, '')
                .replace(/\s*[-|:]\s*Mercado Livre.*$/i, '')
                .replace(/\s*[-|:]\s*Shopee.*$/i, '')
                .trim();
        }

        let image = apiImage || getMeta('og:image') || getMeta('twitter:image') || '';
        if (!image) {
            const match = html.match(/(https:\/\/m\.media-amazon\.com\/images\/I\/[A-Za-z0-9._%-]+\.(?:jpg|png|webp))/i);
            if (match) image = match[1];
        }

        let jsonLdPrice = null;
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
                    if (p) { jsonLdPrice = String(p); break; }
                }
            }
        } catch { }

        let price: string | null = apiPrice || jsonLdPrice || getMeta('product:price:amount') || getMeta('og:price:amount') || null;

        // Enhanced Mercado Livre NORDIC_RENDERING_CTX fallback
        if (!price || price === '0' || price === '0.00') {
            const mlMatch = html.match(/"current_price"\s*:\s*\{\s*"value"\s*:\s*([\d.]+)/i);
            if (mlMatch) {
                price = mlMatch[1];
            }
        }

        // Enhanced Shopee/Generic fallback: detect the SMALLEST price in the page if range exists
        if (!price || price === '0' || price === '0.00') {
            const priceRegex = /R\$\s?([\d.]+,\d{1,2})/gi;
            const matches = [...html.matchAll(priceRegex)];
            if (matches.length > 0) {
                // Convert all to numbers and pick the minimum
                const prices = matches.map(m => {
                    const cleaned = m[1].replace(/\./g, '').replace(',', '.');
                    return parseFloat(cleaned);
                });
                const minPrice = Math.min(...prices.filter(p => !isNaN(p) && p > 0));
                if (minPrice !== Infinity) price = String(minPrice);
            }
        }

        if (price && typeof price === 'string') {
            price = price.replace(/[^\d.,]/g, '').replace(',', '.');
            if (price.split('.').length > 2) {
                const parts = price.split('.');
                const cents = parts?.pop() || '';
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
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), { headers: corsHeaders, status: 400 });
    }
})

function decodeHtmlEntities(text: string) {
    if (!text) return text;
    return text.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n)))
        .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
}
