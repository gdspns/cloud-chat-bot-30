import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// MD5 算法实现
const md5 = (function() {
  const safe_add = (x: number, y: number) => {
    const lsw = (x & 0xFFFF) + (y & 0xFFFF);
    const msw = (x >> 16) + (y >> 16) + (lsw >> 16);
    return (msw << 16) | (lsw & 0xFFFF);
  };
  
  const bit_rol = (num: number, cnt: number) => (num << cnt) | (num >>> (32 - cnt));
  
  const md5_cmn = (q: number, a: number, b: number, x: number, s: number, t: number) => safe_add(bit_rol(safe_add(safe_add(a, q), safe_add(x, t)), s), b);
  const md5_ff = (a: number, b: number, c: number, d: number, x: number, s: number, t: number) => md5_cmn((b & c) | ((~b) & d), a, b, x, s, t);
  const md5_gg = (a: number, b: number, c: number, d: number, x: number, s: number, t: number) => md5_cmn((b & d) | (c & (~d)), a, b, x, s, t);
  const md5_hh = (a: number, b: number, c: number, d: number, x: number, s: number, t: number) => md5_cmn(b ^ c ^ d, a, b, x, s, t);
  const md5_ii = (a: number, b: number, c: number, d: number, x: number, s: number, t: number) => md5_cmn(c ^ (b | (~d)), a, b, x, s, t);

  const core_md5 = (x: number[], len: number) => {
    x[len >> 5] |= 0x80 << ((len) % 32);
    x[(((len + 64) >>> 9) << 4) + 14] = len;

    let a = 1732584193;
    let b = -271733879;
    let c = -1732584194;
    let d = 271733878;

    for (let i = 0; i < x.length; i += 16) {
      const olda = a;
      const oldb = b;
      const oldc = c;
      const oldd = d;

      a = md5_ff(a, b, c, d, x[i + 0], 7, -680876936);
      d = md5_ff(d, a, b, c, x[i + 1], 12, -389564586);
      c = md5_ff(c, d, a, b, x[i + 2], 17, 606105819);
      b = md5_ff(b, c, d, a, x[i + 3], 22, -1044525330);
      a = md5_ff(a, b, c, d, x[i + 4], 7, -176418897);
      d = md5_ff(d, a, b, c, x[i + 5], 12, 1200080426);
      c = md5_ff(c, d, a, b, x[i + 6], 17, -1473231341);
      b = md5_ff(b, c, d, a, x[i + 7], 22, -45705983);
      a = md5_ff(a, b, c, d, x[i + 8], 7, 1770035416);
      d = md5_ff(d, a, b, c, x[i + 9], 12, -1958414417);
      c = md5_ff(c, d, a, b, x[i + 10], 17, -42063);
      b = md5_ff(b, c, d, a, x[i + 11], 22, -1990404162);
      a = md5_ff(a, b, c, d, x[i + 12], 7, 1804603682);
      d = md5_ff(d, a, b, c, x[i + 13], 12, -40341101);
      c = md5_ff(c, d, a, b, x[i + 14], 17, -1502002290);
      b = md5_ff(b, c, d, a, x[i + 15], 22, 1236535329);

      a = md5_gg(a, b, c, d, x[i + 1], 5, -165796510);
      d = md5_gg(d, a, b, c, x[i + 6], 9, -1069501632);
      c = md5_gg(c, d, a, b, x[i + 11], 14, 643717713);
      b = md5_gg(b, c, d, a, x[i + 0], 20, -373897302);
      a = md5_gg(a, b, c, d, x[i + 5], 5, -701558691);
      d = md5_gg(d, a, b, c, x[i + 10], 9, 38016083);
      c = md5_gg(c, d, a, b, x[i + 15], 14, -660478335);
      b = md5_gg(b, c, d, a, x[i + 4], 20, -405537848);
      a = md5_gg(a, b, c, d, x[i + 9], 5, 568446438);
      d = md5_gg(d, a, b, c, x[i + 14], 9, -1019803690);
      c = md5_gg(c, d, a, b, x[i + 3], 14, -187363961);
      b = md5_gg(b, c, d, a, x[i + 8], 20, 1163531501);
      a = md5_gg(a, b, c, d, x[i + 13], 5, -1444681467);
      d = md5_gg(d, a, b, c, x[i + 2], 9, -51403784);
      c = md5_gg(c, d, a, b, x[i + 7], 14, 1735328473);
      b = md5_gg(b, c, d, a, x[i + 12], 20, -1926607734);

      a = md5_hh(a, b, c, d, x[i + 5], 4, -378558);
      d = md5_hh(d, a, b, c, x[i + 8], 11, -2022574463);
      c = md5_hh(c, d, a, b, x[i + 11], 16, 1839030562);
      b = md5_hh(b, c, d, a, x[i + 14], 23, -35309556);
      a = md5_hh(a, b, c, d, x[i + 1], 4, -1530992060);
      d = md5_hh(d, a, b, c, x[i + 4], 11, 1272893353);
      c = md5_hh(c, d, a, b, x[i + 7], 16, -155497632);
      b = md5_hh(b, c, d, a, x[i + 10], 23, -1094730640);
      a = md5_hh(a, b, c, d, x[i + 13], 4, 681279174);
      d = md5_hh(d, a, b, c, x[i + 0], 11, -358537222);
      c = md5_hh(c, d, a, b, x[i + 3], 16, -722521979);
      b = md5_hh(b, c, d, a, x[i + 6], 23, 76029189);
      a = md5_hh(a, b, c, d, x[i + 9], 4, -640364487);
      d = md5_hh(d, a, b, c, x[i + 12], 11, -421815835);
      c = md5_hh(c, d, a, b, x[i + 15], 16, 530742520);
      b = md5_hh(b, c, d, a, x[i + 2], 23, -995338651);

      a = md5_ii(a, b, c, d, x[i + 0], 6, -198630844);
      d = md5_ii(d, a, b, c, x[i + 7], 10, 1126891415);
      c = md5_ii(c, d, a, b, x[i + 14], 15, -1416354905);
      b = md5_ii(b, c, d, a, x[i + 5], 21, -57434055);
      a = md5_ii(a, b, c, d, x[i + 12], 6, 1700485571);
      d = md5_ii(d, a, b, c, x[i + 3], 10, -1894986606);
      c = md5_ii(c, d, a, b, x[i + 10], 15, -1051523);
      b = md5_ii(b, c, d, a, x[i + 1], 21, -2054922799);
      a = md5_ii(a, b, c, d, x[i + 8], 6, 1873313359);
      d = md5_ii(d, a, b, c, x[i + 15], 10, -30611744);
      c = md5_ii(c, d, a, b, x[i + 6], 15, -1560198380);
      b = md5_ii(b, c, d, a, x[i + 13], 21, 1309151649);
      a = md5_ii(a, b, c, d, x[i + 4], 6, -145523070);
      d = md5_ii(d, a, b, c, x[i + 11], 10, -1120210379);
      c = md5_ii(c, d, a, b, x[i + 2], 15, 718787259);
      b = md5_ii(b, c, d, a, x[i + 9], 21, -343485551);

      a = safe_add(a, olda);
      b = safe_add(b, oldb);
      c = safe_add(c, oldc);
      d = safe_add(d, oldd);
    }
    return [a, b, c, d];
  };

  const str2binl = (str: string) => {
    const bin: number[] = [];
    const mask = (1 << 8) - 1;
    for (let i = 0; i < str.length * 8; i += 8) {
      bin[i >> 5] |= (str.charCodeAt(i / 8) & mask) << (i % 32);
    }
    return bin;
  };

  const binl2hex = (binarray: number[]) => {
    const hex_tab = "0123456789abcdef";
    let str = "";
    for (let i = 0; i < binarray.length * 4; i++) {
      str += hex_tab.charAt((binarray[i >> 2] >> ((i % 4) * 8 + 4)) & 0xF) +
             hex_tab.charAt((binarray[i >> 2] >> ((i % 4) * 8)) & 0xF);
    }
    return str;
  };

  return (str: string) => binl2hex(core_md5(str2binl(str), str.length * 8));
})();

