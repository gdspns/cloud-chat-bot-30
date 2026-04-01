import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Product, Order, ShopConfig } from "../types";

interface DbProduct {
  id: string;
  bot_token: string;
  name: string;
  price: number;
  currency: string;
  keywords: string[];
  stock_content: string[];
  description: string | null;
  is_active: boolean;
  category: string | null;
  type: string;
  stock_quantity: number | null;
  image_url: string | null;
  created_at: string;
  updated_at: string;
}

interface DbOrder {
  id: string;
  bot_token: string;
  order_no: string;
  product_id: string | null;
  product_name: string;
  amount: number;
  currency: string;
  payment_method: string;
  status: string;
  telegram_user_id: number | null;
  telegram_username: string | null;
  telegram_chat_id: number | null;
  tx_hash: string | null;
  delivery_content: string | null;
  delivered_at: string | null;
  order_type: string | null;
  created_at: string;
  updated_at: string;
}

interface DbConfig {
  id: string;
  bot_token: string;
  admin_id: string | null;
  wallet_address: string | null;
  tron_grid_key: string | null;
  accept_usdt: boolean;
  accept_trx: boolean;
  random_decimals: boolean;
  connection_mode: string;
  webhook_url: string | null;
  yungou_id: string | null;
  yungou_key: string | null;
  yungou_wechat_id: string | null;
  yungou_wechat_key: string | null;
  yungou_alipay_id: string | null;
  yungou_alipay_key: string | null;
  yungou_alipay_h5: boolean | null;
  xunhu_id: string | null;
  xunhu_secret: string | null;
  xunhu_alipay_id: string | null;
  xunhu_alipay_secret: string | null;
  xunhu_alipay_h5: boolean;
  enable_alipay: boolean;
  alipay_provider: string;
  enable_wechat: boolean;
  wechat_provider: string;
  custom_commands: { shop: string[]; buy: string[]; order: string[] } | null;
  payment_notice: string | null;
  shop_expire_at: string | null;
  shop_trial_started_at: string | null;
  // 新增字段
  start_enabled: boolean | null;
  start_message: string | null;
  start_message_media_url: string | null;
  start_message_media_type: string | null;
  start_message_entities: any[] | null;
  start_disable_preview: boolean | null;
  shop_button_text: string | null;
  shop_button_text_en: string | null;
  order_button_text: string | null;
  order_button_text_en: string | null;
  shop_welcome_content: string | null;
  shop_welcome_media_url: string | null;
  shop_welcome_media_type: string | null;
  shop_welcome_entities: any[] | null;
  shop_welcome_disable_preview: boolean | null;
  order_welcome_content: string | null;
  order_welcome_media_url: string | null;
  order_welcome_media_type: string | null;
  order_welcome_entities: any[] | null;
  order_welcome_disable_preview: boolean | null;
  user_language_preferences: Record<string, string> | null;
  custom_categories: string[] | null;
  start_custom_buttons: Array<{ text: string; url: string }> | null;
  created_at: string;
  updated_at: string;
}

const defaultPaymentNotice = `⚠️ 超时订单将自动取消并删除
⚠️付款转账精确到小数点后面数值
⚠️虚拟货币转账不包含扣除的手续费
下面举个例子👇币安
例：金额10.12TRX+手续费1TRX=11.12TRX
tokenpocket（简称TP）
直接付金额10.12TRX（手续费扣余额）
币安充TRX提现到你的TP钱包
付错额度不会发货联系人工客服处理
✅ 支付成功后将自动发货到此对话`;

