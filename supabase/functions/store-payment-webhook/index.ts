import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * 自助商城支付回调处理
 * 支持虎皮椒 XunHuPay 异步通知
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // 解析回调数据 - 虎皮椒使用 form-urlencoded
    let callbackData: Record<string, string> = {}
    const contentType = req.headers.get('content-type') || ''
    
    if (contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await req.formData()
      for (const [key, value] of formData.entries()) {
        callbackData[key] = String(value)
      }
    } else if (contentType.includes('application/json')) {
      callbackData = await req.json()
    } else {
      // 从 URL 参数获取
      const url = new URL(req.url)
      for (const [key, value] of url.searchParams.entries()) {
        callbackData[key] = value
      }
    }

    console.log('[Store Webhook] 收到回调:', JSON.stringify(callbackData))

    // 虎皮椒回调字段
    // trade_order_id: 商户订单号
    // total_fee: 支付金额
    // status: 支付状态 (OD=已支付)
    // transaction_id: 支付平台流水号
    // hash: 签名
    
    const orderNo = callbackData.trade_order_id || callbackData.order_no || ''
    const totalFee = parseFloat(callbackData.total_fee || callbackData.amount || '0')
    const status = callbackData.status
    const transactionId = callbackData.transaction_id || callbackData.openid || ''

    if (!orderNo) {
      console.error('[Store Webhook] 缺少订单号')
      return new Response('fail', { headers: corsHeaders })
    }

    // 虎皮椒支付成功状态是 'OD'
    if (status !== 'OD') {
      console.log(`[Store Webhook] 订单 ${orderNo} 状态非支付成功: ${status}`)
      return new Response('success', { headers: corsHeaders })
    }

    // 查找订单
    const { data: order, error: orderError } = await supabase
      .from('store_orders')
      .select('*')
      .eq('order_no', orderNo)
      .maybeSingle()

    if (orderError || !order) {
      console.error('[Store Webhook] 订单未找到:', orderNo)
      return new Response('success', { headers: corsHeaders }) // 返回 success 避免重复回调
    }

    // 检查订单是否已处理
    if (order.status === 'paid') {
      console.log('[Store Webhook] 订单已处理:', orderNo)
      return new Response('success', { headers: corsHeaders })
    }

    // 验证金额 (允许小误差)
    const expectedAmount = parseFloat(order.amount)
    if (Math.abs(totalFee - expectedAmount) > 0.1) {
      console.warn(`[Store Webhook] 金额不匹配: 预期 ${expectedAmount}, 实际 ${totalFee}`)
    }

    // 判断订单类型 - 通过 bot_id 是否存在来判断是自动充值还是卡密
    const isAutoRecharge = order.bot_id && order.bot_id !== '匿名' && order.bot_id.length > 10
    let deliveredCode = ''
    
    if (isAutoRecharge) {
      // 自动充值订单 - 调用自动激活函数
      console.log(`[Store Webhook] 自动充值订单, botToken: ${order.bot_id?.slice(-8)}`)
      
      // 解析功能类型 - 从商品名称或 product_id 判断
      // 商品名称格式示例: "双向聊天-1个月" / "菜单键盘-3个月" / "TG商城-1个月"
      let featureType = 'chat' // 默认
      const productName = order.product_name?.toLowerCase() || ''
      if (productName.includes('键盘') || productName.includes('keyboard')) {
        featureType = 'keyboard'
      } else if (productName.includes('商城') || productName.includes('shop') || productName.includes('mall')) {
        featureType = 'shop'
      } else if (productName.includes('全部') || productName.includes('all')) {
        featureType = 'all'
      }
      
      // 从商品名称解析有效期天数
      let validityDays = 30
      if (productName.includes('3个月') || productName.includes('90')) validityDays = 90
      else if (productName.includes('6个月') || productName.includes('180')) validityDays = 180
      else if (productName.includes('12个月') || productName.includes('1年') || productName.includes('360')) validityDays = 360
      
      // 调用自动激活函数
      try {
        const activateRes = await fetch(`${supabaseUrl}/functions/v1/store-auto-activate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`
          },
          body: JSON.stringify({
            orderNo,
            botToken: order.bot_id,
            featureType,
            validityDays
          })
        })
        
        const activateData = await activateRes.json()
        
        if (activateData.success) {
          deliveredCode = activateData.message || '激活成功'
        } else {
          deliveredCode = activateData.error || '激活失败，请联系客服'
        }
      } catch (e) {
        console.error('[Store Webhook] 调用自动激活失败:', e)
        deliveredCode = '自动激活异常，请联系客服'
      }
    } else if (order.product_id) {
      // 卡密商品 - 调用发货函数获取卡密
      const { data: deliverResult, error: deliverError } = await supabase
        .rpc('deliver_card_key', {
          p_order_no: orderNo,
          p_product_id: order.product_id
        })

      if (deliverError) {
        console.error('[Store Webhook] 发货函数调用失败:', deliverError)
        deliveredCode = '发货失败，请联系客服'
      } else if (deliverResult && deliverResult[0]) {
        if (deliverResult[0].success) {
          deliveredCode = deliverResult[0].card_key
        } else {
          deliveredCode = deliverResult[0].error_message || '库存不足'
        }
      }
    }

    // 更新订单状态
    const { error: updateError } = await supabase
      .from('store_orders')
      .update({
        status: 'paid',
        tx_hash: transactionId,
        delivered_code: deliveredCode,
        updated_at: new Date().toISOString()
      })
      .eq('id', order.id)

    if (updateError) {
      console.error('[Store Webhook] 更新订单失败:', updateError)
      return new Response('fail', { headers: corsHeaders })
    }

    console.log(`[Store Webhook] 订单 ${orderNo} 处理成功, 卡密: ${deliveredCode.slice(0, 10)}...`)

    // 返回 success 告知虎皮椒处理成功
    return new Response('success', { headers: corsHeaders })

  } catch (error: unknown) {
    console.error('[Store Webhook] 处理异常:', error)
    return new Response('fail', { headers: corsHeaders })
  }
})
