import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as md5Module from 'https://esm.sh/js-md5@0.8.3'

const md5Fn: (input: string) => string = ((md5Module as any).default ?? (md5Module as any).md5 ?? md5Module) as any

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PaymentRequest {
  bot_token: string
  order_no: string
  product_name: string
  amount: number
  payment_method: 'alipay' | 'wechat'
  provider: 'yungou' | 'xunhu'
  notify_url: string
  return_url?: string
}

// MD5 签名 - Edge Runtime 不支持 crypto.subtle 的 MD5，这里使用纯 JS 实现
async function md5Hex(str: string): Promise<string> {
  return md5Fn(str)
}

// YunGouOS 签名
async function signYunGou(params: Record<string, string>, key: string): Promise<string> {
  const sorted = Object.keys(params).sort()
  const signStr = sorted.map(k => `${k}=${params[k]}`).join('&') + '&key=' + key
  const hash = await md5Hex(signStr)
  return hash.toUpperCase()
}

// 虎皮椒签名
async function signXunHu(params: Record<string, string>, secret: string): Promise<string> {
  const sorted = Object.keys(params).filter(k => params[k]).sort()
  const signStr = sorted.map(k => `${k}=${params[k]}`).join('&') + secret
  return await md5Hex(signStr)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const body: PaymentRequest = await req.json()
    const { bot_token, order_no, product_name, amount, payment_method, provider, notify_url, return_url } = body

    if (!bot_token || !order_no || !amount || !payment_method || !provider) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required parameters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 获取商户配置
    const { data: config, error: configError } = await supabase
      .from('shop_configs')
      .select('*')
      .eq('bot_token', bot_token)
      .maybeSingle()

    if (configError || !config) {
      return new Response(
        JSON.stringify({ success: false, error: 'Shop config not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let payUrl = ''
    let qrCode = ''

    if (provider === 'yungou') {
      // YunGouOS 支付
      if (!config.yungou_id || !config.yungou_key) {
        return new Response(
          JSON.stringify({ success: false, error: 'YunGouOS credentials not configured' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const payType = payment_method === 'alipay' ? 'alipay' : 'wxpay'
      const apiUrl = `https://api.pay.yungouos.com/api/pay/${payType}/nativeApi`
      
      const params: Record<string, string> = {
        out_trade_no: order_no,
        total_fee: amount.toFixed(2),
        mch_id: config.yungou_id,
        body: product_name,
        notify_url: notify_url
      }
      
      if (return_url) {
        params.return_url = return_url
      }
      
      params.sign = await signYunGou(params, config.yungou_key)

      const formData = new URLSearchParams(params)
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData
      })
      
      const data = await res.json()
      console.log('[Create Payment] YunGouOS response:', data)
      
      if (data.code === 0 && data.data) {
        payUrl = data.data
        qrCode = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(payUrl)}`
      } else {
        return new Response(
          JSON.stringify({ success: false, error: data.msg || 'YunGouOS API error' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

    } else if (provider === 'xunhu') {
      // 虎皮椒支付
      if (!config.xunhu_id || !config.xunhu_secret) {
        return new Response(
          JSON.stringify({ success: false, error: 'XunHuPay credentials not configured' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const apiUrl = payment_method === 'alipay' 
        ? 'https://api.xunhupay.com/payment/do.html'
        : 'https://api.xunhupay.com/payment/do.html'
      
      const params: Record<string, string> = {
        version: '1.1',
        appid: config.xunhu_id,
        trade_order_id: order_no,
        total_fee: amount.toFixed(2),
        title: product_name,
        time: Math.floor(Date.now() / 1000).toString(),
        notify_url: notify_url,
        nonce_str: Math.random().toString(36).substring(2),
        type: payment_method === 'alipay' ? 'alipay' : 'wechat'
      }
      
      if (return_url) {
        params.return_url = return_url
      }
      
      params.hash = await signXunHu(params, config.xunhu_secret)

      const formData = new URLSearchParams(params)
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData
      })
      
      const data = await res.json()
      console.log('[Create Payment] XunHuPay response:', data)
      
      if (data.errcode === 0 && data.url) {
        payUrl = data.url
        qrCode = data.url_qrcode || `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(payUrl)}`
      } else {
        return new Response(
          JSON.stringify({ success: false, error: data.errmsg || 'XunHuPay API error' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        pay_url: payUrl,
        qr_code: qrCode,
        order_no: order_no
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: unknown) {
    console.error('[Create Payment] Error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
