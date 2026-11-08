import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function pemBytes(pem: string): Uint8Array {
  const raw = atob(String(pem || '').replace(/-----BEGIN [^-]+-----|-----END [^-]+-----|\s+/g, ''))
  return Uint8Array.from(raw, c => c.charCodeAt(0))
}

function alipaySignContent(params: Record<string, string>): string {
  return Object.keys(params).filter(key => key !== 'sign' && key !== 'sign_type' && params[key] !== '').sort().map(key => `${key}=${params[key]}`).join('&')
}

async function verifyAlipay(params: Record<string, string>, publicKey: string): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey('spki', pemBytes(publicKey), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify'])
    const signature = String(params.sign || '').replace(/ /g, '+')
    return await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, Uint8Array.from(atob(signature), c => c.charCodeAt(0)), new TextEncoder().encode(alipaySignContent(params)))
  } catch { return false }
}

/**
 * 自助商城支付回调处理
 * 支持虎皮椒 XunHuPay 异步通知
 * 
 * 职责：
 * 1. 卡密商品(card): 只把订单状态改为 paid，发货由前端调用 deliver-card-key 完成
 * 2. 自动充值商品(auto): 更新状态为 paid 后，调用 store-auto-activate 函数完成自动激活
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)
    const url = new URL(req.url)
    const paymentType = url.searchParams.get('type') || 'xunhu'

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

    if (paymentType === 'alipay_official') {
      const botToken = url.searchParams.get('bot_token') || ''
      const { data: config } = await supabase.from('shop_configs').select('official_alipay_enabled,official_alipay_app_id,official_alipay_public_key').eq('bot_token', botToken).maybeSingle()
      if (!config?.official_alipay_enabled || callbackData.app_id !== config.official_alipay_app_id || !(await verifyAlipay(callbackData, config.official_alipay_public_key || ''))) return new Response('failure', { status: 401, headers: corsHeaders })
    }

    console.log('[Store Webhook] 收到回调:', JSON.stringify(callbackData))

    // 虎皮椒回调字段
    const orderNo = paymentType === 'alipay_official' ? (callbackData.out_trade_no || '') : (callbackData.trade_order_id || callbackData.order_no || '')
    const totalFee = parseFloat(paymentType === 'alipay_official' ? (callbackData.total_amount || '0') : (callbackData.total_fee || callbackData.amount || '0'))
    const status = paymentType === 'alipay_official' ? callbackData.trade_status : callbackData.status
    const transactionId = paymentType === 'alipay_official' ? (callbackData.trade_no || '') : (callbackData.transaction_id || callbackData.openid || '')

    if (!orderNo) {
      console.error('[Store Webhook] 缺少订单号')
      return new Response('fail', { headers: corsHeaders })
    }

    // 虎皮椒支付成功状态是 'OD'
    if (paymentType === 'alipay_official' ? !['TRADE_SUCCESS', 'TRADE_FINISHED'].includes(status || '') : status !== 'OD') {
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
      return new Response('success', { headers: corsHeaders })
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

    // 查询商品类型
    const { data: product } = await supabase
      .from('store_products')
      .select('type, tags, duration')
      .eq('id', order.product_id)
      .maybeSingle()

    const productType = product?.type || 'card'
    const productTags = product?.tags || []
    const productDuration = product?.duration || 30

    console.log(`[Store Webhook] 订单 ${orderNo} 商品类型: ${productType}, 标签: ${JSON.stringify(productTags)}`)

    // 更新订单状态为 paid
    const { error: updateError } = await supabase
      .from('store_orders')
      .update({
        status: 'paid',
        tx_hash: transactionId,
        updated_at: new Date().toISOString()
      })
      .eq('id', order.id)

    if (updateError) {
      console.error('[Store Webhook] 更新订单失败:', updateError)
      return new Response('fail', { headers: corsHeaders })
    }

    console.log(`[Store Webhook] 订单 ${orderNo} 已标记为 paid`)

    // 如果是自动充值商品，调用 store-auto-activate 函数
    if (productType === 'auto') {
      // ⚠️ 自动充值需要 botToken。订单创建时前端把它写在 store_orders.bot_id
      // 之前误用 contact 导致回调无法自动激活、库存不扣减。
      const botToken = (order.bot_id || '').trim()

      if (!botToken || botToken.length < 20) {
        console.error(`[Store Webhook] 自动充值订单缺少有效的 bot_token(bot_id): ${orderNo}`)
        // 仍然返回成功，避免支付平台重复回调
        return new Response('success', { headers: corsHeaders })
      }

      // 确定功能类型 - 从商品标签推断
      let featureType = 'both' // 默认双向聊天
      if (productTags.includes('chat') && productTags.includes('keyboard') && productTags.includes('mall')) {
        featureType = 'all'
      } else if (productTags.includes('chat') && productTags.includes('mall')) {
        featureType = 'chat_shop'
      } else if (productTags.includes('keyboard') && productTags.includes('mall')) {
        featureType = 'keyboard_shop'
      } else if (productTags.includes('keyboard')) {
        featureType = 'keyboard'
      } else if (productTags.includes('mall')) {
        featureType = 'shop'
      } else if (productTags.includes('chat')) {
        featureType = 'chat'
      }

      console.log(`[Store Webhook] 调用自动激活: orderNo=${orderNo}, botToken=${botToken.slice(-8)}, featureType=${featureType}, days=${productDuration}`)

      try {
        // 调用 store-auto-activate 函数，传入订单的 product_id 确保使用正确的卡密
        const activateResponse = await fetch(`${supabaseUrl}/functions/v1/store-auto-activate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`
          },
          body: JSON.stringify({
            orderNo,
            botToken,
            featureType,
            validityDays: productDuration,
            productId: order.product_id  // 传入订单商品ID，确保使用正确的卡密库存
          })
        })

        const activateResult = await activateResponse.json()
        
        if (activateResult.success) {
          console.log(`[Store Webhook] 自动激活成功: ${JSON.stringify(activateResult)}`)
          
          // 更新订单的发货内容
          await supabase
            .from('store_orders')
            .update({
              delivered_code: activateResult.message || `已激活: ${activateResult.activatedFeatures?.join(', ')}`,
              updated_at: new Date().toISOString()
            })
            .eq('id', order.id)
        } else {
          console.error(`[Store Webhook] 自动激活失败: ${activateResult.error}`)
          
          // 更新订单备注失败原因
          await supabase
            .from('store_orders')
            .update({
              delivered_code: `激活失败: ${activateResult.error}`,
              updated_at: new Date().toISOString()
            })
            .eq('id', order.id)
        }
      } catch (activateError) {
        console.error('[Store Webhook] 调用自动激活异常:', activateError)
      }
    }

    // 返回 success 告知虎皮椒处理成功
    return new Response('success', { headers: corsHeaders })

  } catch (error: unknown) {
    console.error('[Store Webhook] 处理异常:', error)
    return new Response('fail', { headers: corsHeaders })
  }
})
