import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ========== TG商城类型定义 ==========
interface ShopProduct {
  id: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  stock_content: string[] | null;
  stock_quantity: number | null;
  is_active: boolean;
  keywords: string[] | null;
  category: string | null;
  type?: string; // 'goods' | 'recharge' | 'physical'
  image_url?: string | null;
}

interface ShopConfig {
  bot_token: string;
  wallet_address: string | null;
  accept_usdt: boolean;
  accept_trx: boolean;
  enable_alipay: boolean;
  enable_wechat: boolean;
  random_decimals: boolean;
  admin_id: string | null;
  xunhu_alipay_h5: boolean | null;
  custom_commands: { shop: string[]; buy: string[]; order: string[] } | null;
  payment_notice: string | null;
  // 新增字段
  start_enabled: boolean | null;
  start_message: string | null;
  start_message_media_url: string | null;
  start_message_media_type: string | null;
  start_disable_preview: boolean | null;
  shop_button_text: string | null;
  shop_button_text_en: string | null;
  order_button_text: string | null;
  order_button_text_en: string | null;
  shop_welcome_content: string | null;
  shop_welcome_media_url: string | null;
  shop_welcome_media_type: string | null;
  shop_welcome_disable_preview: boolean | null;
  order_welcome_content: string | null;
  order_welcome_media_url: string | null;
  order_welcome_media_type: string | null;
  order_welcome_disable_preview: boolean | null;
  user_language_preferences: Record<string, string> | null;
}

// ========== TG商城多语言翻译系统 ==========
const shopI18n: Record<string, { zh: string; en: string }> = {
  // 通用
  error_no_shop: { zh: "❌ 该机器人未配置商城功能", en: "❌ Shop not configured for this bot" },
  error_product_not_found: { zh: "❌ 商品不存在或已下架", en: "❌ Product not found or delisted" },
  error_no_stock: { zh: "暂无库存，请稍后再试", en: "Out of stock, please try later" },
  error_order_not_found: { zh: "❌ 订单不存在或已过期", en: "❌ Order not found or expired" },
  error_order_completed: { zh: "❌ 订单已完成或已取消", en: "❌ Order completed or cancelled" },
  error_order_create_failed: { zh: "❌ 订单创建失败，请稍后再试", en: "❌ Order creation failed, please try later" },
  error_payment_failed: { zh: "❌ 支付系统错误，请稍后重试", en: "❌ Payment system error, please try again" },
  error_qr_failed: { zh: "❌ 获取付款码失败", en: "❌ Failed to get payment QR code" },
  error_order_expired: { zh: "❌ 订单已过期", en: "❌ Order expired" },
  error_shop_config: { zh: "❌ 商店配置错误", en: "❌ Shop configuration error" },
  error_payment_not_configured: {
    zh: "❌ 支付未配置，请联系管理员",
    en: "❌ Payment not configured, please contact admin",
  },

  // /shop 商城
  shop_no_products: { zh: "📦 暂无可购买的商品", en: "📦 No products available" },
  shop_categories_title: { zh: "🏪 **商城商品分类**", en: "🏪 **Shop Categories**" },
  shop_total_products: { zh: "共 {count} 件商品，{cats} 个分类", en: "Total {count} products in {cats} categories" },
  shop_click_category: { zh: "💡 点击下方分类查看商品", en: "💡 Click a category below to view products" },
  shop_category_items: { zh: "📂 {name} ({count}件)", en: "📂 {name} ({count} items)" },
  shop_back_to_categories: { zh: "🔙 返回分类列表", en: "🔙 Back to categories" },
  shop_category_title: { zh: "🏪 **{name}** ({count}件商品)", en: "🏪 **{name}** ({count} products)" },
  shop_stock: { zh: "库存", en: "Stock" },
  shop_out_of_stock: { zh: "缺货", en: "Out of stock" },
  shop_recharge_product: { zh: "余额充值", en: "Balance recharge" },
  shop_physical_product: { zh: "实物商品", en: "Physical" },
  shop_click_to_buy: { zh: "点击购买👉", en: "Buy now👉" },
  shop_buy_tip: { zh: "💡 点击上方指令直接购买对应商品", en: "💡 Click the command above to buy the product" },

  // /buy 购买
  buy_usage: {
    zh: "❌ 使用方法: /buy <商品名>\n\n例如: /buy VIP会员\n\n发送 /shop 查看所有商品",
    en: "❌ Usage: /buy <product name>\n\nExample: /buy VIP\n\nSend /shop to view all products",
  },
  buy_no_products: { zh: "❌ 暂无可购买的商品", en: "❌ No products available" },
  buy_not_found: { zh: "❌ 未找到匹配商品", en: "❌ No matching product found" },
  buy_available_products: { zh: "📦 可用商品", en: "📦 Available products" },
  buy_use_command: { zh: "使用 /buy <商品名> 购买", en: "Use /buy <product name> to purchase" },
  buy_found_multiple: {
    zh: '🔍 找到 {count} 个匹配 "{keyword}" 的商品',
    en: '🔍 Found {count} products matching "{keyword}"',
  },

  // 订单
  order_created: { zh: "🛒 *订单已创建*", en: "🛒 *Order Created*" },
  order_product: { zh: "📦 商品", en: "📦 Product" },
  order_amount: { zh: "💰 金额", en: "💰 Amount" },
  order_no: { zh: "📝 订单号", en: "📝 Order No" },
  order_stock: { zh: "📊 库存", en: "📊 Stock" },
  order_items: { zh: "件", en: "items" },
  order_select_payment: { zh: "💳 *请选择支付方式:*", en: "💳 *Please select payment method:*" },
  order_valid_time: { zh: "⏰ 订单有效期: 30分钟", en: "⏰ Valid for: 30 minutes" },
  order_timeout_warning: { zh: "⚠️ 超时订单将自动取消", en: "⚠️ Order will be cancelled if timeout" },
  order_cancelled: { zh: "✅ 订单已取消", en: "✅ Order cancelled" },
  order_cancel_btn: { zh: "❌ 取消订单", en: "❌ Cancel Order" },

  // 支付详情
  payment_details_title: { zh: "🛒 *订单支付详情*", en: "🛒 *Payment Details*" },
  payment_method: { zh: "💎 支付方式", en: "💎 Payment Method" },
  payment_amount: { zh: "💰 需支付", en: "💰 Amount to pay" },
  payment_address: { zh: "📍 网络收款地址 (点击复制)", en: "📍 Wallet address (click to copy)" },
  payment_scan_qr: { zh: "📱 请扫描上方二维码完成支付", en: "📱 Please scan the QR code above to pay" },
  payment_h5_tip: {
    zh: '📱 请点击下方"去支付"按钮，在浏览器中打开后唤起支付宝完成支付',
    en: '📱 Click the "Pay Now" button below to complete payment via Alipay',
  },
  payment_deadline: { zh: "⏰ 支付截止", en: "⏰ Payment deadline" },
  payment_30min: { zh: "30分钟", en: "30 minutes" },
  payment_auto_cancel: { zh: "⚠️ 超时订单将自动取消并删除", en: "⚠️ Order will be auto-cancelled if timeout" },
  payment_auto_deliver: { zh: "✅ 支付成功后将自动发货到此对话", en: "✅ Order will be delivered here after payment" },
  payment_alipay: { zh: "支付宝", en: "Alipay" },
  payment_wechat: { zh: "微信支付", en: "WeChat Pay" },
  payment_go_pay: { zh: "💳 去支付", en: "💳 Pay Now" },
  payment_crypto_network: { zh: "当前支付网络协议为 （TRX/TRC20）", en: "Payment network: TRX/TRC20" },
  payment_scan_wechat: { zh: "请用微信扫一扫完成支付！", en: "Please scan with WeChat to pay!" },
  payment_scan_alipay: { zh: "请用支付宝扫一扫完成支付！", en: "Please scan with Alipay to pay!" },

  // /order 订单查询
  order_not_found: { zh: "❌ 未找到已付款订单", en: "❌ No paid order found" },
  order_details_title: { zh: "📋 **订单详情**", en: "📋 **Order Details**" },
  order_status_paid: { zh: "✅ 已支付", en: "✅ Paid" },
  order_created_at: { zh: "创建时间", en: "Created at" },
  order_card_key: { zh: "📦 **卡密:**", en: "📦 **Card/Key:**" },
  order_no_history: { zh: "📋 您暂无已购买的订单", en: "📋 You have no purchased orders" },
  order_history_title: { zh: "📋 **您的已购订单** (最近10条)", en: "📋 **Your Purchased Orders** (Last 10)" },
  order_click_to_view: {
    zh: "💡 点击上面订单号可复制粘贴发送查询详情",
    en: "💡 Click order number above to copy and send for details",
  },
  order_status: { zh: "状态", en: "Status" },

  // 语言切换
  lang_switched_zh: { zh: "🌐 已切换为中文", en: "🌐 Switched to Chinese" },
  lang_switched_en: { zh: "🌐 Language switched to English", en: "🌐 Language switched to English" },

  // 默认分类
  default_category: { zh: "默认分类", en: "Default" },

  // /start 按钮
  btn_shop: { zh: "商城", en: "Shop" },
  btn_order: { zh: "我的订单", en: "My Orders" },

  // 法币支付相关
  fiat_payment_title: { zh: "💳 *{method}支付*", en: "💳 *{method} Payment*" },
  fiat_scan_qr: { zh: "📱 请扫描上方二维码完成支付", en: "📱 Please scan the QR code above to pay" },
  fiat_timeout_warning: { zh: "⚠️ 超时订单将自动取消", en: "⚠️ Order will be auto-cancelled if timeout" },
  fiat_auto_deliver: { zh: "✅ 支付成功后将自动发货到此对话", en: "✅ Order will be delivered here after payment" },

  // 余额相关
  balance_title: { zh: "💳 您当前的账户可用余额为：", en: "💳 Your current available balance is: " },
  balance_no_account: { zh: "💳 您的账户余额为 0，尚未充值。", en: "💳 Your balance is 0. No recharge yet." },
  balance_recharge_hint: { zh: "\n\n💡 发送 /recharge 进行充值", en: "\n\n💡 Send /recharge to top up" },
  recharge_title: { zh: "💰 **充值中心**", en: "💰 **Recharge Center**" },
  recharge_no_products: { zh: "暂无充值商品，请联系管理员配置", en: "No recharge products available. Contact admin." },
  recharge_select: { zh: "💡 点击上方指令充值金额进行充值", en: "💡 Click the command above to recharge" },
  balance_pay: { zh: "💰 余额支付", en: "💰 Balance Pay" },
  balance_insufficient: {
    zh: "❌ 余额不足！当前余额: {balance} {currency}\n需要: {amount} {currency}\n\n💡 发送 /recharge 充值",
    en: "❌ Insufficient balance! Current: {balance} {currency}\nRequired: {amount} {currency}\n\n💡 Send /recharge to top up",
  },
  balance_pay_success: { zh: "✅ **余额支付成功！**", en: "✅ **Balance payment successful!**" },
  // 实物商品
  physical_need_address: { zh: "📮 请发送您的收货地址（姓名+电话+地址），我们将尽快为您发货：", en: "📮 Please send your shipping address (name + phone + address) for delivery:" },
  physical_address_received: { zh: "✅ 收货地址已记录，等待管理员处理发货", en: "✅ Shipping address recorded, waiting for admin to process" },
  physical_order_paid: { zh: "📦 **实物商品订单已支付**", en: "📦 **Physical product order paid**" },
  physical_admin_notify: { zh: "📦 新实物商品订单需要发货！", en: "📦 New physical product order needs shipping!" },
};

// 获取翻译文本
function t(key: string, lang: "zh" | "en", params?: Record<string, string | number>): string {
  const item = shopI18n[key];
  if (!item) return key;
  let text = item[lang] || item.zh;
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      text = text.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
    });
  }
  return text;
}

// ========== TG商城内容自动翻译（用于商品名/分类名/自定义文案） ==========
// 说明：系统内置文案用 t()；用户自定义内容（商品标题/详情/分类/支付说明等）在英文模式下自动从中文翻译成英文。
const translationCache = new Map<string, string>();

function containsCjk(text: string): boolean {
  return /[\u3400-\u9FFF]/.test(text);
}

async function translateManyToEnglish(texts: string[]): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  const unique = Array.from(new Set(texts.map((t) => (t || "").trim()).filter(Boolean)));

  // cache hit
  for (const t of unique) {
    const cached = translationCache.get(t);
    if (cached) result[t] = cached;
  }

  const need = unique.filter((t) => !result[t] && containsCjk(t));
  if (need.length === 0) return result;

  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) {
    // 没有启用AI网关时，直接返回原文（不阻断业务流）
    for (const t of need) result[t] = t;
    return result;
  }

  try {
    const prompt = [
      "You are a professional Chinese->English translator for a Telegram shop bot.",
      "Translate each item in the JSON array into natural, concise English.",
      "- Keep brand names (e.g., Netflix) as proper nouns.",
      "- Keep numbers, emojis, and formatting characters.",
      "- Do NOT add extra commentary.",
      "Return ONLY a JSON array of translated strings in the same order.",
    ].join("\n");

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        temperature: 0.2,
        messages: [
          { role: "system", content: prompt },
          { role: "user", content: JSON.stringify(need) },
        ],
      }),
    });

    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content ?? "";

    let translatedArr: string[] | null = null;
    try {
      translatedArr = JSON.parse(content);
    } catch {
      // 某些模型可能会包裹 ```json
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        translatedArr = JSON.parse(jsonMatch[0]);
      }
    }

    if (!translatedArr || !Array.isArray(translatedArr)) {
      for (const t of need) result[t] = t;
      return result;
    }

    for (let i = 0; i < need.length; i++) {
      const src = need[i];
      const dst = (translatedArr[i] ?? src).toString().trim() || src;
      translationCache.set(src, dst);
      result[src] = dst;
    }

    return result;
  } catch (e) {
    console.error("[TG Shop] translateManyToEnglish failed:", e);
    for (const t of need) result[t] = t;
    return result;
  }
}

async function localizeText(text: string | null | undefined, lang: "zh" | "en"): Promise<string> {
  if (!text) return "";
  const trimmed = String(text);
  if (lang !== "en") return trimmed;
  if (!containsCjk(trimmed)) return trimmed;
  const map = await translateManyToEnglish([trimmed]);
  return map[trimmed] || trimmed;
}

// 生成随机小数防撞单 - 加密货币 (0.001-0.019，三位小数)
function generateRandomDecimal(price: number, enabled: boolean): number {
  if (!enabled) return price;
  // 生成 1-19 的随机数，代表 0.001-0.019
  const randomMills = Math.floor(Math.random() * 19) + 1; // 1-19
  return Math.round((price + randomMills / 1000) * 1000) / 1000;
}

// 生成随机小数防撞单 - 法币CNY (0.01-0.09，两位小数)
function generateRandomDecimalCny(price: number, enabled: boolean): number {
  if (!enabled) return price;
  // 生成 1-9 的随机数，代表 0.01-0.09
  const randomCents = Math.floor(Math.random() * 9) + 1; // 1-9
  return Math.round((price + randomCents / 100) * 100) / 100;
}

// 从币安获取TRX/USDT实时汇率
async function getTrxUsdtRate(): Promise<number> {
  try {
    const response = await fetch("https://api.binance.com/api/v3/ticker/price?symbol=TRXUSDT");
    if (!response.ok) {
      console.error("[TG Shop] Failed to fetch TRX rate from Binance:", response.status);
      return 0;
    }
    const data = await response.json();
    const rate = parseFloat(data.price);
    console.log(`[TG Shop] TRX/USDT rate from Binance: ${rate}`);
    return rate;
  } catch (error) {
    console.error("[TG Shop] Error fetching TRX rate:", error);
    return 0;
  }
}

// 从币安获取CNY/USDT汇率 (使用USDT/CNY交易对)
async function getCnyUsdtRate(): Promise<number> {
  try {
    // 币安P2P参考价格，使用FDUSD/USDT作为参考 (或使用固定汇率作为备选)
    // 由于币安没有直接的CNY交易对，我们使用一个相对稳定的汇率API
    const response = await fetch("https://api.exchangerate-api.com/v4/latest/USD");
    if (!response.ok) {
      console.error("[TG Shop] Failed to fetch CNY rate:", response.status);
      // 使用备用固定汇率
      return 7.25;
    }
    const data = await response.json();
    const cnyRate = data.rates?.CNY || 7.25;
    console.log(`[TG Shop] USD/CNY rate: ${cnyRate}`);
    return cnyRate;
  } catch (error) {
    console.error("[TG Shop] Error fetching CNY rate:", error);
    // 使用备用固定汇率
    return 7.25;
  }
}

