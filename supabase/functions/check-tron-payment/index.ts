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

interface ShopOrder {
  id: string
  order_no: string
  amount: number
  currency: string
  product_name: string
  telegram_user_id: number | null
  telegram_username: string | null
  created_at: string
}

// 从币安获取CNY/USD汇率
async function getCnyUsdtRate(): Promise<number> {
  try {
    const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
    if (!response.ok) return 7.25;
    const data = await response.json();
    return data.rates?.CNY || 7.25;
  } catch {
    return 7.25;
  }
}

// 从币安获取TRX/USDT实时汇率
async function getTrxUsdtRate(): Promise<number> {
  try {
    const response = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=TRXUSDT');
    if (!response.ok) return 0;
    const data = await response.json();
    return parseFloat(data.price) || 0;
  } catch {
    return 0;
  }
}

// 将订单金额转换为预期的链上金额 (USDT或TRX)
async function getExpectedCryptoAmount(order: ShopOrder, paymentCurrency: 'USDT' | 'TRX'): Promise<number> {
  let usdtAmount = order.amount;
  
  // 根据商品原始货币，先转换为USDT等值
  if (order.currency === 'CNY') {
    const cnyRate = await getCnyUsdtRate();
    usdtAmount = Math.round((order.amount / cnyRate) * 1000) / 1000;
    console.log(`[Check Tron] CNY ${order.amount} -> USDT ${usdtAmount}`);
  } else if (order.currency === 'TRX') {
    // TRX定价，转换为USDT等值
    const trxRate = await getTrxUsdtRate();
    if (trxRate > 0) {
      usdtAmount = Math.round((order.amount * trxRate) * 1000) / 1000;
      console.log(`[Check Tron] TRX ${order.amount} -> USDT ${usdtAmount}`);
    } else {
      console.log(`[Check Tron] Cannot get TRX rate for TRX-priced order`);
      return 0;
    }
  }
  // 如果是USDT定价，usdtAmount = order.amount，无需转换
  
  // 如果链上支付的是TRX，将USDT等值转换为TRX数量
  if (paymentCurrency === 'TRX') {
    // 如果商品本身就是TRX定价，直接返回原始金额
    if (order.currency === 'TRX') {
      console.log(`[Check Tron] TRX-priced order, expected TRX: ${order.amount}`);
      return order.amount;
    }
    // 否则需要将USDT等值转换为TRX
    const trxRate = await getTrxUsdtRate();
    if (trxRate > 0) {
      const trxAmount = Math.round((usdtAmount / trxRate) * 1000) / 1000;
      console.log(`[Check Tron] USDT ${usdtAmount} -> TRX ${trxAmount}`);
      return trxAmount;
    }
    return 0; // 无法获取汇率
  }
  
  return usdtAmount;
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
        const orderCreatedAt = new Date(order.created_at).getTime()
        
        // 判断该订单期望的支付币种
        const orderPaymentCurrency = order.currency === 'TRX' ? 'TRX' : 'USDT'

        for (const tx of transactions) {
          // 检查时间 (交易在订单创建之后)
          if (tx.block_timestamp < orderCreatedAt) continue

          // 计算链上交易金额 (USDT和TRX都是6位小数)
          const txAmount = parseInt(tx.value) / 1e6
          
          // 判断该交易是USDT还是TRX
          const isUsdtTx = tx.token_info?.symbol === 'USDT' || (tx.token_info !== undefined)
          const txCurrency = isUsdtTx ? 'USDT' : 'TRX'
          
          // 获取该订单预期的链上支付金额 (考虑CNY转换)
          const expectedAmount = await getExpectedCryptoAmount(
            order as ShopOrder, 
            txCurrency as 'USDT' | 'TRX'
          )
          
          if (expectedAmount <= 0) continue

          // 匹配金额 (允许 0.1 误差，因为汇率波动和防撞单小数)
          if (Math.abs(txAmount - expectedAmount) < 0.15) {
            console.log(`[Check Tron] Matched order ${order.order_no} (${order.currency} ${order.amount}) with tx ${tx.transaction_id} (${txCurrency} ${txAmount})`)
            
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
