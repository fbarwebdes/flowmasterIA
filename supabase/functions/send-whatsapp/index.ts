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
      } catch (fetchErr) {
        console.error('Fetch error calling Green API:', fetchErr);
        return new Response(JSON.stringify({ success: false, error: `Erro de rede: ${fetchErr.message}` }), {
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

        const adminNumber = settings?.whatsappNumber?.replace(/\D/g, '');
        const adminChatId = adminNumber ? `${adminNumber}@c.us` : null;

        let product: any;
        let shuffledIds = config.shuffled_product_ids || [];
        let currentIndex = config.last_shuffle_index || 0;

        // If no shuffle list yet, create it
        if (shuffledIds.length === 0) {
          shuffledIds = shuffleArray(allProducts.map((p: any) => p.id));
          currentIndex = 0;
          await supabase.from('automation_config').update({
            shuffled_product_ids: shuffledIds,
            last_shuffle_index: 0
          }).eq('id', config.id);
        }

        if (isTest) {
          product = allProducts[Math.floor(Math.random() * allProducts.length)];
        } else {
          // Check if cycle is already complete
          if (currentIndex >= shuffledIds.length) {
            // Check if we should send a reminder (e.g. once every 12h if still in this state)
            const lastSent = config.last_sent_at ? new Date(config.last_sent_at) : new Date(0);
            const hoursSinceLast = (now.getTime() - lastSent.getTime()) / (1000 * 60 * 60);

            if (hoursSinceLast >= 12 && adminChatId) {
              const alertMsg = "⚠️ *FlowMasterIA: Ciclo Shopee Finalizado!*\n\nTodos os produtos cadastrados já foram enviados em seus respectivos grupos. \n\nPara garantir que os envios não se repitam e manter o engajamento, por favor:\n1. Vá em *Produtos* e exclua os atuais.\n2. Faça uma *Nova Importação* via API Shopee.\n\nOs envios automáticos estão pausados até a atualização.";

              await fetch(`${apiHost}/waInstance${instanceId}/sendMessage/${token}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chatId: adminChatId, message: alertMsg })
              });

              await supabase.from('automation_config').update({
                last_sent_at: now.toISOString()
              }).eq('id', config.id);

              results.push({ user: config.user_id, status: 'cycle_alert_sent' });
            } else {
              results.push({ user: config.user_id, skipped: 'cycle_already_completed' });
            }
            continue;
          }

          product = allProducts.find((p: any) => p.id === shuffledIds[currentIndex]);

          // If the product was deleted in the meantime, skip it
          if (!product) {
            currentIndex++;
            await supabase.from('automation_config').update({ last_shuffle_index: currentIndex }).eq('id', config.id);
            results.push({ user: config.user_id, skipped: 'product_not_found' });
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

        if (product.sales_copy) message = product.sales_copy;
        else if (salesTemplate) {
          message = salesTemplate
            .replace(/\{nome\}|\{titulo\}/gi, product.title)
            .replace(/(?:R\$\s?)?\{preco\}/gi, `R$ ${formatPrice(price)}`)
            .replace(/(?:R\$\s?)?\{preco_original\}|(?:R\$\s?)?\{preco_antigo\}/gi, `R$ ${formatPrice(oldPrice)}`)
            .replace(/\{link\}/gi, product.affiliate_link || '')
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

          // Check if it was the last one
          if (currentIndex >= shuffledIds.length && adminChatId) {
            const completionMsg = "✅ *FlowMasterIA: Rodada Finalizada!*\n\nTodos os produtos Shopee salvos acabam de ser enviados. \n\n*Atenção:* Os envios serão pausados até que novos produtos sejam importados para garantir que não haja repetições.";

            await fetch(`${apiHost}/waInstance${instanceId}/sendMessage/${token}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ chatId: adminChatId, message: completionMsg })
            });
          }
          // Warn when running low (5 items left)
          else if (shuffledIds.length - currentIndex === 5 && adminChatId) {
            const lowMsg = "⚠️ *FlowMasterIA: Produtos Acabando!*\n\nRestam apenas *5 produtos* Shopee para serem enviados neste ciclo. \n\nLembre-se de preparar uma nova importação em breve.";

            await fetch(`${apiHost}/waInstance${instanceId}/sendMessage/${token}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ chatId: adminChatId, message: lowMsg })
            });
          }

          await supabase.from('automation_config').update({
            last_shuffle_index: currentIndex,
            shuffled_product_ids: shuffledIds,
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
