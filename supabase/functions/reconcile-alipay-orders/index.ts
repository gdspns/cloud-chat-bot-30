import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const headers = { 'Content-Type': 'application/json' }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers })
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceKey)

    const { data: configs, error: configError } = await supabase
      .from('shop_configs')
      .select('bot_token')
      .eq('official_alipay_enabled', true)
      .eq('alipay_provider', 'alipay_official')
    if (configError) throw configError
    const tokens = (configs || []).map(row => row.bot_token).filter(Boolean)
    if (!tokens.length) return new Response(JSON.stringify({ success: true, checked: 0, recovered: 0 }), { headers })

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data: orders, error: orderError } = await supabase
      .from('shop_orders')
      .select('order_no,bot_token')
      .in('bot_token', tokens)
      .eq('status', 'pending')
      .eq('payment_method', 'alipay')
      .gte('created_at', since)
      .order('created_at', { ascending: true })
      .limit(100)
    if (orderError) throw orderError

    let recovered = 0
    for (const order of orders || []) {
      const url = `${supabaseUrl}/functions/v1/shop-payment-webhook?bot_token=${encodeURIComponent(order.bot_token)}&type=alipay_query&order_no=${encodeURIComponent(order.order_no)}`
      const response = await fetch(url, { method: 'POST', headers, body: '{}' })
      const result = await response.json().catch(() => ({}))
      if (response.ok && result?.delivered) recovered++
    }
    return new Response(JSON.stringify({ success: true, checked: orders?.length || 0, recovered }), { headers })
  } catch (error) {
    console.error('[Reconcile Alipay] Error:', error)
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }), { status: 500, headers })
  }
})