interface PaymentRequest {
  orderId: string;
  amount: number;
  paymentMethod: 'wechat' | 'alipay';
  gateway?: string;
}

serve(async (req) => {
  // 处理 CORS 预检请求
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { orderId, amount, paymentMethod, gateway } = await req.json() as PaymentRequest;

    // 验证必要参数
    if (!orderId || !amount || !paymentMethod) {
      return new Response(
        JSON.stringify({ error: '缺少必要参数: orderId, amount, paymentMethod' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 从环境变量获取密钥
    const wechatAppId = Deno.env.get('HUPI_WECHAT_APPID') || '';
    const wechatSecret = Deno.env.get('HUPI_WECHAT_SECRET') || '';
    const alipayAppId = Deno.env.get('HUPI_ALIPAY_APPID') || '';
    const alipaySecret = Deno.env.get('HUPI_ALIPAY_SECRET') || '';

    const appId = paymentMethod === 'wechat' ? wechatAppId : alipayAppId;
    const secret = paymentMethod === 'wechat' ? wechatSecret : alipaySecret;

    if (!appId.trim() || !secret.trim()) {
      return new Response(
        JSON.stringify({ error: `${paymentMethod === 'wechat' ? '微信' : '支付宝'}支付未配置` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 构建支付参数
    const params: Record<string, string | number> = {
      version: '1.1',
      appid: appId.trim(),
      trade_order_id: orderId,
      total_fee: amount,
      title: '在线支付',
      time: Math.floor(Date.now() / 1000),
      nonce_str: Math.random().toString(36).substr(2, 15),
    };

    // 按键名排序并生成签名字符串
    const sortedKeys = Object.keys(params).sort();
    let signStr = '';
    sortedKeys.forEach(key => {
      signStr += key + '=' + params[key] + '&';
    });
    
    // 生成 MD5 签名
    const hash = md5(signStr.slice(0, -1) + secret.trim());

    // 构建最终 URL
    const gatewayUrl = gateway || 'https://api.xunhupay.com/payment/do.html';
    const queryString = new URLSearchParams({
      ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
      hash
    }).toString();
    
    const payUrl = `${gatewayUrl}?${queryString}`;

    console.log(`[create-payment-url] 生成支付链接成功: orderId=${orderId}, method=${paymentMethod}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        payUrl,
        orderId,
        amount,
        paymentMethod
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[create-payment-url] 错误:', error);
    return new Response(
      JSON.stringify({ error: '生成支付链接失败', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