const defaultConfig: ShopConfig = {
  token: "",
  adminId: "",
  status: "offline",
  walletAddress: "TLUZ2paBKhXdXxDcRkjP1w3YbjnyZGDD6s",
  tronGridKey: "",
  acceptUsdt: true,
  acceptTrx: false,
  randomDecimals: true,
  connectionMode: "polling",
  webhookUrl: "",
  yungouId: "",
  yungouKey: "",
  yungouWechatId: "",
  yungouWechatKey: "",
  yungouAlipayId: "",
  yungouAlipayKey: "",
  yungouAlipayH5: false,
  xunhuId: "",
  xunhuSecret: "",
  xunhuAlipayId: "",
  xunhuAlipaySecret: "",
  xunhuAlipayH5: false,
  enableAlipay: false,
  alipayProvider: "xunhu",
  enableWechat: false,
  wechatProvider: "xunhu",
  customCommands: { shop: [], buy: [], order: [], balance: [], recharge: [] },
  paymentNotice: defaultPaymentNotice,
  // 新增默认值
  startEnabled: false,
  startMessage: "",
  startMessageMediaUrl: "",
  startMessageMediaType: "text",
  startMessageEntities: [],
  startDisablePreview: false,
  shopButtonText: "商城",
  shopButtonTextEn: "Shop",
  orderButtonText: "我的订单",
  orderButtonTextEn: "My Orders",
  shopWelcomeContent: "",
  shopWelcomeMediaUrl: "",
  shopWelcomeMediaType: "text",
  shopWelcomeEntities: [],
  shopWelcomeDisablePreview: false,
  orderWelcomeContent: "",
  orderWelcomeMediaUrl: "",
  orderWelcomeMediaType: "text",
  orderWelcomeEntities: [],
  orderWelcomeDisablePreview: false,
  userLanguagePreferences: {},
  customCategories: [],
  startCustomButtons: [],
};

// 转换数据库产品到前端格式
function dbProductToProduct(dbProduct: DbProduct): Product {
  return {
    id: dbProduct.id,
    name: dbProduct.name,
    price: Number(dbProduct.price),
    currency: dbProduct.currency as "USDT" | "TRX" | "CNY",
    keywords: dbProduct.keywords?.join(",") || "",
    keywordsList: dbProduct.keywords || [],
    stockContent: dbProduct.stock_content?.join("\n") || "",
    stockCount: dbProduct.stock_content?.length || 0,
    description: dbProduct.description || "",
    type: dbProduct.type === 'recharge' ? 'recharge' : dbProduct.type === 'physical' ? 'physical' : 'auto',
    category: dbProduct.category || "默认分类",
    stockQuantity: dbProduct.stock_quantity ?? undefined,
    imageUrl: dbProduct.image_url ?? undefined,
    createdAt: dbProduct.created_at,
    updatedAt: dbProduct.updated_at,
  };
}

// 转换前端产品到数据库格式
function productToDbProduct(product: Partial<Product>, botToken: string): Partial<DbProduct> {
  return {
    bot_token: botToken,
    name: product.name,
    price: product.price,
    currency: product.currency,
    keywords: product.keywordsList || product.keywords?.split(",").map((k) => k.trim().toLowerCase()) || [],
    stock_content: product.type === 'physical' ? [] : (product.stockContent?.split("\n").filter((l) => l.trim()) || []),
    description: product.description || null,
    category: product.category || "默认分类",
    type: product.type === 'recharge' ? 'recharge' : product.type === 'physical' ? 'physical' : 'goods',
    is_active: true,
    stock_quantity: product.type === 'physical' ? (product.stockQuantity ?? 0) : null,
    image_url: product.imageUrl || null,
  };
}

// 转换数据库订单到前端格式
function dbOrderToOrder(dbOrder: DbOrder): Order {
  return {
    id: dbOrder.id,
    orderId: dbOrder.order_no,
    productName: dbOrder.product_name,
    amount: Number(dbOrder.amount),
    currency: dbOrder.currency,
    status: dbOrder.status as "pending" | "paid" | "cancelled",
    customer: dbOrder.telegram_username || String(dbOrder.telegram_user_id) || "Unknown",
    createdAt: dbOrder.created_at,
    deliveryContent: dbOrder.delivery_content || undefined,
    paymentMethod: dbOrder.payment_method || undefined,
    orderType: (dbOrder as any).order_type || undefined,
    txHash: dbOrder.tx_hash || undefined,
  };
}

