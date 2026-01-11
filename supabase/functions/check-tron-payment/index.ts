import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// USDT TRC20 合约地址
const USDT_CONTRACT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'

interface TronTransaction {
  transaction_id: string
  from: string
  to: string
  value: string
  token_info?: {
    symbol: string
    decimals: number
  }
  block_timestamp: number
}

// 获取 TRC20 转账记录 (USDT)
async function getTRC20Transactions(address: string, apiKey: string): Promise<TronTransaction[]> {
  const url = `https://api.trongrid.io/v1/accounts/${address}/transactions/trc20?only_to=true&limit=50&contract_address=${USDT_CONTRACT}`
  
  const res = await fetch(url, {
    headers: { 'TRON-PRO-API-KEY': apiKey }
  })
  
  const data = await res.json()
  return data.data || []
}

// 获取 TRX 转账记录
async function getTRXTransactions(address: string, apiKey: string): Promise<TronTransaction[]> {
  const url = `https://api.trongrid.io/v1/accounts/${address}/transactions?only_to=true&limit=50`
  
  const res = await fetch(url, {
    headers: { 'TRON-PRO-API-KEY': apiKey }
  })
  
  const data = await res.json()
  
  // 转换格式
  return (data.data || []).map((tx: any) => ({
    transaction_id: tx.txID,
    from: tx.raw_data?.contract?.[0]?.parameter?.value?.owner_address,
    to: tx.raw_data?.contract?.[0]?.parameter?.value?.to_address,
    value: tx.raw_data?.contract?.[0]?.parameter?.value?.amount?.toString() || '0',
    block_timestamp: tx.block_timestamp
  })).filter((tx: TronTransaction) => tx.value !== '0')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // 获取所有需要检查的商店配置
    const { data: configs, error: configError } = await supabase
      .from('shop_configs')
      .select('*')
      .or('accept_usdt.eq.true,accept_trx.eq.true')
      .not('wallet_address', 'is', null)
      .not('tron_grid_key', 'is', null)

    if (configError) {
      console.error('[Check Tron] Failed to fetch configs:', configError)
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to fetch configs' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!configs || configs.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No shops with crypto enabled' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let totalProcessed = 0
    let totalMatched = 0

    for (const config of configs) {
      const { bot_token, wallet_address, tron_grid_key, accept_usdt, accept_trx } = config

      // 获取该店铺的待支付订单
      const { data: pendingOrders, error: ordersError } = await supabase
        .from('shop_orders')
        .select('*')
        .eq('bot_token', bot_token)
        .eq('status', 'pending')
        .in('currency', ['USDT', 'TRX'])
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // 24小时内

      if (ordersError || !pendingOrders || pendingOrders.length === 0) {
        continue
      }

      console.log(`[Check Tron] Checking ${pendingOrders.length} pending orders for wallet ${wallet_address.slice(-8)}`)

      // 获取链上交易
      const transactions: TronTransaction[] = []
      
      if (accept_usdt) {
        const usdtTxs = await getTRC20Transactions(wallet_address, tron_grid_key)
        transactions.push(...usdtTxs)
      }
      
      if (accept_trx) {
        const trxTxs = await getTRXTransactions(wallet_address, tron_grid_key)
        transactions.push(...trxTxs)
      }

      // 匹配订单与交易
      for (const order of pendingOrders) {
        const orderAmount = parseFloat(order.amount)
        const orderCreatedAt = new Date(order.created_at).getTime()

        for (const tx of transactions) {
          // 检查时间 (交易在订单创建之后)
          if (tx.block_timestamp < orderCreatedAt) continue

          // 计算交易金额
          let txAmount: number
          if (order.currency === 'USDT') {
            // USDT 有 6 位小数
            txAmount = parseInt(tx.value) / 1e6
          } else {
            // TRX 有 6 位小数
            txAmount = parseInt(tx.value) / 1e6
          }

          // 匹配金额 (允许 0.05 误差用于防撞单)
          if (Math.abs(txAmount - orderAmount) < 0.06) {
            console.log(`[Check Tron] Matched order ${order.order_no} with tx ${tx.transaction_id}`)
            
            // 调用支付回调
            const webhookUrl = `${supabaseUrl}/functions/v1/shop-payment-webhook?bot_token=${bot_token}&type=crypto`
            
            await fetch(webhookUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                order_no: order.order_no,
                amount: txAmount.toString(),
                tx_hash: tx.transaction_id,
                status: 'confirmed',
                from_address: tx.from
              })
            })

            totalMatched++
            break
          }
        }
        totalProcessed++
      }
    }

    console.log(`[Check Tron] Processed ${totalProcessed} orders, matched ${totalMatched}`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        processed: totalProcessed,
        matched: totalMatched
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: unknown) {
    console.error('[Check Tron] Error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
