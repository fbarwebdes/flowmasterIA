// @ts-nocheck - This file runs in Deno (Supabase Edge Functions), not Node.js
import { serve } from "std/http/server.ts"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { image } = await req.json()

        if (!image) {
            throw new Error('Image data is required')
        }

        const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')
        if (!GEMINI_API_KEY) {
            return new Response(JSON.stringify({ error: 'GEMINI_API_KEY not configured in Supabase Secrets' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 500,
            })
        }

        // Call Google Gemini API (gemini-1.5-flash)
        // IMPORTANT: The image comes as "data:image/jpeg;base64,....."
        // We need to extract just the base64 part.
        const base64Data = image.split(',')[1];

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: "Analyze this product image. Extract the product Title and Price (in BRL/Real). Return ONLY a valid JSON object with keys 'title' (string) and 'price' (number). Do not wrap in markdown code blocks." },
                        {
                            inline_data: {
                                mime_type: "image/jpeg",
                                data: base64Data
                            }
                        }
                    ]
                }]
            }),
        })

        const data = await response.json()

        if (data.error) {
            console.error('Gemini Error:', data.error);
            throw new Error('Failed to analyze image with AI');
        }

        // Gemini response structure
        const content = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!content) {
            throw new Error('AI returned empty response');
        }

        let result;
        try {
            // Strip markdown if present
            const cleanJson = content.replace(/```json\n?|```/g, '').trim();
            result = JSON.parse(cleanJson);
        } catch (e) {
            console.error('JSON Parse Error:', content);
            throw new Error('AI returned invalid JSON format');
        }

        return new Response(
            JSON.stringify(result),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )

    } catch (error: any) {
        return new Response(
            JSON.stringify({ error: error.message || 'Unknown error' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
        )
    }
})
