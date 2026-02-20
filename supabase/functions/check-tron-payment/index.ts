import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// USDT TRC20 主网合约地址
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
  
  return (data.data || []).map((tx: any) => ({
    transaction_id: tx.txID,
    from: tx.raw_data?.contract?.[0]?.parameter?.value?.owner_address,
    to: tx.raw_data?.contract?.[0]?.parameter?.value?.to_address,
    value: tx.raw_data?.contract?.[0]?.parameter?.value?.amount?.toString() || '0',
    block_timestamp: tx.block_timestamp
  })).filter((tx: TronTransaction) => tx.value !== '0')
}

// 匹配交易与订单
function matchTransaction(
  tx: TronTransaction,
  orderAmount: number,
  orderCreatedAt: number,
  expectedCurrency: 'USDT' | 'TRX'
): boolean {
  // 交易必须在订单创建之后
  if (tx.block_timestamp < orderCreatedAt) return false

  const txAmount = parseInt(tx.value) / 1e6
  
  // 判断交易币种
  const isUsdtTx = tx.token_info?.symbol === 'USDT'
  const txCurrency = isUsdtTx ? 'USDT' : 'TRX'
  
  if (txCurrency !== expectedCurrency) return false
  if (orderAmount <= 0) return false

  // 允许 0.15 误差
  return Math.abs(txAmount - orderAmount) < 0.15
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // 获取所有启用加密货币的商店配置
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

      // 获取链上交易（每个钱包只查一次）
      const transactions: TronTransaction[] = []
      
      if (accept_usdt) {
        const usdtTxs = await getTRC20Transactions(wallet_address, tron_grid_key)
        transactions.push(...usdtTxs)
      }
      
      if (accept_trx) {
        const trxTxs = await getTRXTransactions(wallet_address, tron_grid_key)
        transactions.push(...trxTxs)
      }

      // ===== 1. 检查 TG 商城订单 (shop_orders) =====
      const { data: shopOrders } = await supabase
        .from('shop_orders')
        .select('*')
        .eq('bot_token', bot_token)
        .eq('status', 'pending')
        .in('payment_method', ['usdt', 'trx'])
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

      if (shopOrders && shopOrders.length > 0) {
        console.log(`[Check Tron] Checking ${shopOrders.length} TG shop orders for wallet ${wallet_address.slice(-8)}`)

        for (const order of shopOrders) {
          const orderCreatedAt = new Date(order.created_at).getTime()
          const expectedCurrency = order.payment_method === 'trx' ? 'TRX' : 'USDT'

          for (const tx of transactions) {
            if (matchTransaction(tx, order.amount, orderCreatedAt, expectedCurrency as 'USDT' | 'TRX')) {
              const txAmount = parseInt(tx.value) / 1e6
              console.log(`[Check Tron] Matched shop order ${order.order_no} with tx ${tx.transaction_id} (${expectedCurrency} ${txAmount})`)
              
              const webhookUrl = `${supabaseUrl}/functions/v1/shop-payment-webhook?bot_token=${bot_token}&type=crypto`
              
              await fetch(webhookUrl, {
                method: 'POST',
                headers: { 
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${supabaseKey}`
                },
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

      // ===== 2. 检查自助商城订单 (store_orders) =====
      const { data: storeOrders } = await supabase
        .from('store_orders')
        .select('*')
        .eq('status', 'pending')
        .in('payment_method', ['usdt', 'trx'])
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

      if (storeOrders && storeOrders.length > 0) {
        console.log(`[Check Tron] Checking ${storeOrders.length} store orders for wallet ${wallet_address.slice(-8)}`)

        for (const order of storeOrders) {
          const orderCreatedAt = new Date(order.created_at).getTime()
          const expectedCurrency = order.payment_method === 'trx' ? 'TRX' : 'USDT'

          for (const tx of transactions) {
            if (matchTransaction(tx, order.amount, orderCreatedAt, expectedCurrency as 'USDT' | 'TRX')) {
              const txAmount = parseInt(tx.value) / 1e6
              console.log(`[Check Tron] Matched store order ${order.order_no} with tx ${tx.transaction_id} (${expectedCurrency} ${txAmount})`)
              
              // 直接更新订单状态为 paid
              await supabase
                .from('store_orders')
                .update({
                  status: 'paid',
                  tx_hash: tx.transaction_id,
                  updated_at: new Date().toISOString()
                })
                .eq('order_no', order.order_no)

              // 如果是自动充值商品，触发自动激活
              const botId = order.bot_id
              if (botId && botId.length >= 20) {
                // 获取商品信息
                const { data: product } = await supabase
                  .from('store_products')
                  .select('*')
                  .eq('id', order.product_id)
                  .single()

                if (product && product.type === 'auto') {
                  // 确定功能类型
                  const productTags: string[] = product.tags || []
                  let featureType = 'chat'
                  if (productTags.includes('chat') && productTags.includes('keyboard') && productTags.includes('mall')) {
                    featureType = 'all'
                  } else if (productTags.includes('chat') && productTags.includes('mall')) {
                    featureType = 'chat_shop'
                  } else if (productTags.includes('keyboard') && productTags.includes('mall')) {
                    featureType = 'keyboard_shop'
                  } else if (productTags.includes('chat') && productTags.includes('keyboard')) {
                    featureType = 'both'
                  } else if (productTags.includes('keyboard')) {
                    featureType = 'keyboard'
                  } else if (productTags.includes('mall')) {
                    featureType = 'shop'
                  }

                  console.log(`[Check Tron] Triggering auto-activate for store order ${order.order_no}, bot: ${botId.slice(-8)}, feature: ${featureType}`)

                  try {
                    await fetch(`${supabaseUrl}/functions/v1/store-auto-activate`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${supabaseKey}`
                      },
                      body: JSON.stringify({
                        orderNo: order.order_no,
                        botToken: botId,
                        duration: product.duration,
                        featureType
                      })
                    })
                  } catch (e) {
                    console.error(`[Check Tron] Auto-activate failed for ${order.order_no}:`, e)
                  }
                } else if (product && product.type === 'card') {
                  // 卡密商品 - 调用 deliver_card_key RPC
                  console.log(`[Check Tron] Delivering card key for store order ${order.order_no}`)
                  try {
                    await supabase.rpc('deliver_card_key', {
                      p_order_no: order.order_no,
                      p_product_id: order.product_id
                    })
                  } catch (e) {
                    console.error(`[Check Tron] Card delivery failed for ${order.order_no}:`, e)
                  }
                }
              }

              totalMatched++
              break
            }
          }
          totalProcessed++
        }
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
