import { Product, DashboardStats, Schedule, AppSettings, IntegrationConfig, AutomationConfig } from '../types';
import { supabase } from './supabase';

const SETTINGS_KEY = 'flowmaster_settings';

// ================= PRODUCTS =================

export const fetchProducts = async (): Promise<Product[]> => {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching products:', error);
    return [];
  }

  return data.map((p: any) => ({
    id: p.id,
    title: p.title,
    price: parseFloat(p.price),
    image: p.image || '',
    affiliate_link: p.affiliate_link,
    platform: p.platform || 'Other',
    active: p.active,
    clicks: p.clicks || 0,
    sales: p.sales || 0,
    salesCopy: p.sales_copy || ''
  }));
};

export const saveProduct = async (product: Omit<Product, 'id'>): Promise<Product> => {
  const { data, error } = await supabase
    .from('products')
    .insert({
      title: product.title,
      price: product.price,
      image: product.image,
      affiliate_link: product.affiliate_link,
      platform: product.platform,
      active: product.active,
      clicks: 0,
      sales: 0,
      sales_copy: product.salesCopy || ''
    })
    .select()
    .single();

  if (error) {
    console.error('Error saving product:', error);
    throw new Error('Falha ao salvar produto');
  }

  return {
    id: data.id,
    title: data.title,
    price: parseFloat(data.price),
    image: data.image || '',
    affiliate_link: data.affiliate_link,
    platform: data.platform,
    active: data.active,
    clicks: data.clicks,
    sales: data.sales,
    salesCopy: data.sales_copy
  };
};

export const updateProduct = async (product: Product): Promise<Product> => {
  const { error } = await supabase
    .from('products')
    .update({
      title: product.title,
      price: product.price,
      image: product.image,
      affiliate_link: product.affiliate_link,
      platform: product.platform,
      active: product.active,
      sales_copy: product.salesCopy || ''
    })
    .eq('id', product.id);

  if (error) {
    console.error('Error updating product:', error);
    throw new Error('Falha ao atualizar produto');
  }

  return product;
};

export const deleteProduct = async (productId: string): Promise<void> => {
  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', productId);

  if (error) {
    console.error('Error deleting product:', error);
    throw new Error('Falha ao excluir produto');
  }
};

// Delete all products by platform (or all if no platform specified)
export const deleteAllProducts = async (platform?: string): Promise<number> => {
  let query = supabase.from('products').delete();

  if (platform && platform !== 'all') {
    query = query.eq('platform', platform);
  } else {
    // Delete products where id is not null (all products)
    query = query.neq('id', '00000000-0000-0000-0000-000000000000');
  }

  const { error, count } = await query.select('id');

  if (error) {
    console.error('Error deleting all products:', error);
    throw new Error('Falha ao excluir produtos');
  }

  return count || 0;
};

// ================= SCHEDULES =================

export const fetchSchedules = async (): Promise<Schedule[]> => {
  const { data, error } = await supabase
    .from('schedules')
    .select(`
      *,
      products (id, title, image)
    `)
    .order('scheduled_time', { ascending: true });

  if (error) {
    console.error('Error fetching schedules:', error);
    return [];
  }

  const now = new Date();
  const ONE_DAY = 24 * 60 * 60 * 1000;
  const updates: Promise<any>[] = [];

  const schedules = data.map((s: any) => {
    const schedule: Schedule = {
      id: s.id,
      productId: s.product_id,
      productTitle: s.products?.title || 'Produto removido',
      productImage: s.products?.image || '',
      scheduledTime: s.scheduled_time,
      status: s.status,
      platform: s.platform,
      frequency: s.frequency
    };

    // Check for past recurring schedules
    if (schedule.status === 'pending' && (schedule.frequency === 'daily' || schedule.frequency === 'weekly')) {
      const scheduledDate = new Date(schedule.scheduledTime);

      if (scheduledDate < now) {
        const interval = schedule.frequency === 'daily' ? ONE_DAY : (ONE_DAY * 7);
        let newDate = new Date(scheduledDate);

        // Advance date until it's in the future
        while (newDate <= now) {
          newDate.setTime(newDate.getTime() + interval);
        }

        const newIso = newDate.toISOString();

        // Queue update to DB
        updates.push(
          Promise.resolve(supabase
            .from('schedules')
            .update({ scheduled_time: newIso })
            .eq('id', schedule.id))
        );

        // Update local object
        schedule.scheduledTime = newIso;
      }
    }

    return schedule;
  });

  // Execute DB updates in background (or await if strict consistency is needed - usually background is fine for read)
  if (updates.length > 0) {
    await Promise.all(updates);
  }

  // Re-sort because dates changed
  return schedules.sort((a, b) => new Date(a.scheduledTime).getTime() - new Date(b.scheduledTime).getTime());
};