// 转换数据库配置到前端格式
function dbConfigToConfig(dbConfig: DbConfig): ShopConfig {
  return {
    token: dbConfig.bot_token,
    adminId: dbConfig.admin_id || "",
    status: "online",
    walletAddress: dbConfig.wallet_address || "",
    tronGridKey: dbConfig.tron_grid_key || "",
    acceptUsdt: dbConfig.accept_usdt,
    acceptTrx: dbConfig.accept_trx,
    randomDecimals: dbConfig.random_decimals,
    connectionMode: dbConfig.connection_mode as "polling" | "webhook",
    webhookUrl: dbConfig.webhook_url || "",
    yungouId: dbConfig.yungou_id || "",
    yungouKey: dbConfig.yungou_key || "",
    yungouWechatId: dbConfig.yungou_wechat_id || "",
    yungouWechatKey: dbConfig.yungou_wechat_key || "",
    yungouAlipayId: dbConfig.yungou_alipay_id || "",
    yungouAlipayKey: dbConfig.yungou_alipay_key || "",
    yungouAlipayH5: dbConfig.yungou_alipay_h5 || false,
    xunhuId: dbConfig.xunhu_id || "",
    xunhuSecret: dbConfig.xunhu_secret || "",
    xunhuAlipayId: dbConfig.xunhu_alipay_id || "",
    xunhuAlipaySecret: dbConfig.xunhu_alipay_secret || "",
    xunhuAlipayH5: dbConfig.xunhu_alipay_h5 || false,
    enableAlipay: dbConfig.enable_alipay,
    alipayProvider: dbConfig.alipay_provider as "yungou" | "xunhu",
    enableWechat: dbConfig.enable_wechat,
    wechatProvider: dbConfig.wechat_provider as "yungou" | "xunhu",
    customCommands: { shop: [], buy: [], order: [], balance: [], recharge: [], ...(dbConfig.custom_commands || {}) },
    paymentNotice: dbConfig.payment_notice || defaultPaymentNotice,
    shopExpireAt: dbConfig.shop_expire_at,
    shopTrialStartedAt: dbConfig.shop_trial_started_at,
    // 新增字段
    startEnabled: dbConfig.start_enabled || false,
    startMessage: dbConfig.start_message || "",
    startMessageMediaUrl: dbConfig.start_message_media_url || "",
    startMessageMediaType: (dbConfig.start_message_media_type as "text" | "photo" | "video") || "text",
    startMessageEntities: dbConfig.start_message_entities || [],
    startDisablePreview: dbConfig.start_disable_preview || false,
    shopButtonText: dbConfig.shop_button_text || "商城",
    shopButtonTextEn: dbConfig.shop_button_text_en || "Shop",
    orderButtonText: dbConfig.order_button_text || "我的订单",
    orderButtonTextEn: dbConfig.order_button_text_en || "My Orders",
    shopWelcomeContent: dbConfig.shop_welcome_content || "",
    shopWelcomeMediaUrl: dbConfig.shop_welcome_media_url || "",
    shopWelcomeMediaType: (dbConfig.shop_welcome_media_type as "text" | "photo" | "video") || "text",
    shopWelcomeEntities: dbConfig.shop_welcome_entities || [],
    shopWelcomeDisablePreview: dbConfig.shop_welcome_disable_preview || false,
    orderWelcomeContent: dbConfig.order_welcome_content || "",
    orderWelcomeMediaUrl: dbConfig.order_welcome_media_url || "",
    orderWelcomeMediaType: (dbConfig.order_welcome_media_type as "text" | "photo" | "video") || "text",
    orderWelcomeEntities: dbConfig.order_welcome_entities || [],
    orderWelcomeDisablePreview: dbConfig.order_welcome_disable_preview || false,
    userLanguagePreferences: dbConfig.user_language_preferences || {},
    customCategories: dbConfig.custom_categories || [],
    startCustomButtons: dbConfig.start_custom_buttons || [],
  };
}

