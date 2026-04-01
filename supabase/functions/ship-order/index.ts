import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { orderNo, trackingNumber } = await req.json();

    if (!orderNo) {
      return new Response(JSON.stringify({ error: "Missing orderNo" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 获取订单信息
    const { data: order, error: orderError } = await supabase
      .from("shop_orders")
      .select("*")
      .eq("order_no", orderNo)
      .maybeSingle();

    if (orderError || !order) {
      return new Response(JSON.stringify({ error: "Order not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!order.telegram_chat_id) {
      return new Response(JSON.stringify({ error: "No chat ID for this order" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 更新订单状态为 shipped
    await supabase
      .from("shop_orders")
      .update({ status: "shipped", delivered_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("order_no", orderNo);

    // 构建通知消息
    let message = `📦 **您的订单已发货！**\n\n`;
    message += `📝 订单号: \`${order.order_no}\`\n`;
    message += `🛍️ 商品: ${order.product_name}\n`;
    if (trackingNumber) {
      message += `🚚 快递单号: \`${trackingNumber}\`\n`;
    }
    message += `\n如有疑问请联系客服 🙏`;

    // 发送 Telegram 通知给买家
    const sendResponse = await fetch(
      `https://api.telegram.org/bot${order.bot_token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: order.telegram_chat_id,
          text: message,
          parse_mode: "Markdown",
        }),
      }
    );

    const sendResult = await sendResponse.json();
    console.log("Ship notification result:", sendResult);

    return new Response(
      JSON.stringify({ ok: true, messageSent: sendResult.ok }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Ship order error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
