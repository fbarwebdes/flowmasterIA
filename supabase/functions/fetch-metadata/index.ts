// @ts-nocheck - This file runs in Deno (Supabase Edge Functions), not Node.js
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
    // Handle CORS
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { url } = await req.json()

        if (!url) {
            throw new Error('URL is required')
        }

        // validate URL
        try {
            new URL(url);
        } catch {
            throw new Error('Invalid URL provided');
        }

        console.log(`Fetching metadata for: ${url}`);

        // Fetch page HTML with redirect following and realistic browser User-Agent
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
            },
            redirect: 'follow',
        });

        // Get the final URL after redirects (e.g., amzn.to -> amazon.com.br)
        const finalUrl = response.url || url;
        console.log(`Final URL after redirect: ${finalUrl}`);

        if (!response.ok) {
            throw new Error(`Failed to load page: ${response.status} ${response.statusText}`);
        }

        const html = await response.text();

        // Extract meta content - handles both attribute orderings:
        // <meta property="og:title" content="...">
        // <meta content="..." property="og:title">
        const getMeta = (prop: string): string | null => {
            // Pattern 1: property/name first, content second
            const regex1 = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i');
            const m1 = html.match(regex1);
            if (m1) return m1[1];

            // Pattern 2: content first, property/name second
            const regex2 = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`, 'i');
            const m2 = html.match(regex2);
            if (m2) return m2[1];

            return null;
        };

        // --- TITLE ---
        let title = getMeta('og:title') || getMeta('twitter:title') || getMeta('title') || '';

        // Amazon-specific title extraction via <title> tag or #productTitle
        if (!title || title === 'Produto sem título') {
            // Try <title> tag
            const titleTag = html.match(/<title[^>]*>([^<]+)<\/title>/i);
            if (titleTag) {
                title = titleTag[1].trim();
                // Clean Amazon title suffixes
                title = title.replace(/\s*[-|:]\s*Amazon\.com\.br.*$/i, '').trim();
                title = title.replace(/\s*[-|:]\s*Amazon\.com.*$/i, '').trim();
                title = title.replace(/\s*[-|:]\s*Mercado Livre.*$/i, '').trim();
            }
        }

        // Amazon-specific: extract from productTitle span
        if (!title || title.length < 5) {
            const productTitle = html.match(/id=["']productTitle["'][^>]*>\s*([^<]+)/i);
            if (productTitle) {
                title = productTitle[1].trim();
            }
        }

        // --- IMAGE ---
        let image = getMeta('og:image') || getMeta('twitter:image') || '';

        // Amazon-specific image extraction
        if (!image) {
            // Try data-a-dynamic-image (JSON with image URLs)
            const dynamicImg = html.match(/data-a-dynamic-image=["']\{["']([^"']+)["']/i);
            if (dynamicImg) {
                image = dynamicImg[1];
            }
        }
        if (!image) {
            // Try landingImage id
            const landingImg = html.match(/id=["']landingImage["'][^>]+src=["']([^"']+)["']/i);
            if (landingImg) {
                image = landingImg[1];
            }
        }
        if (!image) {
            // Try imgBlkFront id
            const imgBlk = html.match(/id=["']imgBlkFront["'][^>]+src=["']([^"']+)["']/i);
            if (imgBlk) {
                image = imgBlk[1];
            }
        }

        // --- PRICE ---
        let price = getMeta('product:price:amount') || getMeta('og:price:amount');

        // Amazon-specific price extraction
        if (!price) {
            // Try a-price-whole + a-price-fraction
            const priceWhole = html.match(/class=["']a-price-whole["'][^>]*>(\d[\d.]*)/i);
            const priceFraction = html.match(/class=["']a-price-fraction["'][^>]*>(\d+)/i);
            if (priceWhole) {
                const whole = priceWhole[1].replace('.', '');
                const fraction = priceFraction ? priceFraction[1] : '00';
                price = `${whole}.${fraction}`;
            }
        }

        // Mercado Livre specific price (price-tag-fraction)
        if (!price) {
            const mlPrice = html.match(/class=["'][^"']*price-tag-fraction[^"']*["'][^>]*>(\d[\d.]*)/i);
            if (mlPrice) {
                price = mlPrice[1].replace('.', '');
                const mlCents = html.match(/class=["'][^"']*price-tag-cents[^"']*["'][^>]*>(\d+)/i);
                if (mlCents) {
                    price = `${price}.${mlCents[1]}`;
                }
            }
        }

        // Generic fallback price: "R$ 100,00" or "R$ 1.299,00"
        if (!price) {
            const priceRegex = /R\$\s?([\d.]+,\d{2})/i;
            const match = html.match(priceRegex);
            if (match) {
                price = match[1].replace('.', '').replace(',', '.');
            }
        }

        // --- PLATFORM ---
        let platform = 'Other';
        const combinedUrl = (url + ' ' + finalUrl).toLowerCase();
        if (combinedUrl.includes('shopee')) platform = 'Shopee';
        else if (combinedUrl.includes('amazon') || combinedUrl.includes('amzn.to') || combinedUrl.includes('amzn.com')) platform = 'Amazon';
        else if (combinedUrl.includes('mercadolivre') || combinedUrl.includes('mercadolibre') || combinedUrl.includes('mlb-')) platform = 'Mercado Livre';
        else if (combinedUrl.includes('aliexpress')) platform = 'AliExpress';
        else if (combinedUrl.includes('magazineluiza') || combinedUrl.includes('magalu')) platform = 'Magazine Luiza';

        console.log(`Extracted: title="${title?.substring(0, 60)}", price=${price}, image=${image ? 'yes' : 'no'}, platform=${platform}`);

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
        console.error('fetch-metadata error:', error.message);
        return new Response(
            JSON.stringify({ error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
        )
    }
})

function decodeHtmlEntities(text: string) {
    if (!text) return text;
    return text
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&#x27;/g, "'")
        .replace(/&#39;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n)))
        .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
}