// 将TRX金额转换为USDT金额
async function convertTrxToUsdt(trxAmount: number): Promise<{ usdtAmount: number; rate: number }> {
  const rate = await getTrxUsdtRate();
  if (rate <= 0) {
    return { usdtAmount: 0, rate: 0 };
  }
  // TRX * TRX价格 = USDT
  const usdtAmount = Math.round(trxAmount * rate * 1000) / 1000;
  console.log(`[TG Shop] TRX ${trxAmount} -> USDT ${usdtAmount} (rate: ${rate})`);
  return { usdtAmount, rate };
}

// 将CNY金额转换为USDT金额
async function convertCnyToUsdt(cnyAmount: number): Promise<{ usdtAmount: number; rate: number }> {
  const rate = await getCnyUsdtRate();
  // CNY / 汇率 = USDT
  const usdtAmount = Math.round((cnyAmount / rate) * 1000) / 1000;
  console.log(`[TG Shop] CNY ${cnyAmount} -> USDT ${usdtAmount} (rate: ${rate})`);
  return { usdtAmount, rate };
}

// 将USDT金额转换为CNY金额
async function convertUsdtToCny(usdtAmount: number): Promise<{ cnyAmount: number; rate: number }> {
  const rate = await getCnyUsdtRate();
  // USDT * 汇率 = CNY
  const cnyAmount = Math.round(usdtAmount * rate * 100) / 100;
  console.log(`[TG Shop] USDT ${usdtAmount} -> CNY ${cnyAmount} (rate: ${rate})`);
  return { cnyAmount, rate };
}

// 将USDT金额转换为TRX金额
async function convertUsdtToTrx(usdtAmount: number): Promise<{ trxAmount: number; rate: number }> {
  const rate = await getTrxUsdtRate();
  if (rate <= 0) {
    return { trxAmount: 0, rate: 0 };
  }
  // USDT / TRX价格 = TRX数量
  const trxAmount = Math.round((usdtAmount / rate) * 1000) / 1000;
  return { trxAmount, rate };
}

// 生成订单号
function generateOrderNo(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `TG${timestamp}${random}`;
}

// 处理 /buy 命令 - 创建订单并让用户选择支付方式
async function handleBuyCommand(
  supabase: any,
  botToken: string,
  chatId: number,
  username: string | null,
  text: string,
  lang: "zh" | "en" = "zh",
): Promise<{ handled: boolean; message?: string; inlineKeyboard?: any; orderId?: string }> {
  // 解析命令: /buy <商品名或关键词> 或 /buy_<productId>（无横杆格式）
  const directBuyMatch = text.match(/^\/buy_([a-f0-9]{32})$/i);

  // 如果是直接购买命令 /buy_<productId>（无横杆格式）
  if (directBuyMatch) {
    // 将无横杆的ID还原为UUID格式
    const rawId = directBuyMatch[1];
    const productId = `${rawId.slice(0, 8)}-${rawId.slice(8, 12)}-${rawId.slice(12, 16)}-${rawId.slice(16, 20)}-${rawId.slice(20)}`;
    return await createOrderForProduct(supabase, botToken, chatId, username, productId, undefined, undefined, lang);
  }

  const match = text.match(/^\/buy\s+(.+)$/i);
  if (!match) {
    return {
      handled: true,
      message: t("buy_usage", lang),
    };
  }

  const keyword = match[1].trim().toLowerCase();

  // 获取商店配置
  const { data: shopConfig } = await supabase.from("shop_configs").select("*").eq("bot_token", botToken).maybeSingle();

  if (!shopConfig) {
    return { handled: true, message: t("error_no_shop", lang) };
  }

  // 搜索商品 (按名称或关键词)
  const { data: products } = await supabase
    .from("shop_products")
    .select("*")
    .eq("bot_token", botToken)
    .eq("is_active", true);

  if (!products || products.length === 0) {
    return { handled: true, message: t("buy_no_products", lang) };
  }

  // 模糊匹配所有商品
  const matchedProducts = products.filter((p: ShopProduct) => {
    const nameMatch = p.name.toLowerCase().includes(keyword);
    const keywordMatch = p.keywords?.some((k: string) => k.toLowerCase().includes(keyword));
    return nameMatch || keywordMatch;
  });

  if (matchedProducts.length === 0) {
    // 英文模式下：把商品列表里的中文商品名也自动翻译
    const names = lang === "en" ? (products as ShopProduct[]).map((p) => p.name) : [];
    const nameMap = lang === "en" ? await translateManyToEnglish(names) : {};

    const productList = (products as ShopProduct[])
      .map((p: ShopProduct) => {
        const displayName = lang === "en" ? nameMap[p.name] || p.name : p.name;
        return `• ${displayName} - ${p.price} ${p.currency}`;
      })
      .join("\n");

    return {
      handled: true,
      message: `${t("buy_not_found", lang)}: "${keyword}"\n\n${t("buy_available_products", lang)}:\n${productList}\n\n${t("buy_use_command", lang)}`,
    };
  }

  // 如果匹配到多个商品，显示商品列表供用户选择
  if (matchedProducts.length > 1) {
    const stockLabel = t("shop_stock", lang);
    const outOfStockLabel = t("shop_out_of_stock", lang);
    const buyLabel = t("shop_click_to_buy", lang);

    // 英文模式下：翻译匹配到的商品名
    const names = lang === "en" ? matchedProducts.map((p: ShopProduct) => p.name) : [];
    const nameMap = lang === "en" ? await translateManyToEnglish(names) : {};

    const productLines = matchedProducts.map((p: ShopProduct) => {
      const stock = p.type === "physical" ? (p.stock_quantity ?? 0) : (p.stock_content?.length || 0);
      const isRecharge = p.type === "recharge";
      const isPhysical = p.type === "physical";
      const stockText = isRecharge
        ? `(${t("shop_recharge_product", lang)})`
        : isPhysical
          ? `(${t("shop_physical_product", lang)} ${stock > 0 ? `${stockLabel}: ${stock}` : outOfStockLabel})`
          : stock > 0
            ? `(${stockLabel}: ${stock})`
            : `(${outOfStockLabel})`;
      const shortId = p.id.replace(/-/g, "");
      const displayName = lang === "en" ? nameMap[p.name] || p.name : p.name;
      return `📦 **${displayName}** - ${p.price} ${p.currency} ${stockText}\n${buyLabel} /buy\\_${shortId}`;
    });

    return {
      handled: true,
      message: `${t("buy_found_multiple", lang, { count: matchedProducts.length, keyword })}\n\n${productLines.join("\n\n")}\n\n────────────────\n${t("shop_buy_tip", lang)}`,
    };
  }

  // 只匹配到一个商品，直接创建订单
  const product = matchedProducts[0];
  return await createOrderForProduct(supabase, botToken, chatId, username, product.id, product, shopConfig, lang);
}

// 为指定商品创建订单
async function createOrderForProduct(
  supabase: any,
  botToken: string,
  chatId: number,
  username: string | null,
  productId: string,
  preloadedProduct?: ShopProduct,
  preloadedShopConfig?: ShopConfig,
  lang: "zh" | "en" = "zh",
): Promise<{ handled: boolean; message?: string; inlineKeyboard?: any; orderId?: string }> {
  // 获取商店配置（如果没有预加载）
  let shopConfig = preloadedShopConfig;
  if (!shopConfig) {
    const { data: configData } = await supabase
      .from("shop_configs")
      .select("*")
      .eq("bot_token", botToken)
      .maybeSingle();

    if (!configData) {
      return { handled: true, message: t("error_no_shop", lang) };
    }
    shopConfig = configData;
  }

  // 获取商品（如果没有预加载）
  let product: ShopProduct | null = preloadedProduct || null;
  if (!product) {
    const { data: productData } = await supabase
      .from("shop_products")
      .select("*")
      .eq("id", productId)
      .eq("bot_token", botToken)
      .eq("is_active", true)
      .maybeSingle();

    if (!productData) {
      return { handled: true, message: t("error_product_not_found", lang) };
    }
    product = productData as ShopProduct;
  }

  // TypeScript guard - 此时 product 必定存在
  if (!product) {
    return { handled: true, message: t("error_product_not_found", lang) };
  }

  // 检查库存 (充值商品不需要库存)
  if (product.type === "physical") {
    // 实物商品检查数量库存
    if (product.stock_quantity !== null && product.stock_quantity !== undefined && product.stock_quantity <= 0) {
      const displayName = await localizeText(product.name, lang);
      return { handled: true, message: `❌ "${displayName}" ${t("error_no_stock", lang)}` };
    }
  } else if (product.type !== "recharge" && (!product.stock_content || product.stock_content.length === 0)) {
    const displayName = await localizeText(product.name, lang);
    return { handled: true, message: `❌ "${displayName}" ${t("error_no_stock", lang)}` };
  }

  // 生成订单
  const orderNo = generateOrderNo();
  const basePrice = product.price;

  // 计算过期时间 (30分钟后)
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

  // 创建订单 (payment_method 为 pending，等用户选择)
  const { data: newOrder, error: orderError } = await supabase
    .from("shop_orders")
    .insert({
      bot_token: botToken,
      order_no: orderNo,
      product_id: product.id,
      product_name: product.name,
      amount: basePrice,
      currency: product.currency,
      payment_method: "pending",
      telegram_user_id: chatId,
      telegram_username: username,
      telegram_chat_id: chatId,
      expires_at: expiresAt,
      status: "pending",
      order_type: product.type === "recharge" ? "recharge" : product.type === "physical" ? "physical" : "purchase",
    })
    .select()
    .single();

  if (orderError) {
    console.error("[TG Shop] Order creation failed:", orderError);
    return { handled: true, message: t("error_order_create_failed", lang) };
  }

  // 计算各货币等值金额用于显示
  let usdtAmount = 0;
  let trxAmount = 0;
  let cnyAmount = 0;

  if (product.currency === "CNY") {
    cnyAmount = basePrice;
    const cnyConversion = await convertCnyToUsdt(basePrice);
    usdtAmount = cnyConversion.usdtAmount;
    const trxConversion = await convertUsdtToTrx(usdtAmount);
    trxAmount = trxConversion.trxAmount;
  } else if (product.currency === "TRX") {
    trxAmount = basePrice;
    const trxConversion = await convertTrxToUsdt(basePrice);
    usdtAmount = trxConversion.usdtAmount;
    const cnyConversion = await convertUsdtToCny(usdtAmount);
    cnyAmount = cnyConversion.cnyAmount;
  } else {
    // USDT
    usdtAmount = basePrice;
    const cnyConversion = await convertUsdtToCny(basePrice);
    cnyAmount = cnyConversion.cnyAmount;
    const trxConversion = await convertUsdtToTrx(usdtAmount);
    trxAmount = trxConversion.trxAmount;
  }

  // 构建支付方式选择按钮
  const paymentButtons: any[][] = [];

  // 虚拟货币支付选项
  if (shopConfig!.accept_usdt) {
    paymentButtons.push([{ text: `💎 USDT(TRC20) ≈${usdtAmount} USDT`, callback_data: `pay_usdt_${orderNo}` }]);
  }
  if (shopConfig!.accept_trx) {
    paymentButtons.push([{ text: `💎 TRX ≈${trxAmount} TRX`, callback_data: `pay_trx_${orderNo}` }]);
  }
  // 法币支付选项
  if (shopConfig!.enable_alipay) {
    paymentButtons.push([
      { text: `💳 ${t("payment_alipay", lang)} ¥${cnyAmount}`, callback_data: `pay_alipay_${orderNo}` },
    ]);
  }
  if (shopConfig!.enable_wechat) {
    paymentButtons.push([
      { text: `💚 ${t("payment_wechat", lang)} ¥${cnyAmount}`, callback_data: `pay_wechat_${orderNo}` },
    ]);
  }

  // 余额支付选项 (仅对非充值商品显示，无论余额多少都显示)
  if (product.type !== "recharge") {
    // 查询用户余额
    const { data: userBalance } = await supabase
      .from("shop_user_balances")
      .select("balance, currency")
      .eq("bot_token", botToken)
      .eq("telegram_user_id", chatId)
      .maybeSingle();

    const balanceDisplay = userBalance ? parseFloat(userBalance.balance).toFixed(2) : "0.00";
    const balanceCurrency = userBalance?.currency || product.currency;
    paymentButtons.push([
      {
        text: `${t("balance_pay", lang)} (${balanceDisplay} ${balanceCurrency})`,
        callback_data: `pay_balance_${orderNo}`,
      },
    ]);
  }

  // 取消按钮
  paymentButtons.push([{ text: t("order_cancel_btn", lang), callback_data: `pay_cancel_${orderNo}` }]);

  // 构建订单信息显示
  let amountDisplay = `${basePrice} ${product.currency}`;
  if (product.currency === "CNY" && usdtAmount > 0) {
    amountDisplay += ` (≈${usdtAmount} USDT ≈${trxAmount} TRX)`;
  } else if (product.currency === "TRX" && usdtAmount > 0) {
    amountDisplay += ` (≈${usdtAmount} USDT ≈¥${cnyAmount})`;
  } else if (product.currency === "USDT" && cnyAmount > 0) {
    amountDisplay += ` (≈¥${cnyAmount} ≈${trxAmount} TRX)`;
  }

  const itemsLabel = t("order_items", lang);
  const displayProductName = await localizeText(product.name, lang);
  const isRechargeProduct = product.type === "recharge";
  const isPhysicalProduct = product.type === "physical";
  const stockLine = isRechargeProduct
    ? ""
    : isPhysicalProduct
    ? (product.stock_quantity !== null ? `\n${t("order_stock", lang)}: ${product.stock_quantity} ${itemsLabel}` : "")
    : `\n${t("order_stock", lang)}: ${product.stock_content?.length || 0} ${itemsLabel}`;
  const message = `${t("order_created", lang)}

${t("order_product", lang)}: ${displayProductName}
${t("order_amount", lang)}: ${amountDisplay}
${t("order_no", lang)}: \`${orderNo}\`${stockLine}

────────────────
${t("order_select_payment", lang)}

${t("order_valid_time", lang)}
${t("order_timeout_warning", lang)}`;

  return {
    handled: true,
    message,
    inlineKeyboard: { inline_keyboard: paymentButtons },
    orderId: newOrder.id,
    photoUrl: product.image_url || undefined,
  };
}

