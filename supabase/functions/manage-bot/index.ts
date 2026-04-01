import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Admin-only actions that require role verification
const ADMIN_ACTIONS = [
  'create',
  'admin-authorize',
  'admin-send-message',
  'list-codes',
  'list-all-messages',
  'generate-codes',
  'toggle-user-disabled',
  'list-disabled-users',
  'list-users',
  'list',
  'admin-delete', // 管理员删除
  'toggle',
  'extend',
  'toggle-port',
  'cleanup-expired-trials',
  'admin-toggle-chat',
  'admin-toggle-keyboard',
  'admin-set-chat-expire',
  'admin-set-keyboard-expire',
  'admin-bind-chat-code',
  'admin-bind-keyboard-code',
  'admin-toggle-shop',
  'admin-set-shop-expire',
  'admin-bind-shop-code',
];

// Helper function to verify admin role with retry logic
async function verifyAdminRole(req: Request, supabase: any): Promise<{ isAdmin: boolean; userId: string | null; error?: string }> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { isAdmin: false, userId: null, error: '未提供认证信息' };
  }

  const token = authHeader.replace('Bearer ', '');

  // Verify the JWT using getUser
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);

  if (userError || !user) {
    console.error('getUser error:', userError);
    return { isAdmin: false, userId: null, error: '无效的认证令牌' };
  }

  const userId = user.id;

  // Check if user has admin role using the has_role function with retry
  let lastError: any = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const { data: hasRole, error: roleError } = await supabase.rpc('has_role', {
        _user_id: userId,
        _role: 'admin'
      });

      if (!roleError) {
        console.log('Admin verified:', userId);
        return { isAdmin: hasRole === true, userId };
      }
      
      lastError = roleError;
      console.error(`Role check attempt ${attempt + 1} failed:`, roleError);
      
      // Wait before retry (exponential backoff)
      if (attempt < 2) {
        await new Promise(r => setTimeout(r, 100 * (attempt + 1)));
      }
    } catch (e) {
      lastError = e;
      console.error(`Role check attempt ${attempt + 1} exception:`, e);
      if (attempt < 2) {
        await new Promise(r => setTimeout(r, 100 * (attempt + 1)));
      }
    }
  }

  console.log('Admin verification failed:', { userId, error: '角色验证失败' });
  return { isAdmin: false, userId, error: '角色验证失败' };
}

// Helper function to verify a normal authenticated user
async function verifyUser(req: Request, supabase: any): Promise<{ userId: string | null; error?: string }> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { userId: null, error: '未提供认证信息' };
  }

  const token = authHeader.replace('Bearer ', '');
  
  // Skip if token looks like an anon/service key (not a user JWT)
  // User JWTs have 3 dot-separated parts and contain user-specific claims
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    // Anon keys have role "anon" and no "sub" with user UUID pattern
    if (payload.role === 'anon' && !payload.email) {
      return { userId: null, error: '用户未登录' };
    }
  } catch {
    // If we can't parse, let getUser handle it
  }

  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user) {
    console.error('getUser error in verifyUser:', userError);
    return { userId: null, error: '无效的认证令牌' };
  }

  return { userId: user.id };
}

/**
 * 同步激活码到商城卡密库存
 * 当激活码被手动激活时，如果该激活码也存在于 store_card_keys 表中，
 * 需要同步标记为已使用，以确保商品库存准确
 */
