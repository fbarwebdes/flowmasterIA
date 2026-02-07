// @ts-nocheck - This file runs in Deno (Supabase Edge Functions), not Node.js
import { serve } from "std/http/server.ts"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
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

        // Fetch page HTML
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to load page: ${response.statusText}`);
        }

        const html = await response.text();

        // extract metadata using regex (faster than DOM parser for edge)
        const getMeta = (prop: string) => {
            const regex = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i');
            const match = html.match(regex);
            return match ? match[1] : null;
        };

        const title = getMeta('og:title') || getMeta('twitter:title') || getMeta('title') || '';
        const image = getMeta('og:image') || getMeta('twitter:image') || '';
        let price = getMeta('product:price:amount') || getMeta('og:price:amount');

        // fallback price extraction (naive regex for "R$ 100,00" or "$100.00")
        if (!price) {
            const priceRegex = /R\$\s?(\d+[.,]?\d*)/i;
            const match = html.match(priceRegex);
            if (match) {
                price = match[1].replace('.', '').replace(',', '.'); // normalize to 100.00
            }
        }

        // Determine platform from URL
        let platform = 'Other';
        const lowerUrl = url.toLowerCase();
        if (lowerUrl.includes('shopee')) platform = 'Shopee';
        if (lowerUrl.includes('amazon')) platform = 'Amazon';
        if (lowerUrl.includes('mercadolivre')) platform = 'Mercado Livre';
        if (lowerUrl.includes('aliexpress')) platform = 'AliExpress';

        return new Response(
            JSON.stringify({
                title: decodeHtmlEntities(title),
                image,
                price: price ? parseFloat(price) : null,
                platform
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
    } catch (error: any) {
        return new Response(
            JSON.stringify({ error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
        )
    }
})

function decodeHtmlEntities(text: string) {
    if (!text) return text;
    return text.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#x27;/g, "'");
}
