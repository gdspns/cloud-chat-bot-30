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
  type: 'auto' | 'manual' | 'recharge' | 'physical';
  category: string;
  stockQuantity?: number;
  imageUrl?: string;
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
  deliveryContent?: string;
  paymentMethod?: string;
  orderType?: string;
  txHash?: string;
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
    balance: string[];
    recharge: string[];
  };
  paymentNotice: string;
  // 激活相关字段
  activationCode?: string;
  shopExpireAt?: string | null;
  shopTrialStartedAt?: string | null;
  // /start 欢迎消息配置
  startEnabled?: boolean;
  startMessage?: string;
  startMessageMediaUrl?: string;
  startMessageMediaType?: 'text' | 'photo' | 'video';
  startMessageEntities?: any[];
  startDisablePreview?: boolean;
  // 自定义按钮文字
  shopButtonText?: string;
  shopButtonTextEn?: string;
  orderButtonText?: string;
  orderButtonTextEn?: string;
  // /shop 欢迎内容
  shopWelcomeContent?: string;
  shopWelcomeMediaUrl?: string;
  shopWelcomeMediaType?: 'text' | 'photo' | 'video';
  shopWelcomeEntities?: any[];
  shopWelcomeDisablePreview?: boolean;
  // /order 欢迎内容
  orderWelcomeContent?: string;
  orderWelcomeMediaUrl?: string;
  orderWelcomeMediaType?: 'text' | 'photo' | 'video';
  orderWelcomeEntities?: any[];
  orderWelcomeDisablePreview?: boolean;
  // 用户语言偏好
  userLanguagePreferences?: Record<string, string>;
  // 自定义分类
  customCategories?: string[];
  // 自定义内联按钮
  startCustomButtons?: Array<{ text: string; url: string }>;
}

export type ShopTab = 'settings' | 'products' | 'categories' | 'orders' | 'payment' | 'balance';