// 转换前端配置到数据库格式
function configToDbConfig(config: Partial<ShopConfig>, botToken: string): Partial<DbConfig> {
  return {
    bot_token: botToken,
    admin_id: config.adminId || null,
    wallet_address: config.walletAddress || null,
    tron_grid_key: config.tronGridKey || null,
    accept_usdt: config.acceptUsdt,
    accept_trx: config.acceptTrx,
    random_decimals: config.randomDecimals,
    connection_mode: config.connectionMode,
    webhook_url: config.webhookUrl || null,
    yungou_id: config.yungouId || null,
    yungou_key: config.yungouKey || null,
    yungou_wechat_id: config.yungouWechatId || null,
    yungou_wechat_key: config.yungouWechatKey || null,
    yungou_alipay_id: config.yungouAlipayId || null,
    yungou_alipay_key: config.yungouAlipayKey || null,
    yungou_alipay_h5: config.yungouAlipayH5,
    xunhu_id: config.xunhuId || null,
    xunhu_secret: config.xunhuSecret || null,
    xunhu_alipay_id: config.xunhuAlipayId || null,
    xunhu_alipay_secret: config.xunhuAlipaySecret || null,
    xunhu_alipay_h5: config.xunhuAlipayH5,
    enable_alipay: config.enableAlipay,
    alipay_provider: config.alipayProvider,
    enable_wechat: config.enableWechat,
    wechat_provider: config.wechatProvider,
    custom_commands: config.customCommands || null,
    payment_notice: config.paymentNotice || null,
    // 新增字段
    start_enabled: config.startEnabled ?? null,
    start_message: config.startMessage || null,
    start_message_media_url: config.startMessageMediaUrl || null,
    start_message_media_type: config.startMessageMediaType || null,
    start_message_entities: config.startMessageEntities || null,
    start_disable_preview: config.startDisablePreview ?? null,
    shop_button_text: config.shopButtonText || null,
    shop_button_text_en: config.shopButtonTextEn || null,
    order_button_text: config.orderButtonText || null,
    order_button_text_en: config.orderButtonTextEn || null,
    shop_welcome_content: config.shopWelcomeContent || null,
    shop_welcome_media_url: config.shopWelcomeMediaUrl || null,
    shop_welcome_media_type: config.shopWelcomeMediaType || null,
    shop_welcome_entities: config.shopWelcomeEntities || null,
    shop_welcome_disable_preview: config.shopWelcomeDisablePreview ?? null,
    order_welcome_content: config.orderWelcomeContent || null,
    order_welcome_media_url: config.orderWelcomeMediaUrl || null,
    order_welcome_media_type: config.orderWelcomeMediaType || null,
    order_welcome_entities: config.orderWelcomeEntities || null,
    order_welcome_disable_preview: config.orderWelcomeDisablePreview ?? null,
    user_language_preferences: config.userLanguagePreferences || null,
    custom_categories: config.customCategories || null,
    start_custom_buttons: config.startCustomButtons || null,
  };
}

