import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DAY_MAP: Record<number, string> = {
  0: 'sun', 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri', 6: 'sat'
};

function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function interleaveProducts(products: any[]): string[] {
  if (products.length === 0) return [];

  // Group by platform
  const groups: Record<string, string[]> = {};
  products.forEach(p => {
    const platform = p.platform || 'Other';
    if (!groups[platform]) groups[platform] = [];
    groups[platform].push(p.id);
  });

  // Shuffle each group's IDs
  Object.keys(groups).forEach(platform => {
    groups[platform] = shuffleArray(groups[platform]);
  });

  const interleaved: string[] = [];
  const platforms = Object.keys(groups);
  let hasMore = true;

  while (hasMore) {
    hasMore = false;
    // We can shuffle the platforms list for each round to add more variety
    const shuffledPlatforms = shuffleArray(platforms);
    for (const platform of shuffledPlatforms) {
      if (groups[platform].length > 0) {
        interleaved.push(groups[platform].shift()!);
        hasMore = true;
      }
    }
  }
  return interleaved;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let body: any = {};
    try {
      body = await req.json();
      console.log('Request body:', JSON.stringify(body));
    } catch { /* empty body */ }

    // Check for direct test (from Integrations page)
    if (body?.directTest) {
      const { instanceId, token, baseUrl, chatId, message } = body.directTest;
      console.log(`Direct test for instance ${instanceId} to chat ${chatId} using base ${baseUrl || 'default'}`);

      if (!instanceId || !token || !chatId) {
        return new Response(JSON.stringify({ error: 'Faltam credenciais para o teste direto' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const apiHost = baseUrl ? baseUrl.replace(/\/$/, '') : `https://api.green-api.com`;
      const greenApiUrl = `${apiHost}/waInstance${instanceId}/sendMessage/${token}`;
      console.log(`Calling Green API: ${greenApiUrl}`);

      try {
        const sendResponse = await fetch(greenApiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chatId, message: message || '✅ Teste de conexão Green API!' })
        });

        const sendData = await sendResponse.json();
        console.log('Green API response:', JSON.stringify(sendData));

        return new Response(JSON.stringify({
          success: sendResponse.ok && !!sendData.idMessage,
          data: sendData,
          error: sendData.message || (sendResponse.ok ? null : `API Error ${sendResponse.status}`)
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (e) {
        const fetchErr = e as any;
        console.error('Fetch error calling Green API:', fetchErr);
        return new Response(JSON.stringify({ success: false, error: `Erro de rede: ${fetchErr.message || String(fetchErr)}` }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // Normal flow (Automation or Schedule Test)
    const isTest = body?.test === true;
    const { data: configs, error: configErr } = await supabase.from('automation_config').select('*');

    if (configErr || !configs || configs.length === 0) {
      return new Response(JSON.stringify({ message: 'No automation configs found', sent: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const results: any[] = [];
    for (const config of configs) {
      try {
        if (!isTest && !config.is_active) continue;

        const now = new Date();
        const brTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
        const today = DAY_MAP[brTime.getDay()];

        if (!isTest) {
          if (!config.days || !config.days.includes(today)) {
            results.push({ user: config.user_id, skipped: 'not_active_day' });
            continue;
          }
          const [startH, startM] = (config.start_hour || '08:00').split(':').map(Number);
          const [endH, endM] = (config.end_hour || '23:00').split(':').map(Number);
          const currentTotalMin = brTime.getHours() * 60 + brTime.getMinutes();
          if (currentTotalMin < (startH * 60 + startM) || currentTotalMin >= (endH * 60 + endM)) {
            results.push({ user: config.user_id, skipped: 'outside_window' });
            continue;
          }
          const intervalMs = (config.interval_minutes || 30) * 60 * 1000;
          if (config.last_sent_at) {
            const elapsed = now.getTime() - new Date(config.last_sent_at).getTime();
            if (elapsed < intervalMs) {
              results.push({ user: config.user_id, skipped: 'too_soon' });
              continue;
            }
          }
        }

        const { data: settingsRow } = await supabase.from('app_settings').select('settings').eq('user_id', config.user_id).single();
        const settings = settingsRow?.settings;
        const whatsappConfig = settings?.integrations?.find((i: any) => i.id === 'whatsapp');

        if (!whatsappConfig?.isEnabled || !whatsappConfig?.credentials?.instanceId || !whatsappConfig?.credentials?.token) {
          results.push({ user: config.user_id, skipped: 'not_configured' });
          continue;
        }

        const { instanceId, token, baseUrl, destinationChat, destinationChat2, destinationChat3 } = whatsappConfig.credentials;
        const apiHost = baseUrl ? baseUrl.replace(/\/$/, '') : `https://api.green-api.com`;

        const allChats: string[] = [];
        if (destinationChat) allChats.push(destinationChat.includes('@') ? destinationChat : `${destinationChat}@c.us`);
        if (destinationChat2) allChats.push(destinationChat2.includes('@') ? destinationChat2 : `${destinationChat2}@c.us`);
        if (destinationChat3) allChats.push(destinationChat3.includes('@') ? destinationChat3 : `${destinationChat3}@c.us`);

        if (allChats.length === 0) {
          results.push({ user: config.user_id, skipped: 'no_chats' });
          continue;
        }

        const { data: allProducts } = await supabase.from('products').select('*').eq('active', true);
        if (!allProducts || allProducts.length === 0) {
          results.push({ user: config.user_id, skipped: 'no_products' });
          continue;
        }

        // --- PREVENT REPETITION LOGIC ---
        // Fetch recently sent products in the last 24 hours
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { data: recentSends } = await supabase
          .from('schedules')
          .select('product_id')
          .gte('scheduled_time', twentyFourHoursAgo)
          .eq('status', 'sent');

        const recentlySentIds = new Set((recentSends || []).map((s: any) => s.product_id));

        let product: any;
        let shuffledIds = config.shuffled_product_ids || [];
        let currentIndex = config.last_shuffle_index || 0;

        // If no shuffle list yet or list is empty, create it interleaved
        if (shuffledIds.length === 0) {
          shuffledIds = interleaveProducts(allProducts);
          currentIndex = 0;
          await supabase.from('automation_config').update({
            shuffled_product_ids: shuffledIds,
            last_shuffle_index: 0
          }).eq('id', config.id);
        }

        if (isTest) {
          product = allProducts[Math.floor(Math.random() * allProducts.length)];
        } else {
          // Check if cycle is complete
          if (currentIndex >= shuffledIds.length) {
            console.log("Cycle complete, resetting index and shuffling again...");

            // Mark as cycle completed for the persistent notification
            // Then reset index and reshuffle to repeat
            shuffledIds = interleaveProducts(allProducts);
            currentIndex = 0;

            await supabase.from('automation_config').update({
              cycle_completed: true,
              last_shuffle_index: 0,
              shuffled_product_ids: shuffledIds
            }).eq('id', config.id);
          }

          // --- Smart Recovery: Skip missing or recently sent products ---
          let skipCount = 0;
          let candidateFound = false;

          while (!candidateFound && currentIndex < shuffledIds.length && skipCount < allProducts.length + 50) {
            const candidateId = shuffledIds[currentIndex];
            const candidate = allProducts.find((p: any) => p.id === candidateId);

            if (!candidate) {
              console.log(`Product ID ${candidateId} not found, skipping...`);
              currentIndex++;
              skipCount++;
              continue;
            }

            if (recentlySentIds.has(candidateId)) {
              console.log(`Product ID ${candidateId} ("${candidate.title}") was already sent in the last 24h, skipping to prevent repetition...`);
              currentIndex++;
              skipCount++;
              continue;
            }

            product = candidate;
            candidateFound = true;
          }

          if (!product) {
            console.log("All current IDs invalid or recently sent, treating as cycle complete/no viable products...");
            results.push({ user: config.user_id, skipped: 'all_products_recently_sent_or_invalid' });

            // If we reached the end of the array, prepare for next time
            if (currentIndex >= shuffledIds.length) {
              shuffledIds = interleaveProducts(allProducts);
              currentIndex = 0;
              await supabase.from('automation_config').update({
                cycle_completed: true,
                last_shuffle_index: 0,
                shuffled_product_ids: shuffledIds
              }).eq('id', config.id);
            }
            continue;
          }
        }

        if (!product.price || product.price <= 0) {
          console.log(`Skipping product ${product.title} due to zero price.`);
          results.push({ user: config.user_id, status: 'failed', skipped: 'Produto selecionado está sem preço', product: product.title });
          if (!isTest) {
            currentIndex++;
            await supabase.from('automation_config').update({ last_shuffle_index: currentIndex }).eq('id', config.id);
          }
          continue;
        }

        const price = product.price || 0;
        const oldPrice = price * 1.3;
        const formatPrice = (p: number) => p.toFixed(2).replace('.', ',');
        const salesTemplate = settings?.salesTemplate || '';
        let message = '';

        if (salesTemplate) {
          message = salesTemplate
            .replace(/\{nome\}|\{titulo\}/gi, product.title)
            .replace(/(?:R\$\s?)?\{preco\}/gi, `R$ ${formatPrice(price)}`)
            .replace(/(?:R\$\s?)?\{preco_original\}|(?:R\$\s?)?\{preco_antigo\}/gi, `R$ ${formatPrice(oldPrice)}`)
            .replace(/\{link\}/gi, product.affiliate_link || '')
            .replace(/\{plataforma\}/gi, product.platform || '')
            .replace(/\{desconto\}/gi, '30%');
        } else {
          message = `\u{1F525} OFERTA RELÂMPAGO! \u{1F525}\n\n${product.title}\n\n\u{274C} De: ~R$ ${formatPrice(oldPrice)}~\n\u2705 AGORA POR APENAS: R$ ${formatPrice(price)}\n\n\u{1F6A8} CORRA! Estoque LIMITADO!\n\n\u{1F449} GARANTA O SEU AQUI:\n${product.affiliate_link || ''}\n\n\u{23F0} Promoção por TEMPO LIMITADO!`;
        }

        let sentOk = true;
        for (const chatId of allChats) {
          const res = await fetch(`${apiHost}/waInstance${instanceId}/sendMessage/${token}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chatId, message })
          });
          if (!res.ok) sentOk = false;
          await new Promise(r => setTimeout(r, 1000));
        }

        await supabase.from('schedules').insert({ product_id: product.id, product_title: product.title, product_image: product.image, scheduled_time: now.toISOString(), status: sentOk ? 'sent' : 'failed', platform: 'WhatsApp' });

        if (!isTest) {
          currentIndex++;

          // Admin alerts removed to save Green API quota
          await supabase.from('automation_config').update({
            last_shuffle_index: currentIndex,
            last_sent_at: now.toISOString()
          }).eq('id', config.id);
        }
        results.push({ user: config.user_id, status: sentOk ? 'sent' : 'failed', product: product.title });
      } catch (e) { results.push({ user: config.user_id, error: String(e) }); }
    }

    return new Response(JSON.stringify({ results }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