// 处理支付方式选择回调 - 显示支付详情
async function handlePaymentMethodCallback(
  supabase: any,
  botToken: string,
  chatId: number,
  callbackData: string,
  messageId: number,
  lang: "zh" | "en" = "zh",
): Promise<{
  handled: boolean;
  message?: string;
  cryptoQrUrl?: string;
  orderId?: string;
  paymentMethod?: string;
  h5PayUrl?: string;
}> {
  // 解析回调: pay_<method>_<orderNo>
  const match = callbackData.match(/^pay_(usdt|trx|alipay|wechat|balance|cancel)_(.+)$/i);
  if (!match) {
    return { handled: false };
  }

  const paymentMethod = match[1].toLowerCase();
  const orderNo = match[2];

  // 获取订单
  const { data: order, error: orderError } = await supabase
    .from("shop_orders")
    .select("*, shop_products(*)")
    .eq("order_no", orderNo)
    .maybeSingle();

  if (orderError || !order) {
    return { handled: true, message: t("error_order_not_found", lang) };
  }

  if (order.status !== "pending") {
    return { handled: true, message: t("error_order_completed", lang) };
  }

  // 处理取消订单
  if (paymentMethod === "cancel") {
    await supabase
      .from("shop_orders")
      .update({ status: "cancelled", payment_method: "cancelled" })
      .eq("order_no", orderNo);

    // 删除原消息
    await sendTelegramMessage(botToken, "deleteMessage", {
      chat_id: chatId,
      message_id: messageId,
    });

    return { handled: true, message: `${t("order_cancelled", lang)} \`${orderNo}\`` };
  }

  // 处理余额支付
  if (paymentMethod === "balance") {
    // 获取用户余额
    const { data: userBalance } = await supabase
      .from("shop_user_balances")
      .select("*")
      .eq("bot_token", botToken)
      .eq("telegram_user_id", chatId)
      .maybeSingle();

    // 需要用商品原始币种的价格来扣余额
    const deductAmount = parseFloat(order.original_amount || order.amount);
    const deductCurrency = order.original_currency || order.currency;
    const currentBalance = userBalance ? parseFloat(userBalance.balance) : 0;

    if (currentBalance < deductAmount) {
      return {
        handled: true,
        message: t("balance_insufficient", lang, {
          balance: currentBalance.toFixed(2),
          amount: deductAmount.toFixed(2),
          currency: deductCurrency,
        }),
      };
    }

    // 扣除余额
    const newBalance = currentBalance - deductAmount;
    await supabase
      .from("shop_user_balances")
      .update({ balance: newBalance, updated_at: new Date().toISOString() })
      .eq("id", userBalance.id);

    // 记录消费流水
    await supabase.from("shop_balance_transactions").insert({
      bot_token: botToken,
      telegram_user_id: chatId,
      type: "purchase",
      amount: -deductAmount,
      balance_after: newBalance,
      order_no: orderNo,
      description: `购买 ${order.product_name}`,
    });

    // 获取商品信息
    let deliveryContent = "";
    let isPhysicalOrder = false;
    if (order.product_id) {
      const { data: product } = await supabase
        .from("shop_products")
        .select("stock_content, type, stock_quantity")
        .eq("id", order.product_id)
        .single();

      if (product?.type === "physical") {
        isPhysicalOrder = true;
        // 实物商品：原子扣减数量库存
        const { data: newQty } = await supabase.rpc("decrement_stock_quantity", { p_product_id: order.product_id });
        console.log(`[TG Shop] Physical product stock decremented, new quantity: ${newQty}`);
        deliveryContent = lang === "zh" ? "实物商品-等待发货" : "Physical product - awaiting shipment";
      } else if (product?.stock_content && product.stock_content.length > 0) {
        deliveryContent = product.stock_content[0];
        const remainingStock = product.stock_content.slice(1);
        await supabase.from("shop_products").update({ stock_content: remainingStock }).eq("id", order.product_id);
      } else {
        deliveryContent = "库存不足，请联系管理员补货";
      }
    }

    // 更新订单
    await supabase
      .from("shop_orders")
      .update({
        status: "paid",
        payment_method: "balance",
        amount: deductAmount,
        currency: deductCurrency,
        delivery_content: deliveryContent,
        delivered_at: isPhysicalOrder ? null : new Date().toISOString(),
      })
      .eq("order_no", orderNo);

    // 删除原消息
    await sendTelegramMessage(botToken, "deleteMessage", {
      chat_id: chatId,
      message_id: messageId,
    });

    const displayProductName = await localizeText(order.product_name, lang);

    if (isPhysicalOrder) {
      // 实物商品：提示用户发送收货地址
      const message = `${t("balance_pay_success", lang)}

${t("order_product", lang)}: ${displayProductName}
${t("order_amount", lang)}: ${deductAmount} ${deductCurrency}
${t("order_no", lang)}: \`${orderNo}\`
💳 ${lang === "zh" ? "剩余余额" : "Remaining balance"}: ${newBalance.toFixed(2)} ${deductCurrency}

────────────────
${t("physical_need_address", lang)}`;

      // 通知管理员
      const { data: shopConfig } = await supabase.from("shop_configs").select("admin_id").eq("bot_token", botToken).maybeSingle();
      if (shopConfig?.admin_id) {
        const adminMsg = `✅ **${lang === "zh" ? "用户已付款！实物商品订单需要发货！" : "User has paid! Physical product order needs shipping!"}**

📝 ${orderNo}
📦 ${order.product_name}
💰 ${deductAmount} ${deductCurrency}
👤 @${order.telegram_username || chatId}

⏳ ${lang === "zh" ? "等待用户提供收货地址" : "Waiting for user to provide shipping address"}`;
        await sendTelegramMessage(botToken, "sendMessage", {
          chat_id: shopConfig.admin_id,
          text: adminMsg,
          parse_mode: "Markdown",
        });
      }

      return { handled: true, message };
    }

    const message = `${t("balance_pay_success", lang)}

${t("order_product", lang)}: ${displayProductName}
${t("order_amount", lang)}: ${deductAmount} ${deductCurrency}
${t("order_no", lang)}: \`${orderNo}\`
💳 ${lang === "zh" ? "剩余余额" : "Remaining balance"}: ${newBalance.toFixed(2)} ${deductCurrency}

────────────────
📦 **${lang === "zh" ? "您的卡密" : "Your card/key"}：**
\`${deliveryContent}\`
────────────────
${lang === "zh" ? "感谢您的惠顾！点击卡密可复制！" : "Thank you! Click to copy!"}`;

    return { handled: true, message };
  }

  // 获取商店配置
  const { data: shopConfig } = await supabase.from("shop_configs").select("*").eq("bot_token", botToken).maybeSingle();

  if (!shopConfig) {
    return { handled: true, message: t("error_no_shop", lang) };
  }

  // 英文模式下：订单内的商品名也要自动翻译展示
  const displayOrderProductName = await localizeText(order.product_name, lang);

  // 根据选择的支付方式计算最终金额
  let finalAmount = order.amount;
  let displayCurrency = order.currency;
  let cryptoQrUrl = "";

  // 获取当前汇率用于锁定
  let lockedRateTrxUsdt: number | null = null;
  let lockedRateCnyUsd: number | null = null;

  // 对于虚拟货币支付，需要转换金额并添加随机小数
  if (paymentMethod === "usdt" || paymentMethod === "trx") {
    // 先转换为对应货币金额并锁定汇率
    if (paymentMethod === "usdt") {
      if (order.currency === "CNY") {
        const conversion = await convertCnyToUsdt(order.amount);
        finalAmount = conversion.usdtAmount;
        lockedRateCnyUsd = conversion.rate;
      } else if (order.currency === "TRX") {
        const conversion = await convertTrxToUsdt(order.amount);
        finalAmount = conversion.usdtAmount;
        lockedRateTrxUsdt = conversion.rate;
      }
      // 如果是USDT定价，finalAmount = order.amount
      displayCurrency = "USDT";
    } else {
      // TRX
      if (order.currency === "CNY") {
        const cnyConversion = await convertCnyToUsdt(order.amount);
        lockedRateCnyUsd = cnyConversion.rate;
        const trxConversion = await convertUsdtToTrx(cnyConversion.usdtAmount);
        finalAmount = trxConversion.trxAmount;
        lockedRateTrxUsdt = trxConversion.rate;
      } else if (order.currency === "USDT") {
        const conversion = await convertUsdtToTrx(order.amount);
        finalAmount = conversion.trxAmount;
        lockedRateTrxUsdt = conversion.rate;
      }
      // 如果是TRX定价，finalAmount = order.amount
      displayCurrency = "TRX";
    }

    // 添加随机小数防撞单
    finalAmount = generateRandomDecimal(finalAmount, shopConfig.random_decimals);

    // 生成二维码
    if (shopConfig.wallet_address) {
      cryptoQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(shopConfig.wallet_address)}`;
    }
  } else {
    // 法币支付 - 转换为CNY
    if (order.currency === "USDT") {
      const conversion = await convertUsdtToCny(order.amount);
      finalAmount = conversion.cnyAmount;
      lockedRateCnyUsd = conversion.rate;
    } else if (order.currency === "TRX") {
      const trxConversion = await convertTrxToUsdt(order.amount);
      lockedRateTrxUsdt = trxConversion.rate;
      const cnyConversion = await convertUsdtToCny(trxConversion.usdtAmount);
      finalAmount = cnyConversion.cnyAmount;
      lockedRateCnyUsd = cnyConversion.rate;
    }
    // 法币也加随机小数防撞单 (只到分位 0.01-0.09)
    finalAmount = generateRandomDecimalCny(finalAmount, shopConfig.random_decimals);
    displayCurrency = "CNY";
  }

  // 更新订单的支付方式、最终金额和锁定汇率
  await supabase
    .from("shop_orders")
    .update({
      payment_method: paymentMethod,
      amount: finalAmount,
      currency: displayCurrency,
      original_amount: order.amount,
      original_currency: order.currency,
      locked_rate_trx_usdt: lockedRateTrxUsdt,
      locked_rate_cny_usd: lockedRateCnyUsd,
    })
    .eq("order_no", orderNo);

  // 计算过期时间显示
  const expireTime = new Date(order.expires_at);
  const chinaTime = new Date(expireTime.getTime() + 8 * 60 * 60 * 1000);
  const expireTimeStr = `${chinaTime.getUTCHours().toString().padStart(2, "0")}:${chinaTime.getUTCMinutes().toString().padStart(2, "0")}`;

  // 构建支付详情消息
  let paymentInfo = "";
  if (paymentMethod === "usdt" || paymentMethod === "trx") {
    const currencyLabel = paymentMethod.toUpperCase();
    paymentInfo = `${t("payment_method", lang)}: ${currencyLabel}

${t("payment_amount", lang)}: ${finalAmount} ${currencyLabel}

${t("payment_address", lang)}:
\`${shopConfig.wallet_address}\``;
  } else {
    // 法币支付：直接生成付款二维码（虎皮椒/云沟），避免用户再手动输入 /pay_* 指令
    const provider =
      paymentMethod === "alipay" ? shopConfig.alipay_provider || "xunhu" : shopConfig.wechat_provider || "xunhu";

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const notifyUrl = `${supabaseUrl}/functions/v1/shop-payment-webhook?bot_token=${encodeURIComponent(botToken)}&type=${provider}`;

    // 检查是否启用H5支付（仅支付宝）
    const useH5 = paymentMethod === "alipay" && shopConfig.xunhu_alipay_h5 === true;

    try {
      const paymentRes = await fetch(`${supabaseUrl}/functions/v1/create-payment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({
          bot_token: botToken,
          order_no: orderNo,
          product_name: order.product_name,
          amount: finalAmount,
          payment_method: paymentMethod,
          provider,
          notify_url: notifyUrl,
          use_h5: useH5,
        }),
      });

      const paymentData = await paymentRes.json();

      if (paymentData?.success && (paymentData?.qr_code || paymentData?.h5_url)) {
        // 复用 cryptoQrUrl 的发送逻辑，在回调处理处会先发一张图
        cryptoQrUrl = paymentData.qr_code || "";

        if (useH5 && paymentData?.h5_url) {
          // H5模式：显示引导信息
          paymentInfo = `${t("payment_method", lang)}: ${t("payment_alipay", lang)} (H5)

${t("payment_amount", lang)}: ¥${finalAmount}

${t("payment_h5_tip", lang)}`;

          return {
            handled: true,
            message: `${t("payment_details_title", lang)}

${t("order_product", lang)}: ${displayOrderProductName}
${t("order_no", lang)}: \`${orderNo}\`

────────────────
${paymentInfo}
────────────────

${t("payment_deadline", lang)}: ${expireTimeStr} (${t("payment_30min", lang)})
${t("payment_auto_cancel", lang)}
${t("payment_auto_deliver", lang)}`,
            orderId: order.id,
            paymentMethod,
            cryptoQrUrl,
            h5PayUrl: paymentData.h5_url,
          };
        }

        const payMethodName = paymentMethod === "alipay" ? t("payment_alipay", lang) : t("payment_wechat", lang);
        paymentInfo = `${t("payment_method", lang)}: ${payMethodName}

${t("payment_amount", lang)}: ¥${finalAmount}

${t("payment_scan_qr", lang)}`;
      } else {
        return { handled: true, message: `${t("error_qr_failed", lang)}: ${paymentData?.error || "Unknown error"}` };
      }
    } catch (e) {
      console.error("[TG Shop] create-payment error (callback):", e);
      return { handled: true, message: t("error_payment_failed", lang) };
    }
  }

  // 获取自定义支付说明 - 根据语言选择对应的默认文案
  const defaultPaymentNoticeZh = `⚠️ 超时订单将自动取消并删除
⚠️付款转账精确到小数点后面数值
⚠️虚拟货币转账不包含扣除的手续费
下面举个例子👇币安
例：金额10.12TRX+手续费1TRX=11.12TRX
tokenpocket（简称TP）
直接付金额10.12TRX（手续费扣余额）
币安充TRX提现到你的TP钱包
付错额度不会发货联系人工客服处理
✅ 支付成功后将自动发货到此对话`;

  const defaultPaymentNoticeEn = `⚠️ Order will be auto-cancelled if timeout
⚠️ Pay exact amount including decimals
⚠️ Crypto transfer amount excludes network fees
Example: 10.12 TRX + 1 TRX fee = Send 11.12 TRX from Binance
Using TokenPocket: Send exact 10.12 TRX (fee from balance)
Wrong amount = No delivery, contact support
✅ Auto-delivery after payment confirmed`;

  // 如果用户有自定义支付说明使用自定义的，否则根据语言选择默认文案
  // 英文模式下：自定义文案也做自动翻译
  const paymentNotice = shopConfig.payment_notice
    ? await localizeText(shopConfig.payment_notice, lang)
    : lang === "en"
      ? defaultPaymentNoticeEn
      : defaultPaymentNoticeZh;

  const message = `${t("payment_details_title", lang)}

${t("order_product", lang)}: ${displayOrderProductName}
${t("order_no", lang)}: \`${orderNo}\`

────────────────
${paymentInfo}
────────────────

${t("payment_deadline", lang)}: ${expireTimeStr} (${t("payment_30min", lang)})
${paymentNotice}`;

  return { handled: true, message, cryptoQrUrl, orderId: order.id, paymentMethod };
}

// 处理 /shop 命令 - 显示商品分类列表（点击分类展开/隐藏）
async function handleShopCommand(
  supabase: any,
  botToken: string,
  expandedCategoryKey?: string,
  lang: "zh" | "en" = "zh",
): Promise<{ handled: boolean; message?: string; inlineKeyboard?: any }> {
  const { data: shopConfig } = await supabase.from("shop_configs").select("*").eq("bot_token", botToken).maybeSingle();

  if (!shopConfig) {
    return { handled: true, message: t("error_no_shop", lang) };
  }

  const { data: products } = await supabase
    .from("shop_products")
    .select("*")
    .eq("bot_token", botToken)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (!products || products.length === 0) {
    return { handled: true, message: t("shop_no_products", lang) };
  }

  // 分类Key稳定（用于callback），展示名按语言（英文模式下自动翻译中文分类）
  const DEFAULT_CAT_KEY = "__default__";
  const defaultCatZh = "默认分类";
  const defaultCatEn = "Default";

  type CatBucket = { products: ShopProduct[]; displayName: string };
  const categoryBuckets: Record<string, CatBucket> = {};

  // 先按“原始分类key”分组
  for (const p of products as ShopProduct[]) {
    const raw = (p.category || "").trim();
    const key = raw ? raw : DEFAULT_CAT_KEY;
    if (!categoryBuckets[key]) categoryBuckets[key] = { products: [], displayName: "" };
    categoryBuckets[key].products.push(p);
  }

  // 准备需要翻译的分类名（仅英文模式）
  const keys = Object.keys(categoryBuckets);
  const rawCategoryNamesToTranslate: string[] = [];
  if (lang === "en") {
    for (const k of keys) {
      if (k === DEFAULT_CAT_KEY) continue;
      if (k === defaultCatZh || k === defaultCatEn) continue;
      rawCategoryNamesToTranslate.push(k);
    }
  }
  const catTranslations = lang === "en" ? await translateManyToEnglish(rawCategoryNamesToTranslate) : {};

  // 写入 displayName
  for (const k of keys) {
    if (k === DEFAULT_CAT_KEY || k === defaultCatZh || k === defaultCatEn) {
      categoryBuckets[k].displayName = t("default_category", lang);
    } else if (lang === "en") {
      categoryBuckets[k].displayName = catTranslations[k] || k;
    } else {
      categoryBuckets[k].displayName = k;
    }
  }

  const stockLabel = t("shop_stock", lang);
  const outOfStockLabel = t("shop_out_of_stock", lang);
  const itemsLabel = t("order_items", lang);

  // 展开某个分类
  if (expandedCategoryKey && categoryBuckets[expandedCategoryKey]) {
    const bucket = categoryBuckets[expandedCategoryKey];

    // 英文模式下翻译商品名/详情
    const namesToTranslate: string[] = [];
    const descToTranslate: string[] = [];
    if (lang === "en") {
      for (const p of bucket.products) {
        if (p.name) namesToTranslate.push(p.name);
        if (p.description) descToTranslate.push(p.description);
      }
    }
    const nameMap = lang === "en" ? await translateManyToEnglish(namesToTranslate) : {};
    const descMap = lang === "en" ? await translateManyToEnglish(descToTranslate) : {};

    const productLines = bucket.products.map((p: ShopProduct) => {
      const stock = p.type === "physical" ? (p.stock_quantity ?? 0) : (p.stock_content?.length || 0);
      const isRecharge = p.type === "recharge";
      const isPhysical = p.type === "physical";
      const stockText = isRecharge
        ? `(${t("shop_recharge_product", lang)})`
        : isPhysical
          ? `(${t("shop_physical_product", lang)} ${stock > 0 ? `${stockLabel}: ${stock}` : outOfStockLabel})`
          : stock > 0
            ? `(${stockLabel}: ${stock})`
            : `(${outOfStockLabel})`;
      const shortId = p.id.replace(/-/g, "");
      const displayName = lang === "en" ? nameMap[p.name] || p.name : p.name;
      const displayDesc = p.description
        ? lang === "en"
          ? descMap[p.description] || p.description
          : p.description
        : "";
      return `📦 **${displayName}** - ${p.price} ${p.currency} ${stockText}\n   ${displayDesc || ""}\n   ${t("shop_click_to_buy", lang)} /buy\\_${shortId}`;
    });

    const inlineButtons: any[][] = [[{ text: t("shop_back_to_categories", lang), callback_data: "shop_back" }]];
    const message = `${t("shop_category_title", lang, { name: bucket.displayName, count: bucket.products.length })}

${productLines.join("\n\n")}

────────────────
${t("shop_buy_tip", lang)}`;

    return { handled: true, message, inlineKeyboard: { inline_keyboard: inlineButtons } };
  }

  // 分类列表（按钮显示翻译后的名字，callback_data 用稳定 key）
  const sortedKeys = keys.sort((a, b) => {
    if (a === DEFAULT_CAT_KEY) return -1;
    if (b === DEFAULT_CAT_KEY) return 1;
    return categoryBuckets[a].displayName.localeCompare(categoryBuckets[b].displayName);
  });

  // Use index-based callback_data to avoid Telegram's 64-byte limit
  const inlineButtons: any[][] = sortedKeys.map((key, index) => {
    const count = categoryBuckets[key].products.length;
    const name = categoryBuckets[key].displayName;
    return [{ text: `📂 ${name} (${count}${itemsLabel})`, callback_data: `shop_cat_${index}` }];
  });

  const message = `${t("shop_categories_title", lang)}

${t("shop_total_products", lang, { count: (products as any[]).length, cats: keys.length })}

────────────────
${t("shop_click_category", lang)}`;

  return { handled: true, message, inlineKeyboard: { inline_keyboard: inlineButtons }, _categoryKeys: sortedKeys };
}