export const createSchedule = async (schedule: Omit<Schedule, 'id'>): Promise<void> => {
  const { error } = await supabase
    .from('schedules')
    .insert({
      product_id: schedule.productId === 'all' ? null : schedule.productId,
      product_title: schedule.productTitle || '',
      product_image: schedule.productImage || '',
      scheduled_time: schedule.scheduledTime,
      status: 'pending',
      platform: schedule.platform,
      frequency: schedule.frequency || 'once'
    });

  if (error) {
    console.error('Error creating schedule:', error);
    throw new Error('Falha ao criar agendamento');
  }
};

export const deleteSchedule = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('schedules')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting schedule:', error);
    throw new Error('Falha ao excluir agendamento');
  }
};

export const deleteSchedules = async (ids: string[]): Promise<void> => {
  const { error } = await supabase
    .from('schedules')
    .delete()
    .in('id', ids);

  if (error) {
    console.error('Error deleting schedules:', error);
    throw new Error('Falha ao excluir agendamentos');
  }
};

// ================= DASHBOARD STATS =================

export const fetchStats = async (): Promise<DashboardStats> => {
  // Get product count
  const { count: productCount } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true });

  // Get active products count
  const { count: activeCount } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true })
    .eq('active', true);

  // Get pending schedules
  const { count: pendingSchedules } = await supabase
    .from('schedules')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending');

  // Get posts sent today
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const { count: sentToday } = await supabase
    .from('schedules')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'sent')
    .gte('scheduled_time', today.toISOString());

  return {
    totalProducts: productCount || 0,
    activeLinks: activeCount || 0,
    lastShipment: `${pendingSchedules || 0} agendados`,
    totalRevenue: sentToday || 0 // Reusing this field for "posts sent today"
  };
};

// ================= SETTINGS (Supabase Persisted) =================

const defaultSettings: AppSettings = {
  whatsappNumber: '+55 11 99999-9999',
  autoReply: true,
  salesTemplate: "🔥 OFERTA IMPERDÍVEL! 🔥\n\n{titulo}\n\n💰 De: R$ {preco_antigo} \n✅ Por apenas: R$ {preco}\n\n👇 Garanta o seu agora:\n{link}"
};

export const fetchSettings = async (): Promise<AppSettings> => {
  const { data: { user } } = await supabase.auth.getUser();

  // Default values
  let settings: AppSettings = { ...defaultSettings };

  if (user) {
    // Populate defaults from user metadata
    settings.displayName = user.user_metadata?.name || user.email?.split('@')[0] || 'Usuário';

    // Fetch stored settings
    const { data, error } = await supabase
      .from('app_settings')
      .select('settings')
      .eq('user_id', user.id)
      .maybeSingle();

    if (data?.settings) {
      settings = { ...settings, ...data.settings };
    }

    // Ensure display name is current if not explicitly set in settings (or if we want to sync)
    if (!settings.displayName) {
      settings.displayName = user.user_metadata?.name;
    }
  }

  return settings;
};

export const saveSettings = async (settings: AppSettings): Promise<void> => {
  console.log('DEBUG: Iniciando saveSettings no Supabase/localStorage', settings);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    console.warn('DEBUG: Usuário não autenticado, salvando apenas no localStorage');
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    return;
  }

  // Update Auth User Metadata if displayName changed
  if (settings.displayName) {
    const { error: authError } = await supabase.auth.updateUser({
      data: { name: settings.displayName }
    });
    if (authError) console.error('Error updating auth metadata:', authError);
  }

  // Save app settings to DB
  const { error } = await supabase
    .from('app_settings')
    .upsert(
      {
        user_id: user.id,
        settings: settings, // Explicitly pass settings
        updated_at: new Date().toISOString()
      },
      { onConflict: 'user_id' }
    );

  if (error) {
    console.error('DEBUG: Erro ao salvar no Supabase:', error);
    // Fallback to localStorage
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    throw new Error('Falha ao salvar configurações no banco de dados');
  } else {
    console.log('DEBUG: Configurações salvas com sucesso no Supabase');
  }
};

// ================= AI FUNCTIONS =================

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};

