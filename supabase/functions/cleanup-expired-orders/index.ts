import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// 发送 Telegram API 请求
async function sendTelegramRequest(botToken: string, method: string, params: Record<string, any>) {
  const url = `https://api.telegram.org/bot${botToken}/${method}`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    return await response.json();
  } catch (error) {
    console.error(`Telegram API error (${method}):`, error);
    return { ok: false, error };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('[Cleanup] Starting expired orders cleanup...');

    // 查找所有过期的待付款订单
    const { data: expiredOrders, error: fetchError } = await supabase
      .from('shop_orders')
      .select('*')
      .eq('status', 'pending')
      .lt('expires_at', new Date().toISOString())
      .not('telegram_message_id', 'is', null)
      .not('telegram_chat_id', 'is', null);

    if (fetchError) {
      console.error('[Cleanup] Error fetching expired orders:', fetchError);
      throw fetchError;
    }

    console.log(`[Cleanup] Found ${expiredOrders?.length || 0} expired orders`);

    let deletedMessages = 0;
    let cancelledOrders = 0;

    // 按 bot_token 分组处理
    const ordersByBot = new Map<string, typeof expiredOrders>();
    for (const order of expiredOrders || []) {
      const existing = ordersByBot.get(order.bot_token) || [];
      existing.push(order);
      ordersByBot.set(order.bot_token, existing);
    }

    for (const [botToken, orders] of ordersByBot) {
      for (const order of orders) {
        // 尝试删除 Telegram 消息 (包括二维码消息)
        if (order.telegram_chat_id) {
          // 先删除二维码消息
          if (order.telegram_qr_message_id) {
            const qrDeleteResult = await sendTelegramRequest(botToken, 'deleteMessage', {
              chat_id: order.telegram_chat_id,
              message_id: order.telegram_qr_message_id,
            });
            if (qrDeleteResult.ok) {
              deletedMessages++;
              console.log(`[Cleanup] Deleted QR message ${order.telegram_qr_message_id} for order ${order.order_no}`);
            } else {
              console.log(`[Cleanup] Failed to delete QR message for order ${order.order_no}:`, qrDeleteResult);
            }
          }
          
          // 再删除订单详情消息
          if (order.telegram_message_id) {
            const deleteResult = await sendTelegramRequest(botToken, 'deleteMessage', {
              chat_id: order.telegram_chat_id,
              message_id: order.telegram_message_id,
            });
            
            if (deleteResult.ok) {
              deletedMessages++;
              console.log(`[Cleanup] Deleted message ${order.telegram_message_id} for order ${order.order_no}`);
            } else {
              console.log(`[Cleanup] Failed to delete message for order ${order.order_no}:`, deleteResult);
            }
          }
        }

        // 更新订单状态为已取消
        const { error: updateError } = await supabase
          .from('shop_orders')
          .update({ status: 'cancelled' })
          .eq('id', order.id);

        if (!updateError) {
          cancelledOrders++;
          
          // 发送订单取消通知
          await sendTelegramRequest(botToken, 'sendMessage', {
            chat_id: order.telegram_chat_id,
            text: `⏰ 订单已过期\n\n订单号: ${order.order_no}\n商品: ${order.product_name}\n\n该订单因超过30分钟未支付已自动取消。如需购买请重新下单。`,
            parse_mode: 'Markdown',
          });
        }
      }
    }

    console.log(`[Cleanup] Completed: ${cancelledOrders} orders cancelled, ${deletedMessages} messages deleted`);

    return new Response(
      JSON.stringify({
        success: true,
        cancelled: cancelledOrders,
        messagesDeleted: deletedMessages,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[Cleanup] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