function formatChinaTime(dateStr: string): string {
  const date = new Date(dateStr);
  const chinaTime = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  const year = chinaTime.getUTCFullYear();
  const month = (chinaTime.getUTCMonth() + 1).toString().padStart(2, "0");
  const day = chinaTime.getUTCDate().toString().padStart(2, "0");
  const hours = chinaTime.getUTCHours().toString().padStart(2, "0");
  const minutes = chinaTime.getUTCMinutes().toString().padStart(2, "0");
  const seconds = chinaTime.getUTCSeconds().toString().padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

async function handleOrderCommand(
  supabase: any,
  botToken: string,
  chatId: number,
  text: string,
  lang: "zh" | "en" = "zh",
): Promise<{ handled: boolean; message?: string }> {
  const match = text.match(/^(?:\/order|订单|查询|我的订单)\s*(.*)$/i);
  const orderNo = match?.[1]?.trim();

  if (orderNo) {
    const { data: order } = await supabase
      .from("shop_orders")
      .select("*")
      .eq("bot_token", botToken)
      .eq("order_no", orderNo)
      .eq("status", "paid")
      .maybeSingle();

    if (!order) {
      return { handled: true, message: `${t("order_not_found", lang)}: ${orderNo}` };
    }

    const localizedProductName = await localizeText(order.product_name, lang);

    let message = `${t("order_details_title", lang)}

${t("order_no", lang)}: \`${order.order_no}\`
${t("order_product", lang)}: ${localizedProductName}
${t("order_amount", lang)}: ${order.amount} ${order.currency}
${t("order_status", lang)}: ${t("order_status_paid", lang)}
${t("order_created_at", lang)}: ${formatChinaTime(order.created_at)}`;

    if (order.delivery_content) {
      message += `\n\n${t("order_card_key", lang)}\n\`${order.delivery_content}\``;
    }

    return { handled: true, message };
  }

  const { data: orders } = await supabase
    .from("shop_orders")
    .select("*")
    .eq("bot_token", botToken)
    .eq("telegram_user_id", chatId)
    .eq("status", "paid")
    .order("created_at", { ascending: false })
    .limit(10);

  if (!orders || orders.length === 0) {
    return { handled: true, message: t("order_no_history", lang) };
  }

  // 英文模式下，订单列表里的商品名也做自动翻译
  const productNames = lang === "en" ? orders.map((o: any) => String(o.product_name || "")) : [];
  const nameMap = lang === "en" ? await translateManyToEnglish(productNames) : {};

  const orderLines = orders.map((o: any) => {
    const displayName = lang === "en" ? nameMap[String(o.product_name || "")] || o.product_name : o.product_name;
    return `✅ \`/order ${o.order_no}\` - ${displayName} - ${o.amount} ${o.currency}`;
  });

  const message = `${t("order_history_title", lang)}

${orderLines.join("\n")}

────────────────
${t("order_click_to_view", lang)}`;

  return { handled: true, message };
}

// 类型定义
interface InlineButton {
  text: string;
  type: "url" | "callback_data" | "web_app";
  value: string;
}

interface ReplyButton {
  text: string;
  textEn?: string;
  actionType: "text" | "navigate";
  actionValue?: string;
}

interface MenuPage {
  id: string;
  name: string;
  rows: ReplyButton[][];
}

interface MessageData {
  id: string;
  label?: string;
  type: "text" | "photo" | "video"; // 添加视频类型支持
  content: string;
  mediaUrl?: string;
  inlineKeyboard?: InlineButton[][];
  disableWebPagePreview?: boolean;
}

interface AutoReplyRule {
  id: string;
  triggerType: "keyword" | "command";
  triggerValue: string;
  replyMessages: MessageData[];
}

interface KeyboardConfig {
  bot_token: string;
  reply_keyboard: MenuPage[] | null;
  auto_reply_rules: AutoReplyRule[] | null;
  flow_messages: MessageData[] | null;
  commands: { command: string; description: string }[] | null;
  force_menu_on_start: boolean | null;
  activity_log_enabled: boolean | null;
  bilingual_button_enabled: boolean | null;
  user_language_preferences: Record<string, string> | null;
  menu_admin_chat_id: number | null;
  auto_cleanup_enabled: boolean | null;
  auto_cleanup_days: number | null;
  chat_start_enabled: boolean | null;
  keyboard_start_enabled: boolean | null;
}

// 发送Telegram消息的辅助函数
async function sendTelegramMessage(botToken: string, method: string, body: any) {
  const url = `https://api.telegram.org/bot${botToken}/${method}`;
  console.log(`Calling Telegram API: ${method}`, JSON.stringify(body, null, 2));

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const result = await response.json();
  console.log(`Telegram API response:`, JSON.stringify(result, null, 2));
  return result;
}

// 获取用户的语言偏好
function getUserLanguage(chatId: number, userLanguagePreferences: Record<string, string> | null): "zh" | "en" {
  if (!userLanguagePreferences) return "zh";
  return (userLanguagePreferences[chatId.toString()] as "zh" | "en") || "zh";
}

// 根据语言偏好生成键盘 - 支持自动翻译
async function generateKeyboardWithLanguage(
  menuPage: MenuPage | undefined,
  language: "zh" | "en",
  bilingualEnabled: boolean,
): Promise<{ text: string }[][] | null> {
  if (!menuPage || menuPage.rows.length === 0) return null;

  const keyboard: { text: string }[][] = [];
  for (const row of menuPage.rows) {
    const translatedRow: { text: string }[] = [];
    for (const btn of row) {
      let btnText = btn.text;
      if (language === "en") {
        if (btn.textEn) {
          btnText = btn.textEn;
        } else {
          // 自动翻译按钮文字
          btnText = await localizeText(btn.text, "en");
        }
      }
      translatedRow.push({ text: btnText });
    }
    keyboard.push(translatedRow);
  }

  // 如果开启双语按钮，添加语言切换按钮到最后一行
  if (bilingualEnabled) {
    const langButton = language === "zh" ? { text: "🌐 English" } : { text: "🌐 中文" };
    keyboard.push([langButton]);
  }

  return keyboard;
}

// 获取用户当前所在的菜单页面ID
function getUserCurrentPage(chatId: number, userLanguagePreferences: Record<string, string> | null): string {
  if (!userLanguagePreferences) return "main";
  return userLanguagePreferences[`${chatId}_page`] || "main";
}

// 处理菜单导航 - 优先匹配用户当前所在页面的按钮
async function handleMenuNavigation(
  botToken: string,
  chatId: number,
  text: string,
  menuPages: MenuPage[],
  language: "zh" | "en" = "zh",
  bilingualEnabled: boolean = false,
  currentPageId: string = "main",
): Promise<{ handled: boolean; targetPageId?: string }> {
  const textNorm = text.trim().toLowerCase();

  // 辅助函数：在指定页面中查找匹配的导航按钮
  async function findNavigateBtn(page: MenuPage): Promise<ReplyButton | null> {
    for (const row of page.rows) {
      for (const btn of row) {
        if (btn.actionType !== "navigate" || !btn.actionValue) continue;
        const zhMatch = btn.text.toLowerCase() === textNorm;
        const enMatch = btn.textEn && btn.textEn.toLowerCase() === textNorm;
        let autoTranslatedMatch = false;
        if (!zhMatch && !enMatch && language === "en" && bilingualEnabled && !btn.textEn) {
          const translatedBtnText = await localizeText(btn.text, "en");
          autoTranslatedMatch = translatedBtnText.toLowerCase() === textNorm;
        }
        if (zhMatch || enMatch || autoTranslatedMatch) return btn;
      }
    }
    return null;
  }

  // 1. 优先在用户当前所在的页面中查找
  const currentPage = menuPages.find((p) => p.id === currentPageId);
  if (currentPage) {
    const matchedBtn = await findNavigateBtn(currentPage);
    if (matchedBtn && matchedBtn.actionValue) {
      const targetPage = menuPages.find((p) => p.id === matchedBtn.actionValue);
      if (targetPage) {
        const keyboard = await generateKeyboardWithLanguage(targetPage, language, bilingualEnabled);
        const displayName = language === "en" ? await localizeText(targetPage.name, "en") : targetPage.name;
        await sendTelegramMessage(botToken, "sendMessage", {
          chat_id: chatId,
          text: language === "en" ? `📂 Switch to: ${displayName}` : `📂 切换菜单: ${targetPage.name}`,
          reply_markup: keyboard ? { keyboard, resize_keyboard: true, one_time_keyboard: false } : undefined,
        });
        console.log(`Menu navigation: ${currentPage.name} -> ${targetPage.name} (from current page)`);
        return { handled: true, targetPageId: targetPage.id };
      }
    }
  }

  // 2. 如果当前页面没找到，再扫描所有页面（兜底）
  for (const page of menuPages) {
    if (page.id === currentPageId) continue; // 已经检查过了
    const matchedBtn = await findNavigateBtn(page);
    if (matchedBtn && matchedBtn.actionValue) {
      const targetPage = menuPages.find((p) => p.id === matchedBtn.actionValue);
      if (targetPage) {
        const keyboard = await generateKeyboardWithLanguage(targetPage, language, bilingualEnabled);
        const displayName = language === "en" ? await localizeText(targetPage.name, "en") : targetPage.name;
        await sendTelegramMessage(botToken, "sendMessage", {
          chat_id: chatId,
          text: language === "en" ? `📂 Switch to: ${displayName}` : `📂 切换菜单: ${targetPage.name}`,
          reply_markup: keyboard ? { keyboard, resize_keyboard: true, one_time_keyboard: false } : undefined,
        });
        console.log(`Menu navigation: ${page.name} -> ${targetPage.name} (fallback scan)`);
        return { handled: true, targetPageId: targetPage.id };
      }
    }
  }
  return { handled: false };
}

// 处理自动回复 - 同时附带最新的底部键盘
// 英文模式下自动翻译关键词匹配、回复内容和内联按钮文字
async function handleAutoReply(
  botToken: string,
  chatId: number,
  text: string,
  autoReplyRules: AutoReplyRule[],
  menuPages?: MenuPage[],
  language: "zh" | "en" = "zh",
  bilingualEnabled: boolean = false,
): Promise<boolean> {
  const textNorm = text.trim().toLowerCase();
  const cleanText = textNorm.replace(/^\//, "");
  const firstToken = cleanText.split(/\s+/)[0];

  // 英文模式下，预翻译所有触发词用于匹配
  let triggerTranslations: Record<string, string> = {};
  if (language === "en" && bilingualEnabled) {
    const triggers = autoReplyRules.map((r) => (r.triggerValue || "").trim()).filter((t) => t && containsCjk(t));
    if (triggers.length > 0) {
      triggerTranslations = await translateManyToEnglish(triggers);
    }
  }

  const matchedRule = autoReplyRules.find((r) => {
    const ruleVal = (r.triggerValue || "").trim().toLowerCase();
    if (!ruleVal) return false;

    const cleanRule = ruleVal.replace(/^\//, "");

    if (r.triggerType === "command") {
      return firstToken === cleanRule;
    }

    // keyword: 先匹配中文原文
    if (cleanText.includes(cleanRule)) return true;

    // 英文模式下：也尝试匹配翻译后的英文关键词
    if (language === "en" && bilingualEnabled) {
      const originalTrigger = (r.triggerValue || "").trim();
      const translatedTrigger = triggerTranslations[originalTrigger];
      if (translatedTrigger) {
        const translatedNorm = translatedTrigger.toLowerCase();
        if (cleanText.includes(translatedNorm) || translatedNorm.includes(cleanText)) return true;
      }
    }

    return false;
  });

  if (matchedRule) {
    console.log(`Auto-reply matched: ${matchedRule.triggerValue} (lang: ${language})`);

    const mainPage = menuPages?.find((p: MenuPage) => p.id === "main");
    const keyboard = await generateKeyboardWithLanguage(mainPage, language, bilingualEnabled);
    const replyKeyboard = keyboard
      ? {
          keyboard,
          resize_keyboard: true,
          one_time_keyboard: false,
        }
      : null;

    for (const reply of matchedRule.replyMessages) {
      const body: any = { chat_id: chatId, parse_mode: "HTML" };

      if (reply.disableWebPagePreview) {
        body.disable_web_page_preview = true;
      }

      // 英文模式下自动翻译回复内容
      const replyContent =
        language === "en" && bilingualEnabled ? await localizeText(reply.content, "en") : reply.content;

      // 处理内联键盘
      if (reply.inlineKeyboard && reply.inlineKeyboard.length > 0) {
        // 英文模式下翻译内联按钮文字
        let translatedInlineKeyboard = reply.inlineKeyboard;
        if (language === "en" && bilingualEnabled) {
          const btnTexts = reply.inlineKeyboard
            .flat()
            .map((btn) => btn.text)
            .filter(Boolean);
          const btnTextMap = btnTexts.length > 0 ? await translateManyToEnglish(btnTexts) : {};
          translatedInlineKeyboard = reply.inlineKeyboard.map((row) =>
            row.map((btn) => ({ ...btn, text: btnTextMap[btn.text] || btn.text })),
          );
        }

        body.reply_markup = {
          inline_keyboard: translatedInlineKeyboard.map((row) =>
            row.map((btn) => {
              if (btn.type === "url") {
                return { text: btn.text, url: btn.value };
              } else if (btn.type === "callback_data") {
                return { text: btn.text, callback_data: btn.value };
              } else if (btn.type === "web_app") {
                return { text: btn.text, web_app: { url: btn.value } };
              }
              return { text: btn.text, callback_data: btn.value };
            }),
          ),
        };
      } else if (replyKeyboard) {
        body.reply_markup = replyKeyboard;
      }

      try {
        if (reply.type === "photo" && reply.mediaUrl) {
          body.photo = reply.mediaUrl;
          body.caption = replyContent;
          await sendTelegramMessage(botToken, "sendPhoto", body);
        } else if (reply.type === "video" && reply.mediaUrl) {
          body.video = reply.mediaUrl;
          body.caption = replyContent;
          await sendTelegramMessage(botToken, "sendVideo", body);
        } else {
          body.text = replyContent;
          await sendTelegramMessage(botToken, "sendMessage", body);
        }
      } catch (e) {
        console.error("Auto-reply send failed:", e);
      }
    }
    return true;
  }
  return false;
}

// 处理callback_query（内联按钮点击）
// 英文模式下自动翻译回复内容和内联按钮文字
async function handleCallbackQuery(
  botToken: string,
  callbackQuery: any,
  autoReplyRules: AutoReplyRule[],
  language: "zh" | "en" = "zh",
  bilingualEnabled: boolean = false,
): Promise<boolean> {
  const callbackData = callbackQuery.data;
  const chatId = callbackQuery.message?.chat?.id;
  const messageId = callbackQuery.message?.message_id;

  if (!callbackData || !chatId) return false;

  console.log(`Callback query received: ${callbackData}`);

  // 先回应callback_query，避免loading状态
  await sendTelegramMessage(botToken, "answerCallbackQuery", {
    callback_query_id: callbackQuery.id,
  });

  // 查找匹配的自动回复规则
  const matchedRule = autoReplyRules.find((r) => {
    const ruleVal = r.triggerValue.toLowerCase();
    return callbackData.toLowerCase() === ruleVal;
  });

  if (matchedRule) {
    console.log(`Callback matched rule: ${matchedRule.triggerValue} (lang: ${language})`);

    for (const reply of matchedRule.replyMessages) {
      const body: any = { chat_id: chatId, parse_mode: "HTML" };

      if (reply.disableWebPagePreview) {
        body.disable_web_page_preview = true;
      }

      // 英文模式下自动翻译回复内容
      const replyContent =
        language === "en" && bilingualEnabled ? await localizeText(reply.content, "en") : reply.content;

      if (reply.inlineKeyboard && reply.inlineKeyboard.length > 0) {
        // 英文模式下翻译内联按钮文字
        let translatedInlineKeyboard = reply.inlineKeyboard;
        if (language === "en" && bilingualEnabled) {
          const btnTexts = reply.inlineKeyboard
            .flat()
            .map((btn) => btn.text)
            .filter(Boolean);
          const btnTextMap = btnTexts.length > 0 ? await translateManyToEnglish(btnTexts) : {};
          translatedInlineKeyboard = reply.inlineKeyboard.map((row) =>
            row.map((btn) => ({ ...btn, text: btnTextMap[btn.text] || btn.text })),
          );
        }

        body.reply_markup = {
          inline_keyboard: translatedInlineKeyboard.map((row) =>
            row.map((btn) => {
              if (btn.type === "url") {
                return { text: btn.text, url: btn.value };
              } else if (btn.type === "callback_data") {
                return { text: btn.text, callback_data: btn.value };
              } else if (btn.type === "web_app") {
                return { text: btn.text, web_app: { url: btn.value } };
              }
              return { text: btn.text, callback_data: btn.value };
            }),
          ),
        };
      }

      try {
        if (reply.type === "photo" && reply.mediaUrl) {
          body.photo = reply.mediaUrl;
          body.caption = replyContent;
          await sendTelegramMessage(botToken, "sendPhoto", body);
        } else if (reply.type === "video" && reply.mediaUrl) {
          body.video = reply.mediaUrl;
          body.caption = replyContent;
          await sendTelegramMessage(botToken, "sendVideo", body);
        } else {
          body.text = replyContent;
          await sendTelegramMessage(botToken, "sendMessage", body);
        }
      } catch (e) {
        console.error("Callback reply failed:", e);
      }
    }
    return true;
  }

  return false;
}

// 发送主菜单 - 同时重置用户当前页面为main
async function sendMainMenu(
  botToken: string,
  chatId: number,
  menuPages: MenuPage[],
  greetingMessage?: string,
  language: "zh" | "en" = "zh",
  bilingualEnabled: boolean = false,
  supabaseClient?: any,
  userLanguagePreferences?: Record<string, string>,
) {
  const mainPage = menuPages.find((p) => p.id === "main");
  if (mainPage && mainPage.rows.length > 0) {
    const keyboard = await generateKeyboardWithLanguage(mainPage, language, bilingualEnabled);
    await sendTelegramMessage(botToken, "sendMessage", {
      chat_id: chatId,
      text:
        greetingMessage || (language === "en" ? "📂 Welcome! Please select from the menu" : "📂 欢迎使用，请选择菜单"),
      reply_markup: keyboard
        ? {
            keyboard,
            resize_keyboard: true,
            one_time_keyboard: false,
          }
        : undefined,
    });
    // 重置用户当前页面为main
    if (supabaseClient && userLanguagePreferences) {
      userLanguagePreferences[`${chatId}_page`] = "main";
      await supabaseClient
        .from("keyboard_configs")
        .update({ user_language_preferences: userLanguagePreferences })
        .eq("bot_token", botToken);
    }
    console.log("Main menu sent to user");
    return true;
  }
  return false;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    console.log("Received webhook:", JSON.stringify(body, null, 2));

    // Extract bot token from URL path
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/");
    const botToken = pathParts[pathParts.length - 1];

    if (!botToken || botToken === "telegram-webhook") {
      console.log("No bot token in path");
      return new Response(JSON.stringify({ error: "Missing bot token" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find the bot activation by token (可能为空，菜单键盘可独立运行)
    const { data: activation } = await supabase
      .from("bot_activations")
      .select("*")
      .eq("bot_token", botToken)
      .maybeSingle();

    // 检查双向聊天的授权状态（如果有绑定）
    let bidirectionalChatEnabled = false;
    let personalUserId = 0;

    if (activation) {
      // 首先检查管理员是否手动关闭了双向聊天功能
      if (activation.is_active === false) {
        console.log("Bidirectional chat disabled by admin toggle");
        // 不返回错误，继续处理菜单键盘功能
      } else if (activation.expire_at && new Date(activation.expire_at) < new Date()) {
        // Check if bot is expired
        console.log("Bot activation expired - disabling bidirectional chat");
        await supabase.from("bot_activations").update({ is_active: false }).eq("id", activation.id);
        // 不返回错误，继续处理菜单键盘功能
      } else if (activation.is_authorized || activation.trial_messages_used < activation.trial_limit) {
        // 双向聊天功能可用
        bidirectionalChatEnabled = activation.app_enabled !== false;
        personalUserId = parseInt(activation.personal_user_id);
      } else {
        console.log("Trial limit reached - bidirectional chat disabled");
      }
    }

    // 获取菜单键盘配置
    const { data: keyboardConfig } = await supabase
      .from("keyboard_configs")
      .select("*")
      .eq("bot_token", botToken)
      .maybeSingle();

    // 检查菜单键盘是否过期或试用已结束
    let keyboardMenuEnabled = true;
    if (keyboardConfig) {
      const now = new Date();
      const keyboardExpireAt = keyboardConfig.keyboard_expire_at ? new Date(keyboardConfig.keyboard_expire_at) : null;
      const keyboardTrialStartedAt = keyboardConfig.keyboard_trial_started_at
        ? new Date(keyboardConfig.keyboard_trial_started_at)
        : null;

      // 如果已激活授权，检查是否过期
      if (keyboardExpireAt) {
        if (keyboardExpireAt < now) {
          console.log("Keyboard menu expired - disabling keyboard features");
          keyboardMenuEnabled = false;
        }
      } else if (keyboardTrialStartedAt) {
        // 试用模式：24小时后过期
        const trialEndTime = new Date(keyboardTrialStartedAt.getTime() + 24 * 60 * 60 * 1000);
        if (now > trialEndTime) {
          console.log("Keyboard menu trial expired (24h) - disabling keyboard features");
          keyboardMenuEnabled = false;
        }
      }
    }

    const menuPages: MenuPage[] = keyboardMenuEnabled ? keyboardConfig?.reply_keyboard || [] : [];
    const autoReplyRules: AutoReplyRule[] = keyboardMenuEnabled ? keyboardConfig?.auto_reply_rules || [] : [];
    const forceMenuOnStart: boolean = keyboardMenuEnabled ? keyboardConfig?.force_menu_on_start || false : false;
    const activityLogEnabled: boolean = keyboardConfig?.activity_log_enabled !== false; // 默认为true
    const bilingualEnabled: boolean = keyboardMenuEnabled ? keyboardConfig?.bilingual_button_enabled || false : false;
    let userLanguagePreferences: Record<string, string> = keyboardConfig?.user_language_preferences || {};
    const menuAdminChatId: number = keyboardConfig?.menu_admin_chat_id ? Number(keyboardConfig.menu_admin_chat_id) : 0;
    const chatStartEnabled: boolean = keyboardConfig?.chat_start_enabled !== false; // 默认为true
    const keyboardStartEnabled: boolean = keyboardConfig?.keyboard_start_enabled !== false; // 默认为true

    console.log(
      `Keyboard config loaded: ${menuPages.length} pages, ${autoReplyRules.length} rules, activityLog: ${activityLogEnabled}, bilingual: ${bilingualEnabled}, bidirectionalChat: ${bidirectionalChatEnabled}, menuAdminChatId: ${menuAdminChatId}, keyboardMenuEnabled: ${keyboardMenuEnabled}`,
    );

    // 处理 callback_query（内联按钮点击）
    if (body.callback_query) {
      const callbackData = body.callback_query.data || "";
      const cbChatId = body.callback_query.message?.chat?.id;
      const cbMessageId = body.callback_query.message?.message_id;

      // 先回应callback_query，避免loading状态
      await sendTelegramMessage(botToken, "answerCallbackQuery", {
        callback_query_id: body.callback_query.id,
      });

      // 优先检查是否是支付方式选择回调
      if (callbackData.startsWith("pay_")) {
        console.log(`[TG Shop] Payment method callback: ${callbackData}`);

        // 获取用户语言偏好
        const { data: payShopCfg } = await supabase
          .from("shop_configs")
          .select("user_language_preferences")
          .eq("bot_token", botToken)
          .maybeSingle();
        const payLangPrefs = payShopCfg?.user_language_preferences || {};
        const payUserLang: "zh" | "en" = (payLangPrefs[cbChatId.toString()] as "zh" | "en") || "zh";

        const paymentResult = await handlePaymentMethodCallback(
          supabase,
          botToken,
          cbChatId,
          callbackData,
          cbMessageId,
          payUserLang,
        );

        if (paymentResult.handled) {
          // 删除原来的支付方式选择消息
          await sendTelegramMessage(botToken, "deleteMessage", {
            chat_id: cbChatId,
            message_id: cbMessageId,
          });

          if (paymentResult.message) {
            let qrMessageId: number | null = null;

            // 如果有二维码，先发送二维码图片
            if (paymentResult.cryptoQrUrl) {
              // 根据支付方式选择不同的提示文案（多语言）
              let qrCaption = "";
              if (paymentResult.paymentMethod === "usdt" || paymentResult.paymentMethod === "trx") {
                qrCaption = t("payment_crypto_network", payUserLang);
              } else if (paymentResult.paymentMethod === "wechat") {
                qrCaption = t("payment_scan_wechat", payUserLang);
              } else if (paymentResult.paymentMethod === "alipay") {
                qrCaption = t("payment_scan_alipay", payUserLang);
              }

              const qrResult = await sendTelegramMessage(botToken, "sendPhoto", {
                chat_id: cbChatId,
                photo: paymentResult.cryptoQrUrl,
                caption: qrCaption || undefined,
              });
              if (qrResult.ok && qrResult.result?.message_id) {
                qrMessageId = qrResult.result.message_id;
              }
            }

            // 发送支付详情（如果有H5链接，添加内联按钮）
            const sendMessageParams: any = {
              chat_id: cbChatId,
              text: paymentResult.message,
              parse_mode: "Markdown",
            };

            // H5支付模式：添加"去支付"按钮（多语言）
            if (paymentResult.h5PayUrl) {
              sendMessageParams.reply_markup = {
                inline_keyboard: [[{ text: t("payment_go_pay", payUserLang), url: paymentResult.h5PayUrl }]],
              };
            }

            const msgResult = await sendTelegramMessage(botToken, "sendMessage", sendMessageParams);

            // 保存消息ID以便超时后删除
            if (msgResult.ok && msgResult.result?.message_id && paymentResult.orderId) {
              const updateData: any = { telegram_message_id: msgResult.result.message_id };
              if (qrMessageId) {
                updateData.telegram_qr_message_id = qrMessageId;
              }
              await supabase.from("shop_orders").update(updateData).eq("id", paymentResult.orderId);
            }
          }

          return new Response(JSON.stringify({ ok: true, payment_handled: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      // 处理商城分类回调（展开分类或返回列表）
      if (callbackData.startsWith("shop_cat_") || callbackData === "shop_back") {
        console.log(`[TG Shop] Category callback: ${callbackData}`);

        let expandedCategory: string | undefined;
        if (callbackData.startsWith("shop_cat_")) {
          const catIndex = parseInt(callbackData.replace("shop_cat_", ""), 10);
          // First, get the category list to resolve index to key
          const preResult = await handleShopCommand(supabase, botToken, undefined, "zh");
          const categoryKeys = (preResult as any)._categoryKeys || [];
          if (!isNaN(catIndex) && catIndex >= 0 && catIndex < categoryKeys.length) {
            expandedCategory = categoryKeys[catIndex];
          }
        }

        // 获取用户语言偏好
        const { data: catShopCfg } = await supabase
          .from("shop_configs")
          .select("user_language_preferences")
          .eq("bot_token", botToken)
          .maybeSingle();
        const catLangPrefs = catShopCfg?.user_language_preferences || {};
        const catUserLang: "zh" | "en" = (catLangPrefs[cbChatId.toString()] as "zh" | "en") || "zh";

        const shopResult = await handleShopCommand(supabase, botToken, expandedCategory, catUserLang);

        if (shopResult.handled && shopResult.message) {
          // 编辑原消息，更新内容
          await sendTelegramMessage(botToken, "editMessageText", {
            chat_id: cbChatId,
            message_id: cbMessageId,
            text: shopResult.message,
            parse_mode: "Markdown",
            reply_markup: shopResult.inlineKeyboard,
          });
        }

        return new Response(JSON.stringify({ ok: true, shop_category_handled: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // 处理TG商城语言切换回调
      if (callbackData === "shop_lang_zh" || callbackData === "shop_lang_en") {
        console.log(`[TG Shop] Language switch callback: ${callbackData}`);

        const newLang = callbackData === "shop_lang_en" ? "en" : "zh";

        // 获取商城配置
        const { data: shopConfigForLang } = await supabase
          .from("shop_configs")
          .select("*")
          .eq("bot_token", botToken)
          .maybeSingle();

        if (shopConfigForLang) {
          // 更新用户语言偏好
          const langPrefs = shopConfigForLang.user_language_preferences || {};
          langPrefs[cbChatId.toString()] = newLang;

          await supabase
            .from("shop_configs")
            .update({ user_language_preferences: langPrefs })
            .eq("bot_token", botToken);

          // 同步更新 keyboard_configs 的语言偏好，确保底部键盘也能切换
          if (bilingualEnabled) {
            userLanguagePreferences[cbChatId.toString()] = newLang;
            await supabase
              .from("keyboard_configs")
              .update({ user_language_preferences: userLanguagePreferences })
              .eq("bot_token", botToken);
          }

          // 重新发送开始消息 - 使用翻译系统
          const shopBtnText =
            newLang === "en" ? t("btn_shop", "en") : shopConfigForLang.shop_button_text || t("btn_shop", "zh");
          const orderBtnText =
            newLang === "en" ? t("btn_order", "en") : shopConfigForLang.order_button_text || t("btn_order", "zh");

          // 更新原消息的按钮
          const startButtons = [
            [
              { text: `🛒 ${shopBtnText}`, callback_data: "shop_cmd_shop" },
              { text: `📋 ${orderBtnText}`, callback_data: "shop_cmd_order" },
            ],
            [
              {
                text: "🌐 " + (newLang === "en" ? "中文" : "English"),
                callback_data: newLang === "en" ? "shop_lang_zh" : "shop_lang_en",
              },
            ],
          ];

          // 根据语言显示确认消息
          const confirmMsg = newLang === "en" ? "🌐 Language switched to English" : "🌐 已切换为中文";

          await sendTelegramMessage(botToken, "editMessageReplyMarkup", {
            chat_id: cbChatId,
            message_id: cbMessageId,
            reply_markup: { inline_keyboard: startButtons },
          });

          // 同时更新底部键盘按钮为对应语言
          if (bilingualEnabled && menuPages.length > 0) {
            const mainPage = menuPages.find((p: MenuPage) => p.id === "main");
            const translatedKeyboard = await generateKeyboardWithLanguage(
              mainPage,
              newLang as "zh" | "en",
              bilingualEnabled,
            );
            await sendTelegramMessage(botToken, "sendMessage", {
              chat_id: cbChatId,
              text: confirmMsg,
              reply_markup: translatedKeyboard
                ? {
                    keyboard: translatedKeyboard,
                    resize_keyboard: true,
                    one_time_keyboard: false,
                  }
                : undefined,
            });
          } else {
            // 发送确认消息
            await sendTelegramMessage(botToken, "sendMessage", {
              chat_id: cbChatId,
              text: confirmMsg,
            });
          }
        }

        return new Response(JSON.stringify({ ok: true, shop_lang_handled: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // 处理TG商城命令回调 (从/start消息的按钮)
      if (callbackData === "shop_cmd_shop" || callbackData === "shop_cmd_order") {
        console.log(`[TG Shop] Command callback: ${callbackData}`);

        // 获取用户语言偏好
        const { data: cmdShopCfg } = await supabase
          .from("shop_configs")
          .select("user_language_preferences")
          .eq("bot_token", botToken)
          .maybeSingle();
        const cmdLangPrefs = cmdShopCfg?.user_language_preferences || {};
        const cmdUserLang: "zh" | "en" = (cmdLangPrefs[cbChatId.toString()] as "zh" | "en") || "zh";

        if (callbackData === "shop_cmd_shop") {
          const shopResult = await handleShopCommand(supabase, botToken, undefined, cmdUserLang);
          if (shopResult.handled && shopResult.message) {
            await sendTelegramMessage(botToken, "sendMessage", {
              chat_id: cbChatId,
              text: shopResult.message,
              parse_mode: "Markdown",
              reply_markup: shopResult.inlineKeyboard,
            });
          }
        } else {
          const orderResult = await handleOrderCommand(supabase, botToken, cbChatId, "/order", cmdUserLang);
          if (orderResult.handled && orderResult.message) {
            await sendTelegramMessage(botToken, "sendMessage", {
              chat_id: cbChatId,
              text: orderResult.message,
              parse_mode: "Markdown",
            });
          }
        }

        return new Response(JSON.stringify({ ok: true, shop_cmd_handled: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // 其他回调走原有自动回复逻辑 - 传入语言参数实现自动翻译
      const cbUserLanguage = getUserLanguage(cbChatId, userLanguagePreferences);
      const handled = await handleCallbackQuery(
        botToken,
        body.callback_query,
        autoReplyRules,
        cbUserLanguage,
        bilingualEnabled,
      );
      console.log(`Callback query handled: ${handled}`);

      // 确定活动记录接收者：优先双向聊天的personalUserId，否则使用菜单键盘的menuAdminChatId
      const activityRecipient = bidirectionalChatEnabled && personalUserId > 0 ? personalUserId : menuAdminChatId;

      // 如果活动记录开启且有接收者，转发内联按钮点击事件
      if (activityLogEnabled && activityRecipient > 0) {
        const cbFromUser = body.callback_query.from;
        const cbUserName = cbFromUser.first_name + (cbFromUser.last_name ? " " + cbFromUser.last_name : "");

        if (cbChatId && cbChatId !== activityRecipient) {
          const activityText = `📋 用户操作记录\n来自: ${cbUserName}\n用户ID: ${cbChatId}\n操作: 点击内联按钮\n按钮数据: ${callbackData}`;
          await sendTelegramMessage(botToken, "sendMessage", {
            chat_id: activityRecipient,
            text: activityText,
          });
        }
      }

      return new Response(JSON.stringify({ ok: true, callback_handled: handled }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const message = body.message;
    if (!message) {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const chatId = message.chat.id;
    const fromUser = message.from;
    let text = message.text || message.caption || "";
    const messageId = message.message_id;

    // ========== 防轰炸：频率限制检查 ==========
    const rateLimitEnabled = keyboardConfig?.rate_limit_enabled !== false; // 默认开启
    const rateLimitPerMinute = keyboardConfig?.rate_limit_per_minute || 10;
    const rateLimitAction = keyboardConfig?.rate_limit_action || 'warn';
    const isAdminForRateLimit = (bidirectionalChatEnabled && personalUserId > 0 && chatId === personalUserId) || 
                                (menuAdminChatId > 0 && chatId === menuAdminChatId);

    if (rateLimitEnabled && !isAdminForRateLimit) {
      // 检查用户是否已被永久拉黑
      const { data: rateRecord } = await supabase
        .from('bot_rate_limits')
        .select('*')
        .eq('bot_token', botToken)
        .eq('telegram_user_id', chatId)
        .maybeSingle();

      if (rateRecord?.is_blocked) {
        console.log(`[RateLimit] User ${chatId} is blocked - silently ignoring message`);
        return new Response(JSON.stringify({ ok: true, rate_limited: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const now = new Date();
      const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);

      if (rateRecord) {
        const windowStart = new Date(rateRecord.window_start);
        
        if (windowStart > oneMinuteAgo) {
          // 在同一个时间窗口内
          const newCount = rateRecord.message_count + 1;
          
          if (newCount > rateLimitPerMinute) {
            // 超过频率限制
            console.log(`[RateLimit] User ${chatId} exceeded rate limit: ${newCount}/${rateLimitPerMinute} per minute`);
            
            // 发送警告提示（每次超限只提示一次，在刚超过时）
            if (newCount === rateLimitPerMinute + 1) {
              await sendTelegramMessage(botToken, 'sendMessage', {
                chat_id: chatId,
                text: '⚠️ 消息发送过于频繁，请稍后再试。\n⚠️ You are sending messages too frequently. Please try again later.',
              });
            }
            
            // 更新计数但不处理消息
            await supabase
              .from('bot_rate_limits')
              .update({ message_count: newCount, updated_at: now.toISOString() })
              .eq('id', rateRecord.id);
            
            return new Response(JSON.stringify({ ok: true, rate_limited: true }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
          
          // 未超限，更新计数
          await supabase
            .from('bot_rate_limits')
            .update({ message_count: newCount, updated_at: now.toISOString() })
            .eq('id', rateRecord.id);
        } else {
          // 时间窗口已过，重置计数
          await supabase
            .from('bot_rate_limits')
            .update({ message_count: 1, window_start: now.toISOString(), updated_at: now.toISOString() })
            .eq('id', rateRecord.id);
        }
      } else {
        // 首次记录
        await supabase
          .from('bot_rate_limits')
          .insert({ bot_token: botToken, telegram_user_id: chatId, message_count: 1, window_start: now.toISOString() });
      }
    }

    // 处理图片消息
    let photoUrl = "";
    let photoFileId = "";
    if (message.photo && message.photo.length > 0) {
      const largestPhoto = message.photo[message.photo.length - 1];
      photoFileId = largestPhoto.file_id;

      const fileResponse = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${photoFileId}`);
      const fileData = await fileResponse.json();

      if (fileData.ok && fileData.result.file_path) {
        photoUrl = `https://api.telegram.org/file/bot${botToken}/${fileData.result.file_path}`;
        text = `[图片:${photoFileId}] ${photoUrl}` + (text ? `\n${text}` : "");
      } else {
        text = `[图片:${photoFileId}]` + (text ? `\n${text}` : "");
      }
      console.log("Photo received:", { photoFileId, photoUrl });
    }

    // Check if this is a reply from personal user to forward (仅当双向聊天可用时)
    if (bidirectionalChatEnabled && activation && chatId === personalUserId && message.reply_to_message) {
      if (activation.app_enabled === false) {
        console.log("App port disabled - reply blocked");
        return new Response(JSON.stringify({ ok: true, blocked: "app_port_disabled" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const replyText = message.reply_to_message.text || message.reply_to_message.caption || "";
      const chatIdMatch = replyText.match(/\[CHATID:(\d+):MSGID:(\d+)\]/);

      if (chatIdMatch) {
        const targetChatId = parseInt(chatIdMatch[1]);
        const originalMsgId = parseInt(chatIdMatch[2]);

        console.log(`Routing reply to chatId: ${targetChatId}, originalMsgId: ${originalMsgId}`);

        let sendResult;
        let messageContent = message.text || message.caption || "";

        if (message.photo && message.photo.length > 0) {
          const replyPhotoFileId = message.photo[message.photo.length - 1].file_id;
          const sendResponse = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: targetChatId,
              photo: replyPhotoFileId,
              caption: messageContent,
              reply_to_message_id: originalMsgId,
            }),
          });
          sendResult = await sendResponse.json();

          const fileResponse = await fetch(
            `https://api.telegram.org/bot${botToken}/getFile?file_id=${replyPhotoFileId}`,
          );
          const fileData = await fileResponse.json();
          if (fileData.ok && fileData.result.file_path) {
            const replyPhotoUrl = `https://api.telegram.org/file/bot${botToken}/${fileData.result.file_path}`;
            messageContent =
              `[图片:${replyPhotoFileId}] ${replyPhotoUrl}` + (messageContent ? `\n${messageContent}` : "");
          } else {
            messageContent = `[图片:${replyPhotoFileId}]` + (messageContent ? `\n${messageContent}` : "");
          }
        } else {
          const sendResponse = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: targetChatId,
              text: messageContent,
              reply_to_message_id: originalMsgId,
            }),
          });
          sendResult = await sendResponse.json();
        }

        console.log("Reply sent result:", JSON.stringify(sendResult, null, 2));

        if (sendResult.ok) {
          await supabase.from("messages").insert({
            bot_activation_id: activation.id,
            telegram_chat_id: targetChatId,
            telegram_message_id: sendResult.result?.message_id,
            telegram_user_name: "我",
            content: messageContent,
            direction: "outgoing",
          });
        }

        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // 管理员自己发送的非回复消息：不再跳过，允许继续处理菜单键盘、商城、关键词等功能
    // 转发逻辑在底部已通过 chatId !== activityRecipient 条件自动跳过
    const isAdminUser = bidirectionalChatEnabled && personalUserId > 0 && chatId === personalUserId;

    // 存储消息到数据库 (仅当双向聊天可用时，且不是管理员自己的消息)
    const userName = fromUser.first_name + (fromUser.last_name ? " " + fromUser.last_name : "");

    if (bidirectionalChatEnabled && activation && !isAdminUser) {
      await supabase.from("messages").insert({
        bot_activation_id: activation.id,
        telegram_chat_id: chatId,
        telegram_user_name: userName,
        telegram_message_id: messageId,
        content: text,
        direction: "incoming",
        is_read: activation.web_enabled === false ? null : false,
      });
    }

    // 自动抓取用户数据到 bot_users 表 (菜单键盘功能需要)
    try {
      await supabase.from("bot_users").upsert(
        {
          bot_token: botToken,
          telegram_user_id: chatId,
          first_name: fromUser.first_name || "",
          last_name: fromUser.last_name || null,
          username: fromUser.username || null,
          last_seen_at: new Date().toISOString(),
        },
        {
          onConflict: "bot_token,telegram_user_id",
          ignoreDuplicates: false,
        },
      );
      console.log(`User ${chatId} saved/updated in bot_users`);
    } catch (e) {
      console.error("Failed to save user to bot_users:", e);
    }

    // Update trial messages count if not authorized (仅当有activation时)
    if (activation && !activation.is_authorized) {
      await supabase
        .from("bot_activations")
        .update({ trial_messages_used: activation.trial_messages_used + 1 })
        .eq("id", activation.id);

      await supabase.from("bot_trial_records").upsert(
        {
          bot_token: botToken,
          messages_used: activation.trial_messages_used + 1,
          is_blocked: activation.trial_messages_used + 1 >= activation.trial_limit,
        },
        { onConflict: "bot_token" },
      );
    }

    // 菜单键盘功能 - 独立运行，不依赖双向聊天
    let keyboardHandled = false;

    // 获取用户的语言偏好
    let userLanguage = getUserLanguage(chatId, userLanguagePreferences);

    // 检查是否是语言切换按钮点击
    if (bilingualEnabled && (text === "🌐 English" || text === "🌐 中文")) {
      // 切换语言
      const newLanguage: "zh" | "en" = text === "🌐 English" ? "en" : "zh";
      userLanguagePreferences[chatId.toString()] = newLanguage;
      userLanguagePreferences[`${chatId}_page`] = "main"; // 切换语言时重置到主菜单
      userLanguage = newLanguage;

      // 保存语言偏好到数据库
      await supabase
        .from("keyboard_configs")
        .update({ user_language_preferences: userLanguagePreferences })
        .eq("bot_token", botToken);

      // 发送切换确认并更新键盘
      const mainPage = menuPages.find((p: MenuPage) => p.id === "main");
      const keyboard = await generateKeyboardWithLanguage(mainPage, newLanguage, bilingualEnabled);

      await sendTelegramMessage(botToken, "sendMessage", {
        chat_id: chatId,
        text: newLanguage === "en" ? "🌐 Switched to English" : "🌐 已切换为中文",
        reply_markup: keyboard
          ? {
              keyboard,
              resize_keyboard: true,
              one_time_keyboard: false,
            }
          : undefined,
      });

      console.log(`Language switched to ${newLanguage} for user ${chatId}`);
      keyboardHandled = true;
    }

    // ========== TG商城命令处理 ==========
    // 获取完整的商城配置
    const { data: shopConfigData } = await supabase
      .from("shop_configs")
      .select("*")
      .eq("bot_token", botToken)
      .maybeSingle();

    let shopConfig = shopConfigData as
      | (ShopConfig & { shop_expire_at?: string | null; shop_trial_started_at?: string | null })
      | null;
    const customCommands = shopConfig?.custom_commands || { shop: [], buy: [], order: [], balance: [], recharge: [] };

    // 获取TG商城的用户语言偏好
    let shopUserLanguagePreferences: Record<string, string> = shopConfig?.user_language_preferences || {};
    let shopUserLanguage: "zh" | "en" = (shopUserLanguagePreferences[chatId.toString()] as "zh" | "en") || "zh";

    // TG商城有效期/试用期检查
    let shopEnabled = true;
    let shopExpiredMessage = "";
    if (shopConfig) {
      const now = new Date();
      const shopExpireAt = (shopConfigData as any)?.shop_expire_at
        ? new Date((shopConfigData as any).shop_expire_at)
        : null;
      const shopTrialStartedAt = (shopConfigData as any)?.shop_trial_started_at
        ? new Date((shopConfigData as any).shop_trial_started_at)
        : null;

      // 如果已激活授权，检查是否过期
      if (shopExpireAt) {
        if (shopExpireAt < now) {
          console.log("[TG Shop] Shop expired - disabling shop features");
          shopEnabled = false;
          shopExpiredMessage =
            shopUserLanguage === "en"
              ? "❌ Shop subscription expired. Please enter an activation code to renew."
              : "❌ 商城授权已过期，请输入激活码续期！";
        }
      } else if (shopTrialStartedAt) {
        // 试用模式：24小时后过期
        const trialEndTime = new Date(shopTrialStartedAt.getTime() + 24 * 60 * 60 * 1000);
        if (now > trialEndTime) {
          console.log("[TG Shop] Shop trial expired (24h) - disabling shop features");
          shopEnabled = false;
          shopExpiredMessage =
            shopUserLanguage === "en"
              ? "❌ Shop trial has expired. Please enter an activation code to activate."
              : "❌ 商城试用已过期，请输入激活码激活！";
        }
      }
      // 注意：如果既没有 shop_expire_at 也没有 shop_trial_started_at，说明是首次使用，将在下面自动开启试用
    }

    // 处理TG商城的语言切换回调（从/start消息的语言按钮）
    if (
      !keyboardHandled &&
      (text === "🌐 English" || text === "🌐 中文 / English" || text === "shop_lang_en" || text === "shop_lang_zh")
    ) {
      // 这是通过消息文本触发的语言切换，但实际上我们应该在callback_query中处理
      // 这里不处理，留给callback_query处理
    }

    // 中文模糊匹配函数 - 匹配2个字符即触发
    const fuzzyMatchChinese = (text: string, keywords: string[]): boolean => {
      if (!keywords || keywords.length === 0) return false;
      const textLower = text.toLowerCase().trim();
      return keywords.some((keyword: string) => {
        if (!keyword || keyword.length < 2) return false;
        // 检查文本中是否包含关键词的任意2个连续字符
        for (let i = 0; i <= keyword.length - 2; i++) {
          const twoChars = keyword.substring(i, i + 2);
          if (textLower.includes(twoChars)) return true;
        }
        return false;
      });
    };

    // ========== /balance 余额查询 ==========
    const isBalanceCommand =
      text.toLowerCase() === "/balance" ||
      text === "查询余额" ||
      text === "余额" ||
      fuzzyMatchChinese(text, customCommands.balance || []);
    if (!keyboardHandled && isBalanceCommand && shopEnabled && shopConfig) {
      const { data: userBal } = await supabase
        .from("shop_user_balances")
        .select("balance, currency")
        .eq("bot_token", botToken)
        .eq("telegram_user_id", chatId)
        .maybeSingle();

      let balMsg = "";
      if (userBal && parseFloat(userBal.balance) > 0) {
        balMsg = `${t("balance_title", shopUserLanguage)}**${parseFloat(userBal.balance).toFixed(2)} ${userBal.currency}**${t("balance_recharge_hint", shopUserLanguage)}`;
      } else {
        balMsg = `${t("balance_no_account", shopUserLanguage)}${t("balance_recharge_hint", shopUserLanguage)}`;
      }

      await sendTelegramMessage(botToken, "sendMessage", {
        chat_id: chatId,
        text: balMsg,
        parse_mode: "Markdown",
      });
      keyboardHandled = true;
      console.log("[TG Shop] /balance command handled");
    }

    // ========== /recharge 充值 ==========
    const isRechargeCommand =
      text.toLowerCase() === "/recharge" ||
      text === "充值" ||
      text === "充值余额" ||
      fuzzyMatchChinese(text, customCommands.recharge || []);
    if (!keyboardHandled && isRechargeCommand && shopEnabled && shopConfig) {
      // 获取 type=recharge 的商品
      const { data: rechargeProducts } = await supabase
        .from("shop_products")
        .select("*")
        .eq("bot_token", botToken)
        .eq("is_active", true)
        .eq("type", "recharge")
        .order("price", { ascending: true });

      if (!rechargeProducts || rechargeProducts.length === 0) {
        await sendTelegramMessage(botToken, "sendMessage", {
          chat_id: chatId,
          text: t("recharge_no_products", shopUserLanguage),
          parse_mode: "Markdown",
        });
      } else {
        // 查询当前余额
        const { data: curBal } = await supabase
          .from("shop_user_balances")
          .select("balance, currency")
          .eq("bot_token", botToken)
          .eq("telegram_user_id", chatId)
          .maybeSingle();

        const currentBal = curBal ? parseFloat(curBal.balance).toFixed(2) : "0.00";
        const balCurrency = curBal?.currency || rechargeProducts[0].currency;

        const productLines = rechargeProducts.map((p: any) => {
          const shortId = p.id.replace(/-/g, "");
          const displayName = p.name;
          return `💰 **${displayName}** - ${p.price} ${p.currency}\n   ${t("shop_click_to_buy", shopUserLanguage)}/buy\\_${shortId}`;
        });

        const msg = `${t("recharge_title", shopUserLanguage)}

💳 ${shopUserLanguage === "zh" ? "当前余额" : "Current balance"}: **${currentBal} ${balCurrency}**

${productLines.join("\n\n")}

────────────────
${t("recharge_select", shopUserLanguage)}`;

        await sendTelegramMessage(botToken, "sendMessage", {
          chat_id: chatId,
          text: msg,
          parse_mode: "Markdown",
        });
      }
      keyboardHandled = true;
      console.log("[TG Shop] /recharge command handled");
    }

    // 处理 /shop 命令或自定义中文命令
    const isShopCommand = text.toLowerCase() === "/shop" || fuzzyMatchChinese(text, customCommands.shop);
    if (!keyboardHandled && isShopCommand) {
      // 首次使用自动开启24小时试用
      if (shopConfig && !(shopConfigData as any)?.shop_expire_at && !(shopConfigData as any)?.shop_trial_started_at) {
        console.log("[TG Shop] First use - starting 24h trial");
        const trialStartTime = new Date().toISOString();
        await supabase
          .from("shop_configs")
          .update({
            shop_trial_started_at: trialStartTime,
            updated_at: new Date().toISOString(),
          })
          .eq("bot_token", botToken);
        // 更新本地变量
        shopEnabled = true;
      }

      // 检查商城是否过期
      if (!shopEnabled) {
        await sendTelegramMessage(botToken, "sendMessage", {
          chat_id: chatId,
          text: shopExpiredMessage,
          parse_mode: "Markdown",
        });
        keyboardHandled = true;
        console.log("[TG Shop] /shop command blocked - shop expired");
      } else {
        const shopResult = await handleShopCommand(supabase, botToken, undefined, shopUserLanguage);
        if (shopResult.handled && shopResult.message) {
          await sendTelegramMessage(botToken, "sendMessage", {
            chat_id: chatId,
            text: shopResult.message,
            parse_mode: "Markdown",
            reply_markup: shopResult.inlineKeyboard,
          });
          keyboardHandled = true;
          console.log("[TG Shop] /shop command handled");
        }
      }
    }

    // 处理 /buy 命令或自定义中文命令
    // 对于自定义命令，格式为 "购买 商品名" 或 "下单 商品名"
    let buyCommandText = text;
    const isBuyEnglishCommand = text.toLowerCase().startsWith("/buy");
    const isBuyChineseCommand = fuzzyMatchChinese(text.split(/\s+/)[0] || "", customCommands.buy);

    if (!keyboardHandled && (isBuyEnglishCommand || isBuyChineseCommand)) {
      // 检查商城是否过期
      if (!shopEnabled) {
        await sendTelegramMessage(botToken, "sendMessage", {
          chat_id: chatId,
          text: shopExpiredMessage,
          parse_mode: "Markdown",
        });
        keyboardHandled = true;
        console.log("[TG Shop] /buy command blocked - shop expired");
      } else {
        // 如果是中文命令，转换为 /buy 格式以便处理
        if (isBuyChineseCommand && !isBuyEnglishCommand) {
          const parts = text.split(/\s+/);
          if (parts.length > 1) {
            buyCommandText = "/buy " + parts.slice(1).join(" ");
          } else {
            buyCommandText = "/buy";
          }
        }

        const buyResult = await handleBuyCommand(
          supabase,
          botToken,
          chatId,
          fromUser.username || null,
          buyCommandText,
          shopUserLanguage,
        );
        if (buyResult.handled && buyResult.message) {
          // 发送订单详情，带支付方式选择按钮（如有商品图片则发送图片）
          const msgResult = buyResult.photoUrl
            ? await sendTelegramMessage(botToken, "sendPhoto", {
                chat_id: chatId,
                photo: buyResult.photoUrl,
                caption: buyResult.message,
                parse_mode: "Markdown",
                reply_markup: buyResult.inlineKeyboard,
              })
            : await sendTelegramMessage(botToken, "sendMessage", {
                chat_id: chatId,
                text: buyResult.message,
                parse_mode: "Markdown",
                reply_markup: buyResult.inlineKeyboard,
              });

          // 保存消息ID以便超时后删除
          if (msgResult.ok && msgResult.result?.message_id && buyResult.orderId) {
            await supabase
              .from("shop_orders")
              .update({ telegram_message_id: msgResult.result.message_id })
              .eq("id", buyResult.orderId);
            console.log(`[TG Shop] Saved message_id ${msgResult.result.message_id} for order ${buyResult.orderId}`);
          }

          keyboardHandled = true;
          console.log("[TG Shop] /buy command handled");
        }
      }
    }

    // 处理 /order 命令或自定义中文命令
    let orderCommandText = text;
    const isOrderEnglishCommand = text.toLowerCase().startsWith("/order");
    const isOrderChineseCommand = fuzzyMatchChinese(text.split(/\s+/)[0] || "", customCommands.order);

    if (!keyboardHandled && (isOrderEnglishCommand || isOrderChineseCommand)) {
      // 检查商城是否过期
      if (!shopEnabled) {
        await sendTelegramMessage(botToken, "sendMessage", {
          chat_id: chatId,
          text: shopExpiredMessage,
          parse_mode: "Markdown",
        });
        keyboardHandled = true;
        console.log("[TG Shop] /order command blocked - shop expired");
      } else {
        // 如果是中文命令，转换为 /order 格式
        if (isOrderChineseCommand && !isOrderEnglishCommand) {
          const parts = text.split(/\s+/);
          if (parts.length > 1) {
            orderCommandText = "/order " + parts.slice(1).join(" ");
          } else {
            orderCommandText = "/order";
          }
        }

        const orderResult = await handleOrderCommand(supabase, botToken, chatId, orderCommandText, shopUserLanguage);
        if (orderResult.handled && orderResult.message) {
          await sendTelegramMessage(botToken, "sendMessage", {
            chat_id: chatId,
            text: orderResult.message,
            parse_mode: "Markdown",
          });
          keyboardHandled = true;
          console.log("[TG Shop] /order command handled");
        }
      }
    }

    // ========== 实物商品收货地址捕获（优先于关键词匹配） ==========
    if (!keyboardHandled && shopEnabled && shopConfig && !text.startsWith("/")) {
      try {
        // 检查用户是否有已付款但未发货的实物订单
        const { data: pendingPhysicalOrders } = await supabase
          .from("shop_orders")
          .select("*")
          .eq("bot_token", botToken)
          .eq("telegram_user_id", chatId)
          .eq("status", "paid")
          .eq("order_type", "physical")
          .is("delivered_at", null)
          .order("created_at", { ascending: false })
          .limit(1);

        if (pendingPhysicalOrders && pendingPhysicalOrders.length > 0) {
          const physicalOrder = pendingPhysicalOrders[0];
          const addressText = text.trim();

          // 更新订单：记录收货地址
          await supabase
            .from("shop_orders")
            .update({
              delivery_content: addressText,
              delivered_at: new Date().toISOString(),
            })
            .eq("id", physicalOrder.id);

          // 通知用户
          await sendTelegramMessage(botToken, "sendMessage", {
            chat_id: chatId,
            text: `${t("physical_address_received", shopUserLanguage)}\n\n📝 ${shopUserLanguage === "zh" ? "订单号" : "Order No"}: \`${physicalOrder.order_no}\``,
            parse_mode: "Markdown",
          });

          // 通知管理员：用户已付款 + 收货地址 + 商品信息
          if ((shopConfig as any).admin_id) {
            const adminMsg = `✅ **${shopUserLanguage === "zh" ? "买家已付款，请尽快发货！" : "Buyer has paid, please ship ASAP!"}**

📝 ${shopUserLanguage === "zh" ? "订单号" : "Order No"}: \`${physicalOrder.order_no}\`
📦 ${shopUserLanguage === "zh" ? "商品" : "Product"}: ${physicalOrder.product_name}
💰 ${shopUserLanguage === "zh" ? "金额" : "Amount"}: ${physicalOrder.amount} ${physicalOrder.currency}
👤 ${shopUserLanguage === "zh" ? "买家" : "Buyer"}: @${physicalOrder.telegram_username || chatId}

📮 ${shopUserLanguage === "zh" ? "收货地址" : "Shipping Address"}:
${addressText}`;
            await sendTelegramMessage(botToken, "sendMessage", {
              chat_id: (shopConfig as any).admin_id,
              text: adminMsg,
              parse_mode: "Markdown",
            });
          }

          keyboardHandled = true;
          console.log(`[TG Shop] Physical order ${physicalOrder.order_no} address captured`);
        }
      } catch (addrErr) {
        console.error("[TG Shop] Address capture error:", addrErr);
      }
    }

    // ========== 商品关键词触发：用户直接发送关键词匹配商品 ==========
    if (!keyboardHandled && shopEnabled && shopConfig && !text.startsWith("/")) {
      try {
        const { data: kwProducts } = await supabase
          .from("shop_products")
          .select("*")
          .eq("bot_token", botToken)
          .eq("is_active", true);

        if (kwProducts && kwProducts.length > 0) {
          const inputLower = text.toLowerCase().trim();
          const kwMatched = kwProducts.filter((p: ShopProduct) => {
            // 精确匹配关键词（不做模糊匹配，避免误触发）
            return p.keywords?.some((k: string) => k && k.toLowerCase().trim() === inputLower);
          });

          if (kwMatched.length === 1) {
            // 精确匹配到一个商品，直接创建订单
            const product = kwMatched[0];
            const buyResult = await createOrderForProduct(
              supabase,
              botToken,
              chatId,
              fromUser.username || null,
              product.id,
              product,
              shopConfig as any,
              shopUserLanguage,
            );
            if (buyResult.handled && buyResult.message) {
              const msgResult = buyResult.photoUrl
                ? await sendTelegramMessage(botToken, "sendPhoto", {
                    chat_id: chatId,
                    photo: buyResult.photoUrl,
                    caption: buyResult.message,
                    parse_mode: "Markdown",
                    reply_markup: buyResult.inlineKeyboard,
                  })
                : await sendTelegramMessage(botToken, "sendMessage", {
                    chat_id: chatId,
                    text: buyResult.message,
                    parse_mode: "Markdown",
                    reply_markup: buyResult.inlineKeyboard,
                  });
              if (msgResult.ok && msgResult.result?.message_id && buyResult.orderId) {
                await supabase
                  .from("shop_orders")
                  .update({ telegram_message_id: msgResult.result.message_id })
                  .eq("id", buyResult.orderId);
              }
              keyboardHandled = true;
              console.log(`[TG Shop] Keyword "${inputLower}" matched product: ${product.name}`);
            }
          } else if (kwMatched.length > 1) {
            // 匹配到多个商品，显示列表
            const stockLabel = t("shop_stock", shopUserLanguage);
            const outOfStockLabel = t("shop_out_of_stock", shopUserLanguage);
            const buyLabel = t("shop_click_to_buy", shopUserLanguage);

            const names = shopUserLanguage === "en" ? kwMatched.map((p: ShopProduct) => p.name) : [];
            const nameMap = shopUserLanguage === "en" ? await translateManyToEnglish(names) : {};

            const productLines = kwMatched.map((p: ShopProduct) => {
              const stock = p.stock_content?.length || 0;
              const isRecharge = p.type === "recharge";
              const stockText = isRecharge
                ? `(${t("shop_recharge_product", shopUserLanguage)})`
                : stock > 0
                  ? `(${stockLabel}: ${stock})`
                  : `(${outOfStockLabel})`;
              const shortId = p.id.replace(/-/g, "");
              const displayName = shopUserLanguage === "en" ? nameMap[p.name] || p.name : p.name;
              return `📦 **${displayName}** - ${p.price} ${p.currency} ${stockText}\n${buyLabel} /buy\\_${shortId}`;
            });

            await sendTelegramMessage(botToken, "sendMessage", {
              chat_id: chatId,
              text: `${t("buy_found_multiple", shopUserLanguage, { count: kwMatched.length, keyword: text })}\n\n${productLines.join("\n\n")}\n\n────────────────\n${t("shop_buy_tip", shopUserLanguage)}`,
              parse_mode: "Markdown",
            });
            keyboardHandled = true;
            console.log(`[TG Shop] Keyword "${inputLower}" matched ${kwMatched.length} products`);
          }
        }
      } catch (kwErr) {
        console.error("[TG Shop] Keyword matching error:", kwErr);
      }
    }

    // ========== 实物商品收货地址捕获 ==========
    if (!keyboardHandled && shopEnabled && shopConfig && !text.startsWith("/")) {
      try {
        // 检查用户是否有已付款但未发货的实物订单
        const { data: pendingPhysicalOrders } = await supabase
          .from("shop_orders")
          .select("*")
          .eq("bot_token", botToken)
          .eq("telegram_user_id", chatId)
          .eq("status", "paid")
          .eq("order_type", "physical")
          .is("delivered_at", null)
          .order("created_at", { ascending: false })
          .limit(1);

        if (pendingPhysicalOrders && pendingPhysicalOrders.length > 0) {
          const physicalOrder = pendingPhysicalOrders[0];
          const addressText = text.trim();

          // 更新订单：记录收货地址并标记已发货（等待管理员实际发货）
          await supabase
            .from("shop_orders")
            .update({
              delivery_content: addressText,
              delivered_at: new Date().toISOString(),
            })
            .eq("id", physicalOrder.id);

          // 通知用户
          await sendTelegramMessage(botToken, "sendMessage", {
            chat_id: chatId,
            text: `${t("physical_address_received", shopUserLanguage)}\n\n📝 ${shopUserLanguage === "zh" ? "订单号" : "Order No"}: \`${physicalOrder.order_no}\``,
            parse_mode: "Markdown",
          });

          // 通知管理员：用户已付款 + 收货地址
          if ((shopConfig as any).admin_id) {
            const adminMsg = `✅ **${shopUserLanguage === "zh" ? "用户已付款，请处理发货！" : "User has paid, please process shipping!"}**

📝 ${shopUserLanguage === "zh" ? "订单号" : "Order No"}: \`${physicalOrder.order_no}\`
📦 ${shopUserLanguage === "zh" ? "商品" : "Product"}: ${physicalOrder.product_name}
💰 ${shopUserLanguage === "zh" ? "金额" : "Amount"}: ${physicalOrder.amount} ${physicalOrder.currency}
👤 ${shopUserLanguage === "zh" ? "用户" : "User"}: @${physicalOrder.telegram_username || chatId}

📮 ${shopUserLanguage === "zh" ? "收货地址" : "Shipping Address"}:
${addressText}`;
            await sendTelegramMessage(botToken, "sendMessage", {
              chat_id: (shopConfig as any).admin_id,
              text: adminMsg,
              parse_mode: "Markdown",
            });
          }

          keyboardHandled = true;
          console.log(`[TG Shop] Physical order ${physicalOrder.order_no} address captured`);
        }
      } catch (addrErr) {
        console.error("[TG Shop] Address capture error:", addrErr);
      }
    }

    // 处理 /pay_alipay 或 /pay_wechat 命令 - 获取法币支付二维码
    const payMatch = text.match(/^\/pay_(alipay|wechat)_(.+)$/i);
    if (!keyboardHandled && payMatch) {
      const payMethod = payMatch[1].toLowerCase() as "alipay" | "wechat";
      const payOrderNo = payMatch[2];

      console.log(`[TG Shop] Fiat payment request: ${payMethod} for order ${payOrderNo}`);

      // 获取订单
      const { data: payOrder, error: payOrderError } = await supabase
        .from("shop_orders")
        .select("*")
        .eq("order_no", payOrderNo)
        .eq("bot_token", botToken)
        .maybeSingle();

      if (payOrderError || !payOrder) {
        await sendTelegramMessage(botToken, "sendMessage", {
          chat_id: chatId,
          text: `${t("error_order_not_found", shopUserLanguage)}: ${payOrderNo}`,
          parse_mode: "Markdown",
        });
        keyboardHandled = true;
      } else if (payOrder.status !== "pending") {
        await sendTelegramMessage(botToken, "sendMessage", {
          chat_id: chatId,
          text: t("error_order_completed", shopUserLanguage),
          parse_mode: "Markdown",
        });
        keyboardHandled = true;
      } else {
        // 获取商店配置
        const { data: payShopConfig } = await supabase
          .from("shop_configs")
          .select("*")
          .eq("bot_token", botToken)
          .maybeSingle();

        if (!payShopConfig) {
          await sendTelegramMessage(botToken, "sendMessage", {
            chat_id: chatId,
            text: t("error_shop_config", shopUserLanguage),
            parse_mode: "Markdown",
          });
          keyboardHandled = true;
        } else {
          // 确定使用哪个支付提供商
          let provider = "";
          if (payMethod === "alipay") {
            provider = payShopConfig.alipay_provider || "xunhu";
          } else {
            provider = payShopConfig.wechat_provider || "xunhu";
          }

          // 检查提供商配置
          if (provider === "yungou" && (!payShopConfig.yungou_id || !payShopConfig.yungou_key)) {
            await sendTelegramMessage(botToken, "sendMessage", {
              chat_id: chatId,
              text: t("error_payment_not_configured", shopUserLanguage),
              parse_mode: "Markdown",
            });
            keyboardHandled = true;
          } else if (provider === "xunhu" && (!payShopConfig.xunhu_id || !payShopConfig.xunhu_secret)) {
            await sendTelegramMessage(botToken, "sendMessage", {
              chat_id: chatId,
              text: t("error_payment_not_configured", shopUserLanguage),
              parse_mode: "Markdown",
            });
            keyboardHandled = true;
          } else {
            // 调用 create-payment 函数获取支付链接
            const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
            const notifyUrl = `${supabaseUrl}/functions/v1/shop-payment-webhook?bot_token=${encodeURIComponent(botToken)}&type=${provider}`;

            try {
              const paymentRes = await fetch(`${supabaseUrl}/functions/v1/create-payment`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
                },
                body: JSON.stringify({
                  bot_token: botToken,
                  order_no: payOrderNo,
                  product_name: payOrder.product_name,
                  amount: payOrder.amount,
                  payment_method: payMethod,
                  provider: provider,
                  notify_url: notifyUrl,
                }),
              });

              const paymentData = await paymentRes.json();
              console.log("[TG Shop] Create payment response:", paymentData);

              if (paymentData.success && paymentData.qr_code) {
                // 发送支付二维码 - 多语言支持
                const paymentLabel =
                  payMethod === "alipay"
                    ? t("payment_alipay", shopUserLanguage)
                    : t("payment_wechat", shopUserLanguage);
                const expireTime = new Date(payOrder.expires_at);
                const chinaTime = new Date(expireTime.getTime() + 8 * 60 * 60 * 1000);
                const expireTimeStr = `${chinaTime.getUTCHours().toString().padStart(2, "0")}:${chinaTime.getUTCMinutes().toString().padStart(2, "0")}`;

                const qrCaption = `💳 *${paymentLabel}*

${t("order_product", shopUserLanguage)}: ${payOrder.product_name}
${t("order_no", shopUserLanguage)}: \`${payOrderNo}\`
${t("payment_amount", shopUserLanguage)}: ¥${payOrder.amount}

────────────────
${t("fiat_scan_qr", shopUserLanguage)}

${t("payment_deadline", shopUserLanguage)}: ${expireTimeStr} (${t("payment_30min", shopUserLanguage)})
${t("fiat_timeout_warning", shopUserLanguage)}
${t("fiat_auto_deliver", shopUserLanguage)}`;

                const qrMsgResult = await sendTelegramMessage(botToken, "sendPhoto", {
                  chat_id: chatId,
                  photo: paymentData.qr_code,
                  caption: qrCaption,
                  parse_mode: "Markdown",
                });

                // 保存二维码消息ID
                if (qrMsgResult.ok && qrMsgResult.result?.message_id) {
                  await supabase
                    .from("shop_orders")
                    .update({ telegram_qr_message_id: qrMsgResult.result.message_id })
                    .eq("order_no", payOrderNo);
                }

                keyboardHandled = true;
                console.log("[TG Shop] Fiat payment QR sent successfully");
              } else {
                await sendTelegramMessage(botToken, "sendMessage", {
                  chat_id: chatId,
                  text: `${t("error_qr_failed", shopUserLanguage)}: ${paymentData.error || "Unknown error"}`,
                  parse_mode: "Markdown",
                });
                keyboardHandled = true;
              }
            } catch (payError) {
              console.error("[TG Shop] Create payment error:", payError);
              await sendTelegramMessage(botToken, "sendMessage", {
                chat_id: chatId,
                text: t("error_payment_failed", shopUserLanguage),
                parse_mode: "Markdown",
              });
              keyboardHandled = true;
            }
          }
        }
      }
    }

    // 处理 /start 命令
    if (!keyboardHandled && text === "/start") {
      // 检查TG商城是否启用了/start消息
      if (shopConfig?.start_enabled) {
        console.log("[TG Shop] Sending shop start message");

        // 使用翻译系统自动中英文切换
        const shopBtnText =
          shopUserLanguage === "en" ? t("btn_shop", "en") : shopConfig.shop_button_text || t("btn_shop", "zh");
        const orderBtnText =
          shopUserLanguage === "en" ? t("btn_order", "en") : shopConfig.order_button_text || t("btn_order", "zh");

        const startButtons = {
          inline_keyboard: [
            [
              { text: `🛒 ${shopBtnText}`, callback_data: "shop_cmd_shop" },
              { text: `📋 ${orderBtnText}`, callback_data: "shop_cmd_order" },
            ],
            [
              {
                text: "🌐 " + (shopUserLanguage === "en" ? "中文" : "English"),
                callback_data: shopUserLanguage === "en" ? "shop_lang_zh" : "shop_lang_en",
              },
            ],
          ],
        };

        const startMessage =
          shopConfig.start_message ||
          (shopUserLanguage === "en" ? "👋 Welcome! Please select a service:" : "👋 欢迎！请选择您需要的服务：");

        const msgParams: any = {
          chat_id: chatId,
          reply_markup: startButtons,
          parse_mode: "Markdown",
        };

        if (shopConfig.start_disable_preview) {
          msgParams.disable_web_page_preview = true;
        }

        if (shopConfig.start_message_media_type === "photo" && shopConfig.start_message_media_url) {
          msgParams.photo = shopConfig.start_message_media_url;
          msgParams.caption = startMessage;
          await sendTelegramMessage(botToken, "sendPhoto", msgParams);
        } else if (shopConfig.start_message_media_type === "video" && shopConfig.start_message_media_url) {
          msgParams.video = shopConfig.start_message_media_url;
          msgParams.caption = startMessage;
          await sendTelegramMessage(botToken, "sendVideo", msgParams);
        } else {
          msgParams.text = startMessage;
          await sendTelegramMessage(botToken, "sendMessage", msgParams);
        }

        keyboardHandled = true;
      }

      // 欢迎语逻辑：
      // 1. 同时有双向聊天和菜单键盘时 → 使用菜单键盘的/start自动回复
      // 2. 只有双向聊天时 → 使用双向聊天的欢迎语(activation.greeting_message)

      const hasBidirectionalChat = bidirectionalChatEnabled && activation && chatStartEnabled;
      const hasKeyboardMenu = keyboardMenuEnabled && menuPages.length > 0 && keyboardStartEnabled;

      // 如果同时有双向聊天和菜单键盘，优先使用菜单键盘的/start自动回复
      if (hasBidirectionalChat && hasKeyboardMenu) {
        // 先检查自动回复规则中是否有 /start 命令
        const hasStartAutoReply = autoReplyRules.some((r) => {
          const ruleVal = (r.triggerValue || "").trim().toLowerCase().replace(/^\//, "");
          return r.triggerType === "command" && ruleVal === "start";
        });

        if (hasStartAutoReply) {
          // 使用菜单键盘的/start自动回复
          keyboardHandled = await handleAutoReply(
            botToken,
            chatId,
            text,
            autoReplyRules,
            menuPages,
            userLanguage,
            bilingualEnabled,
          );
        } else if (forceMenuOnStart) {
          // 没有/start自动回复但配置了强制显示菜单
          await sendMainMenu(
            botToken,
            chatId,
            menuPages,
            undefined,
            userLanguage,
            bilingualEnabled,
            supabase,
            userLanguagePreferences,
          );
          keyboardHandled = true;
        } else {
          // 没有配置/start自动回复，发送默认菜单
          await sendMainMenu(
            botToken,
            chatId,
            menuPages,
            undefined,
            userLanguage,
            bilingualEnabled,
            supabase,
            userLanguagePreferences,
          );
          keyboardHandled = true;
        }
      } else if (hasKeyboardMenu) {
        // 只有菜单键盘，使用菜单键盘的自动回复或默认菜单
        if (forceMenuOnStart) {
          await sendMainMenu(
            botToken,
            chatId,
            menuPages,
            undefined,
            userLanguage,
            bilingualEnabled,
            supabase,
            userLanguagePreferences,
          );
          keyboardHandled = true;
        } else {
          keyboardHandled = await handleAutoReply(
            botToken,
            chatId,
            text,
            autoReplyRules,
            menuPages,
            userLanguage,
            bilingualEnabled,
          );
          if (!keyboardHandled && menuPages.length > 0) {
            await sendMainMenu(
              botToken,
              chatId,
              menuPages,
              undefined,
              userLanguage,
              bilingualEnabled,
              supabase,
              userLanguagePreferences,
            );
            keyboardHandled = true;
          }
        }
      } else if (hasBidirectionalChat && activation?.greeting_message) {
        // 只有双向聊天，使用双向聊天的欢迎语
        await sendTelegramMessage(botToken, "sendMessage", {
          chat_id: chatId,
          text: activation.greeting_message,
        });
        keyboardHandled = true;
      }

      // 如果以上都没处理，检查自动回复规则
      if (!keyboardHandled) {
        keyboardHandled = await handleAutoReply(
          botToken,
          chatId,
          text,
          autoReplyRules,
          menuPages,
          userLanguage,
          bilingualEnabled,
        );
      }
    } else if (!keyboardHandled) {
      // 先检查菜单导航
      if (menuPages.length > 0) {
        const currentPageId = getUserCurrentPage(chatId, userLanguagePreferences);
        const navResult = await handleMenuNavigation(
          botToken,
          chatId,
          text,
          menuPages,
          userLanguage,
          bilingualEnabled,
          currentPageId,
        );
        keyboardHandled = navResult.handled;
        if (navResult.handled && navResult.targetPageId) {
          // 保存用户当前所在的菜单页面
          userLanguagePreferences[`${chatId}_page`] = navResult.targetPageId;
          await supabase
            .from("keyboard_configs")
            .update({ user_language_preferences: userLanguagePreferences })
            .eq("bot_token", botToken);
        }
      }

      // 如果菜单没有处理，检查自动回复 - 自动回复消息也附带最新键盘
      if (!keyboardHandled && autoReplyRules.length > 0) {
        keyboardHandled = await handleAutoReply(
          botToken,
          chatId,
          text,
          autoReplyRules,
          menuPages,
          userLanguage,
          bilingualEnabled,
        );
      }

      // 非双向聊天模式下：无论消息是否被处理，都确保用户收到最新的底部键盘
      // 如果消息已被处理（自动回复/菜单按钮），handleAutoReply 已经附带了键盘
      // 如果消息未被处理，这里补发最新键盘
      if (!keyboardHandled && !bidirectionalChatEnabled && menuPages.length > 0) {
        const mainPage = menuPages.find((p: MenuPage) => p.id === "main");
        if (mainPage && mainPage.rows.length > 0) {
          const keyboard = await generateKeyboardWithLanguage(mainPage, userLanguage, bilingualEnabled);
          if (keyboard) {
            const menuPromptText =
              userLanguage === "en" ? "📂 Please use the menu to select a function" : "📂 请使用菜单选择功能";
            await sendTelegramMessage(botToken, "sendMessage", {
              chat_id: chatId,
              text: menuPromptText,
              reply_markup: {
                keyboard,
                resize_keyboard: true,
                one_time_keyboard: false,
              },
            });
            console.log("Keyboard refreshed for unhandled message (menu-only mode)");
          }
        }
      }
    }

    // 确定活动记录接收者：优先双向聊天的personalUserId，否则使用菜单键盘的menuAdminChatId
    const activityRecipient = bidirectionalChatEnabled && personalUserId > 0 ? personalUserId : menuAdminChatId;

    // 转发消息给管理员（支持无双向聊天绑定的菜单键盘机器人）
    if (activityRecipient > 0 && chatId !== activityRecipient) {
      if (bidirectionalChatEnabled && personalUserId > 0) {
        // ===== 双向聊天模式：转发完整消息带发起私聊按钮 =====
        // 根据 activityLogEnabled 设置决定是否转发已自动处理的消息
        const shouldForward = activityLogEnabled || !keyboardHandled;

        if (shouldForward) {
          // 构建发起私聊按钮 - 点击可直接跳转到用户私聊
          const privateChatButton = {
            inline_keyboard: [[{ text: `💬 发起私聊 (${fromUser.first_name})`, url: `tg://user?id=${chatId}` }]],
          };

          // 转发消息到管理员（带发起私聊按钮）
          if (photoFileId) {
            const forwardCaption = `📨 新消息\n来自: ${userName}\n[CHATID:${chatId}:MSGID:${messageId}]\n${keyboardHandled ? "✅ 已自动处理" : ""}\n\n${message.caption || ""}`;
            await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: personalUserId,
                photo: photoFileId,
                caption: forwardCaption,
                reply_markup: privateChatButton,
              }),
            });
          } else {
            const forwardText = `📨 新消息\n来自: ${userName}\n[CHATID:${chatId}:MSGID:${messageId}]\n${keyboardHandled ? "✅ 已自动处理" : ""}\n\n${text}`;
            await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: personalUserId,
                text: forwardText,
                reply_markup: privateChatButton,
              }),
            });
          }
          console.log(`Bidirectional chat: Message forwarded to personalUserId: ${personalUserId}`);
        } else {
          console.log("Activity log disabled - auto-processed message not forwarded");
        }
      } else if (menuAdminChatId > 0 && activityLogEnabled) {
        // ===== 菜单键盘模式（无双向聊天）：只发送简洁的活动记录，不带发起私聊按钮 =====
        // 仅在 activityLogEnabled 开启时发送活动记录

        // 确定操作类型
        let operationType = "发送消息";
        if (text === "/start") {
          operationType = "点击 /start 启动机器人";
        } else if (text.startsWith("/")) {
          operationType = `发送指令: ${text}`;
        } else if (keyboardHandled) {
          operationType = `点击菜单按钮: ${text}`;
        } else {
          operationType = `发送文字: ${text.substring(0, 50)}${text.length > 50 ? "..." : ""}`;
        }

        // 如果是图片
        if (photoFileId) {
          operationType = `发送图片${message.caption ? ` (附言: ${message.caption.substring(0, 30)}...)` : ""}`;
        }

        const activityText = `📋 用户操作记录\n来自: ${userName}\n用户ID: ${chatId}\n操作: ${operationType}`;

        await sendTelegramMessage(botToken, "sendMessage", {
          chat_id: menuAdminChatId,
          text: activityText,
        });

        console.log(`Menu bot: Activity record sent to menuAdminChatId: ${menuAdminChatId}`);
      } else {
        console.log("Activity log disabled or no recipient configured");
      }
    } else {
      console.log("No activity recipient configured or message from admin - skipping forward");
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Webhook error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
