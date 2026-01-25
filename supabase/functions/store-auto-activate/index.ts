import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * 自助商城自动激活函数
 * 支付成功后自动从卡密库获取激活码并激活机器人
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { orderNo, botToken, featureType, validityDays, productId } = await req.json()

    if (!orderNo || !botToken || !featureType) {
      return new Response(
        JSON.stringify({ success: false, error: '缺少必要参数' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[Auto Activate] 处理订单: ${orderNo}, 机器人: ${botToken.slice(-8)}, 功能: ${featureType}, 商品ID: ${productId || '未提供'}`)

    // 1. 从 store_card_keys 表获取一个匹配商品的未使用激活码
    // 优先使用传入的 productId（订单关联的商品），否则根据 featureType 查找
    let codeData: { id: string; card_key: string; product_id: string } | null = null
    let productDuration = validityDays || 30

    if (productId) {
      // 直接使用订单的商品ID获取卡密
      const { data: cardKey } = await supabase
        .from('store_card_keys')
        .select('id, card_key, product_id')
        .eq('product_id', productId)
        .eq('is_used', false)
        .limit(1)
        .maybeSingle()
      
      if (cardKey) {
        codeData = cardKey
        console.log(`[Auto Activate] 使用订单商品的卡密: productId=${productId}`)
      }
    }

    // 如果没有找到或没提供 productId，回退到根据 featureType 查询
    if (!codeData) {
      // 功能类型到标签的映射（mall -> mall，不是 shop）
      const featureToTag: Record<string, string[]> = {
        'chat': ['chat'],
        'keyboard': ['keyboard'],
        'shop': ['mall'],
        'mall': ['mall'],
        'both': ['chat', 'keyboard'],
        'chat_shop': ['chat', 'mall'],
        'keyboard_shop': ['keyboard', 'mall'],
        'all': ['chat', 'keyboard', 'mall']
      }
      
      const searchTags = featureToTag[featureType] || ['chat']
      
      // 找任意一个匹配标签的自动充值商品
      const { data: matchProduct } = await supabase
        .from('store_products')
        .select('id, duration')
        .eq('type', 'auto')
        .overlaps('tags', searchTags)
        .gte('duration', validityDays || 30)
        .order('duration', { ascending: true })
        .limit(1)
        .maybeSingle()

      if (matchProduct) {
        const { data: cardKey } = await supabase
          .from('store_card_keys')
          .select('id, card_key, product_id')
          .eq('product_id', matchProduct.id)
          .eq('is_used', false)
          .limit(1)
          .maybeSingle()
        
        if (cardKey) {
          codeData = cardKey
          productDuration = matchProduct.duration
          console.log(`[Auto Activate] 通过featureType查找卡密: matchProduct=${matchProduct.id}`)
        }
      }
    }

    if (!codeData) {
      console.error(`[Auto Activate] 无可用激活码: featureType=${featureType}, productId=${productId}, days=${validityDays}`)
      return new Response(
        JSON.stringify({ success: false, error: '库存不足，无可用激活码' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const actualValidityDays = productDuration
    const actualFeatureType = featureType

    // 2. 判断需要激活的功能（shop 和 mall 都映射到商城）
    const shouldActivateChat = ['chat', 'both', 'chat_shop', 'all'].includes(actualFeatureType)
    const shouldActivateKeyboard = ['keyboard', 'both', 'keyboard_shop', 'all'].includes(actualFeatureType)
    const shouldActivateShop = ['shop', 'mall', 'chat_shop', 'keyboard_shop', 'all'].includes(actualFeatureType)

    // 3. 查找或创建机器人记录
    let { data: botRecord } = await supabase
      .from('bot_activations')
      .select('*')
      .eq('bot_token', botToken)
      .maybeSingle()

    let newChatExpireAt: Date | null = null
    let newKeyboardExpireAt: Date | null = null
    let newShopExpireAt: Date | null = null

    // 计算各功能的有效期
    if (shouldActivateChat) {
      if (botRecord?.expire_at && new Date(botRecord.expire_at) > new Date()) {
        newChatExpireAt = new Date(botRecord.expire_at)
        newChatExpireAt.setDate(newChatExpireAt.getDate() + actualValidityDays)
      } else {
        newChatExpireAt = new Date()
        newChatExpireAt.setDate(newChatExpireAt.getDate() + actualValidityDays)
      }
      newChatExpireAt.setHours(23, 59, 59, 999)
    }

    if (shouldActivateKeyboard) {
      // 获取当前键盘配置
      const { data: kbConfig } = await supabase
        .from('keyboard_configs')
        .select('keyboard_expire_at')
        .eq('bot_token', botToken)
        .maybeSingle()

      if (kbConfig?.keyboard_expire_at && new Date(kbConfig.keyboard_expire_at) > new Date()) {
        newKeyboardExpireAt = new Date(kbConfig.keyboard_expire_at)
        newKeyboardExpireAt.setDate(newKeyboardExpireAt.getDate() + actualValidityDays)
      } else {
        newKeyboardExpireAt = new Date()
        newKeyboardExpireAt.setDate(newKeyboardExpireAt.getDate() + actualValidityDays)
      }
      newKeyboardExpireAt.setHours(23, 59, 59, 999)
    }

    if (shouldActivateShop) {
      // 获取当前商城配置
      const { data: shopConfig } = await supabase
        .from('shop_configs')
        .select('shop_expire_at')
        .eq('bot_token', botToken)
        .maybeSingle()

      if (shopConfig?.shop_expire_at && new Date(shopConfig.shop_expire_at) > new Date()) {
        newShopExpireAt = new Date(shopConfig.shop_expire_at)
        newShopExpireAt.setDate(newShopExpireAt.getDate() + actualValidityDays)
      } else {
        newShopExpireAt = new Date()
        newShopExpireAt.setDate(newShopExpireAt.getDate() + actualValidityDays)
      }
      newShopExpireAt.setHours(23, 59, 59, 999)
    }

    // 4. 更新或创建 bot_activations 记录
    if (botRecord && shouldActivateChat) {
      await supabase
        .from('bot_activations')
        .update({
          expire_at: newChatExpireAt?.toISOString(),
          is_authorized: true,
          is_active: true,
          trial_messages_used: 0,
          web_enabled: true,
          app_enabled: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', botRecord.id)
    } else if (!botRecord && shouldActivateChat) {
      // 需要验证 bot token 有效性
      try {
        const telegramRes = await fetch(`https://api.telegram.org/bot${botToken}/getMe`)
        const telegramData = await telegramRes.json()
        
        if (!telegramData.ok) {
          return new Response(
            JSON.stringify({ success: false, error: '无效的机器人 Token' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // 创建新记录
        const { data: newBot } = await supabase
          .from('bot_activations')
          .insert({
            bot_token: botToken,
            activation_code: codeData.card_key,
            personal_user_id: 'store_auto_activate',
            expire_at: newChatExpireAt?.toISOString(),
            is_authorized: true,
            is_active: true,
            trial_messages_used: 0,
            web_enabled: true,
            app_enabled: true
          })
          .select()
          .single()
        
        botRecord = newBot
      } catch (e) {
        console.error('[Auto Activate] 验证 Token 失败:', e)
        return new Response(
          JSON.stringify({ success: false, error: '验证机器人失败' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // 5. 更新 keyboard_configs
    if (shouldActivateKeyboard && newKeyboardExpireAt) {
      await supabase
        .from('keyboard_configs')
        .upsert({
          bot_token: botToken,
          keyboard_expire_at: newKeyboardExpireAt.toISOString(),
          keyboard_trial_started_at: null, // 清除试用标记
          updated_at: new Date().toISOString()
        } as any, { onConflict: 'bot_token' })
    }

    // 6. 更新 shop_configs
    if (shouldActivateShop && newShopExpireAt) {
      await supabase
        .from('shop_configs')
        .upsert({
          bot_token: botToken,
          shop_expire_at: newShopExpireAt.toISOString(),
          shop_trial_started_at: null, // 清除试用标记
          updated_at: new Date().toISOString()
        } as any, { onConflict: 'bot_token' })
    }

    // 7. 标记卡密为已使用（在 store_card_keys 表中）
    await supabase
      .from('store_card_keys')
      .update({
        is_used: true,
        order_id: orderNo,
        updated_at: new Date().toISOString()
      })
      .eq('id', codeData.id)

    // 构建成功消息
    const activatedFeatures: string[] = []
    if (newChatExpireAt) activatedFeatures.push(`双向聊天(${newChatExpireAt.toLocaleDateString()})`)
    if (newKeyboardExpireAt) activatedFeatures.push(`菜单键盘(${newKeyboardExpireAt.toLocaleDateString()})`)
    if (newShopExpireAt) activatedFeatures.push(`TG商城(${newShopExpireAt.toLocaleDateString()})`)

    console.log(`[Auto Activate] 订单 ${orderNo} 激活成功: ${activatedFeatures.join(', ')}`)

    return new Response(
      JSON.stringify({
        success: true,
        orderNo,
        activatedFeatures,
        usedCode: codeData.card_key,
        message: `已成功激活: ${activatedFeatures.join(', ')}`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: unknown) {
    console.error('[Auto Activate] 处理异常:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
