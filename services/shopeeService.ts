// Shopee Affiliate API Service
// Uses the Open Platform API to search products

import { supabase } from './supabase';
import { Product, AppSettings } from '../types';

// Edge Function URL - uses direct fetch to avoid JWT relay issues
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const EDGE_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/shopee-products`;

interface ShopeeProduct {
  item_id: number;
  item_name: string;
  item_price: number;
  item_image: string;
  product_link: string;
  commission_rate?: number;
  shop_name?: string;
}

interface ShopeeCredentials {
  appId: string;
  appSecret: string;
}

import { fetchSettings } from './mockService';

// Fetch credentials from DB settings
export const getShopeeCredentials = async (): Promise<ShopeeCredentials | null> => {
  const settings = await fetchSettings();
  const shopeeConfig = settings.integrations?.find(i => i.id === 'shopee');

  if (!shopeeConfig?.isEnabled || !shopeeConfig.credentials.apiKey) {
    return null;
  }

  return {
    appId: shopeeConfig.credentials.partnerId || '',
    appSecret: shopeeConfig.credentials.apiKey || ''
  };
};

// Direct fetch to Edge Function (bypasses supabase.functions.invoke JWT issues)
async function callEdgeFunction(body: Record<string, any>): Promise<any> {
  const response = await fetch(EDGE_FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error('Edge Function HTTP Error:', response.status, text);
    throw new Error(`Edge Function retornou erro ${response.status}`);
  }

  return response.json();
}

// Fetch products from Shopee via Edge Function
export const fetchShopeeProducts = async (keyword: string = ''): Promise<ShopeeProduct[]> => {
  const credentials = await getShopeeCredentials();

  if (!credentials || !credentials.appId) {
    throw new Error('Credenciais da Shopee não configuradas. Vá para Integrações.');
  }

  try {
    const data = await callEdgeFunction({
      appId: credentials.appId,
      appSecret: credentials.appSecret,
      action: 'search',
      keyword: keyword,
      limit: 50
    });

    if (data.warning) {
      console.warn('Shopee API Warning:', data.warning);
    }

    return data.products || [];
  } catch (e) {
    console.error('Shopee Fetch Error:', e);
    throw new Error('Não foi possível buscar produtos da Shopee');
  }
};

// Save imported Shopee products to Supabase (upsert to prevent duplicates)
export const saveShopeeProduct = async (shopeeProduct: ShopeeProduct): Promise<Product> => {
  const externalId = String(shopeeProduct.item_id);

  // Check if product already exists
  const { data: existing } = await supabase
    .from('products')
    .select('id')
    .eq('external_id', externalId)
    .eq('source', 'shopee')
    .maybeSingle();

  if (existing) {
    // Skip duplicate
    console.log('Product already exists:', shopeeProduct.item_name);
    return {
      id: existing.id,
      title: shopeeProduct.item_name,
      price: shopeeProduct.item_price,
      image: shopeeProduct.item_image,
      affiliate_link: shopeeProduct.product_link,
      platform: 'Shopee',
      active: true,
      source: 'shopee',
      externalId: externalId
    };
  }

  if (shopeeProduct.item_price <= 0) {
    console.warn('Skipping save for product with zero price:', shopeeProduct.item_name);
    throw new Error('Preço do produto é zero ou inválido');
  }

  const { data, error } = await supabase
    .from('products')
    .insert({
      title: shopeeProduct.item_name,
      price: shopeeProduct.item_price,
      image: shopeeProduct.item_image,
      affiliate_link: shopeeProduct.product_link,
      platform: 'Shopee',
      source: 'shopee',
      external_id: externalId,
      active: true,
      clicks: 0,
      sales: 0
    })
    .select()
    .single();

  if (error) {
    console.error('Error saving Shopee product:', error);
    throw new Error('Falha ao salvar produto');
  }

  return {
    id: data.id,
    title: data.title,
    price: parseFloat(data.price),
    image: data.image || '',
    affiliate_link: data.affiliate_link,
    platform: 'Shopee',
    active: data.active,
    source: 'shopee',
    externalId: data.external_id
  };
};

// Import multiple Shopee products at once
export const importShopeeProducts = async (products: ShopeeProduct[]): Promise<number> => {
  let imported = 0;

  for (const product of products) {
    try {
      await saveShopeeProduct(product);
      imported++;
    } catch (e) {
      console.error('Failed to import:', product.item_name);
    }
  }

  return imported;
};

// Validate Shopee credentials against the Edge Function
export const validateShopeeCredentials = async (appId: string, appSecret: string): Promise<{ valid: boolean; message?: string }> => {
  try {
    const data = await callEdgeFunction({
      appId,
      appSecret,
      action: 'validate',
      keyword: 'celular',
      limit: 1
    });

    // Check if the source is from the real API
    if (data.source === 'shopee_affiliate_api') {
      return { valid: true };
    } else if (data.source === 'demo_missing_creds') {
      return { valid: false, message: 'Credenciais ausentes na requisição' };
    } else if (data.source === 'demo_fallback') {
      return {
        valid: false,
        message: data.debug?.error || data.warning || 'A Shopee rejeitou as credenciais'
      };
    }

    return { valid: true };
  } catch (e: any) {
    console.error('Validation Exception:', e);
    return { valid: false, message: e.message || 'Erro desconhecido ao validar' };
  }
};