async function syncActivationCodeToStoreKeys(
  supabase: any,
  activationCode: string,
  botToken: string
) {
  try {
    // 检查该激活码是否也存在于 store_card_keys 表中
    const { data: storeKey, error: queryError } = await supabase
      .from('store_card_keys')
      .select('id, is_used')
      .eq('card_key', activationCode)
      .eq('is_used', false)
      .maybeSingle();

    if (queryError) {
      console.log('[Sync Store Keys] 查询失败:', queryError.message);
      return;
    }

    // 如果找到未使用的卡密，标记为已使用
    if (storeKey) {
      const { error: updateError } = await supabase
        .from('store_card_keys')
        .update({
          is_used: true,
          order_id: `manual_activation_${botToken.slice(-8)}`,
          updated_at: new Date().toISOString()
        })
        .eq('id', storeKey.id);

      if (updateError) {
        console.log('[Sync Store Keys] 更新失败:', updateError.message);
      } else {
        console.log(`[Sync Store Keys] 已同步标记卡密为已使用: ${activationCode}`);
      }
    } else {
      console.log('[Sync Store Keys] 该激活码不在商城库存中，无需同步');
    }
  } catch (e) {
    console.log('[Sync Store Keys] 同步异常:', e);
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { action, ...params } = await req.json();
    console.log('Manage bot action:', action, params);

    // Check if this action requires admin role
    if (ADMIN_ACTIONS.includes(action)) {
      const { isAdmin, userId, error } = await verifyAdminRole(req, supabase);
      
      if (!isAdmin) {
        console.log('Admin verification failed:', { userId, error });
        return new Response(JSON.stringify({ 
          ok: false, 
          error: error || '您没有管理员权限执行此操作' 
        }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      console.log('Admin verified:', userId);
    }

    switch (action) {
      // 管理员创建授权
      case 'create': {
        const { botToken, personalUserId, greetingMessage, expireAt } = params;
        
        // Generate unique activation code
        const activationCode = crypto.randomUUID().substring(0, 8);
        
        const { data, error } = await supabase
          .from('bot_activations')
          .insert({
            bot_token: botToken,
            personal_user_id: personalUserId,
            greeting_message: greetingMessage || '你好！👋 有什么可以帮助你的吗？',
            activation_code: activationCode,
            expire_at: expireAt,
            is_active: false,
            is_authorized: false,
          })
          .select()
          .single();

        if (error) {
          console.error('Create error:', error);
          return new Response(JSON.stringify({ ok: false, error: error.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        return new Response(JSON.stringify({ ok: true, data }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 用户添加机器人（前端使用 add，兼容 create-trial）
      case 'add':
      case 'create-trial': {
        const { botToken, personalUserId, greetingMessage, userId } = params;
        
        // 检查试用记录 - 该令牌的历史使用情况
        const { data: trialRecord } = await supabase
          .from('bot_trial_records')
          .select('*')
          .eq('bot_token', botToken)
          .maybeSingle();

        // 检查是否已存在于bot_activations
        const { data: existing } = await supabase
          .from('bot_activations')
          .select('*')
          .eq('bot_token', botToken)
          .maybeSingle();

        if (existing) {
          // 构建需要更新的字段
          const updatePayload: Record<string, any> = {};
          
          // 如果已存在且 user_id 为空，但当前有用户登录，则更新 user_id
          if (!existing.user_id && userId) {
            updatePayload.user_id = userId;
          }
          
          // 如果试用期机器人 is_active 为 false，且试用次数未用完，自动恢复为活跃状态
          const trialExceeded = !existing.is_authorized && existing.trial_messages_used >= existing.trial_limit;
          const isExpired = existing.expire_at && new Date(existing.expire_at) < new Date();
          if (!existing.is_active && !trialExceeded && !isExpired) {
            updatePayload.is_active = true;
          }
          
          // 更新个人用户ID和欢迎语（如果提供了新值）
          if (personalUserId && personalUserId !== existing.personal_user_id) {
            updatePayload.personal_user_id = personalUserId;
          }
          if (greetingMessage && greetingMessage !== existing.greeting_message) {
            updatePayload.greeting_message = greetingMessage;
          }
          
          if (Object.keys(updatePayload).length > 0) {
            const { data: updatedBot, error: updateError } = await supabase
              .from('bot_activations')
              .update(updatePayload)
              .eq('id', existing.id)
              .select()
              .single();
            
            if (!updateError && updatedBot) {
              // 如果恢复了活跃状态，重新设置webhook
              if (updatePayload.is_active) {
                const webhookUrl = `${supabaseUrl}/functions/v1/telegram-webhook/${botToken}`;
                await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ url: webhookUrl }),
                });
              }
              return new Response(JSON.stringify({ ok: true, data: updatedBot, existed: true, claimed: !!updatePayload.user_id }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              });
            }
          }
          
          // 已存在且无需更新，返回现有数据
          return new Response(JSON.stringify({ ok: true, data: existing, existed: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        // 如果之前有试用记录且已授权过的机器人被删除重新添加，恢复授权状态
        if (trialRecord && trialRecord.was_authorized) {
          const activationCode = 'restored-' + crypto.randomUUID().substring(0, 8);
          
          const { data, error } = await supabase
            .from('bot_activations')
            .insert({
              bot_token: botToken,
              personal_user_id: personalUserId,
              greeting_message: greetingMessage || '你好！👋 有什么可以帮助你的吗？',
              activation_code: activationCode,
              is_active: true,
              is_authorized: true,
              expire_at: trialRecord.last_authorized_expire_at,
              trial_limit: 20,
              trial_messages_used: 0,
              user_id: userId || null,
            })
            .select()
            .single();

          if (error) {
            console.error('Restore bot error:', error);
            return new Response(JSON.stringify({ ok: false, error: error.message }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }

          // 设置webhook - 使用bot token作为路径
          const webhookUrl = `${supabaseUrl}/functions/v1/telegram-webhook/${botToken}`;
          await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: webhookUrl }),
          });

          return new Response(JSON.stringify({ ok: true, data, restored: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        // 检查是否被封禁（试用完成但未激活）
        if (trialRecord && trialRecord.is_blocked) {
          // 创建一个试用完成的记录
          const activationCode = 'trial-' + crypto.randomUUID().substring(0, 8);
          
          const { data, error } = await supabase
            .from('bot_activations')
            .insert({
              bot_token: botToken,
              personal_user_id: personalUserId,
              greeting_message: greetingMessage || '你好！👋 有什么可以帮助你的吗？',
              activation_code: activationCode,
              is_active: false,
              is_authorized: false,
              trial_limit: 20,
              trial_messages_used: 20, // 直接设置为试用上限
              user_id: userId || null,
            })
            .select()
            .single();

          if (error) {
            console.error('Create blocked bot error:', error);
            return new Response(JSON.stringify({ ok: false, error: error.message }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }

          return new Response(JSON.stringify({ ok: true, data, blocked: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        // 创建新的试用机器人
        const activationCode = 'trial-' + crypto.randomUUID().substring(0, 8);
        const trialMessagesUsed = trialRecord ? trialRecord.messages_used : 0;
        
        const { data, error } = await supabase
          .from('bot_activations')
          .insert({
            bot_token: botToken,
            personal_user_id: personalUserId,
            greeting_message: greetingMessage || '你好！👋 有什么可以帮助你的吗？',
            activation_code: activationCode,
            is_active: true,
            is_authorized: false,
            trial_limit: 20,
            trial_messages_used: trialMessagesUsed,
            user_id: userId || null,
          })
          .select()
          .single();

        if (error) {
          console.error('Create trial bot error:', error);
          return new Response(JSON.stringify({ ok: false, error: error.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // 创建或更新试用记录
        if (!trialRecord) {
          await supabase
            .from('bot_trial_records')
            .insert({
              bot_token: botToken,
              messages_used: 0,
              is_blocked: false,
            });
        }

        // 设置webhook - 使用bot token作为路径
        const webhookUrl = `${supabaseUrl}/functions/v1/telegram-webhook/${botToken}`;
        await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: webhookUrl }),
        });

        return new Response(JSON.stringify({ ok: true, data }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 确保机器人出现在管理员后台列表（用于菜单键盘/TG商城等只写配置表的场景）
      case 'ensure-bot-listing': {
        const { botToken, personalUserId } = params;

        if (!botToken) {
          return new Response(JSON.stringify({ ok: false, error: 'botToken is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const { userId, error: userError } = await verifyUser(req, supabase);
        if (!userId) {
          // User not logged in - silently succeed since this is a non-critical sync operation
          console.log('ensure-bot-listing: user not logged in, skipping');
          return new Response(JSON.stringify({ ok: true, skipped: true, reason: userError || '未登录' }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // 如果已存在：尽量补齐归属（user_id）
        const { data: existing } = await supabase
          .from('bot_activations')
          .select('id, user_id')
          .eq('bot_token', botToken)
          .maybeSingle();

        if (existing?.id) {
          if (!existing.user_id) {
            await supabase
              .from('bot_activations')
              .update({ user_id: userId })
              .eq('id', existing.id);
          }

          return new Response(JSON.stringify({ ok: true, existed: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // 以试用模式创建机器人（在线可测试），不自动授权
        const activationCode = 'trial-' + crypto.randomUUID().substring(0, 8);

        // 检查试用记录
        const { data: trialRecord } = await supabase
          .from('bot_trial_records')
          .select('*')
          .eq('bot_token', botToken)
          .maybeSingle();

        const trialMessagesUsed = trialRecord ? trialRecord.messages_used : 0;
        const isBlocked = trialRecord?.is_blocked === true;

        const { error: insertError } = await supabase
          .from('bot_activations')
          .insert({
            bot_token: botToken,
            personal_user_id: personalUserId || userId,
            greeting_message: '你好！👋 有什么可以帮助你的吗？',
            activation_code: activationCode,
            is_active: !isBlocked,      // 未封禁则在线（试用可用）
            is_authorized: false,        // 未授权，保持试用状态
            trial_limit: 20,
            trial_messages_used: trialMessagesUsed,
            user_id: userId,
          });

        if (insertError) {
          console.error('Ensure bot listing insert error:', insertError);
          return new Response(JSON.stringify({ ok: false, error: insertError.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // 创建试用记录（如不存在）
        if (!trialRecord) {
          await supabase.from('bot_trial_records').insert({
            bot_token: botToken,
            messages_used: 0,
            is_blocked: false,
          });
        }

        // 设置 Webhook
        const webhookUrl = `${supabaseUrl}/functions/v1/telegram-webhook/${botToken}`;
        await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: webhookUrl }),
        });

        return new Response(JSON.stringify({ ok: true, created: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 批量生成激活码
      case 'generate-codes': {
        const { count, validityDays, featureType } = params;
        
        // 激活码在激活时才计算过期时间，生成时 expire_at 为 null
        const codes: string[] = [];
        const insertData = [];
        
        for (let i = 0; i < count; i++) {
          const code = crypto.randomUUID().substring(0, 8).toUpperCase();
          codes.push(code);
          insertData.push({
            code,
            expire_at: null, // 激活码在未激活时不过期
            is_used: false,
            validity_days: validityDays || 30,
            feature_type: featureType || 'both',
          });
        }

        const { error } = await supabase
          .from('activation_codes')
          .insert(insertData);

        if (error) {
          console.error('Generate codes error:', error);
          return new Response(JSON.stringify({ ok: false, error: error.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        return new Response(JSON.stringify({ ok: true, codes }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 获取所有激活码
      case 'list-codes': {
        const { data, error } = await supabase
          .from('activation_codes')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) {
          console.error('List codes error:', error);
          return new Response(JSON.stringify({ ok: false, error: error.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        return new Response(JSON.stringify({ ok: true, data }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 绑定已存在的机器人到激活码 (支持 bind-code 和 bind-existing 两种action名称)
      case 'bind-code':
      case 'bind-existing': {
        // 兼容两种参数名称: code 或 activationCode
        const code = params.code || params.activationCode;
        const { botId, botToken } = params;
        
        // 查找激活码
        const { data: codeData, error: codeError } = await supabase
          .from('activation_codes')
          .select('*')
          .eq('code', code)
          .maybeSingle();

        if (codeError || !codeData) {
          return new Response(JSON.stringify({ ok: false, error: '激活码不存在' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        if (codeData.is_used) {
          return new Response(JSON.stringify({ ok: false, error: '激活码已被使用' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // 获取当前机器人信息 - 支持通过 botId 或 botToken 查询
        let currentBot: any = null;
        let actualBotToken = botToken;
        if (botId) {
          const { data } = await supabase
            .from('bot_activations')
            .select('id, expire_at, bot_token')
            .eq('id', botId)
            .single();
          currentBot = data;
          actualBotToken = data?.bot_token;
        } else if (botToken) {
          const { data } = await supabase
            .from('bot_activations')
            .select('id, expire_at, bot_token')
            .eq('bot_token', botToken)
            .single();
          currentBot = data;
        }

        if (!currentBot) {
          return new Response(JSON.stringify({ ok: false, error: '机器人不存在' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const validityDays = codeData.validity_days || 30;
        const featureType = codeData.feature_type || 'both';
        
        // 根据功能类型更新对应的有效期
        const updatePayload: any = {};
        let newChatExpireAt: Date | null = null;
        let newKeyboardExpireAt: Date | null = null;
        let newShopExpireAt: Date | null = null;

        // 判断各功能是否需要激活
        const shouldActivateChat = ['chat', 'both', 'chat_shop', 'all'].includes(featureType);
        const shouldActivateKeyboard = ['keyboard', 'both', 'keyboard_shop', 'all'].includes(featureType);
        const shouldActivateShop = ['shop', 'chat_shop', 'keyboard_shop', 'all'].includes(featureType);

        // 计算双向聊天有效期
        if (shouldActivateChat) {
          if (currentBot.expire_at && new Date(currentBot.expire_at) > new Date()) {
            newChatExpireAt = new Date(currentBot.expire_at);
            newChatExpireAt.setDate(newChatExpireAt.getDate() + validityDays);
          } else {
            newChatExpireAt = new Date();
            newChatExpireAt.setDate(newChatExpireAt.getDate() + validityDays);
          }
          newChatExpireAt.setHours(23, 59, 59, 999);
          updatePayload.expire_at = newChatExpireAt.toISOString();
          updatePayload.is_authorized = true;
          updatePayload.is_active = true;
          updatePayload.trial_messages_used = 0;
          updatePayload.web_enabled = true;
          updatePayload.app_enabled = true;
        }

        // 计算键盘菜单有效期
        if (shouldActivateKeyboard) {
          const { data: keyboardConfig } = await supabase
            .from('keyboard_configs')
            .select('keyboard_expire_at')
            .eq('bot_token', actualBotToken)
            .maybeSingle();

          if (keyboardConfig?.keyboard_expire_at && new Date(keyboardConfig.keyboard_expire_at) > new Date()) {
            newKeyboardExpireAt = new Date(keyboardConfig.keyboard_expire_at);
            newKeyboardExpireAt.setDate(newKeyboardExpireAt.getDate() + validityDays);
          } else {
            newKeyboardExpireAt = new Date();
            newKeyboardExpireAt.setDate(newKeyboardExpireAt.getDate() + validityDays);
          }
          newKeyboardExpireAt.setHours(23, 59, 59, 999);

          // 更新 keyboard_configs 表
          await supabase.from('keyboard_configs').upsert(
            {
              bot_token: actualBotToken,
              keyboard_expire_at: newKeyboardExpireAt.toISOString(),
              updated_at: new Date().toISOString(),
            } as any,
            { onConflict: 'bot_token' }
          );
        }

        // 计算 TG商城有效期
        if (shouldActivateShop) {
          const { data: shopConfig } = await supabase
            .from('shop_configs')
            .select('shop_expire_at')
            .eq('bot_token', actualBotToken)
            .maybeSingle();

          if (shopConfig?.shop_expire_at && new Date(shopConfig.shop_expire_at) > new Date()) {
            newShopExpireAt = new Date(shopConfig.shop_expire_at);
            newShopExpireAt.setDate(newShopExpireAt.getDate() + validityDays);
          } else {
            newShopExpireAt = new Date();
            newShopExpireAt.setDate(newShopExpireAt.getDate() + validityDays);
          }
          newShopExpireAt.setHours(23, 59, 59, 999);

          // 更新 shop_configs 表
          await supabase.from('shop_configs').upsert(
            {
              bot_token: actualBotToken,
              shop_expire_at: newShopExpireAt.toISOString(),
              updated_at: new Date().toISOString(),
            } as any,
            { onConflict: 'bot_token' }
          );
        }

        // 更新机器人（仅双向聊天相关字段）
        if (Object.keys(updatePayload).length > 0) {
          const { error: updateError } = await supabase
            .from('bot_activations')
            .update(updatePayload)
            .eq('id', currentBot.id);

          if (updateError) {
            console.error('Update bot error:', updateError);
            return new Response(JSON.stringify({ ok: false, error: updateError.message }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        }

        // 标记激活码为已使用
        const codeExpireAt = newChatExpireAt || newKeyboardExpireAt;
        await supabase
          .from('activation_codes')
          .update({
            is_used: true,
            used_by_bot_id: currentBot.id,
            expire_at: codeExpireAt ? codeExpireAt.toISOString() : null,
          })
          .eq('id', codeData.id);

        // 同步更新 store_card_keys 表（如果该激活码也在商城库存中）
        await syncActivationCodeToStoreKeys(supabase, code, actualBotToken);

        // 更新试用记录 (仅对双向聊天)
        if (newChatExpireAt && actualBotToken) {
          await supabase
            .from('bot_trial_records')
            .upsert({
              bot_token: actualBotToken,
              was_authorized: true,
              last_authorized_expire_at: newChatExpireAt.toISOString(),
              is_blocked: false,
            }, { onConflict: 'bot_token' });

          // 设置webhook
          const webhookUrl = `${supabaseUrl}/functions/v1/telegram-webhook/${actualBotToken}`;
          await fetch(`https://api.telegram.org/bot${actualBotToken}/setWebhook`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: webhookUrl }),
          });
        }

        console.log('Bind code success:', { 
          featureType, 
          newChatExpireAt: newChatExpireAt?.toISOString(), 
          newKeyboardExpireAt: newKeyboardExpireAt?.toISOString(),
          newShopExpireAt: newShopExpireAt?.toISOString()
        });

        return new Response(JSON.stringify({ 
          ok: true, 
          featureType,
          newExpireAt: newChatExpireAt?.toISOString() || null,
          newKeyboardExpireAt: newKeyboardExpireAt?.toISOString() || null,
          newShopExpireAt: newShopExpireAt?.toISOString() || null,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 键盘菜单独立激活码绑定 - 不依赖 bot_activations 表
      case 'bind-keyboard-code': {
        const code = params.code || params.activationCode;
        const { botToken } = params;
        
        if (!botToken) {
          return new Response(JSON.stringify({ ok: false, error: '缺少机器人 Token' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // 查找激活码
        const { data: codeData, error: codeError } = await supabase
          .from('activation_codes')
          .select('*')
          .eq('code', code)
          .maybeSingle();

        if (codeError || !codeData) {
          return new Response(JSON.stringify({ ok: false, error: '激活码不存在' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        if (codeData.is_used) {
          return new Response(JSON.stringify({ ok: false, error: '激活码已被使用' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const validityDays = codeData.validity_days || 30;
        const featureType = codeData.feature_type || 'keyboard';
        
        let newChatExpireAt: Date | null = null;
        let newKeyboardExpireAt: Date | null = null;

        // 获取 keyboard_configs 中的当前有效期
        const { data: keyboardConfig } = await supabase
          .from('keyboard_configs')
          .select('keyboard_expire_at')
          .eq('bot_token', botToken)
          .maybeSingle();

        // 计算键盘菜单有效期 (feature_type = 'keyboard' 或 'both')
        if (featureType === 'keyboard' || featureType === 'both') {
          if (keyboardConfig?.keyboard_expire_at && new Date(keyboardConfig.keyboard_expire_at) > new Date()) {
            newKeyboardExpireAt = new Date(keyboardConfig.keyboard_expire_at);
            newKeyboardExpireAt.setDate(newKeyboardExpireAt.getDate() + validityDays);
          } else {
            newKeyboardExpireAt = new Date();
            newKeyboardExpireAt.setDate(newKeyboardExpireAt.getDate() + validityDays);
          }
          newKeyboardExpireAt.setHours(23, 59, 59, 999);

          // 更新 keyboard_configs 表
          await supabase.from('keyboard_configs').upsert(
            {
              bot_token: botToken,
              keyboard_expire_at: newKeyboardExpireAt.toISOString(),
              updated_at: new Date().toISOString(),
            } as any,
            { onConflict: 'bot_token' }
          );
        }

        // 如果是双向聊天或二合一类型，也更新 bot_activations（如果存在）
        if (featureType === 'chat' || featureType === 'both') {
          const { data: currentBot } = await supabase
            .from('bot_activations')
            .select('id, expire_at, bot_token')
            .eq('bot_token', botToken)
            .maybeSingle();

          if (currentBot) {
            if (currentBot.expire_at && new Date(currentBot.expire_at) > new Date()) {
              newChatExpireAt = new Date(currentBot.expire_at);
              newChatExpireAt.setDate(newChatExpireAt.getDate() + validityDays);
            } else {
              newChatExpireAt = new Date();
              newChatExpireAt.setDate(newChatExpireAt.getDate() + validityDays);
            }
            newChatExpireAt.setHours(23, 59, 59, 999);

            await supabase
              .from('bot_activations')
              .update({
                expire_at: newChatExpireAt.toISOString(),
                is_authorized: true,
                is_active: true,
                trial_messages_used: 0,
                web_enabled: true,
                app_enabled: true,
              })
              .eq('id', currentBot.id);

            // 更新试用记录
            await supabase
              .from('bot_trial_records')
              .upsert({
                bot_token: botToken,
                was_authorized: true,
                last_authorized_expire_at: newChatExpireAt.toISOString(),
                is_blocked: false,
              }, { onConflict: 'bot_token' });
          }
        }

        // 标记激活码为已使用
        await supabase
          .from('activation_codes')
          .update({
            is_used: true,
            expire_at: (newChatExpireAt || newKeyboardExpireAt)?.toISOString() || null,
          })
          .eq('id', codeData.id);

        // 同步更新 store_card_keys 表（如果该激活码也在商城库存中）
        await syncActivationCodeToStoreKeys(supabase, code, botToken);

        // 确保 webhook 已设置
        const webhookUrl = `${supabaseUrl}/functions/v1/telegram-webhook/${botToken}`;
        await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: webhookUrl }),
        });

        console.log('Bind keyboard code success:', { 
          featureType, 
          newChatExpireAt: newChatExpireAt?.toISOString(), 
          newKeyboardExpireAt: newKeyboardExpireAt?.toISOString() 
        });

        return new Response(JSON.stringify({ 
          ok: true, 
          featureType,
          newExpireAt: newChatExpireAt?.toISOString() || null,
          newKeyboardExpireAt: newKeyboardExpireAt?.toISOString() || null,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // TG商城独立激活码绑定
      case 'bind-shop-code': {
        const code = params.code || params.activationCode;
        const { botToken } = params;
        
        if (!botToken) {
          return new Response(JSON.stringify({ ok: false, error: '缺少机器人 Token' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // 查找激活码
        const { data: codeData, error: codeError } = await supabase
          .from('activation_codes')
          .select('*')
          .eq('code', code)
          .maybeSingle();

        if (codeError || !codeData) {
          return new Response(JSON.stringify({ ok: false, error: '激活码不存在' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        if (codeData.is_used) {
          return new Response(JSON.stringify({ ok: false, error: '激活码已被使用' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const validityDays = codeData.validity_days || 30;
        const featureType = codeData.feature_type || 'shop';
        
        // 检查激活码是否支持商城功能
        const supportsShop = ['shop', 'chat_shop', 'keyboard_shop', 'all'].includes(featureType);
        if (!supportsShop) {
          return new Response(JSON.stringify({ ok: false, error: '此激活码不支持 TG商城 功能' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // 获取当前商城有效期
        const { data: shopConfig } = await supabase
          .from('shop_configs')
          .select('shop_expire_at')
          .eq('bot_token', botToken)
          .maybeSingle();

        let newShopExpireAt: Date;
        let newChatExpireAt: Date | null = null;
        let newKeyboardExpireAt: Date | null = null;
        
        if (shopConfig?.shop_expire_at && new Date(shopConfig.shop_expire_at) > new Date()) {
          newShopExpireAt = new Date(shopConfig.shop_expire_at);
          newShopExpireAt.setDate(newShopExpireAt.getDate() + validityDays);
        } else {
          newShopExpireAt = new Date();
          newShopExpireAt.setDate(newShopExpireAt.getDate() + validityDays);
        }
        newShopExpireAt.setHours(23, 59, 59, 999);

        // 更新 shop_configs 表
        await supabase.from('shop_configs').upsert(
          {
            bot_token: botToken,
            shop_expire_at: newShopExpireAt.toISOString(),
            shop_trial_started_at: null, // 清除试用记录
            updated_at: new Date().toISOString(),
          } as any,
          { onConflict: 'bot_token' }
        );

        // 复合激活码：同时更新双向聊天有效期
        const supportsChat = ['chat_shop', 'all'].includes(featureType);
        if (supportsChat) {
          const { data: currentBot } = await supabase
            .from('bot_activations')
            .select('id, expire_at, bot_token')
            .eq('bot_token', botToken)
            .maybeSingle();

          if (currentBot) {
            if (currentBot.expire_at && new Date(currentBot.expire_at) > new Date()) {
              newChatExpireAt = new Date(currentBot.expire_at);
              newChatExpireAt.setDate(newChatExpireAt.getDate() + validityDays);
            } else {
              newChatExpireAt = new Date();
              newChatExpireAt.setDate(newChatExpireAt.getDate() + validityDays);
            }
            newChatExpireAt.setHours(23, 59, 59, 999);

            await supabase
              .from('bot_activations')
              .update({
                expire_at: newChatExpireAt.toISOString(),
                is_authorized: true,
                is_active: true,
                trial_messages_used: 0,
                web_enabled: true,
                app_enabled: true,
              })
              .eq('id', currentBot.id);

            // 更新试用记录
            await supabase
              .from('bot_trial_records')
              .upsert({
                bot_token: botToken,
                was_authorized: true,
                last_authorized_expire_at: newChatExpireAt.toISOString(),
                is_blocked: false,
              }, { onConflict: 'bot_token' });
          }
        }

        // 复合激活码：同时更新菜单键盘有效期
        const supportsKeyboard = ['keyboard_shop', 'all'].includes(featureType);
        if (supportsKeyboard) {
          const { data: keyboardConfig } = await supabase
            .from('keyboard_configs')
            .select('keyboard_expire_at')
            .eq('bot_token', botToken)
            .maybeSingle();

          if (keyboardConfig?.keyboard_expire_at && new Date(keyboardConfig.keyboard_expire_at) > new Date()) {
            newKeyboardExpireAt = new Date(keyboardConfig.keyboard_expire_at);
            newKeyboardExpireAt.setDate(newKeyboardExpireAt.getDate() + validityDays);
          } else {
            newKeyboardExpireAt = new Date();
            newKeyboardExpireAt.setDate(newKeyboardExpireAt.getDate() + validityDays);
          }
          newKeyboardExpireAt.setHours(23, 59, 59, 999);

          await supabase.from('keyboard_configs').upsert(
            {
              bot_token: botToken,
              keyboard_expire_at: newKeyboardExpireAt.toISOString(),
              keyboard_trial_started_at: null, // 清除试用记录
              updated_at: new Date().toISOString(),
            } as any,
            { onConflict: 'bot_token' }
          );
        }

        // 标记激活码为已使用
        await supabase
          .from('activation_codes')
          .update({
            is_used: true,
            expire_at: newShopExpireAt.toISOString(),
          })
          .eq('id', codeData.id);

        // 同步更新 store_card_keys 表（如果该激活码也在商城库存中）
        await syncActivationCodeToStoreKeys(supabase, code, botToken);

        console.log('Bind shop code success:', { 
          featureType, 
          newShopExpireAt: newShopExpireAt.toISOString(),
          newChatExpireAt: newChatExpireAt?.toISOString() || null,
          newKeyboardExpireAt: newKeyboardExpireAt?.toISOString() || null,
        });

        return new Response(JSON.stringify({ 
          ok: true, 
          message: 'TG商城激活成功',
          expireAt: newShopExpireAt.toISOString(),
          chatExpireAt: newChatExpireAt?.toISOString() || null,
          keyboardExpireAt: newKeyboardExpireAt?.toISOString() || null,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 管理员直接激活
      case 'admin-authorize': {
        const { id } = params;
        
        const { error } = await supabase
          .from('bot_activations')
          .update({
            is_authorized: true,
            is_active: true,
            trial_messages_used: 0,
            web_enabled: true,  // 激活时重置为开启
            app_enabled: true,  // 激活时重置为开启
          })
          .eq('id', id);

        if (error) {
          return new Response(JSON.stringify({ ok: false, error: error.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // 更新试用记录
        const { data: bot } = await supabase
          .from('bot_activations')
          .select('bot_token, expire_at')
          .eq('id', id)
          .single();

        if (bot) {
          await supabase
            .from('bot_trial_records')
            .upsert({
              bot_token: bot.bot_token,
              was_authorized: true,
              last_authorized_expire_at: bot.expire_at,
              is_blocked: false,
            }, { onConflict: 'bot_token' });

          // 设置webhook - 使用bot token作为路径
          const webhookUrl = `${supabaseUrl}/functions/v1/telegram-webhook/${bot.bot_token}`;
          await fetch(`https://api.telegram.org/bot${bot.bot_token}/setWebhook`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: webhookUrl }),
          });
        }

        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 用户使用激活码激活机器人
      case 'authorize': {
        const { activationCode: code, botId } = params;
        
        // 查找激活码
        const { data: codeData, error: codeError } = await supabase
          .from('activation_codes')
          .select('*')
          .eq('code', code)
          .maybeSingle();

        if (codeError || !codeData) {
          return new Response(JSON.stringify({ ok: false, error: '激活码不存在' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        if (codeData.is_used) {
          return new Response(JSON.stringify({ ok: false, error: '激活码已被使用' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // 更新机器人为已激活 - 同时重置端口开关为开启状态
        const { error: updateError } = await supabase
          .from('bot_activations')
          .update({
            is_authorized: true,
            is_active: true,
            expire_at: codeData.expire_at,
            trial_messages_used: 0,
            web_enabled: true,  // 激活时重置为开启
            app_enabled: true,  // 激活时重置为开启
          })
          .eq('id', botId);

        if (updateError) {
          return new Response(JSON.stringify({ ok: false, error: updateError.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // 标记激活码为已使用
        await supabase
          .from('activation_codes')
          .update({
            is_used: true,
            used_by_bot_id: botId,
          })
          .eq('id', codeData.id);

        // 更新试用记录
        const { data: bot } = await supabase
          .from('bot_activations')
          .select('bot_token')
          .eq('id', botId)
          .single();

        if (bot) {
          await supabase
            .from('bot_trial_records')
            .upsert({
              bot_token: bot.bot_token,
              was_authorized: true,
              last_authorized_expire_at: codeData.expire_at,
              is_blocked: false,
            }, { onConflict: 'bot_token' });

          // 设置webhook - 使用bot token作为路径
          const webhookUrl = `${supabaseUrl}/functions/v1/telegram-webhook/${bot.bot_token}`;
          console.log('Setting webhook for authorized bot:', webhookUrl);
          const webhookResult = await fetch(`https://api.telegram.org/bot${bot.bot_token}/setWebhook`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: webhookUrl }),
          });
          const webhookResponse = await webhookResult.json();
          console.log('Webhook set result:', webhookResponse);
        }

        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 启用/停用机器人
      case 'toggle': {
        const { id, isActive } = params;
        
        const { data: bot, error: fetchError } = await supabase
          .from('bot_activations')
          .select('bot_token')
          .eq('id', id)
          .single();

        if (fetchError) {
          return new Response(JSON.stringify({ ok: false, error: fetchError.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const { error } = await supabase
          .from('bot_activations')
          .update({ is_active: isActive })
          .eq('id', id);

        if (error) {
          return new Response(JSON.stringify({ ok: false, error: error.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // 设置或删除webhook
        if (isActive) {
          // 设置webhook - 使用bot token作为路径
          const webhookUrl = `${supabaseUrl}/functions/v1/telegram-webhook/${bot.bot_token}`;
          await fetch(`https://api.telegram.org/bot${bot.bot_token}/setWebhook`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: webhookUrl }),
          });
        } else {
          await fetch(`https://api.telegram.org/bot${bot.bot_token}/deleteWebhook`, {
            method: 'POST',
          });
        }

        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 用户删除自己的机器人
      case 'delete': {
        // 兼容 id 和 botId 两种参数名
        const botId = params.id || params.botId;
        
        if (!botId) {
          return new Response(JSON.stringify({ ok: false, error: '缺少机器人ID' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        const { data: bot, error: fetchError } = await supabase
          .from('bot_activations')
          .select('bot_token, user_id')
          .eq('id', botId)
          .maybeSingle();
        
        if (!bot && !fetchError) {
          return new Response(JSON.stringify({ ok: true, message: '机器人已被删除' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        if (fetchError) {
          return new Response(JSON.stringify({ ok: false, error: fetchError.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // 验证用户权限 - 只能删除自己的机器人或游客机器人
        const authHeader = req.headers.get('Authorization');
        if (authHeader) {
          const token = authHeader.replace('Bearer ', '');
          const { data: { user } } = await supabase.auth.getUser(token);
          
          // 如果机器人有用户ID且不是当前用户，拒绝删除
          if (bot.user_id && user && bot.user_id !== user.id) {
            // 检查是否是管理员
            const { data: isAdmin } = await supabase.rpc('has_role', {
              _user_id: user.id,
              _role: 'admin'
            });
            
            if (!isAdmin) {
              return new Response(JSON.stringify({ ok: false, error: '无权删除此机器人' }), {
                status: 403,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              });
            }
          }
        }

        // 删除相关消息
        await supabase
          .from('messages')
          .delete()
          .eq('bot_activation_id', botId);

        // TG商城数据（shop_products, shop_orders, shop_configs）保留在云端
        // 重新添加同一机器人时会自动恢复所有商城配置和商品

        // 删除机器人
        const { error } = await supabase
          .from('bot_activations')
          .delete()
          .eq('id', botId);

        if (error) {
          return new Response(JSON.stringify({ ok: false, error: error.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        // 检查是否有菜单键盘配置 - 如果有，保留webhook让菜单继续工作
        const { data: keyboardConfig } = await supabase
          .from('keyboard_configs')
          .select('id')
          .eq('bot_token', bot.bot_token)
          .single();

        if (!keyboardConfig) {
          // 没有菜单键盘配置，删除webhook
          await fetch(`https://api.telegram.org/bot${bot.bot_token}/deleteWebhook`, {
            method: 'POST',
          });
          console.log(`Webhook deleted for bot ${bot.bot_token} - no keyboard config found`);
        } else {
          console.log(`Webhook preserved for bot ${bot.bot_token} - keyboard config exists`);
        }

        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      // 管理员删除机器人 (旧版兼容)
      case 'admin-delete': {
        const { id } = params;
        
        const { data: bot, error: fetchError } = await supabase
          .from('bot_activations')
          .select('bot_token')
          .eq('id', id)
          .maybeSingle();
        
        if (!bot && !fetchError) {
          return new Response(JSON.stringify({ ok: true, message: '机器人已被删除' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        if (fetchError) {
          return new Response(JSON.stringify({ ok: false, error: fetchError.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // 删除相关消息
        await supabase
          .from('messages')
          .delete()
          .eq('bot_activation_id', id);

        // TG商城数据（shop_products, shop_orders, shop_configs）保留在云端
        // 重新添加同一机器人时会自动恢复所有商城配置和商品

        // 删除机器人
        const { error } = await supabase
          .from('bot_activations')
          .delete()
          .eq('id', id);

        if (error) {
          return new Response(JSON.stringify({ ok: false, error: error.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // 检查是否有菜单键盘配置 - 如果有，保留webhook让菜单继续工作
        const { data: keyboardConfig } = await supabase
          .from('keyboard_configs')
          .select('id')
          .eq('bot_token', bot.bot_token)
          .single();

        if (!keyboardConfig) {
          // 没有菜单键盘配置，删除webhook
          await fetch(`https://api.telegram.org/bot${bot.bot_token}/deleteWebhook`, {
            method: 'POST',
          });
          console.log(`Webhook deleted for bot ${bot.bot_token} - no keyboard config found`);
        } else {
          console.log(`Webhook preserved for bot ${bot.bot_token} - keyboard config exists`);
        }

        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 延长到期日期
      case 'extend': {
        const { id, expireAt } = params;
        
        // 将过期时间设置为当天的23:59:59
        const expireDate = new Date(expireAt);
        expireDate.setHours(23, 59, 59, 999);
        const normalizedExpireAt = expireDate.toISOString();
        
        // 获取当前机器人信息
        const { data: currentBot } = await supabase
          .from('bot_activations')
          .select('bot_token, is_active')
          .eq('id', id)
          .single();
        
        // 更新过期日期，同时自动启动机器人
        const { error } = await supabase
          .from('bot_activations')
          .update({ 
            expire_at: normalizedExpireAt,
            is_active: true  // 延长日期时自动启动
          })
          .eq('id', id);

        if (error) {
          return new Response(JSON.stringify({ ok: false, error: error.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // 更新试用记录
        if (currentBot) {
          await supabase
            .from('bot_trial_records')
            .update({ last_authorized_expire_at: normalizedExpireAt })
            .eq('bot_token', currentBot.bot_token);
          
          // 如果之前未启动，设置webhook
          if (!currentBot.is_active) {
            const webhookUrl = `${supabaseUrl}/functions/v1/telegram-webhook/${currentBot.bot_token}`;
            await fetch(`https://api.telegram.org/bot${currentBot.bot_token}/setWebhook`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ url: webhookUrl }),
            });
          }
        }

        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 获取所有机器人列表（管理员用）
      case 'list': {
        const { data, error } = await supabase
          .from('bot_activations')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) {
          return new Response(JSON.stringify({ ok: false, error: error.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // 检查并自动停止已过期的机器人
        const now = new Date();
        const expiredBots: string[] = [];
        
        for (const bot of data || []) {
          if (bot.expire_at && bot.is_active && bot.is_authorized) {
            const expireDate = new Date(bot.expire_at);
            if (expireDate <= now) {
              expiredBots.push(bot.id);
              // 更新数据库中的状态
              await supabase
                .from('bot_activations')
                .update({ is_active: false })
                .eq('id', bot.id);
              // 删除webhook
              await fetch(`https://api.telegram.org/bot${bot.bot_token}/deleteWebhook`, {
                method: 'POST',
              });
              console.log(`Auto-stopped expired bot: ${bot.bot_token}`);
            }
          }
        }

        // 获取所有试用记录
        const { data: trialRecords } = await supabase
          .from('bot_trial_records')
          .select('bot_token, messages_used, is_blocked');
        
        const trialMap: Record<string, { messages_used: number; is_blocked: boolean }> = {};
        if (trialRecords) {
          for (const record of trialRecords) {
            trialMap[record.bot_token] = {
              messages_used: record.messages_used || 0,
              is_blocked: record.is_blocked || false,
            };
          }
        }

        // 获取用户邮箱
        const userIds = [...new Set(data.filter(d => d.user_id).map(d => d.user_id))];
        const userEmails: Record<string, string> = {};
        
        for (const userId of userIds) {
          const { data: userData } = await supabase.auth.admin.getUserById(userId);
          if (userData?.user?.email) {
            userEmails[userId] = userData.user.email;
          }
        }

        const enrichedData = data.map(d => {
          const trialInfo = trialMap[d.bot_token];
          // 如果刚才自动停止了，更新本地数据
          const wasAutoStopped = expiredBots.includes(d.id);
          return {
            ...d,
            is_active: wasAutoStopped ? false : d.is_active,
            user_email: d.user_id ? userEmails[d.user_id] : null,
            // 同步试用记录中的消息使用数
            trial_messages_from_record: trialInfo?.messages_used || 0,
            is_blocked_in_record: trialInfo?.is_blocked || false,
          };
        });

        return new Response(JSON.stringify({ ok: true, data: enrichedData }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 获取所有消息（管理员用）
      case 'list-all-messages': {
        const { data, error } = await supabase
          .from('messages')
          .select('*, bot_activations(bot_token, personal_user_id)')
          .order('created_at', { ascending: false })
          .limit(1000);

        if (error) {
          return new Response(JSON.stringify({ ok: false, error: error.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        return new Response(JSON.stringify({ ok: true, data }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 切换端口状态
      case 'toggle-port': {
        const { id, portType, enabled } = params;
        
        const updateData = portType === 'web' 
          ? { web_enabled: enabled }
          : { app_enabled: enabled };

        const { error } = await supabase
          .from('bot_activations')
          .update(updateData)
          .eq('id', id);

        if (error) {
          return new Response(JSON.stringify({ ok: false, error: error.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 清理过期试用机器人
      case 'cleanup-expired-trials': {
        const threeDaysAgo = new Date();
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

        const { data: expiredBots, error: fetchError } = await supabase
          .from('bot_activations')
          .select('id, bot_token')
          .eq('is_authorized', false)
          .lt('created_at', threeDaysAgo.toISOString());

        if (fetchError) {
          return new Response(JSON.stringify({ ok: false, error: fetchError.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        for (const bot of expiredBots || []) {
          // 删除webhook
          await fetch(`https://api.telegram.org/bot${bot.bot_token}/deleteWebhook`, {
            method: 'POST',
          });

          // 删除消息
          await supabase
            .from('messages')
            .delete()
            .eq('bot_activation_id', bot.id);

          // 删除机器人
          await supabase
            .from('bot_activations')
            .delete()
            .eq('id', bot.id);
        }

        return new Response(JSON.stringify({ ok: true, cleaned: expiredBots?.length || 0 }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 管理员发送消息
      case 'admin-send-message': {
        const { botActivationId, chatId, message } = params;
        
        const { data: bot, error: fetchError } = await supabase
          .from('bot_activations')
          .select('bot_token, web_enabled')
          .eq('id', botActivationId)
          .single();

        if (fetchError || !bot) {
          return new Response(JSON.stringify({ ok: false, error: '机器人不存在' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // 发送Telegram消息
        const telegramResponse = await fetch(`https://api.telegram.org/bot${bot.bot_token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: message,
          }),
        });

        const telegramResult = await telegramResponse.json();
        
        if (!telegramResult.ok) {
          return new Response(JSON.stringify({ ok: false, error: telegramResult.description }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // 保存消息记录
        // 管理员发送的消息始终可见（is_read: false），不受web端口限制
        // 这样管理员聊天监控始终能看到自己发送的消息
        await supabase
          .from('messages')
          .insert({
            bot_activation_id: botActivationId,
            telegram_chat_id: chatId,
            telegram_message_id: telegramResult.result.message_id,
            content: message,
            direction: 'outgoing',
            is_admin_reply: true,
            is_read: false, // 管理员消息始终可见
          });

        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 禁用/启用用户
      case 'toggle-user-disabled': {
        const { userId, disabled } = params;
        
        if (disabled) {
          const { error } = await supabase
            .from('disabled_users')
            .insert({ user_id: userId });

          if (error && error.code !== '23505') { // 忽略重复键错误
            return new Response(JSON.stringify({ ok: false, error: error.message }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        } else {
          const { error } = await supabase
            .from('disabled_users')
            .delete()
            .eq('user_id', userId);

          if (error) {
            return new Response(JSON.stringify({ ok: false, error: error.message }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        }

        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 获取禁用用户列表
      case 'list-disabled-users': {
        const { data, error } = await supabase
          .from('disabled_users')
          .select('user_id');

        if (error) {
          return new Response(JSON.stringify({ ok: false, error: error.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        return new Response(JSON.stringify({ ok: true, data }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 获取所有注册用户列表（管理员用）
      case 'list-users': {
        try {
          // 使用 admin API 获取所有用户
          const { data: { users }, error } = await supabase.auth.admin.listUsers();
          
          if (error) {
            return new Response(JSON.stringify({ ok: false, error: error.message }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }

          // 返回用户基本信息
          const userData = users.map(u => ({
            id: u.id,
            email: u.email,
            created_at: u.created_at,
          }));

          return new Response(JSON.stringify({ ok: true, data: userData }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        } catch (err) {
          console.error('List users error:', err);
          return new Response(JSON.stringify({ ok: false, error: '获取用户列表失败' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      // 重置Webhook绑定 - 将机器人重新绑定到本系统
      case 'reset-webhook': {
        const { botToken } = params;
        
        if (!botToken) {
          return new Response(JSON.stringify({ ok: false, error: '缺少机器人Token' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        try {
          // 设置webhook - 使用bot token作为路径
          const webhookUrl = `${supabaseUrl}/functions/v1/telegram-webhook/${botToken}`;
          const response = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: webhookUrl }),
          });

          const result = await response.json();
          
          if (!result.ok) {
            return new Response(JSON.stringify({ ok: false, error: result.description || 'Webhook设置失败' }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }

          return new Response(JSON.stringify({ ok: true, message: 'Webhook已重新绑定到本系统' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        } catch (err) {
          console.error('Reset webhook error:', err);
          return new Response(JSON.stringify({ ok: false, error: '重置Webhook失败' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      // 深度重置 - 移除所有用户的底部键盘
      case 'deep-reset': {
        const { botToken, adminChatId } = params;
        
        if (!botToken) {
          return new Response(JSON.stringify({ ok: false, error: '缺少机器人Token' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        try {
          let successCount = 0;
          
          // 1. 删除机器人的全局菜单命令
          try {
            await fetch(`https://api.telegram.org/bot${botToken}/deleteMyCommands`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({}),
            });
          } catch (e) {
            console.error('Failed to delete global commands:', e);
          }

          // 2. 重置全局菜单按钮为默认
          try {
            await fetch(`https://api.telegram.org/bot${botToken}/setChatMenuButton`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ menu_button: { type: 'default' } }),
            });
          } catch (e) {
            console.error('Failed to reset global menu button:', e);
          }

          // 3. 重置管理员的菜单和键盘
          if (adminChatId) {
            try {
              // 删除管理员的命令缓存
              await fetch(`https://api.telegram.org/bot${botToken}/deleteMyCommands`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ scope: { type: 'chat', chat_id: adminChatId } }),
              });
              // 重置管理员的菜单按钮
              await fetch(`https://api.telegram.org/bot${botToken}/setChatMenuButton`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: adminChatId, menu_button: { type: 'default' } }),
              });
              // 发送消息移除键盘
              await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  chat_id: adminChatId,
                  text: "🔄 系统界面重置",
                  reply_markup: { remove_keyboard: true },
                }),
              });
              successCount++;
            } catch (e) {
              console.error('Failed to reset admin keyboard:', e);
            }
          }

          // 4. 从数据库获取所有用户列表并重置（不设 LIMIT 以确保全部获取）
          const { data: dbUsers, error: dbError } = await supabase
            .from('bot_users')
            .select('telegram_user_id, first_name')
            .eq('bot_token', botToken);

          if (dbError) {
            console.error('Failed to fetch bot_users:', dbError);
          }

          console.log(`Deep reset: Found ${dbUsers?.length || 0} users for bot ${botToken}`);

          if (dbUsers && dbUsers.length > 0) {
            for (const user of dbUsers) {
              // 跳过管理员（已单独处理）
              if (adminChatId && user.telegram_user_id.toString() === adminChatId.toString()) continue;
              try {
                // 删除用户的命令缓存
                await fetch(`https://api.telegram.org/bot${botToken}/deleteMyCommands`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ scope: { type: 'chat', chat_id: user.telegram_user_id } }),
                });
                // 重置用户的菜单按钮为默认
                await fetch(`https://api.telegram.org/bot${botToken}/setChatMenuButton`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ chat_id: user.telegram_user_id, menu_button: { type: 'default' } }),
                });
                // 发送消息移除键盘
                await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    chat_id: user.telegram_user_id,
                    text: "🔄 系统界面重置",
                    reply_markup: { remove_keyboard: true },
                  }),
                });
                successCount++;
              } catch (e) {
                console.error(`Failed to reset user ${user.telegram_user_id}:`, e);
              }
              await new Promise(r => setTimeout(r, 50));
            }
          }

          return new Response(JSON.stringify({ ok: true, successCount, message: `已通知 ${successCount} 位用户移除键盘` }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        } catch (err) {
          console.error('Deep reset error:', err);
          return new Response(JSON.stringify({ ok: false, error: '深度重置失败' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      // 同步键盘到Telegram - 发送带有底部键盘的消息
      case 'sync-keyboard': {
        const { botToken, chatId, keyboard, text } = params;
        
        if (!botToken || !chatId) {
          return new Response(JSON.stringify({ ok: false, error: '缺少必要参数' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        try {
          const body: any = {
            chat_id: chatId,
            text: text || '🔄 菜单已更新',
          };

          if (keyboard && keyboard.length > 0) {
            body.reply_markup = {
              keyboard: keyboard,
              resize_keyboard: true,
              one_time_keyboard: false,
            };
          }

          const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });

          const result = await response.json();
          
          if (!result.ok) {
            return new Response(JSON.stringify({ ok: false, error: result.description }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }

          return new Response(JSON.stringify({ ok: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        } catch (err) {
          console.error('Sync keyboard error:', err);
          return new Response(JSON.stringify({ ok: false, error: '同步键盘失败' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      // 群发键盘更新到所有用户
      case 'broadcast-keyboard': {
        const { botToken, keyboard, text } = params;
        
        if (!botToken) {
          return new Response(JSON.stringify({ ok: false, error: '缺少机器人Token' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        try {
          // 从数据库获取用户列表
          const { data: dbUsers } = await supabase
            .from('bot_users')
            .select('telegram_user_id')
            .eq('bot_token', botToken);

          if (!dbUsers || dbUsers.length === 0) {
            return new Response(JSON.stringify({ ok: true, successCount: 0, message: '暂无用户' }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }

          // 获取黑名单用户，排除在群发之外
          const { data: blockedUsers } = await supabase
            .from('bot_rate_limits')
            .select('telegram_user_id')
            .eq('bot_token', botToken)
            .eq('is_blocked', true);
          
          const blockedSet = new Set((blockedUsers || []).map(u => u.telegram_user_id));
          const filteredUsers = dbUsers.filter(u => !blockedSet.has(u.telegram_user_id));

          let successCount = 0;
          
          for (const user of filteredUsers) {
            try {
              const body: any = {
                chat_id: user.telegram_user_id,
                text: text || '🔄 菜单已更新',
              };

              if (keyboard && keyboard.length > 0) {
                body.reply_markup = {
                  keyboard: keyboard,
                  resize_keyboard: true,
                  one_time_keyboard: false,
                };
              }

              const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
              });

              const result = await response.json();
              if (result.ok) successCount++;
            } catch (e) {
              console.error(`Failed to send to user ${user.telegram_user_id}:`, e);
            }
            await new Promise(r => setTimeout(r, 100));
          }

          return new Response(JSON.stringify({ ok: true, successCount, total: filteredUsers.length, skippedBlocked: blockedSet.size, message: `群发完成：${successCount}/${filteredUsers.length} 成功（跳过${blockedSet.size}个黑名单用户）` }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        } catch (err) {
          console.error('Broadcast keyboard error:', err);
          return new Response(JSON.stringify({ ok: false, error: '群发失败' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      // 管理员切换双向聊天功能
      case 'admin-toggle-chat': {
        const { botToken, enabled } = params;
        
        if (!botToken) {
          return new Response(JSON.stringify({ ok: false, error: '缺少机器人Token' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // 更新bot_activations表中的is_active字段
        const { error } = await supabase
          .from('bot_activations')
          .update({ is_active: enabled })
          .eq('bot_token', botToken);

        if (error) {
          return new Response(JSON.stringify({ ok: false, error: error.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 管理员切换菜单键盘功能（通过设置过期时间实现）
      case 'admin-toggle-keyboard': {
        const { botToken, enabled } = params;
        
        if (!botToken) {
          return new Response(JSON.stringify({ ok: false, error: '缺少机器人Token' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // 如果禁用，设置过期时间为过去；如果启用，清除过期时间或设置一个月后
        const updateData: any = {};
        if (!enabled) {
          // 设置为已过期
          updateData.keyboard_expire_at = new Date('2000-01-01').toISOString();
        } else {
          // 清除试用开始时间和过期时间，让用户重新开始试用
          updateData.keyboard_trial_started_at = null;
          updateData.keyboard_expire_at = null;
        }

        const { error } = await supabase
          .from('keyboard_configs')
          .update(updateData)
          .eq('bot_token', botToken);

        if (error) {
          return new Response(JSON.stringify({ ok: false, error: error.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 管理员设置双向聊天过期时间
      case 'admin-set-chat-expire': {
        const { botToken, expireAt } = params;
        
        if (!botToken) {
          return new Response(JSON.stringify({ ok: false, error: '缺少机器人Token' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        if (!expireAt) {
          return new Response(JSON.stringify({ ok: false, error: '缺少过期时间' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // 将过期时间设置为当天的23:59:59
        const expireDate = new Date(expireAt);
        if (isNaN(expireDate.getTime())) {
          return new Response(JSON.stringify({ ok: false, error: '无效的日期格式' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        expireDate.setHours(23, 59, 59, 999);
        const normalizedExpireAt = expireDate.toISOString();

        const { error } = await supabase
          .from('bot_activations')
          .update({ 
            expire_at: normalizedExpireAt,
            is_authorized: true,
            is_active: true
          })
          .eq('bot_token', botToken);

        if (error) {
          return new Response(JSON.stringify({ ok: false, error: error.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // 更新试用记录
        await supabase
          .from('bot_trial_records')
          .upsert({
            bot_token: botToken,
            was_authorized: true,
            last_authorized_expire_at: normalizedExpireAt,
            is_blocked: false,
          }, { onConflict: 'bot_token' });

        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 管理员设置菜单键盘过期时间
      case 'admin-set-keyboard-expire': {
        const { botToken, expireAt } = params;
        
        if (!botToken) {
          return new Response(JSON.stringify({ ok: false, error: '缺少机器人Token' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        if (!expireAt) {
          return new Response(JSON.stringify({ ok: false, error: '缺少过期时间' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // 将过期时间设置为当天的23:59:59
        const expireDate = new Date(expireAt);
        if (isNaN(expireDate.getTime())) {
          return new Response(JSON.stringify({ ok: false, error: '无效的日期格式' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        expireDate.setHours(23, 59, 59, 999);
        const normalizedExpireAt = expireDate.toISOString();

        const { error } = await supabase
          .from('keyboard_configs')
          .update({ keyboard_expire_at: normalizedExpireAt })
          .eq('bot_token', botToken);

        if (error) {
          return new Response(JSON.stringify({ ok: false, error: error.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 管理员绑定双向聊天激活码
      case 'admin-bind-chat-code': {
        const { botToken, activationCode: code } = params;
        
        if (!botToken || !code) {
          return new Response(JSON.stringify({ ok: false, error: '缺少必要参数' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // 查找激活码
        const { data: codeData, error: codeError } = await supabase
          .from('activation_codes')
          .select('*')
          .eq('code', code)
          .maybeSingle();

        if (codeError || !codeData) {
          return new Response(JSON.stringify({ ok: false, error: '激活码不存在' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        if (codeData.is_used) {
          return new Response(JSON.stringify({ ok: false, error: '激活码已被使用' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // 检查激活码类型是否支持chat
        if (codeData.feature_type === 'keyboard') {
          return new Response(JSON.stringify({ ok: false, error: '此激活码仅适用于菜单键盘功能' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // 查找机器人
        const { data: bot, error: botError } = await supabase
          .from('bot_activations')
          .select('*')
          .eq('bot_token', botToken)
          .maybeSingle();

        if (botError || !bot) {
          return new Response(JSON.stringify({ ok: false, error: '机器人不存在' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // 计算新的过期时间
        const validityDays = codeData.validity_days || 30;
        let newExpireAt: Date;
        
        if (bot.expire_at && new Date(bot.expire_at) > new Date()) {
          // 已有有效期，叠加
          newExpireAt = new Date(bot.expire_at);
        } else {
          // 新激活或已过期
          newExpireAt = new Date();
        }
        newExpireAt.setDate(newExpireAt.getDate() + validityDays);
        newExpireAt.setHours(23, 59, 59, 999);

        // 更新机器人
        const { error: updateError } = await supabase
          .from('bot_activations')
          .update({
            is_authorized: true,
            is_active: true,
            expire_at: newExpireAt.toISOString(),
            trial_messages_used: 0,
            web_enabled: true,
            app_enabled: true,
          })
          .eq('id', bot.id);

        if (updateError) {
          return new Response(JSON.stringify({ ok: false, error: updateError.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // 标记激活码为已使用
        await supabase
          .from('activation_codes')
          .update({
            is_used: true,
            used_by_bot_id: bot.id,
          })
          .eq('id', codeData.id);

        // 更新试用记录
        await supabase
          .from('bot_trial_records')
          .upsert({
            bot_token: botToken,
            was_authorized: true,
            last_authorized_expire_at: newExpireAt.toISOString(),
            is_blocked: false,
          }, { onConflict: 'bot_token' });

        return new Response(JSON.stringify({ ok: true, expireAt: newExpireAt.toISOString() }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 管理员绑定菜单键盘激活码
      case 'admin-bind-keyboard-code': {
        const { botToken, activationCode: code } = params;
        
        if (!botToken || !code) {
          return new Response(JSON.stringify({ ok: false, error: '缺少必要参数' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // 查找激活码
        const { data: codeData, error: codeError } = await supabase
          .from('activation_codes')
          .select('*')
          .eq('code', code)
          .maybeSingle();

        if (codeError || !codeData) {
          return new Response(JSON.stringify({ ok: false, error: '激活码不存在' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        if (codeData.is_used) {
          return new Response(JSON.stringify({ ok: false, error: '激活码已被使用' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // 检查激活码类型是否支持keyboard
        if (codeData.feature_type === 'chat') {
          return new Response(JSON.stringify({ ok: false, error: '此激活码仅适用于双向聊天功能' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // 查找或创建keyboard_config
        const { data: keyboardConfig, error: kbError } = await supabase
          .from('keyboard_configs')
          .select('*')
          .eq('bot_token', botToken)
          .maybeSingle();

        // 计算新的过期时间
        const validityDays = codeData.validity_days || 30;
        let newExpireAt: Date;
        
        if (keyboardConfig?.keyboard_expire_at && new Date(keyboardConfig.keyboard_expire_at) > new Date()) {
          // 已有有效期，叠加
          newExpireAt = new Date(keyboardConfig.keyboard_expire_at);
        } else {
          // 新激活或已过期
          newExpireAt = new Date();
        }
        newExpireAt.setDate(newExpireAt.getDate() + validityDays);
        newExpireAt.setHours(23, 59, 59, 999);

        if (keyboardConfig) {
          // 更新现有配置
          const { error: updateError } = await supabase
            .from('keyboard_configs')
            .update({ keyboard_expire_at: newExpireAt.toISOString() })
            .eq('bot_token', botToken);

          if (updateError) {
            return new Response(JSON.stringify({ ok: false, error: updateError.message }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        } else {
          // 创建新配置
          const { error: insertError } = await supabase
            .from('keyboard_configs')
            .insert({ 
              bot_token: botToken,
              keyboard_expire_at: newExpireAt.toISOString()
            });

          if (insertError) {
            return new Response(JSON.stringify({ ok: false, error: insertError.message }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        }

        // 标记激活码为已使用
        await supabase
          .from('activation_codes')
          .update({
            is_used: true,
          })
          .eq('id', codeData.id);

        return new Response(JSON.stringify({ ok: true, expireAt: newExpireAt.toISOString() }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 管理员切换TG商城状态（通过清除或设置试用开始时间）
      case 'admin-toggle-shop': {
        const { botToken, enabled } = params;
        
        if (!botToken) {
          return new Response(JSON.stringify({ ok: false, error: '缺少机器人Token' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // 获取当前配置
        const { data: shopConfig } = await supabase
          .from('shop_configs')
          .select('*')
          .eq('bot_token', botToken)
          .maybeSingle();

        if (enabled) {
          // 启用：只修改过期时间字段，绝不影响其他配置和商品数据
          const savedExpire = shopConfig?.shop_saved_expire_at;
          
          if (savedExpire && new Date(savedExpire) > new Date()) {
            // 有保存的有效到期时间，恢复它
            await supabase.from('shop_configs').update({
              shop_expire_at: savedExpire,
              shop_saved_expire_at: null,
              updated_at: new Date().toISOString(),
            }).eq('bot_token', botToken);
          } else if (shopConfig) {
            // 已有配置行，只清除过期标记，恢复到自然状态
            const trialStart = shopConfig.shop_trial_started_at;
            const hasUsedTrial = trialStart && new Date(trialStart).getFullYear() > 2000;
            
            if (hasUsedTrial) {
              // 试用已用过，清除管理员设置的过期时间，恢复为试用过期状态
              await supabase.from('shop_configs').update({
                shop_expire_at: null,
                shop_saved_expire_at: null,
                updated_at: new Date().toISOString(),
              }).eq('bot_token', botToken);
            } else {
              // 从未试用过，开启24小时试用（只更新试用字段）
              await supabase.from('shop_configs').update({
                shop_trial_started_at: new Date().toISOString(),
                shop_expire_at: null,
                shop_saved_expire_at: null,
                updated_at: new Date().toISOString(),
              }).eq('bot_token', botToken);
            }
          } else {
            // 完全没有配置行，创建一个新的（带试用）
            await supabase.from('shop_configs').insert({
              bot_token: botToken,
              shop_trial_started_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            } as any);
          }
        } else {
          // 禁用：只保存当前有效期并标记为过期，不触碰其他配置和商品数据
          if (shopConfig) {
            const currentExpire = shopConfig.shop_expire_at;
            const hasValidExpiry = currentExpire && new Date(currentExpire) > new Date();
            
            // 试用中的也保存试用剩余时间
            let savedExpireValue = null;
            if (hasValidExpiry) {
              savedExpireValue = currentExpire;
            } else if (!currentExpire && shopConfig.shop_trial_started_at) {
              // 试用中：计算试用到期时间并保存
              const trialEnd = new Date(new Date(shopConfig.shop_trial_started_at).getTime() + 24 * 60 * 60 * 1000);
              if (trialEnd > new Date()) {
                savedExpireValue = trialEnd.toISOString();
              }
            }
            
            await supabase
              .from('shop_configs')
              .update({
                shop_saved_expire_at: savedExpireValue,
                shop_expire_at: '2000-01-01T00:00:00.000Z',
                updated_at: new Date().toISOString(),
              })
              .eq('bot_token', botToken);
          }
        }

        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 管理员设置TG商城过期时间
      case 'admin-set-shop-expire': {
        const { botToken, expireAt } = params;
        
        if (!botToken) {
          return new Response(JSON.stringify({ ok: false, error: '缺少机器人Token' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        if (!expireAt) {
          return new Response(JSON.stringify({ ok: false, error: '缺少过期时间' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // 将过期时间设置为当天的23:59:59
        const expireDate = new Date(expireAt);
        if (isNaN(expireDate.getTime())) {
          return new Response(JSON.stringify({ ok: false, error: '无效的日期格式' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        expireDate.setHours(23, 59, 59, 999);
        const normalizedExpireAt = expireDate.toISOString();

        const { error } = await supabase
          .from('shop_configs')
          .upsert({
            bot_token: botToken,
            shop_expire_at: normalizedExpireAt,
            updated_at: new Date().toISOString(),
          } as any, { onConflict: 'bot_token' });

        if (error) {
          return new Response(JSON.stringify({ ok: false, error: error.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 管理员绑定TG商城激活码
      case 'admin-bind-shop-code': {
        const { botToken, activationCode: code } = params;
        
        if (!botToken || !code) {
          return new Response(JSON.stringify({ ok: false, error: '缺少必要参数' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // 查找激活码
        const { data: codeData, error: codeError } = await supabase
          .from('activation_codes')
          .select('*')
          .eq('code', code)
          .maybeSingle();

        if (codeError || !codeData) {
          return new Response(JSON.stringify({ ok: false, error: '激活码不存在' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        if (codeData.is_used) {
          return new Response(JSON.stringify({ ok: false, error: '激活码已被使用' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // 检查激活码类型是否支持shop
        const supportsShop = ['shop', 'chat_shop', 'keyboard_shop', 'all'].includes(codeData.feature_type || 'both');
        if (!supportsShop) {
          return new Response(JSON.stringify({ ok: false, error: '此激活码不支持TG商城功能' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // 查找现有shop_config
        const { data: shopConfig } = await supabase
          .from('shop_configs')
          .select('*')
          .eq('bot_token', botToken)
          .maybeSingle();

        // 计算新的过期时间
        const validityDays = codeData.validity_days || 30;
        let newExpireAt: Date;
        
        if (shopConfig?.shop_expire_at && new Date(shopConfig.shop_expire_at) > new Date()) {
          // 已有有效期，叠加
          newExpireAt = new Date(shopConfig.shop_expire_at);
        } else {
          // 新激活或已过期
          newExpireAt = new Date();
        }
        newExpireAt.setDate(newExpireAt.getDate() + validityDays);
        newExpireAt.setHours(23, 59, 59, 999);

        // 更新或创建shop_configs
        const { error: upsertError } = await supabase.from('shop_configs').upsert(
          {
            bot_token: botToken,
            shop_expire_at: newExpireAt.toISOString(),
            shop_trial_started_at: null, // 清除试用记录
            updated_at: new Date().toISOString(),
          } as any,
          { onConflict: 'bot_token' }
        );

        if (upsertError) {
          return new Response(JSON.stringify({ ok: false, error: upsertError.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // 标记激活码为已使用
        await supabase
          .from('activation_codes')
          .update({
            is_used: true,
          })
          .eq('id', codeData.id);

        return new Response(JSON.stringify({ ok: true, expireAt: newExpireAt.toISOString() }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      default:
        return new Response(JSON.stringify({ ok: false, error: 'Unknown action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
  } catch (error: unknown) {
    console.error('Manage bot error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ ok: false, error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
