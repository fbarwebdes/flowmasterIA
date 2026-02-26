// @ts-ignore - Deno JSR import for Supabase Edge Functions
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Shopee Affiliate API - GraphQL Implementation
// Documentation: https://affiliate.shopee.com.br/open_api

declare const Deno: {
    serve: (handler: (req: Request) => Promise<Response>) => void;
};

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Generate SHA256 signature for Shopee Affiliate API
// Format: SHA256(AppId + Timestamp + Payload + Secret)
async function generateSignature(
    appId: string,
    timestamp: number,
    payload: string,
    secret: string
): Promise<string> {
    const baseString = `${appId}${timestamp}${payload}${secret}`;
    const encoder = new TextEncoder();
    const msgData = encoder.encode(baseString);

    const hashBuffer = await crypto.subtle.digest("SHA-256", msgData);
    return Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
}

// GraphQL query to get product offers with affiliate links
function getProductOfferListQuery(keyword: string, limit: number) {
    return JSON.stringify({
        query: `
      query ProductOfferV2($keyword: String, $limit: Int, $sortType: Int) {
        productOfferV2(
          listType: 0
          sortType: $sortType
          limit: $limit
          keyword: $keyword
        ) {
          nodes {
            itemId
            shopId
            commissionRate
            productName
            price
            priceMin
            priceMax
            sales
            imageUrl
            shopName
            shopType
            productLink
            ratingStar
          }
          pageInfo {
            page
            limit
            hasNextPage
          }
        }
      }
    `,
        variables: {
            keyword: keyword,
            limit: limit,
            sortType: 1 // Sort by sales
        }
    });
}

// GraphQL mutation to convert a raw Shopee URL into a tracked affiliate short link
function getGenerateShortLinkMutation(originUrl: string, subId: string = '') {
    return JSON.stringify({
        query: `
      mutation GenerateShortLink($input: GenerateShortLinkInput!) {
        generateShortLink(input: $input) {
          shortLink
        }
      }
    `,
        variables: {
            input: {
                originUrl: originUrl,
                subId: subId
            }
        }
    });
}