export const extractFromImage = async (file: File): Promise<{ title: string; price: number }> => {
  try {
    const base64Image = await fileToBase64(file);

    const { data, error } = await supabase.functions.invoke('analyze-product', {
      body: { image: base64Image }
    });

    if (error) {
      console.error('Supabase Function Error:', error);
      throw new Error('Falha na comunicação com a IA.');
    }

    if (!data || !data.title) {
      throw new Error('IA não retornou dados válidos.');
    }

    return {
      title: data.title,
      price: typeof data.price === 'string' ? parseFloat(data.price) : data.price
    };
  } catch (e) {
    console.error('OCR Error:', e);
    throw new Error('Não foi possível analisar a imagem.');
  }
};

export const extractFromLink = async (link: string): Promise<{ title: string; price: number; image: string; platform: Product['platform'] }> => {
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    const edgeFunctionUrl = `${supabaseUrl}/functions/v1/fetch-metadata`;

    const { data: { user } } = await supabase.auth.getUser();

    const response = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
      },
      body: JSON.stringify({ url: link, userId: user?.id }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('fetch-metadata HTTP Error:', response.status, text);
      throw new Error(`Edge Function retornou erro ${response.status}`);
    }

    const data = await response.json();
    let { title, price, image, platform } = data;

    // --- SHOPEE FALLBACK ---
    // Se for Shopee e o preço for 0 ou suspeito, tenta a API oficial via shopee-products
    if (platform === 'Shopee' && (!price || price === 0) && link.includes('shopee.com.br')) {
      console.log('Price is 0 for Shopee, trying API fallback...');
      try {
        const shopeeCredentials = await getShopeeCredentials();
        if (shopeeCredentials) {
          // Extrai itemID do link
          const match = link.match(/product\/\d+\/(\d+)/i) || link.match(/-i\.\d+\.(\d+)/i);
          const itemId = match ? match[1] : '';

          if (itemId) {
            const shopeeData = await fetchShopeeProducts(itemId);
            const product = shopeeData.find(p => String(p.item_id) === itemId) || shopeeData[0];

            if (product) {
              console.log('Shopee API Fallback Success:', product.item_price);
              title = product.item_name;
              price = product.item_price;
              image = product.item_image;
            }
          }
        }
      } catch (err) {
        console.error('Shopee Fallback Error:', err);
      }
    }

    return {
      title: title || 'Produto sem título',
      price: price || 0,
      image: image || 'https://via.placeholder.com/200?text=No+Image',
      platform: platform || 'Other'
    };
  } catch (err) {
    console.error('Link Fetch Error:', err);
    return {
      title: '',
      price: 0,
      image: '',
      platform: 'Other'
    };
  }
};

// ================= INTEGRATION IMPORT =================

import { fetchShopeeProducts, importShopeeProducts, getShopeeCredentials } from './shopeeService';

// SETTINGS_KEY moved to top

export const importProductsFromIntegration = async (integrationId: string): Promise<number> => {
  const settings = await fetchSettings();
  const integration = settings.integrations?.find(i => i.id === integrationId);

  if (!integration?.isEnabled) {
    throw new Error(`Integração com ${integrationId} não está ativa.`);
  }

  // Use real Shopee service for Shopee imports
  if (integrationId === 'shopee') {
    const shopeeProducts = await fetchShopeeProducts();
    const imported = await importShopeeProducts(shopeeProducts);
    return imported;
  }

  // Fallback for other platforms (removed manual simulation for now as requested)
  // Amazon and ML are now manual-only via Quick Post.

  return 0;
};

// ================= AUTOMATION CONFIG =================

export const fetchAutomationConfig = async (): Promise<AutomationConfig | null> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('automation_config')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: data.id,
    userId: data.user_id,
    isActive: data.is_active,
    days: data.days || [],
    startHour: data.start_hour || '08:00',
    endHour: data.end_hour || '23:00',
    intervalMinutes: data.interval_minutes || 30,
    lastShuffleIndex: data.last_shuffle_index || 0,
    shuffledProductIds: data.shuffled_product_ids || [],
    lastSentAt: data.last_sent_at,
  };
};

export const saveAutomationConfig = async (config: AutomationConfig): Promise<void> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const payload = {
    user_id: user.id,
    is_active: config.isActive,
    days: config.days,
    start_hour: config.startHour,
    end_hour: config.endHour,
    interval_minutes: config.intervalMinutes,
    last_shuffle_index: config.lastShuffleIndex,
    shuffled_product_ids: config.shuffledProductIds,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('automation_config')
    .upsert(payload, { onConflict: 'user_id' });

  if (error) throw error;
};
