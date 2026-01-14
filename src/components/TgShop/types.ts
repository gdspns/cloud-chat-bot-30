// TG商城类型定义

export interface Product {
  id: string;
  name: string;
  price: number;
  currency: 'USDT' | 'TRX' | 'CNY';
  keywords: string;
  keywordsList: string[];
  stockContent: string;
  stockCount: number;
  description: string;
  type: 'auto' | 'manual';
  createdAt?: string;
  updatedAt?: string;
}

export interface Order {
  id: string;
  orderId: string;
  productName: string;
  amount: number;
  currency: string;
  status: 'pending' | 'paid' | 'cancelled';
  customer: string;
  createdAt?: string;
}

export interface ShopConfig {
  token: string;
  adminId: string;
  status: 'online' | 'offline';
  walletAddress: string;
  tronGridKey: string;
  acceptUsdt: boolean;
  acceptTrx: boolean;
  randomDecimals: boolean;
  connectionMode: 'polling' | 'webhook';
  webhookUrl: string;
  yungouId: string;
  yungouKey: string;
  yungouWechatId: string;
  yungouWechatKey: string;
  yungouAlipayId: string;
  yungouAlipayKey: string;
  yungouAlipayH5: boolean;
  xunhuId: string;
  xunhuSecret: string;
  xunhuAlipayId: string;
  xunhuAlipaySecret: string;
  xunhuAlipayH5: boolean;
  enableAlipay: boolean;
  alipayProvider: 'yungou' | 'xunhu';
  enableWechat: boolean;
  wechatProvider: 'yungou' | 'xunhu';
  customCommands: {
    shop: string[];
    buy: string[];
    order: string[];
  };
  paymentNotice: string;
}

export type ShopTab = 'settings' | 'products' | 'orders' | 'simulator';