// Call Shopee Affiliate GraphQL API
async function callShopeeGraphQL(
    appId: string,
    appSecret: string,
    payload: string
): Promise<any> {
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = await generateSignature(appId, timestamp, payload, appSecret);

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

// Create direct product URL with affiliate ID (fallback when short link generation fails)
function createDirectProductUrl(
    productName: string,
    shopId: string | number,
    itemId: string | number,
    affiliateId: string
): string {
    return `https://shopee.com.br/product/${shopId}/${itemId}?af_id=${affiliateId}`;
}

// Create a search link as fallback for demo products
function createReliableSearchLink(keyword: string, affiliateId: string): string {
    const encoded = encodeURIComponent(keyword);
    return `https://shopee.com.br/search?keyword=${encoded}&sortBy=sales&af_id=${affiliateId}`;
}

// Convert a raw Shopee URL into a proper short affiliate link
async function convertToShortLink(
    appId: string,
    appSecret: string,
    originUrl: string
): Promise<string | null> {
    try {
        const payload = getGenerateShortLinkMutation(originUrl);
        const result = await callShopeeGraphQL(appId, appSecret, payload);
        const shortLink = result?.data?.generateShortLink?.shortLink;
        if (shortLink) {
            console.log(`Short link generated: ${originUrl} -> ${shortLink}`);
            return shortLink;
        }
        console.warn('generateShortLink returned no shortLink:', JSON.stringify(result));
        return null;
    } catch (e) {
        console.error('Error generating short link:', e);
        return null;
    }
}

interface ShopeeProduct {
    itemId: string;
    shopId: string;
    productName: string;
    priceMin: number;
    priceMax: number;
    imageUrl: string;
    shopName: string;
    commissionRate: number;
    productLink: string;
    sales: number;
}

Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const { appId, appSecret, keyword, limit = 50 } = await req.json();

        if (!appId || !appSecret) {
            // Return fallback immediately if no credentials
            const demoProducts = generateReliableDemoProducts(appId || "no_id");
            return new Response(
                JSON.stringify({
                    products: demoProducts,
                    warning: "Credenciais de API não fornecidas. Mostrando produtos de exemplo.",
                    source: "demo_missing_creds"
                }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        console.log("Shopee Affiliate API - Fetching products for keyword:", keyword || "popular");

        const productQuery = getProductOfferListQuery(keyword || "", Math.min(limit, 50));
        const productResponse = await callShopeeGraphQL(appId, appSecret, productQuery);

        if (productResponse.data?.productOfferV2?.nodes?.length > 0) {
            const shopeeProducts: ShopeeProduct[] = productResponse.data.productOfferV2.nodes;

            // Step 1: Build raw product list with direct URLs as fallback
            const productsWithRawLinks = shopeeProducts.map((product: any) => {
                // Build a clean raw URL for this product to convert via generateShortLink
                const rawProductUrl = `https://shopee.com.br/product/${product.shopId}/${product.itemId}`;

                // Scale-Aware price extraction:
                // Shopee API often returns prices multiplied by 100,000 (e.g. 10.50 -> 1050000).
                // However, sometimes it returns decimals. We check the magnitude.
                let rawPrice = product.price || product.priceMin || product.priceMax || 0;
                let finalPrice = rawPrice;

                if (rawPrice > 1000) {
                    finalPrice = rawPrice / 100000;
                }

                return {
                    item_id: product.itemId,
                    shop_id: product.shopId,
                    item_name: product.productName,
                    item_price: finalPrice,
                    item_image: product.imageUrl,
                    product_link: rawProductUrl, // Will be replaced by short link
                    shop_name: product.shopName,
                    commission_rate: product.commissionRate,
                    sales: product.sales,
                };
            });

            // Step 2: Convert all URLs to tracked short links via generateShortLink
            console.log(`Converting ${productsWithRawLinks.length} product links to short affiliate links...`);
            const shortLinkPromises = productsWithRawLinks.map(async (product) => {
                const shortLink = await convertToShortLink(appId, appSecret, product.product_link);
                if (shortLink) {
                    product.product_link = shortLink;
                } else {
                    // Fallback: append af_id if short link fails
                    product.product_link = `${product.product_link}?af_id=${appId}`;
                }
                return product;
            });

            const productsWithShortLinks = await Promise.all(shortLinkPromises);
            console.log(`Short link conversion complete. ${productsWithShortLinks.filter(p => p.product_link.includes('s.shopee')).length}/${productsWithShortLinks.length} converted successfully.`);

            return new Response(
                JSON.stringify({
                    products: productsWithShortLinks,
                    total: productsWithShortLinks.length,
                    source: "shopee_affiliate_api"
                }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Fallback: API failed or returned empty
        console.log("No API results, using reliable demo products");
        const demoProducts = generateReliableDemoProducts(appId);

        return new Response(
            JSON.stringify({
                products: demoProducts,
                warning: productResponse.errors?.[0]?.message || "API não retornou produtos. Mostrando vitrine de exemplo.",
                source: "demo_fallback",
                debug: {
                    error: productResponse.errors?.[0]?.message
                }
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (err) {
        const error = err as Error;
        console.error("Edge Function Error:", error);

        const demoProducts = generateReliableDemoProducts("error_fallback");
        return new Response(
            JSON.stringify({
                products: demoProducts,
                error: error.message,
                warning: "Erro na conexão. Mostrando produtos offline."
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});

// Generate reliable demo products with Unsplash images (always load)
// and specific Search Links (always find products)
// We use Search Links for fallback because hardcoded IDs expire and break (Error 404).
function generateReliableDemoProducts(affiliateId: string) {
    const demoItems = [
        {
            name: "iPhone 13 128GB Estelar",
            price: 3599.00,
            img: "https://images.unsplash.com/photo-1632661674596-df8be070a5c5?w=500&q=80",
            keyword: "iphone 13 128gb"
        },
        {
            name: "Fone de Ouvido Bluetooth Lenovo GM2 Pro",
            price: 59.90,
            img: "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=500&q=80",
            keyword: "fone lenovo gm2 pro"
        },
        {
            name: "Smartwatch Relógio Inteligente D20",
            price: 34.90,
            img: "https://images.unsplash.com/photo-1579586337278-3befd40fd17a?w=500&q=80",
            keyword: "smartwatch d20"
        },
        {
            name: "Fralda Pampers Confort Sec M",
            price: 89.90,
            img: "https://images.unsplash.com/photo-1519689680058-324335c77eba?w=500&q=80",
            keyword: "fralda pampers confort sec m"
        },
        {
            name: "Cadeira Gamer Ergonômica Reclinável",
            price: 699.90,
            img: "https://images.unsplash.com/photo-1598550476439-6847785fcea6?w=500&q=80",
            keyword: "cadeira gamer ergonomica"
        },
        {
            name: "Air Fryer Fritadeira Sem Óleo 4L",
            price: 299.90,
            img: "https://images.unsplash.com/photo-1626168537554-046644b9b91f?w=500&q=80",
            keyword: "air fryer 4l"
        },
        {
            name: "Kit Teclado e Mouse Gamer RGB",
            price: 129.90,
            img: "https://images.unsplash.com/photo-1587829741301-3a0595d2c2f6?w=500&q=80",
            keyword: "kit teclado mouse gamer"
        },
        {
            name: "Máquina de Cortar Cabelo Profissional",
            price: 49.90,
            img: "https://images.unsplash.com/photo-1621609764095-646fd8aad52f?w=500&q=80",
            keyword: "maquina cortar cabelo"
        },
        {
            name: "Câmera de Segurança WiFi 360",
            price: 79.90,
            img: "https://images.unsplash.com/photo-1557862921-37829c790f19?w=500&q=80",
            keyword: "camera wifi 360"
        },
        {
            name: "Garrafa Térmica Aço Inox 500ml",
            price: 29.90,
            img: "https://images.unsplash.com/photo-1602143407151-011141951f2a?w=500&q=80",
            keyword: "garrafa termica inox"
        }
    ];

    return demoItems.map((p, i) => ({
        item_id: `demo_${Date.now()}_${i}`,
        shop_id: "demo_shop",
        item_name: p.name,
        item_price: p.price,
        item_image: p.img,
        // Use Reliable Search Link for Demo Items to avoid 404s
        product_link: createReliableSearchLink(p.keyword, affiliateId),
        shop_name: "Loja Demo (API Offline)",
        commission_rate: 5,
        sales: 1000 + i * 50
    }));
}
