async function generateSignature(appId: string, timestamp: number, payload: string, secret: string) {
    const baseString = `${appId}${timestamp}${payload}${secret}`;
    const encoder = new TextEncoder();
    const msgData = encoder.encode(baseString);
    const hashBuffer = await crypto.subtle.digest("SHA-256", msgData);
    return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function testRawShopee() {
    const appId = '18363940496';
    const secret = 'BEGH5AO4XL7FA3YF2XSAPQ3WOMNQP6QA';
    const timestamp = Math.floor(Date.now() / 1000);

    const productQuery = `query ProductOfferV2($keyword: String, $limit: Int) {
    productOfferV2(listType: 0, limit: $limit, keyword: $keyword) {
      nodes { productName, priceMin, priceMax }
    }
  }`;

    const productPayload = JSON.stringify({
        query: productQuery,
        variables: { keyword: 'destaques', limit: 3 }
    });

    const signature = await generateSignature(appId, timestamp, productPayload, secret);

    const response = await fetch("https://open-api.affiliate.shopee.com.br/graphql", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `SHA256 Credential=${appId},Timestamp=${timestamp},Signature=${signature}`,
        },
        body: productPayload,
    });

    const resJson = await response.json();
    const nodes = resJson.data?.productOfferV2?.nodes || [];
    nodes.forEach((n: any) => {
        console.log(`Product: ${n.productName}`);
        console.log(`  priceMin: ${n.priceMin} | priceMax: ${n.priceMax}`);
    });
}

testRawShopee();
