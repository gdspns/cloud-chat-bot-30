import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

// MD5(32位小写hex) - 纯JS实现，避免 Edge Runtime 对 crypto.subtle.digest('MD5') 的不支持
function md5HexSync(input: string): string {
  const utf8 = new TextEncoder().encode(input)

  // Convert to little-endian words
  const words: number[] = []
  for (let i = 0; i < utf8.length; i++) {
    words[i >> 2] = (words[i >> 2] || 0) | (utf8[i] << ((i % 4) * 8))
  }
  // Append padding
  const bitLen = utf8.length * 8
  words[bitLen >> 5] = (words[bitLen >> 5] || 0) | (0x80 << (bitLen % 32))
  words[(((bitLen + 64) >>> 9) << 4) + 14] = bitLen

  let a = 0x67452301
  let b = 0xefcdab89
  let c = 0x98badcfe
  let d = 0x10325476

  const ff = (a0: number, b0: number, c0: number, d0: number, x: number, s: number, t: number) => {
    const n = a0 + ((b0 & c0) | (~b0 & d0)) + x + t
    return (((n << s) | (n >>> (32 - s))) + b0) | 0
  }
  const gg = (a0: number, b0: number, c0: number, d0: number, x: number, s: number, t: number) => {
    const n = a0 + ((b0 & d0) | (c0 & ~d0)) + x + t
    return (((n << s) | (n >>> (32 - s))) + b0) | 0
  }
  const hh = (a0: number, b0: number, c0: number, d0: number, x: number, s: number, t: number) => {
    const n = a0 + (b0 ^ c0 ^ d0) + x + t
    return (((n << s) | (n >>> (32 - s))) + b0) | 0
  }
  const ii = (a0: number, b0: number, c0: number, d0: number, x: number, s: number, t: number) => {
    const n = a0 + (c0 ^ (b0 | ~d0)) + x + t
    return (((n << s) | (n >>> (32 - s))) + b0) | 0
  }

  for (let i = 0; i < words.length; i += 16) {
    const oa = a, ob = b, oc = c, od = d

    a = ff(a, b, c, d, words[i + 0] | 0, 7, -680876936)
    d = ff(d, a, b, c, words[i + 1] | 0, 12, -389564586)
    c = ff(c, d, a, b, words[i + 2] | 0, 17, 606105819)
    b = ff(b, c, d, a, words[i + 3] | 0, 22, -1044525330)
    a = ff(a, b, c, d, words[i + 4] | 0, 7, -176418897)
    d = ff(d, a, b, c, words[i + 5] | 0, 12, 1200080426)
    c = ff(c, d, a, b, words[i + 6] | 0, 17, -1473231341)
    b = ff(b, c, d, a, words[i + 7] | 0, 22, -45705983)
    a = ff(a, b, c, d, words[i + 8] | 0, 7, 1770035416)
    d = ff(d, a, b, c, words[i + 9] | 0, 12, -1958414417)
    c = ff(c, d, a, b, words[i + 10] | 0, 17, -42063)
    b = ff(b, c, d, a, words[i + 11] | 0, 22, -1990404162)
    a = ff(a, b, c, d, words[i + 12] | 0, 7, 1804603682)
    d = ff(d, a, b, c, words[i + 13] | 0, 12, -40341101)
    c = ff(c, d, a, b, words[i + 14] | 0, 17, -1502002290)
    b = ff(b, c, d, a, words[i + 15] | 0, 22, 1236535329)

    a = gg(a, b, c, d, words[i + 1] | 0, 5, -165796510)
    d = gg(d, a, b, c, words[i + 6] | 0, 9, -1069501632)
    c = gg(c, d, a, b, words[i + 11] | 0, 14, 643717713)
    b = gg(b, c, d, a, words[i + 0] | 0, 20, -373897302)
    a = gg(a, b, c, d, words[i + 5] | 0, 5, -701558691)
    d = gg(d, a, b, c, words[i + 10] | 0, 9, 38016083)
    c = gg(c, d, a, b, words[i + 15] | 0, 14, -660478335)
    b = gg(b, c, d, a, words[i + 4] | 0, 20, -405537848)
    a = gg(a, b, c, d, words[i + 9] | 0, 5, 568446438)
    d = gg(d, a, b, c, words[i + 14] | 0, 9, -1019803690)
    c = gg(c, d, a, b, words[i + 3] | 0, 14, -187363961)
    b = gg(b, c, d, a, words[i + 8] | 0, 20, 1163531501)
    a = gg(a, b, c, d, words[i + 13] | 0, 5, -1444681467)
    d = gg(d, a, b, c, words[i + 2] | 0, 9, -51403784)
    c = gg(c, d, a, b, words[i + 7] | 0, 14, 1735328473)
    b = gg(b, c, d, a, words[i + 12] | 0, 20, -1926607734)

    a = hh(a, b, c, d, words[i + 5] | 0, 4, -378558)
    d = hh(d, a, b, c, words[i + 8] | 0, 11, -2022574463)
    c = hh(c, d, a, b, words[i + 11] | 0, 16, 1839030562)
    b = hh(b, c, d, a, words[i + 14] | 0, 23, -35309556)
    a = hh(a, b, c, d, words[i + 1] | 0, 4, -1530992060)
    d = hh(d, a, b, c, words[i + 4] | 0, 11, 1272893353)
    c = hh(c, d, a, b, words[i + 7] | 0, 16, -155497632)
    b = hh(b, c, d, a, words[i + 10] | 0, 23, -1094730640)
    a = hh(a, b, c, d, words[i + 13] | 0, 4, 681279174)
    d = hh(d, a, b, c, words[i + 0] | 0, 11, -358537222)
    c = hh(c, d, a, b, words[i + 3] | 0, 16, -722521979)
    b = hh(b, c, d, a, words[i + 6] | 0, 23, 76029189)
    a = hh(a, b, c, d, words[i + 9] | 0, 4, -640364487)
    d = hh(d, a, b, c, words[i + 12] | 0, 11, -421815835)
    c = hh(c, d, a, b, words[i + 15] | 0, 16, 530742520)
    b = hh(b, c, d, a, words[i + 2] | 0, 23, -995338651)

    a = ii(a, b, c, d, words[i + 0] | 0, 6, -198630844)
    d = ii(d, a, b, c, words[i + 7] | 0, 10, 1126891415)
    c = ii(c, d, a, b, words[i + 14] | 0, 15, -1416354905)
    b = ii(b, c, d, a, words[i + 5] | 0, 21, -57434055)
    a = ii(a, b, c, d, words[i + 12] | 0, 6, 1700485571)
    d = ii(d, a, b, c, words[i + 3] | 0, 10, -1894986606)
    c = ii(c, d, a, b, words[i + 10] | 0, 15, -1051523)
    b = ii(b, c, d, a, words[i + 1] | 0, 21, -2054922799)
    a = ii(a, b, c, d, words[i + 8] | 0, 6, 1873313359)
    d = ii(d, a, b, c, words[i + 15] | 0, 10, -30611744)
    c = ii(c, d, a, b, words[i + 6] | 0, 15, -1560198380)
    b = ii(b, c, d, a, words[i + 13] | 0, 21, 1309151649)
    a = ii(a, b, c, d, words[i + 4] | 0, 6, -145523070)
    d = ii(d, a, b, c, words[i + 11] | 0, 10, -1120210379)
    c = ii(c, d, a, b, words[i + 2] | 0, 15, 718787259)
    b = ii(b, c, d, a, words[i + 9] | 0, 21, -343485551)

    a = (a + oa) | 0
    b = (b + ob) | 0
    c = (c + oc) | 0
    d = (d + od) | 0
  }

  const toHexLE = (n: number) => {
    const hex = (n >>> 0).toString(16).padStart(8, '0')
    return hex.match(/../g)!.reverse().join('')
  }

  return (toHexLE(a) + toHexLE(b) + toHexLE(c) + toHexLE(d)).toLowerCase()
}

async function md5Hex(str: string): Promise<string> {
  return md5HexSync(str)
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
