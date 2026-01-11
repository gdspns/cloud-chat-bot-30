import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface KeyboardConfig {
  bot_token: string;
  auto_cleanup_enabled: boolean;
  auto_cleanup_days: number;
  last_cleanup_at: string | null;
}

// 发送Telegram消息删除请求
async function deleteTelegramMessage(botToken: string, chatId: number, messageId: number) {
  const url = `https://api.telegram.org/bot${botToken}/deleteMessage`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, message_id: messageId }),
    });
    return await response.json();
  } catch (error) {
    console.error(`Failed to delete message ${messageId} in chat ${chatId}:`, error);
    return { ok: false, error };
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Starting message cleanup job...');

    // 获取所有开启了自动清理的机器人配置
    const { data: configs, error: configError } = await supabase
      .from('keyboard_configs')
      .select('bot_token, auto_cleanup_enabled, auto_cleanup_days, last_cleanup_at')
      .eq('auto_cleanup_enabled', true)
      .gt('auto_cleanup_days', 0);

    if (configError) {
      console.error('Failed to fetch configs:', configError);
      throw configError;
    }

    console.log(`Found ${configs?.length || 0} bots with cleanup enabled`);

    const results: { bot_token: string; deleted_count: number; telegram_deleted: number; error?: string }[] = [];

    for (const config of configs || []) {
      const { bot_token, auto_cleanup_days } = config as KeyboardConfig;
      console.log(`Processing bot ${bot_token.slice(-8)}, cleanup days: ${auto_cleanup_days}`);

      try {
        // 获取该机器人的所有用户（从 bot_users 表）
        const { data: users, error: usersError } = await supabase
          .from('bot_users')
          .select('telegram_user_id')
          .eq('bot_token', bot_token);

        if (usersError) {
          console.error(`Failed to fetch users for bot ${bot_token.slice(-8)}:`, usersError);
          results.push({ bot_token: bot_token.slice(-8), deleted_count: 0, telegram_deleted: 0, error: usersError.message });
          continue;
        }

        console.log(`Found ${users?.length || 0} users for bot ${bot_token.slice(-8)}`);

        // 获取该机器人的 bot_activation_id（用于关联 messages 表）
        const { data: activation } = await supabase
          .from('bot_activations')
          .select('id')
          .eq('bot_token', bot_token)
          .maybeSingle();

        const activationId = activation?.id;
        console.log(`Bot activation ID: ${activationId || 'not found'}`);

        // 计算截止日期
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - auto_cleanup_days);
        const cutoffDateStr = cutoffDate.toISOString();

        console.log(`Cutoff date: ${cutoffDateStr}`);

        let totalDeleted = 0;
        let telegramDeleted = 0;

        // 遍历每个用户，删除过期消息
        for (const user of users || []) {
          const chatId = user.telegram_user_id;

          // 如果有 activation，从 messages 表获取该用户需要删除的消息
          if (activationId) {
            const { data: messages, error: msgError } = await supabase
              .from('messages')
              .select('id, telegram_message_id, telegram_chat_id')
              .eq('bot_activation_id', activationId)
              .eq('telegram_chat_id', chatId)
              .lt('created_at', cutoffDateStr);

            if (msgError) {
              console.error(`Failed to fetch messages for chat ${chatId}:`, msgError);
              continue;
            }

            if (messages && messages.length > 0) {
              console.log(`Found ${messages.length} messages to delete for chat ${chatId}`);

              // 尝试从Telegram删除消息
              for (const msg of messages) {
                if (msg.telegram_message_id) {
                  const result = await deleteTelegramMessage(bot_token, chatId, msg.telegram_message_id);
                  if (result.ok) {
                    console.log(`Deleted Telegram message ${msg.telegram_message_id} in chat ${chatId}`);
                    telegramDeleted++;
                  }
                  // 无论Telegram删除是否成功，都延迟一下避免频率限制
                  await new Promise(r => setTimeout(r, 50));
                }
              }

              // 从数据库删除消息记录
              const messageIds = messages.map(m => m.id);
              const { error: deleteError } = await supabase
                .from('messages')
                .delete()
                .in('id', messageIds);

              if (deleteError) {
                console.error(`Failed to delete messages from DB for chat ${chatId}:`, deleteError);
              } else {
                totalDeleted += messages.length;
                console.log(`Deleted ${messages.length} messages from DB for chat ${chatId}`);
              }
            }
          }

          // 即使没有 activation（菜单键盘独立运行），也尝试直接在 Telegram 删除最近的消息
          // 注意：由于菜单键盘模式下消息不保存到数据库，需要使用 Telegram API 的其他方法
          // 但 Telegram 不支持批量获取历史消息，这里跳过此情况
        }

        // 更新最后清理时间
        await supabase
          .from('keyboard_configs')
          .update({ last_cleanup_at: new Date().toISOString() })
          .eq('bot_token', bot_token);

        results.push({ 
          bot_token: bot_token.slice(-8), 
          deleted_count: totalDeleted,
          telegram_deleted: telegramDeleted
        });
        console.log(`Bot ${bot_token.slice(-8)} cleanup complete, deleted ${totalDeleted} DB records, ${telegramDeleted} Telegram messages`);

      } catch (error: any) {
        console.error(`Error processing bot ${bot_token.slice(-8)}:`, error);
        results.push({ bot_token: bot_token.slice(-8), deleted_count: 0, telegram_deleted: 0, error: error.message });
      }
    }

    console.log('Cleanup job complete', JSON.stringify(results));

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Cleanup completed',
        results 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error: any) {
    console.error('Cleanup job failed:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