export function useShopData(botToken?: string) {
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [config, setConfig] = useState<ShopConfig>(defaultConfig);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  // 加载数据
  const loadData = useCallback(async () => {
    if (!botToken) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      // 并行加载所有数据
      const [productsRes, ordersRes, configRes] = await Promise.all([
        supabase.from("shop_products").select("*").eq("bot_token", botToken).order("created_at", { ascending: false }),
        supabase.from("shop_orders").select("*").eq("bot_token", botToken).order("created_at", { ascending: false }),
        supabase.from("shop_configs").select("*").eq("bot_token", botToken).maybeSingle(),
      ]);

      if (productsRes.data) {
        setProducts((productsRes.data as DbProduct[]).map(dbProductToProduct));
      }

      if (ordersRes.data) {
        setOrders((ordersRes.data as DbOrder[]).map(dbOrderToOrder));
      }

      if (configRes.data) {
        const rawData = configRes.data as unknown as DbConfig;
        const loadedConfig = dbConfigToConfig(rawData);
        
        // Auto-start 24h trial if no expire and no trial started
        if (!rawData.shop_expire_at && !rawData.shop_trial_started_at) {
          const trialStartTime = new Date().toISOString();
          await supabase
            .from("shop_configs")
            .update({ shop_trial_started_at: trialStartTime, updated_at: new Date().toISOString() } as any)
            .eq("bot_token", botToken);
          loadedConfig.shopTrialStartedAt = trialStartTime;
        }
        
        setConfig(loadedConfig);
      } else {
        // Create config with trial started
        const trialStartTime = new Date().toISOString();
        const newConfig = { ...defaultConfig, token: botToken, shopTrialStartedAt: trialStartTime };
        const dbConfig = configToDbConfig(newConfig, botToken);
        (dbConfig as any).shop_trial_started_at = trialStartTime;
        await supabase.from("shop_configs").insert(dbConfig as any);
        setConfig(newConfig);
      }
    } catch (error) {
      console.error("Failed to load shop data:", error);
    } finally {
      setIsLoading(false);
    }
  }, [botToken]);

  // 初始化加载
  useEffect(() => {
    loadData();
  }, [loadData]);

  // 保存配置
  const saveConfig = useCallback(
    async (newConfig: Partial<ShopConfig>) => {
      if (!botToken) {
        console.error("Cannot save config: botToken is missing");
        return false;
      }

      setIsSyncing(true);
      try {
        const mergedConfig = { ...config, ...newConfig };
        const dbConfig = configToDbConfig(mergedConfig, botToken);

        const { data: existing, error: selectError } = await supabase
          .from("shop_configs")
          .select("id")
          .eq("bot_token", botToken)
          .maybeSingle();

        if (selectError) {
          console.error("Failed to check existing config:", selectError);
          throw selectError;
        }

        if (existing) {
          const { error: updateError } = await supabase
            .from("shop_configs")
            .update(dbConfig as any)
            .eq("bot_token", botToken);

          if (updateError) {
            console.error("Failed to update config:", updateError);
            throw updateError;
          }
        } else {
          const { error: insertError } = await supabase.from("shop_configs").insert(dbConfig as any);

          if (insertError) {
            console.error("Failed to insert config:", insertError);
            throw insertError;
          }
        }

        // 确保该机器人会出现在管理员后台机器人列表
        try {
          await supabase.functions.invoke("manage-bot", {
            body: {
              action: "ensure-bot-listing",
              botToken,
              // 这里用 adminId 作为 personal_user_id 的一个合理默认值（为空则由后端回退到 userId）
              personalUserId: mergedConfig.adminId || "",
            },
          });
        } catch (e) {
          console.warn("[Shop] ensure-bot-listing failed (ignored):", e);
        }

        setConfig(mergedConfig);
        return true;
      } catch (error) {
        console.error("Failed to save config:", error);
        return false;
      } finally {
        setIsSyncing(false);
      }
    },
    [botToken, config],
  );

  // 添加商品
  const addProduct = useCallback(
    async (product: Omit<Product, "id">) => {
      if (!botToken) return null;

      setIsSyncing(true);
      try {
        const dbProduct = productToDbProduct(product, botToken);
        const { data, error } = await supabase
          .from("shop_products")
          .insert(dbProduct as any)
          .select()
          .single();

        if (error) throw error;

        const newProduct = dbProductToProduct(data as DbProduct);
        setProducts((prev) => [newProduct, ...prev]);
        return newProduct;
      } catch (error) {
        console.error("Failed to add product:", error);
        return null;
      } finally {
        setIsSyncing(false);
      }
    },
    [botToken],
  );

  // 更新商品
  const updateProduct = useCallback(
    async (id: string, updates: Partial<Product>) => {
      if (!botToken) return false;

      setIsSyncing(true);
      try {
        const dbUpdates = productToDbProduct(updates, botToken);
        delete (dbUpdates as any).bot_token; // 不更新 bot_token

        const { error } = await supabase
          .from("shop_products")
          .update(dbUpdates as any)
          .eq("id", id)
          .eq("bot_token", botToken);

        if (error) throw error;

        setProducts((prev) =>
          prev.map((p) => (p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p)),
        );
        return true;
      } catch (error) {
        console.error("Failed to update product:", error);
        return false;
      } finally {
        setIsSyncing(false);
      }
    },
    [botToken],
  );

  // 删除商品
  const deleteProduct = useCallback(
    async (id: string) => {
      if (!botToken) return false;

      setIsSyncing(true);
      try {
        const { error } = await supabase.from("shop_products").delete().eq("id", id).eq("bot_token", botToken);

        if (error) throw error;

        setProducts((prev) => prev.filter((p) => p.id !== id));
        return true;
      } catch (error) {
        console.error("Failed to delete product:", error);
        return false;
      } finally {
        setIsSyncing(false);
      }
    },
    [botToken],
  );

  // 添加订单
  const addOrder = useCallback(
    async (order: Omit<Order, "id">, productId?: string, telegramUserId?: number, telegramUsername?: string) => {
      if (!botToken) return null;

      setIsSyncing(true);
      try {
        const dbOrder = {
          bot_token: botToken,
          order_no: order.orderId,
          product_id: productId || null,
          product_name: order.productName,
          amount: order.amount,
          currency: order.currency,
          payment_method: order.currency === "CNY" ? "cny" : "crypto",
          status: order.status,
          telegram_user_id: telegramUserId || null,
          telegram_username: telegramUsername || order.customer,
        };

        const { data, error } = await supabase
          .from("shop_orders")
          .insert(dbOrder as any)
          .select()
          .single();

        if (error) throw error;

        const newOrder = dbOrderToOrder(data as DbOrder);
        setOrders((prev) => [newOrder, ...prev]);
        return newOrder;
      } catch (error) {
        console.error("Failed to add order:", error);
        return null;
      } finally {
        setIsSyncing(false);
      }
    },
    [botToken],
  );

  // 更新订单状态
  const updateOrderStatus = useCallback(
    async (orderId: string, status: Order["status"]) => {
      if (!botToken) return false;

      setIsSyncing(true);
      try {
        const { error } = await supabase
          .from("shop_orders")
          .update({ status })
          .eq("order_no", orderId)
          .eq("bot_token", botToken);

        if (error) throw error;

        setOrders((prev) => prev.map((o) => (o.orderId === orderId ? { ...o, status } : o)));
        return true;
      } catch (error) {
        console.error("Failed to update order status:", error);
        return false;
      } finally {
        setIsSyncing(false);
      }
    },
    [botToken],
  );

  // 清空指定状态的订单
  const clearOrdersByStatus = useCallback(
    async (status: Order["status"]) => {
      if (!botToken) return false;

      setIsSyncing(true);
      try {
        const { error } = await supabase.from("shop_orders").delete().eq("bot_token", botToken).eq("status", status);

        if (error) throw error;

        setOrders((prev) => prev.filter((o) => o.status !== status));
        return true;
      } catch (error) {
        console.error("Failed to clear orders:", error);
        return false;
      } finally {
        setIsSyncing(false);
      }
    },
    [botToken],
  );

  // 刷新数据
  const refreshData = useCallback(async () => {
    await loadData();
  }, [loadData]);

  return {
    products,
    orders,
    config,
    isLoading,
    isSyncing,
    saveConfig,
    addProduct,
    updateProduct,
    deleteProduct,
    addOrder,
    updateOrderStatus,
    clearOrdersByStatus,
    refreshData,
    setProducts,
    setOrders,
  };
}
