import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ========== TG商城类型定义 ==========
interface ShopProduct {
  id: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  stock_content: string[] | null;
  is_active: boolean;
  keywords: string[] | null;
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
}

// 生成随机小数防撞单 (0.010-0.099，三位小数)
function generateRandomDecimal(price: number, enabled: boolean): number {
  if (!enabled) return price;
  // 生成 10-99 的随机数，代表 0.010-0.099
  const randomMills = Math.floor(Math.random() * 90) + 10; // 10-99
  return Math.round((price + randomMills / 1000) * 1000) / 1000;
}

// 从币安获取TRX/USDT实时汇率
async function getTrxUsdtRate(): Promise<number> {
  try {
    const response = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=TRXUSDT');
    if (!response.ok) {
      console.error('[TG Shop] Failed to fetch TRX rate from Binance:', response.status);
      return 0;
    }
    const data = await response.json();
    const rate = parseFloat(data.price);
    console.log(`[TG Shop] TRX/USDT rate from Binance: ${rate}`);
    return rate;
  } catch (error) {
    console.error('[TG Shop] Error fetching TRX rate:', error);
    return 0;
  }
}

// 从币安获取CNY/USDT汇率 (使用USDT/CNY交易对)
async function getCnyUsdtRate(): Promise<number> {
  try {
    // 币安P2P参考价格，使用FDUSD/USDT作为参考 (或使用固定汇率作为备选)
    // 由于币安没有直接的CNY交易对，我们使用一个相对稳定的汇率API
    const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
    if (!response.ok) {
      console.error('[TG Shop] Failed to fetch CNY rate:', response.status);
      // 使用备用固定汇率
      return 7.25;
    }
    const data = await response.json();
    const cnyRate = data.rates?.CNY || 7.25;
    console.log(`[TG Shop] USD/CNY rate: ${cnyRate}`);
    return cnyRate;
  } catch (error) {
    console.error('[TG Shop] Error fetching CNY rate:', error);
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
  const usdtAmount = Math.round((trxAmount * rate) * 1000) / 1000;
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
  const cnyAmount = Math.round((usdtAmount * rate) * 100) / 100;
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
  text: string
): Promise<{ handled: boolean; message?: string; inlineKeyboard?: any; orderId?: string }> {
  // 解析命令: /buy <商品名或关键词>
  const match = text.match(/^\/buy\s+(.+)$/i);
  if (!match) {
    return { 
      handled: true, 
      message: '❌ 使用方法: /buy <商品名>\n\n例如: /buy VIP会员\n\n发送 /shop 查看所有商品' 
    };
  }

  const keyword = match[1].trim().toLowerCase();

  // 获取商店配置
  const { data: shopConfig } = await supabase
    .from('shop_configs')
    .select('*')
    .eq('bot_token', botToken)
    .maybeSingle();

  if (!shopConfig) {
    return { handled: true, message: '❌ 该机器人未配置商城功能' };
  }

  // 搜索商品 (按名称或关键词)
  const { data: products } = await supabase
    .from('shop_products')
    .select('*')
    .eq('bot_token', botToken)
    .eq('is_active', true);

  if (!products || products.length === 0) {
    return { handled: true, message: '❌ 暂无可购买的商品' };
  }

  // 模糊匹配商品
  const product = products.find((p: ShopProduct) => {
    const nameMatch = p.name.toLowerCase().includes(keyword);
    const keywordMatch = p.keywords?.some((k: string) => k.toLowerCase().includes(keyword));
    return nameMatch || keywordMatch;
  });

  if (!product) {
    const productList = products.map((p: ShopProduct) => `• ${p.name} - ${p.price} ${p.currency}`).join('\n');
    return { 
      handled: true, 
      message: `❌ 未找到匹配商品: "${keyword}"\n\n📦 可用商品:\n${productList}\n\n使用 /buy <商品名> 购买` 
    };
  }

  // 检查库存
  if (!product.stock_content || product.stock_content.length === 0) {
    return { handled: true, message: `❌ 商品 "${product.name}" 暂无库存，请稍后再试` };
  }

  // 生成订单
  const orderNo = generateOrderNo();
  const basePrice = product.price;
  
  // 计算过期时间 (30分钟后)
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

  // 创建订单 (payment_method 为 pending，等用户选择)
  const { data: newOrder, error: orderError } = await supabase
    .from('shop_orders')
    .insert({
      bot_token: botToken,
      order_no: orderNo,
      product_id: product.id,
      product_name: product.name,
      amount: basePrice,  // 保存原始价格，选择支付方式后会更新
      currency: product.currency,
      payment_method: 'pending',
      telegram_user_id: chatId,
      telegram_username: username,
      telegram_chat_id: chatId,
      expires_at: expiresAt,
      status: 'pending'
    })
    .select()
    .single();

  if (orderError) {
    console.error('[TG Shop] Order creation failed:', orderError);
    return { handled: true, message: '❌ 订单创建失败，请稍后再试' };
  }

  // 计算各货币等值金额用于显示
  let usdtAmount = 0;
  let trxAmount = 0;
  let cnyAmount = 0;
  
  if (product.currency === 'CNY') {
    cnyAmount = basePrice;
    const cnyConversion = await convertCnyToUsdt(basePrice);
    usdtAmount = cnyConversion.usdtAmount;
    const trxConversion = await convertUsdtToTrx(usdtAmount);
    trxAmount = trxConversion.trxAmount;
  } else if (product.currency === 'TRX') {
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
  if (shopConfig.accept_usdt) {
    paymentButtons.push([{ text: `💎 USDT(TRC20) ≈${usdtAmount} USDT`, callback_data: `pay_usdt_${orderNo}` }]);
  }
  if (shopConfig.accept_trx) {
    paymentButtons.push([{ text: `💎 TRX ≈${trxAmount} TRX`, callback_data: `pay_trx_${orderNo}` }]);
  }
  // 法币支付选项
  if (shopConfig.enable_alipay) {
    paymentButtons.push([{ text: `💳 支付宝 ¥${cnyAmount}`, callback_data: `pay_alipay_${orderNo}` }]);
  }
  if (shopConfig.enable_wechat) {
    paymentButtons.push([{ text: `💚 微信支付 ¥${cnyAmount}`, callback_data: `pay_wechat_${orderNo}` }]);
  }
  
  // 取消按钮
  paymentButtons.push([{ text: '❌ 取消订单', callback_data: `pay_cancel_${orderNo}` }]);

  // 构建订单信息显示
  let amountDisplay = `${basePrice} ${product.currency}`;
  if (product.currency === 'CNY' && usdtAmount > 0) {
    amountDisplay += ` (≈${usdtAmount} USDT ≈${trxAmount} TRX)`;
  } else if (product.currency === 'TRX' && usdtAmount > 0) {
    amountDisplay += ` (≈${usdtAmount} USDT ≈¥${cnyAmount})`;
  } else if (product.currency === 'USDT' && cnyAmount > 0) {
    amountDisplay += ` (≈¥${cnyAmount} ≈${trxAmount} TRX)`;
  }

  const message = `🛒 *订单已创建*

📦 商品: ${product.name}
💰 金额: ${amountDisplay}
📝 订单号: \`${orderNo}\`
📊 库存: ${product.stock_content.length} 件

────────────────
💳 *请选择支付方式:*

⏰ 订单有效期: 30分钟
⚠️ 超时订单将自动取消`;

  return { 
    handled: true, 
    message, 
    inlineKeyboard: { inline_keyboard: paymentButtons },
    orderId: newOrder.id 
  };
}

// 处理支付方式选择回调 - 显示支付详情
async function handlePaymentMethodCallback(
  supabase: any,
  botToken: string,
  chatId: number,
  callbackData: string,
  messageId: number
): Promise<{ handled: boolean; message?: string; cryptoQrUrl?: string; orderId?: string }> {
  // 解析回调: pay_<method>_<orderNo>
  const match = callbackData.match(/^pay_(usdt|trx|alipay|wechat|cancel)_(.+)$/i);
  if (!match) {
    return { handled: false };
  }

  const paymentMethod = match[1].toLowerCase();
  const orderNo = match[2];

  // 获取订单
  const { data: order, error: orderError } = await supabase
    .from('shop_orders')
    .select('*, shop_products(*)')
    .eq('order_no', orderNo)
    .maybeSingle();

  if (orderError || !order) {
    return { handled: true, message: '❌ 订单不存在或已过期' };
  }

  if (order.status !== 'pending') {
    return { handled: true, message: '❌ 订单已完成或已取消' };
  }

  // 处理取消订单
  if (paymentMethod === 'cancel') {
    await supabase
      .from('shop_orders')
      .update({ status: 'cancelled', payment_method: 'cancelled' })
      .eq('order_no', orderNo);
    
    // 删除原消息
    await sendTelegramMessage(botToken, 'deleteMessage', {
      chat_id: chatId,
      message_id: messageId
    });
    
    return { handled: true, message: `✅ 订单 \`${orderNo}\` 已取消` };
  }

  // 获取商店配置
  const { data: shopConfig } = await supabase
    .from('shop_configs')
    .select('*')
    .eq('bot_token', botToken)
    .maybeSingle();

  if (!shopConfig) {
    return { handled: true, message: '❌ 商店配置错误' };
  }

  // 根据选择的支付方式计算最终金额
  let finalAmount = order.amount;
  let displayCurrency = order.currency;
  let cryptoQrUrl = '';
  
  // 对于虚拟货币支付，需要转换金额并添加随机小数
  if (paymentMethod === 'usdt' || paymentMethod === 'trx') {
    // 先转换为对应货币金额
    if (paymentMethod === 'usdt') {
      if (order.currency === 'CNY') {
        const conversion = await convertCnyToUsdt(order.amount);
        finalAmount = conversion.usdtAmount;
      } else if (order.currency === 'TRX') {
        const conversion = await convertTrxToUsdt(order.amount);
        finalAmount = conversion.usdtAmount;
      }
      // 如果是USDT定价，finalAmount = order.amount
      displayCurrency = 'USDT';
    } else {
      // TRX
      if (order.currency === 'CNY') {
        const cnyConversion = await convertCnyToUsdt(order.amount);
        const trxConversion = await convertUsdtToTrx(cnyConversion.usdtAmount);
        finalAmount = trxConversion.trxAmount;
      } else if (order.currency === 'USDT') {
        const conversion = await convertUsdtToTrx(order.amount);
        finalAmount = conversion.trxAmount;
      }
      // 如果是TRX定价，finalAmount = order.amount
      displayCurrency = 'TRX';
    }
    
    // 添加随机小数防撞单
    finalAmount = generateRandomDecimal(finalAmount, shopConfig.random_decimals);
    
    // 生成二维码
    if (shopConfig.wallet_address) {
      cryptoQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(shopConfig.wallet_address)}`;
    }
  } else {
    // 法币支付 - 转换为CNY
    if (order.currency === 'USDT') {
      const conversion = await convertUsdtToCny(order.amount);
      finalAmount = conversion.cnyAmount;
    } else if (order.currency === 'TRX') {
      const trxConversion = await convertTrxToUsdt(order.amount);
      const cnyConversion = await convertUsdtToCny(trxConversion.usdtAmount);
      finalAmount = cnyConversion.cnyAmount;
    }
    displayCurrency = 'CNY';
  }

  // 更新订单的支付方式和最终金额
  await supabase
    .from('shop_orders')
    .update({ 
      payment_method: paymentMethod,
      amount: finalAmount,
      currency: displayCurrency
    })
    .eq('order_no', orderNo);

  // 计算过期时间显示
  const expireTime = new Date(order.expires_at);
  const chinaTime = new Date(expireTime.getTime() + 8 * 60 * 60 * 1000);
  const expireTimeStr = `${chinaTime.getUTCHours().toString().padStart(2, '0')}:${chinaTime.getUTCMinutes().toString().padStart(2, '0')}`;

  // 构建支付详情消息
  let paymentInfo = '';
  if (paymentMethod === 'usdt' || paymentMethod === 'trx') {
    const currencyLabel = paymentMethod.toUpperCase();
    paymentInfo = `💎 支付方式: ${currencyLabel}

💰 需支付: ${finalAmount} ${currencyLabel}

📍 收款地址 (点击复制):
\`${shopConfig.wallet_address}\``;
  } else {
    paymentInfo = `💳 支付方式: ${paymentMethod === 'alipay' ? '支付宝' : '微信支付'}

💰 需支付: ¥${finalAmount}

请发送 /pay_${paymentMethod}_${orderNo} 获取付款码`;
  }

  const message = `🛒 *订单支付详情*

📦 商品: ${order.product_name}
📝 订单号: \`${orderNo}\`

────────────────
${paymentInfo}
────────────────

⏰ 支付截止: ${expireTimeStr} (30分钟)
⚠️ 超时订单将自动取消并删除
⚠️付款转账精确到小数点后面数值
⚠️虚拟货币转账不包含扣除的手续费
下面举个例子👇币安（转账最低30TRX）
例：金额10.12TRX+手续费1TRX=11.12TRX
tokenpocket（简称TP）
直接付金额10.12TRX（手续费扣余额）
可以币安充TRX转到你的TP钱包进行付款
付错额度不会发货联系人工客服处理
✅ 支付成功后将自动发货到此对话`;

  return { handled: true, message, cryptoQrUrl, orderId: order.id };
}

// 处理 /shop 命令 - 显示商品列表
async function handleShopCommand(
  supabase: any,
  botToken: string
): Promise<{ handled: boolean; message?: string }> {
  // 获取商店配置
  const { data: shopConfig } = await supabase
    .from('shop_configs')
    .select('*')
    .eq('bot_token', botToken)
    .maybeSingle();

  if (!shopConfig) {
    return { handled: true, message: '❌ 该机器人未配置商城功能' };
  }

  // 获取所有上架商品
  const { data: products } = await supabase
    .from('shop_products')
    .select('*')
    .eq('bot_token', botToken)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (!products || products.length === 0) {
    return { handled: true, message: '📦 暂无可购买的商品' };
  }

  const productLines = products.map((p: ShopProduct, idx: number) => {
    const stock = p.stock_content?.length || 0;
    const stockText = stock > 0 ? `(库存: ${stock})` : '(缺货)';
    return `${idx + 1}. **${p.name}** - ${p.price} ${p.currency} ${stockText}\n   ${p.description || ''}`;
  });

  const message = `🏪 **商城商品列表**

${productLines.join('\n\n')}

────────────────
💡 购买方法: /buy <商品名>
例如: /buy ${products[0].name}`;

  return { handled: true, message };
}

// 处理 /order 命令 - 查询订单
async function handleOrderCommand(
  supabase: any,
  botToken: string,
  chatId: number,
  text: string
): Promise<{ handled: boolean; message?: string }> {
  // 解析命令
  const match = text.match(/^\/order\s*(.*)$/i);
  const orderNo = match?.[1]?.trim();

  if (orderNo) {
    // 查询特定订单
    const { data: order } = await supabase
      .from('shop_orders')
      .select('*')
      .eq('bot_token', botToken)
      .eq('order_no', orderNo)
      .maybeSingle();

    if (!order) {
      return { handled: true, message: `❌ 未找到订单: ${orderNo}` };
    }

    const statusText = order.status === 'paid' ? '✅ 已支付' : '⏳ 待支付';
    let message = `📋 **订单详情**

订单号: \`${order.order_no}\`
商品: ${order.product_name}
金额: ${order.amount} ${order.currency}
状态: ${statusText}
创建时间: ${new Date(order.created_at).toLocaleString('zh-CN')}`;

    if (order.status === 'paid' && order.delivery_content) {
      message += `\n\n📦 **卡密:**\n\`${order.delivery_content}\``;
    }

    return { handled: true, message };
  }

  // 查询用户所有订单
  const { data: orders } = await supabase
    .from('shop_orders')
    .select('*')
    .eq('bot_token', botToken)
    .eq('telegram_user_id', chatId)
    .order('created_at', { ascending: false })
    .limit(10);

  if (!orders || orders.length === 0) {
    return { handled: true, message: '📋 您暂无订单记录' };
  }

  const orderLines = orders.map((o: any) => {
    const status = o.status === 'paid' ? '✅' : '⏳';
    return `${status} \`/order ${o.order_no}\` - ${o.product_name} - ${o.amount} ${o.currency}`;
  });

  const message = `📋 **您的订单** (最近10条)

${orderLines.join('\n')}

────────────────
💡 点击上面订单号可复制粘贴发送查询`;

  return { handled: true, message };
}

// 类型定义
interface InlineButton {
  text: string;
  type: 'url' | 'callback_data' | 'web_app';
  value: string;
}

interface ReplyButton {
  text: string;
  textEn?: string;
  actionType: 'text' | 'navigate';
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
  type: 'text' | 'photo' | 'video';  // 添加视频类型支持
  content: string;
  mediaUrl?: string;
  inlineKeyboard?: InlineButton[][];
  disableWebPagePreview?: boolean;
}

interface AutoReplyRule {
  id: string;
  triggerType: 'keyword' | 'command';
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
}

// 发送Telegram消息的辅助函数
async function sendTelegramMessage(botToken: string, method: string, body: any) {
  const url = `https://api.telegram.org/bot${botToken}/${method}`;
  console.log(`Calling Telegram API: ${method}`, JSON.stringify(body, null, 2));
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  
  const result = await response.json();
  console.log(`Telegram API response:`, JSON.stringify(result, null, 2));
  return result;
}

// 获取用户的语言偏好
function getUserLanguage(chatId: number, userLanguagePreferences: Record<string, string> | null): 'zh' | 'en' {
  if (!userLanguagePreferences) return 'zh';
  return (userLanguagePreferences[chatId.toString()] as 'zh' | 'en') || 'zh';
}

// 根据语言偏好生成键盘
function generateKeyboardWithLanguage(
  menuPage: MenuPage | undefined,
  language: 'zh' | 'en',
  bilingualEnabled: boolean
): { text: string }[][] | null {
  if (!menuPage || menuPage.rows.length === 0) return null;
  
  const keyboard = menuPage.rows.map(row => 
    row.map(btn => ({
      text: language === 'en' && btn.textEn ? btn.textEn : btn.text
    }))
  );
  
  // 如果开启双语按钮，添加语言切换按钮到最后一行
  if (bilingualEnabled) {
    const langButton = language === 'zh' 
      ? { text: '🌐 English' }
      : { text: '🌐 中文' };
    keyboard.push([langButton]);
  }
  
  return keyboard;
}

// 处理菜单导航
async function handleMenuNavigation(
  botToken: string, 
  chatId: number, 
  text: string, 
  menuPages: MenuPage[],
  language: 'zh' | 'en' = 'zh',
  bilingualEnabled: boolean = false
): Promise<boolean> {
  const textNorm = text.trim().toLowerCase();
  
  for (const page of menuPages) {
    for (const row of page.rows) {
      for (const btn of row) {
        // 检查中文或英文文本匹配
        const zhMatch = btn.text.toLowerCase() === textNorm;
        const enMatch = btn.textEn && btn.textEn.toLowerCase() === textNorm;
        
        if ((zhMatch || enMatch) && btn.actionType === 'navigate' && btn.actionValue) {
          const targetPage = menuPages.find(p => p.id === btn.actionValue);
          if (targetPage) {
            const keyboard = generateKeyboardWithLanguage(targetPage, language, bilingualEnabled);
            await sendTelegramMessage(botToken, 'sendMessage', {
              chat_id: chatId,
              text: language === 'en' ? `📂 Switch to: ${targetPage.name}` : `📂 切换菜单: ${targetPage.name}`,
              reply_markup: keyboard ? {
                keyboard,
                resize_keyboard: true,
                one_time_keyboard: false
              } : undefined
            });
            console.log(`Menu navigation: ${page.name} -> ${targetPage.name}`);
            return true;
          }
        }
      }
    }
  }
  return false;
}

// 处理自动回复 - 同时附带最新的底部键盘
async function handleAutoReply(
  botToken: string,
  chatId: number,
  text: string,
  autoReplyRules: AutoReplyRule[],
  menuPages?: MenuPage[],
  language: 'zh' | 'en' = 'zh',
  bilingualEnabled: boolean = false
): Promise<boolean> {
  const textNorm = text.trim().toLowerCase();
  const cleanText = textNorm.replace(/^\//, '');
  const firstToken = cleanText.split(/\s+/)[0];

  const matchedRule = autoReplyRules.find((r) => {
    const ruleVal = (r.triggerValue || '').trim().toLowerCase();
    if (!ruleVal) return false;

    const cleanRule = ruleVal.replace(/^\//, '');

    if (r.triggerType === 'command') {
      // 支持: “/cmd”、 “cmd”、 “/cmd 参数...”、 “cmd 参数...”
      return firstToken === cleanRule;
    }

    // keyword: 支持包含匹配（用户输入可能带参数/前后文）
    return cleanText.includes(cleanRule);
  });
  
  if (matchedRule) {
    console.log(`Auto-reply matched: ${matchedRule.triggerValue}`);
    
    // 获取主菜单的底部键盘，用于附带到自动回复消息中
    const mainPage = menuPages?.find((p: MenuPage) => p.id === 'main');
    const keyboard = generateKeyboardWithLanguage(mainPage, language, bilingualEnabled);
    const replyKeyboard = keyboard ? {
      keyboard,
      resize_keyboard: true,
      one_time_keyboard: false
    } : null;
    
    for (const reply of matchedRule.replyMessages) {
      const body: any = { chat_id: chatId, parse_mode: 'HTML' };
      
      if (reply.disableWebPagePreview) {
        body.disable_web_page_preview = true;
      }
      
      // 处理内联键盘 - 内联键盘和底部键盘不能同时在一个消息中发送
      // 如果有内联键盘，优先发送内联键盘
      if (reply.inlineKeyboard && reply.inlineKeyboard.length > 0) {
        body.reply_markup = {
          inline_keyboard: reply.inlineKeyboard.map(row =>
            row.map(btn => {
              if (btn.type === 'url') {
                return { text: btn.text, url: btn.value };
              } else if (btn.type === 'callback_data') {
                return { text: btn.text, callback_data: btn.value };
              } else if (btn.type === 'web_app') {
                return { text: btn.text, web_app: { url: btn.value } };
              }
              return { text: btn.text, callback_data: btn.value };
            })
          )
        };
      } else if (replyKeyboard) {
        // 如果没有内联键盘，附带最新的底部键盘（实现菜单自动刷新）
        body.reply_markup = replyKeyboard;
      }
      
      // 标记需要额外发送底部键盘刷新（当有内联键盘时）
      const needExtraKeyboardRefresh = reply.inlineKeyboard && reply.inlineKeyboard.length > 0 && replyKeyboard;
      
      try {
        if (reply.type === 'photo' && reply.mediaUrl) {
          body.photo = reply.mediaUrl;
          body.caption = reply.content;
          await sendTelegramMessage(botToken, 'sendPhoto', body);
        } else if (reply.type === 'video' && reply.mediaUrl) {
          // 视频消息支持
          body.video = reply.mediaUrl;
          body.caption = reply.content;
          await sendTelegramMessage(botToken, 'sendVideo', body);
        } else {
          body.text = reply.content;
          await sendTelegramMessage(botToken, 'sendMessage', body);
        }
        
        // 如果发送的消息带有内联键盘，由于内联键盘和底部键盘不能同时发送
        // 底部键盘将在最后一条消息后自动刷新（通过最后一条消息携带底部键盘）
        // 不再发送额外的刷新提示消息，避免消息过多
      } catch (e) {
        console.error("Auto-reply send failed:", e);
      }
    }
    return true;
  }
  return false;
}

// 处理callback_query（内联按钮点击）
async function handleCallbackQuery(
  botToken: string,
  callbackQuery: any,
  autoReplyRules: AutoReplyRule[]
): Promise<boolean> {
  const callbackData = callbackQuery.data;
  const chatId = callbackQuery.message?.chat?.id;
  const messageId = callbackQuery.message?.message_id;
  
  if (!callbackData || !chatId) return false;
  
  console.log(`Callback query received: ${callbackData}`);
  
  // 先回应callback_query，避免loading状态
  await sendTelegramMessage(botToken, 'answerCallbackQuery', {
    callback_query_id: callbackQuery.id
  });
  
  // 查找匹配的自动回复规则
  const matchedRule = autoReplyRules.find(r => {
    const ruleVal = r.triggerValue.toLowerCase();
    return callbackData.toLowerCase() === ruleVal;
  });
  
  if (matchedRule) {
    console.log(`Callback matched rule: ${matchedRule.triggerValue}`);
    
    for (const reply of matchedRule.replyMessages) {
      const body: any = { chat_id: chatId, parse_mode: 'HTML' };
      
      if (reply.disableWebPagePreview) {
        body.disable_web_page_preview = true;
      }
      
      if (reply.inlineKeyboard && reply.inlineKeyboard.length > 0) {
        body.reply_markup = {
          inline_keyboard: reply.inlineKeyboard.map(row =>
            row.map(btn => {
              if (btn.type === 'url') {
                return { text: btn.text, url: btn.value };
              } else if (btn.type === 'callback_data') {
                return { text: btn.text, callback_data: btn.value };
              } else if (btn.type === 'web_app') {
                return { text: btn.text, web_app: { url: btn.value } };
              }
              return { text: btn.text, callback_data: btn.value };
            })
          )
        };
      }
      
      try {
        if (reply.type === 'photo' && reply.mediaUrl) {
          body.photo = reply.mediaUrl;
          body.caption = reply.content;
          await sendTelegramMessage(botToken, 'sendPhoto', body);
        } else if (reply.type === 'video' && reply.mediaUrl) {
          // 视频消息支持
          body.video = reply.mediaUrl;
          body.caption = reply.content;
          await sendTelegramMessage(botToken, 'sendVideo', body);
        } else {
          body.text = reply.content;
          await sendTelegramMessage(botToken, 'sendMessage', body);
        }
      } catch (e) {
        console.error("Callback reply failed:", e);
      }
    }
    return true;
  }
  
  return false;
}

// 发送主菜单
async function sendMainMenu(
  botToken: string,
  chatId: number,
  menuPages: MenuPage[],
  greetingMessage?: string,
  language: 'zh' | 'en' = 'zh',
  bilingualEnabled: boolean = false
) {
  const mainPage = menuPages.find(p => p.id === 'main');
  if (mainPage && mainPage.rows.length > 0) {
    const keyboard = generateKeyboardWithLanguage(mainPage, language, bilingualEnabled);
    await sendTelegramMessage(botToken, 'sendMessage', {
      chat_id: chatId,
      text: greetingMessage || (language === 'en' ? '📂 Welcome! Please select from the menu' : '📂 欢迎使用，请选择菜单'),
      reply_markup: keyboard ? {
        keyboard,
        resize_keyboard: true,
        one_time_keyboard: false
      } : undefined
    });
    console.log('Main menu sent to user');
    return true;
  }
  return false;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    console.log('Received webhook:', JSON.stringify(body, null, 2));

    // Extract bot token from URL path
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const botToken = pathParts[pathParts.length - 1];

    if (!botToken || botToken === 'telegram-webhook') {
      console.log('No bot token in path');
      return new Response(JSON.stringify({ error: 'Missing bot token' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Find the bot activation by token (可能为空，菜单键盘可独立运行)
    const { data: activation } = await supabase
      .from('bot_activations')
      .select('*')
      .eq('bot_token', botToken)
      .maybeSingle();

    // 检查双向聊天的授权状态（如果有绑定）
    let bidirectionalChatEnabled = false;
    let personalUserId = 0;
    
    if (activation) {
      // 首先检查管理员是否手动关闭了双向聊天功能
      if (activation.is_active === false) {
        console.log('Bidirectional chat disabled by admin toggle');
        // 不返回错误，继续处理菜单键盘功能
      } else if (activation.expire_at && new Date(activation.expire_at) < new Date()) {
        // Check if bot is expired
        console.log('Bot activation expired - disabling bidirectional chat');
        await supabase
          .from('bot_activations')
          .update({ is_active: false })
          .eq('id', activation.id);
        // 不返回错误，继续处理菜单键盘功能
      } else if (activation.is_authorized || (activation.trial_messages_used < activation.trial_limit)) {
        // 双向聊天功能可用
        bidirectionalChatEnabled = activation.app_enabled !== false;
        personalUserId = parseInt(activation.personal_user_id);
      } else {
        console.log('Trial limit reached - bidirectional chat disabled');
      }
    }

    // 获取菜单键盘配置
    const { data: keyboardConfig } = await supabase
      .from('keyboard_configs')
      .select('*')
      .eq('bot_token', botToken)
      .maybeSingle();

    // 检查菜单键盘是否过期或试用已结束
    let keyboardMenuEnabled = true;
    if (keyboardConfig) {
      const now = new Date();
      const keyboardExpireAt = keyboardConfig.keyboard_expire_at ? new Date(keyboardConfig.keyboard_expire_at) : null;
      const keyboardTrialStartedAt = keyboardConfig.keyboard_trial_started_at ? new Date(keyboardConfig.keyboard_trial_started_at) : null;
      
      // 如果已激活授权，检查是否过期
      if (keyboardExpireAt) {
        if (keyboardExpireAt < now) {
          console.log('Keyboard menu expired - disabling keyboard features');
          keyboardMenuEnabled = false;
        }
      } else if (keyboardTrialStartedAt) {
        // 试用模式：24小时后过期
        const trialEndTime = new Date(keyboardTrialStartedAt.getTime() + 24 * 60 * 60 * 1000);
        if (now > trialEndTime) {
          console.log('Keyboard menu trial expired (24h) - disabling keyboard features');
          keyboardMenuEnabled = false;
        }
      }
    }

    const menuPages: MenuPage[] = keyboardMenuEnabled ? (keyboardConfig?.reply_keyboard || []) : [];
    const autoReplyRules: AutoReplyRule[] = keyboardMenuEnabled ? (keyboardConfig?.auto_reply_rules || []) : [];
    const forceMenuOnStart: boolean = keyboardMenuEnabled ? (keyboardConfig?.force_menu_on_start || false) : false;
    const activityLogEnabled: boolean = keyboardConfig?.activity_log_enabled !== false; // 默认为true
    const bilingualEnabled: boolean = keyboardMenuEnabled ? (keyboardConfig?.bilingual_button_enabled || false) : false;
    let userLanguagePreferences: Record<string, string> = keyboardConfig?.user_language_preferences || {};
    const menuAdminChatId: number = keyboardConfig?.menu_admin_chat_id ? Number(keyboardConfig.menu_admin_chat_id) : 0;

    console.log(`Keyboard config loaded: ${menuPages.length} pages, ${autoReplyRules.length} rules, activityLog: ${activityLogEnabled}, bilingual: ${bilingualEnabled}, bidirectionalChat: ${bidirectionalChatEnabled}, menuAdminChatId: ${menuAdminChatId}, keyboardMenuEnabled: ${keyboardMenuEnabled}`);

    // 处理 callback_query（内联按钮点击）
    if (body.callback_query) {
      const callbackData = body.callback_query.data || '';
      const cbChatId = body.callback_query.message?.chat?.id;
      const cbMessageId = body.callback_query.message?.message_id;
      
      // 先回应callback_query，避免loading状态
      await sendTelegramMessage(botToken, 'answerCallbackQuery', {
        callback_query_id: body.callback_query.id
      });
      
      // 优先检查是否是支付方式选择回调
      if (callbackData.startsWith('pay_')) {
        console.log(`[TG Shop] Payment method callback: ${callbackData}`);
        
        const paymentResult = await handlePaymentMethodCallback(
          supabase,
          botToken,
          cbChatId,
          callbackData,
          cbMessageId
        );
        
        if (paymentResult.handled) {
          // 删除原来的支付方式选择消息
          await sendTelegramMessage(botToken, 'deleteMessage', {
            chat_id: cbChatId,
            message_id: cbMessageId
          });
          
          if (paymentResult.message) {
            let qrMessageId: number | null = null;
            
            // 如果有加密货币二维码，先发送二维码图片
            if (paymentResult.cryptoQrUrl) {
              const qrResult = await sendTelegramMessage(botToken, 'sendPhoto', {
                chat_id: cbChatId,
                photo: paymentResult.cryptoQrUrl,
                caption: '📍 扫码获取收款地址'
              });
              if (qrResult.ok && qrResult.result?.message_id) {
                qrMessageId = qrResult.result.message_id;
              }
            }
            
            // 发送支付详情
            const msgResult = await sendTelegramMessage(botToken, 'sendMessage', {
              chat_id: cbChatId,
              text: paymentResult.message,
              parse_mode: 'Markdown'
            });
            
            // 保存消息ID以便超时后删除
            if (msgResult.ok && msgResult.result?.message_id && paymentResult.orderId) {
              const updateData: any = { telegram_message_id: msgResult.result.message_id };
              if (qrMessageId) {
                updateData.telegram_qr_message_id = qrMessageId;
              }
              await supabase
                .from('shop_orders')
                .update(updateData)
                .eq('id', paymentResult.orderId);
            }
          }
          
          return new Response(JSON.stringify({ ok: true, payment_handled: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }
      
      // 其他回调走原有自动回复逻辑
      const handled = await handleCallbackQuery(botToken, body.callback_query, autoReplyRules);
      console.log(`Callback query handled: ${handled}`);
      
      // 确定活动记录接收者：优先双向聊天的personalUserId，否则使用菜单键盘的menuAdminChatId
      const activityRecipient = bidirectionalChatEnabled && personalUserId > 0 ? personalUserId : menuAdminChatId;
      
      // 如果活动记录开启且有接收者，转发内联按钮点击事件
      if (activityLogEnabled && activityRecipient > 0) {
        const cbFromUser = body.callback_query.from;
        const cbUserName = cbFromUser.first_name + (cbFromUser.last_name ? ' ' + cbFromUser.last_name : '');
        
        if (cbChatId && cbChatId !== activityRecipient) {
          const activityText = `📋 用户操作记录\n来自: ${cbUserName}\n用户ID: ${cbChatId}\n操作: 点击内联按钮\n按钮数据: ${callbackData}`;
          await sendTelegramMessage(botToken, 'sendMessage', {
            chat_id: activityRecipient,
            text: activityText,
          });
        }
      }
      
      return new Response(JSON.stringify({ ok: true, callback_handled: handled }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const message = body.message;
    if (!message) {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const chatId = message.chat.id;
    const fromUser = message.from;
    let text = message.text || message.caption || '';
    const messageId = message.message_id;

    // 处理图片消息
    let photoUrl = '';
    let photoFileId = '';
    if (message.photo && message.photo.length > 0) {
      const largestPhoto = message.photo[message.photo.length - 1];
      photoFileId = largestPhoto.file_id;
      
      const fileResponse = await fetch(
        `https://api.telegram.org/bot${botToken}/getFile?file_id=${photoFileId}`
      );
      const fileData = await fileResponse.json();
      
      if (fileData.ok && fileData.result.file_path) {
        photoUrl = `https://api.telegram.org/file/bot${botToken}/${fileData.result.file_path}`;
        text = `[图片] ${photoUrl}` + (text ? `\n${text}` : '');
      }
      console.log('Photo received:', { photoFileId, photoUrl });
    }

    // Check if this is a reply from personal user to forward (仅当双向聊天可用时)
    if (bidirectionalChatEnabled && activation && chatId === personalUserId && message.reply_to_message) {
      if (activation.app_enabled === false) {
        console.log('App port disabled - reply blocked');
        return new Response(JSON.stringify({ ok: true, blocked: 'app_port_disabled' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const replyText = message.reply_to_message.text || message.reply_to_message.caption || '';
      const chatIdMatch = replyText.match(/\[CHATID:(\d+):MSGID:(\d+)\]/);
      
      if (chatIdMatch) {
        const targetChatId = parseInt(chatIdMatch[1]);
        const originalMsgId = parseInt(chatIdMatch[2]);
        
        console.log(`Routing reply to chatId: ${targetChatId}, originalMsgId: ${originalMsgId}`);
        
        let sendResult;
        let messageContent = message.text || message.caption || '';
        
        if (message.photo && message.photo.length > 0) {
          const replyPhotoFileId = message.photo[message.photo.length - 1].file_id;
          const sendResponse = await fetch(
            `https://api.telegram.org/bot${botToken}/sendPhoto`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: targetChatId,
                photo: replyPhotoFileId,
                caption: messageContent,
                reply_to_message_id: originalMsgId,
              }),
            }
          );
          sendResult = await sendResponse.json();
          
          const fileResponse = await fetch(
            `https://api.telegram.org/bot${botToken}/getFile?file_id=${replyPhotoFileId}`
          );
          const fileData = await fileResponse.json();
          if (fileData.ok && fileData.result.file_path) {
            const replyPhotoUrl = `https://api.telegram.org/file/bot${botToken}/${fileData.result.file_path}`;
            messageContent = `[图片] ${replyPhotoUrl}` + (messageContent ? `\n${messageContent}` : '');
          } else {
            messageContent = `[图片]` + (messageContent ? `\n${messageContent}` : '');
          }
        } else {
          const sendResponse = await fetch(
            `https://api.telegram.org/bot${botToken}/sendMessage`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: targetChatId,
                text: messageContent,
                reply_to_message_id: originalMsgId,
              }),
            }
          );
          sendResult = await sendResponse.json();
        }

        console.log('Reply sent result:', JSON.stringify(sendResult, null, 2));

        if (sendResult.ok) {
          await supabase.from('messages').insert({
            bot_activation_id: activation.id,
            telegram_chat_id: targetChatId,
            telegram_message_id: sendResult.result?.message_id,
            telegram_user_name: '我',
            content: messageContent,
            direction: 'outgoing',
          });
        }

        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Skip messages from personal user that are not replies (仅当双向聊天可用时)
    if (bidirectionalChatEnabled && personalUserId > 0 && chatId === personalUserId) {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 存储消息到数据库 (仅当双向聊天可用时)
    const userName = fromUser.first_name + (fromUser.last_name ? ' ' + fromUser.last_name : '');
    
    if (bidirectionalChatEnabled && activation) {
      await supabase.from('messages').insert({
        bot_activation_id: activation.id,
        telegram_chat_id: chatId,
        telegram_user_name: userName,
        telegram_message_id: messageId,
        content: text,
        direction: 'incoming',
        is_read: activation.web_enabled === false ? null : false,
      });
    }

    // 自动抓取用户数据到 bot_users 表 (菜单键盘功能需要)
    try {
      await supabase.from('bot_users').upsert({
        bot_token: botToken,
        telegram_user_id: chatId,
        first_name: fromUser.first_name || '',
        last_name: fromUser.last_name || null,
        username: fromUser.username || null,
        last_seen_at: new Date().toISOString(),
      }, { 
        onConflict: 'bot_token,telegram_user_id',
        ignoreDuplicates: false 
      });
      console.log(`User ${chatId} saved/updated in bot_users`);
    } catch (e) {
      console.error('Failed to save user to bot_users:', e);
    }

    // Update trial messages count if not authorized (仅当有activation时)
    if (activation && !activation.is_authorized) {
      await supabase
        .from('bot_activations')
        .update({ trial_messages_used: activation.trial_messages_used + 1 })
        .eq('id', activation.id);
        
      await supabase
        .from('bot_trial_records')
        .upsert({
          bot_token: botToken,
          messages_used: activation.trial_messages_used + 1,
          is_blocked: activation.trial_messages_used + 1 >= activation.trial_limit,
        }, { onConflict: 'bot_token' });
    }

    // 菜单键盘功能 - 独立运行，不依赖双向聊天
    let keyboardHandled = false;
    
    // 获取用户的语言偏好
    let userLanguage = getUserLanguage(chatId, userLanguagePreferences);
    
    // 检查是否是语言切换按钮点击
    if (bilingualEnabled && (text === '🌐 English' || text === '🌐 中文')) {
      // 切换语言
      const newLanguage: 'zh' | 'en' = text === '🌐 English' ? 'en' : 'zh';
      userLanguagePreferences[chatId.toString()] = newLanguage;
      userLanguage = newLanguage;
      
      // 保存语言偏好到数据库
      await supabase
        .from('keyboard_configs')
        .update({ user_language_preferences: userLanguagePreferences })
        .eq('bot_token', botToken);
      
      // 发送切换确认并更新键盘
      const mainPage = menuPages.find((p: MenuPage) => p.id === 'main');
      const keyboard = generateKeyboardWithLanguage(mainPage, newLanguage, bilingualEnabled);
      
      await sendTelegramMessage(botToken, 'sendMessage', {
        chat_id: chatId,
        text: newLanguage === 'en' ? '🌐 Switched to English' : '🌐 已切换为中文',
        reply_markup: keyboard ? {
          keyboard,
          resize_keyboard: true,
          one_time_keyboard: false
        } : undefined
      });
      
      console.log(`Language switched to ${newLanguage} for user ${chatId}`);
      keyboardHandled = true;
    }
    
    // ========== TG商城命令处理 ==========
    // 处理 /shop 命令
    if (!keyboardHandled && text.toLowerCase() === '/shop') {
      const shopResult = await handleShopCommand(supabase, botToken);
      if (shopResult.handled && shopResult.message) {
        await sendTelegramMessage(botToken, 'sendMessage', {
          chat_id: chatId,
          text: shopResult.message,
          parse_mode: 'Markdown'
        });
        keyboardHandled = true;
        console.log('[TG Shop] /shop command handled');
      }
    }
    
    // 处理 /buy 命令
    if (!keyboardHandled && text.toLowerCase().startsWith('/buy')) {
      const buyResult = await handleBuyCommand(
        supabase, 
        botToken, 
        chatId, 
        fromUser.username || null,
        text
      );
      if (buyResult.handled && buyResult.message) {
        // 发送订单详情，带支付方式选择按钮
        const msgResult = await sendTelegramMessage(botToken, 'sendMessage', {
          chat_id: chatId,
          text: buyResult.message,
          parse_mode: 'Markdown',
          reply_markup: buyResult.inlineKeyboard
        });
        
        // 保存消息ID以便超时后删除
        if (msgResult.ok && msgResult.result?.message_id && buyResult.orderId) {
          await supabase
            .from('shop_orders')
            .update({ telegram_message_id: msgResult.result.message_id })
            .eq('id', buyResult.orderId);
          console.log(`[TG Shop] Saved message_id ${msgResult.result.message_id} for order ${buyResult.orderId}`);
        }
        
        keyboardHandled = true;
        console.log('[TG Shop] /buy command handled');
      }
    }
    
    // 处理 /order 命令
    if (!keyboardHandled && text.toLowerCase().startsWith('/order')) {
      const orderResult = await handleOrderCommand(supabase, botToken, chatId, text);
      if (orderResult.handled && orderResult.message) {
        await sendTelegramMessage(botToken, 'sendMessage', {
          chat_id: chatId,
          text: orderResult.message,
          parse_mode: 'Markdown'
        });
        keyboardHandled = true;
        console.log('[TG Shop] /order command handled');
      }
    }
    
    // 处理 /start 命令
    if (!keyboardHandled && text === '/start') {
      // 欢迎语逻辑：
      // 1. 同时有双向聊天和菜单键盘时 → 使用菜单键盘的/start自动回复
      // 2. 只有双向聊天时 → 使用双向聊天的欢迎语(activation.greeting_message)
      
      const hasBidirectionalChat = bidirectionalChatEnabled && activation;
      const hasKeyboardMenu = keyboardMenuEnabled && menuPages.length > 0;
      
      // 如果同时有双向聊天和菜单键盘，优先使用菜单键盘的/start自动回复
      if (hasBidirectionalChat && hasKeyboardMenu) {
        // 先检查自动回复规则中是否有 /start 命令
        const hasStartAutoReply = autoReplyRules.some(r => {
          const ruleVal = (r.triggerValue || '').trim().toLowerCase().replace(/^\//, '');
          return r.triggerType === 'command' && ruleVal === 'start';
        });
        
        if (hasStartAutoReply) {
          // 使用菜单键盘的/start自动回复
          keyboardHandled = await handleAutoReply(botToken, chatId, text, autoReplyRules, menuPages, userLanguage, bilingualEnabled);
        } else if (forceMenuOnStart) {
          // 没有/start自动回复但配置了强制显示菜单
          await sendMainMenu(botToken, chatId, menuPages, undefined, userLanguage, bilingualEnabled);
          keyboardHandled = true;
        } else {
          // 没有配置/start自动回复，发送默认菜单
          await sendMainMenu(botToken, chatId, menuPages, undefined, userLanguage, bilingualEnabled);
          keyboardHandled = true;
        }
      } else if (hasKeyboardMenu) {
        // 只有菜单键盘，使用菜单键盘的自动回复或默认菜单
        if (forceMenuOnStart) {
          await sendMainMenu(botToken, chatId, menuPages, undefined, userLanguage, bilingualEnabled);
          keyboardHandled = true;
        } else {
          keyboardHandled = await handleAutoReply(botToken, chatId, text, autoReplyRules, menuPages, userLanguage, bilingualEnabled);
          if (!keyboardHandled && menuPages.length > 0) {
            await sendMainMenu(botToken, chatId, menuPages, undefined, userLanguage, bilingualEnabled);
            keyboardHandled = true;
          }
        }
      } else if (hasBidirectionalChat && activation?.greeting_message) {
        // 只有双向聊天，使用双向聊天的欢迎语
        await sendTelegramMessage(botToken, 'sendMessage', {
          chat_id: chatId,
          text: activation.greeting_message,
        });
        keyboardHandled = true;
      }
      
      // 如果以上都没处理，检查自动回复规则
      if (!keyboardHandled) {
        keyboardHandled = await handleAutoReply(botToken, chatId, text, autoReplyRules, menuPages, userLanguage, bilingualEnabled);
      }
    } else if (!keyboardHandled) {
      // 先检查菜单导航
      if (menuPages.length > 0) {
        keyboardHandled = await handleMenuNavigation(botToken, chatId, text, menuPages, userLanguage, bilingualEnabled);
      }

      // 如果菜单没有处理，检查自动回复 - 自动回复消息也附带最新键盘
      if (!keyboardHandled && autoReplyRules.length > 0) {
        keyboardHandled = await handleAutoReply(botToken, chatId, text, autoReplyRules, menuPages, userLanguage, bilingualEnabled);
      }
      
      // 非双向聊天模式下：无论消息是否被处理，都确保用户收到最新的底部键盘
      // 如果消息已被处理（自动回复/菜单按钮），handleAutoReply 已经附带了键盘
      // 如果消息未被处理，这里补发最新键盘
      if (!keyboardHandled && !bidirectionalChatEnabled && menuPages.length > 0) {
        const mainPage = menuPages.find((p: MenuPage) => p.id === 'main');
        if (mainPage && mainPage.rows.length > 0) {
          const keyboard = generateKeyboardWithLanguage(mainPage, userLanguage, bilingualEnabled);
          if (keyboard) {
            await sendTelegramMessage(botToken, 'sendMessage', {
              chat_id: chatId,
              text: '📂 请使用菜单选择功能',
              reply_markup: {
                keyboard,
                resize_keyboard: true,
                one_time_keyboard: false
              }
            });
            console.log('Keyboard refreshed for unhandled message (menu-only mode)');
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
            inline_keyboard: [[
              { text: `💬 发起私聊 (${fromUser.first_name})`, url: `tg://user?id=${chatId}` }
            ]]
          };
          
          // 转发消息到管理员（带发起私聊按钮）
          if (photoFileId) {
            const forwardCaption = `📨 新消息\n来自: ${userName}\n[CHATID:${chatId}:MSGID:${messageId}]\n${keyboardHandled ? '✅ 已自动处理' : ''}\n\n${message.caption || ''}`;
            await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: personalUserId,
                photo: photoFileId,
                caption: forwardCaption,
                reply_markup: privateChatButton,
              }),
            });
          } else {
            const forwardText = `📨 新消息\n来自: ${userName}\n[CHATID:${chatId}:MSGID:${messageId}]\n${keyboardHandled ? '✅ 已自动处理' : ''}\n\n${text}`;
            await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: personalUserId,
                text: forwardText,
                reply_markup: privateChatButton,
              }),
            });
          }
          console.log(`Bidirectional chat: Message forwarded to personalUserId: ${personalUserId}`);
        } else {
          console.log('Activity log disabled - auto-processed message not forwarded');
        }
        
      } else if (menuAdminChatId > 0 && activityLogEnabled) {
        // ===== 菜单键盘模式（无双向聊天）：只发送简洁的活动记录，不带发起私聊按钮 =====
        // 仅在 activityLogEnabled 开启时发送活动记录
        
        // 确定操作类型
        let operationType = '发送消息';
        if (text === '/start') {
          operationType = '点击 /start 启动机器人';
        } else if (text.startsWith('/')) {
          operationType = `发送指令: ${text}`;
        } else if (keyboardHandled) {
          operationType = `点击菜单按钮: ${text}`;
        } else {
          operationType = `发送文字: ${text.substring(0, 50)}${text.length > 50 ? '...' : ''}`;
        }
        
        // 如果是图片
        if (photoFileId) {
          operationType = `发送图片${message.caption ? ` (附言: ${message.caption.substring(0, 30)}...)` : ''}`;
        }
        
        const activityText = `📋 用户操作记录\n来自: ${userName}\n用户ID: ${chatId}\n操作: ${operationType}`;
        
        await sendTelegramMessage(botToken, 'sendMessage', {
          chat_id: menuAdminChatId,
          text: activityText,
        });
        
        console.log(`Menu bot: Activity record sent to menuAdminChatId: ${menuAdminChatId}`);
      } else {
        console.log('Activity log disabled or no recipient configured');
      }
    } else {
      console.log('No activity recipient configured or message from admin - skipping forward');
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Webhook error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
