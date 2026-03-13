import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('[AutoRefresh] Starting auto-refresh webhooks check...');

    // 查找所有启用了自动刷新的活跃机器人
    const { data: bots, error: fetchError } = await supabase
      .from('bot_activations')
      .select('id, bot_token, auto_refresh_interval, last_auto_refresh_at')
      .eq('auto_refresh_webhook', true)
      .eq('is_active', true);

    if (fetchError) {
      console.error('[AutoRefresh] Error fetching bots:', fetchError);
      throw fetchError;
    }

    if (!bots || bots.length === 0) {
      console.log('[AutoRefresh] No bots with auto-refresh enabled');
      return new Response(
        JSON.stringify({ ok: true, refreshed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const now = new Date();
    let refreshedCount = 0;

    for (const bot of bots) {
      const interval = bot.auto_refresh_interval || 60; // 默认60秒
      const lastRefresh = bot.last_auto_refresh_at ? new Date(bot.last_auto_refresh_at) : null;

      // 检查是否到了需要刷新的时间
      if (lastRefresh) {
        const elapsedSeconds = (now.getTime() - lastRefresh.getTime()) / 1000;
        if (elapsedSeconds < interval) {
          continue; // 还没到刷新时间，跳过
        }
      }

      try {
        // 设置webhook
        const webhookUrl = `${supabaseUrl}/functions/v1/telegram-webhook/${bot.bot_token}`;
        const response = await fetch(`https://api.telegram.org/bot${bot.bot_token}/setWebhook`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: webhookUrl }),
        });

        const result = await response.json();

        if (result.ok) {
          // 更新最后刷新时间
          await supabase
            .from('bot_activations')
            .update({ last_auto_refresh_at: now.toISOString() })
            .eq('id', bot.id);

          refreshedCount++;
          console.log(`[AutoRefresh] Refreshed webhook for bot ${bot.bot_token.split(':')[0]}`);
        } else {
          console.error(`[AutoRefresh] Failed to set webhook for bot ${bot.bot_token.split(':')[0]}:`, result.description);
        }
      } catch (err) {
        console.error(`[AutoRefresh] Error refreshing bot ${bot.bot_token.split(':')[0]}:`, err);
      }
    }

    console.log(`[AutoRefresh] Completed: ${refreshedCount}/${bots.length} bots refreshed`);

    return new Response(
      JSON.stringify({ ok: true, total: bots.length, refreshed: refreshedCount }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[AutoRefresh] Error:', error);
    return new Response(
      JSON.stringify({ ok: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
