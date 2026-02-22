import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://mzxfxybxexqzhiztkilm.supabase.co';
const userId = '1f7fd280-a8ad-4656-b99c-b37f62982e04';
const itemId = '22699060527'; // The ID from the user's screenshot
const shopId = '844790476'; // The shop ID from the URL

async function testShopeeProduct() {
    const appId = '18363940496';
    const secret = 'BEGH5AO4XL7FA3YF2XSAPQ3WOMNQP6QA';

    const edgeFunctionUrl = `${SUPABASE_URL}/functions/v1/shopee-products`;

    console.log(`Calling shopee-products for itemId: ${itemId}, shopId: ${shopId}...`);

    const res = await fetch(edgeFunctionUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16eGZ4eWJ4ZXhxeaBoaXp0a2lsbSIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzM3NzQxOTI4LCJleHAiOjIwNTMzMTc5Mjh9.pG2I0bL8_X_60D-W66X44-Y_W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W-W'
        },
        body: JSON.stringify({
            appId,
            appSecret: secret,
            action: 'get_by_id',
            itemId: itemId,
            shopId: shopId,
            limit: 1
        })
    });

    const data = await res.json();
    console.log('Response:', JSON.stringify(data, null, 2));
}

testShopeeProduct();
