import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PaymentCallback {
  // 通用字段
  order_no: string
  amount: string
  currency: string
  status: string
  tx_hash?: string
  
  // USDT/TRX 链上支付
  from_address?: string
  to_address?: string
  
  // YunGouOS 回调
  outTradeNo?: string
  payNo?: string
  money?: string
  
  // XunHuPay 回调  
  trade_order_id?: string
  total_fee?: string
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const url = new URL(req.url)
    const botToken = url.searchParams.get('bot_token')
    const paymentType = url.searchParams.get('type') || 'crypto' // crypto | yungou | xunhu

    if (!botToken) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing bot_token parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 解析回调数据
    let callbackData: PaymentCallback
    const contentType = req.headers.get('content-type') || ''
    
    if (contentType.includes('application/json')) {
      callbackData = await req.json()
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await req.formData()
      callbackData = Object.fromEntries(formData.entries()) as unknown as PaymentCallback
    } else {
      // 尝试从 URL 参数获取
      callbackData = Object.fromEntries(url.searchParams.entries()) as unknown as PaymentCallback
    }

    console.log(`[Shop Webhook] Received ${paymentType} callback for bot ${botToken.slice(-8)}:`, callbackData)

    // 根据支付类型解析订单号和金额
    let orderNo: string
    let amount: number
    let txHash: string | undefined
    let paymentStatus: string

    switch (paymentType) {
      case 'yungou':
        // YunGouOS 格式
        orderNo = callbackData.outTradeNo || callbackData.order_no || ''
        amount = parseFloat(callbackData.money || callbackData.amount || '0')
        paymentStatus = callbackData.status === '1' ? 'paid' : 'pending'
        txHash = callbackData.payNo
        break
        
      case 'xunhu':
        // 虎皮椒格式
        orderNo = callbackData.trade_order_id || callbackData.order_no || ''
        amount = parseFloat(callbackData.total_fee || callbackData.amount || '0')
        paymentStatus = callbackData.status === 'OD' ? 'paid' : 'pending'
        break
        
      case 'crypto':
      default:
        // USDT/TRX 链上支付格式
        orderNo = callbackData.order_no || ''
        amount = parseFloat(callbackData.amount || '0')
        txHash = callbackData.tx_hash
        paymentStatus = callbackData.status === 'confirmed' ? 'paid' : 'pending'
        break
    }

    if (!orderNo) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing order_no' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 查找订单
    const { data: order, error: orderError } = await supabase
      .from('shop_orders')
      .select('*, shop_products(*)')
      .eq('bot_token', botToken)
      .eq('order_no', orderNo)
      .maybeSingle()

    if (orderError || !order) {
      console.error('[Shop Webhook] Order not found:', orderNo)
      return new Response(
        JSON.stringify({ success: false, error: 'Order not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 检查订单是否已处理
    if (order.status === 'paid') {
      console.log('[Shop Webhook] Order already paid:', orderNo)
      return new Response(
        JSON.stringify({ success: true, message: 'Order already processed' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 验证金额 (允许小数误差)
    const expectedAmount = parseFloat(order.amount)
    if (Math.abs(amount - expectedAmount) > 0.1) {
      console.warn(`[Shop Webhook] Amount mismatch: expected ${expectedAmount}, got ${amount}`)
      // 记录但不阻止，某些情况下可能有汇率差异
    }

    // 获取商品库存
    let deliveryContent = ''
    if (order.product_id) {
      const { data: product } = await supabase
        .from('shop_products')
        .select('stock_content')
        .eq('id', order.product_id)
        .single()

      if (product?.stock_content && product.stock_content.length > 0) {
        // 取出第一个库存项
        deliveryContent = product.stock_content[0]
        
        // 更新库存 (移除已发货的项)
        const remainingStock = product.stock_content.slice(1)
        await supabase
          .from('shop_products')
          .update({ stock_content: remainingStock })
          .eq('id', order.product_id)
      } else {
        deliveryContent = '库存不足，请联系管理员补货'
      }
    }

    // 更新订单状态
    const { error: updateError } = await supabase
      .from('shop_orders')
      .update({
        status: 'paid',
        tx_hash: txHash,
        delivery_content: deliveryContent,
        delivered_at: new Date().toISOString()
      })
      .eq('id', order.id)

    if (updateError) {
      console.error('[Shop Webhook] Failed to update order:', updateError)
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to update order' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 获取店铺配置以获取 bot token 发送消息
    const { data: shopConfig } = await supabase
      .from('shop_configs')
      .select('*')
      .eq('bot_token', botToken)
      .maybeSingle()

    // 发送 Telegram 消息通知用户
    if (order.telegram_user_id && shopConfig) {
      const message = `✅ **支付成功！**

💰 订单号: \`${orderNo}\`
🎁 商品: ${order.product_name}
💵 金额: ${order.amount} ${order.currency}
${txHash ? `🔗 交易哈希: \`${txHash.slice(0, 16)}...\`\n` : ''}
────────────────
📦 **您的卡密：**
\`${deliveryContent}\`
────────────────
感谢您的惠顾！`

      try {
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: order.telegram_user_id,
            text: message,
            parse_mode: 'Markdown'
          })
        })
        console.log('[Shop Webhook] Delivery message sent to user:', order.telegram_user_id)
      } catch (e) {
        console.error('[Shop Webhook] Failed to send Telegram message:', e)
      }
    }

    // 通知管理员
    if (shopConfig?.admin_id) {
      const adminMessage = `📦 **新订单完成！**

订单号: \`${orderNo}\`
商品: ${order.product_name}
金额: ${order.amount} ${order.currency}
用户: ${order.telegram_username || order.telegram_user_id || 'Unknown'}
${txHash ? `TxHash: \`${txHash}\`\n` : ''}
已自动发货 ✅`

      try {
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: shopConfig.admin_id,
            text: adminMessage,
            parse_mode: 'Markdown'
          })
        })
      } catch (e) {
        console.error('[Shop Webhook] Failed to notify admin:', e)
      }
    }

    console.log(`[Shop Webhook] Order ${orderNo} processed successfully, delivered: ${deliveryContent.slice(0, 20)}...`)

    // 返回不同支付平台期望的响应格式
    if (paymentType === 'yungou') {
      return new Response('SUCCESS', { headers: corsHeaders })
    } else if (paymentType === 'xunhu') {
      return new Response('success', { headers: corsHeaders })
    }

    return new Response(
      JSON.stringify({ success: true, order_no: orderNo, delivered: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: unknown) {
    console.error('[Shop Webhook] Error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})