export type IntegrationId = 'shopee' | 'whatsapp' | 'other';

export interface IntegrationConfig {
  id: IntegrationId;
  name: string;
  isEnabled: boolean;
  credentials: {
    affiliateId?: string;
    apiKey?: string;
    apiSecret?: string;
    partnerId?: string; // For Shopee
    baseUrl?: string;   // For WhatsApp (Green API base URL)
    token?: string;     // For WhatsApp (apiTokenInstance)
    instanceId?: string; // For Green API (idInstance)
    destinationChat?: string; // WhatsApp chat ID 1 (e.g. 5511999999999@c.us)
    destinationChat2?: string; // WhatsApp chat ID 2
    destinationChat3?: string; // WhatsApp chat ID 3
  };
}

export interface Product {
  id: string;
  title: string;
  price: number;
  image: string;
  affiliate_link: string;
  platform: 'Shopee' | 'Amazon' | 'AliExpress' | 'Other' | 'Mercado Livre';
  active: boolean;
  clicks?: number;
  sales?: number;
  salesCopy?: string;
  externalId?: string; // ID on the source platform
  source?: IntegrationId; // Where it was imported from
}

export interface DashboardStats {
  totalProducts: number;
  activeLinks: number;
  lastShipment: string;
  totalRevenue: number;
}

export interface User {
  name: string;
  email: string;
  avatar: string;
}

export interface Schedule {
  id: string;
  productId: string | 'all';
  productImage?: string;
  productTitle?: string;
  scheduledTime: string; // ISO string
  status: 'pending' | 'sent' | 'failed';
  platform: 'WhatsApp' | 'Telegram' | 'Instagram';
  frequency?: 'once' | 'daily' | 'weekly'; // New field for advanced scheduling
}

export interface AppSettings {
  salesTemplate: string;
  whatsappNumber: string;
  autoReply: boolean;
  displayName?: string; // New field for user's display name
  integrations?: IntegrationConfig[]; // Store integrations here
}

export type ViewState = 'dashboard' | 'products' | 'schedule' | 'links' | 'integrations' | 'settings' | 'templates';
