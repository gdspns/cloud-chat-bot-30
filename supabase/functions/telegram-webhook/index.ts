import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// 类型定义
interface InlineButton {
  text: string;
  type: 'url' | 'callback_data' | 'web_app';
  value: string;
}

interface ReplyButton {
  text: string;
  textEn?: string;
  actionType: 'text' | 'navigate';
  actionValue?: string;
}

interface MenuPage {
  id: string;
  name: string;
  rows: ReplyButton[][];
}

interface MessageData {
  id: string;
  label?: string;
  type: 'text' | 'photo' | 'video';  // 添加视频类型支持
  content: string;
  mediaUrl?: string;
  inlineKeyboard?: InlineButton[][];
  disableWebPagePreview?: boolean;
}

interface AutoReplyRule {
  id: string;
  triggerType: 'keyword' | 'command';
  triggerValue: string;
  replyMessages: MessageData[];
}

interface KeyboardConfig {
  bot_token: string;
  reply_keyboard: MenuPage[] | null;
  auto_reply_rules: AutoReplyRule[] | null;
  flow_messages: MessageData[] | null;
  commands: { command: string; description: string }[] | null;
  force_menu_on_start: boolean | null;
  activity_log_enabled: boolean | null;
  bilingual_button_enabled: boolean | null;
  user_language_preferences: Record<string, string> | null;
  menu_admin_chat_id: number | null;
  auto_cleanup_enabled: boolean | null;
  auto_cleanup_days: number | null;
}

// 发送Telegram消息的辅助函数
async function sendTelegramMessage(botToken: string, method: string, body: any) {
  const url = `https://api.telegram.org/bot${botToken}/${method}`;
  console.log(`Calling Telegram API: ${method}`, JSON.stringify(body, null, 2));
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  
  const result = await response.json();
  console.log(`Telegram API response:`, JSON.stringify(result, null, 2));
  return result;
}

// 获取用户的语言偏好
function getUserLanguage(chatId: number, userLanguagePreferences: Record<string, string> | null): 'zh' | 'en' {
  if (!userLanguagePreferences) return 'zh';
  return (userLanguagePreferences[chatId.toString()] as 'zh' | 'en') || 'zh';
}

// 根据语言偏好生成键盘
function generateKeyboardWithLanguage(
  menuPage: MenuPage | undefined,
  language: 'zh' | 'en',
  bilingualEnabled: boolean
): { text: string }[][] | null {
  if (!menuPage || menuPage.rows.length === 0) return null;
  
  const keyboard = menuPage.rows.map(row => 
    row.map(btn => ({
      text: language === 'en' && btn.textEn ? btn.textEn : btn.text
    }))
  );
  
  // 如果开启双语按钮，添加语言切换按钮到最后一行
  if (bilingualEnabled) {
    const langButton = language === 'zh' 
      ? { text: '🌐 English' }
      : { text: '🌐 中文' };
    keyboard.push([langButton]);
  }
  
  return keyboard;
}

// 处理菜单导航
async function handleMenuNavigation(
  botToken: string, 
  chatId: number, 
  text: string, 
  menuPages: MenuPage[],
  language: 'zh' | 'en' = 'zh',
  bilingualEnabled: boolean = false
): Promise<boolean> {
  const textNorm = text.trim().toLowerCase();
  
  for (const page of menuPages) {
    for (const row of page.rows) {
      for (const btn of row) {
        // 检查中文或英文文本匹配
        const zhMatch = btn.text.toLowerCase() === textNorm;
        const enMatch = btn.textEn && btn.textEn.toLowerCase() === textNorm;
        
        if ((zhMatch || enMatch) && btn.actionType === 'navigate' && btn.actionValue) {
          const targetPage = menuPages.find(p => p.id === btn.actionValue);
          if (targetPage) {
            const keyboard = generateKeyboardWithLanguage(targetPage, language, bilingualEnabled);
            await sendTelegramMessage(botToken, 'sendMessage', {
              chat_id: chatId,
              text: language === 'en' ? `📂 Switch to: ${targetPage.name}` : `📂 切换菜单: ${targetPage.name}`,
              reply_markup: keyboard ? {
                keyboard,
                resize_keyboard: true,
                one_time_keyboard: false
              } : undefined
            });
            console.log(`Menu navigation: ${page.name} -> ${targetPage.name}`);
            return true;
          }
        }
      }
    }
  }
  return false;
}

// 处理自动回复 - 同时附带最新的底部键盘
async function handleAutoReply(
  botToken: string,
  chatId: number,
  text: string,
  autoReplyRules: AutoReplyRule[],
  menuPages?: MenuPage[],
  language: 'zh' | 'en' = 'zh',
  bilingualEnabled: boolean = false
): Promise<boolean> {
  const textNorm = text.trim().toLowerCase();
  const cleanText = textNorm.replace(/^\//, '');
  const firstToken = cleanText.split(/\s+/)[0];

  const matchedRule = autoReplyRules.find((r) => {
    const ruleVal = (r.triggerValue || '').trim().toLowerCase();
    if (!ruleVal) return false;

    const cleanRule = ruleVal.replace(/^\//, '');

    if (r.triggerType === 'command') {
      // 支持: “/cmd”、 “cmd”、 “/cmd 参数...”、 “cmd 参数...”
      return firstToken === cleanRule;
    }

    // keyword: 支持包含匹配（用户输入可能带参数/前后文）
    return cleanText.includes(cleanRule);
  });
  
  if (matchedRule) {
    console.log(`Auto-reply matched: ${matchedRule.triggerValue}`);
    
    // 获取主菜单的底部键盘，用于附带到自动回复消息中
    const mainPage = menuPages?.find((p: MenuPage) => p.id === 'main');
    const keyboard = generateKeyboardWithLanguage(mainPage, language, bilingualEnabled);
    const replyKeyboard = keyboard ? {
      keyboard,
      resize_keyboard: true,
      one_time_keyboard: false
    } : null;
    
    for (const reply of matchedRule.replyMessages) {
      const body: any = { chat_id: chatId, parse_mode: 'HTML' };
      
      if (reply.disableWebPagePreview) {
        body.disable_web_page_preview = true;
      }
      
      // 处理内联键盘 - 内联键盘和底部键盘不能同时在一个消息中发送
      // 如果有内联键盘，优先发送内联键盘
      if (reply.inlineKeyboard && reply.inlineKeyboard.length > 0) {
        body.reply_markup = {
          inline_keyboard: reply.inlineKeyboard.map(row =>
            row.map(btn => {
              if (btn.type === 'url') {
                return { text: btn.text, url: btn.value };
              } else if (btn.type === 'callback_data') {
                return { text: btn.text, callback_data: btn.value };
              } else if (btn.type === 'web_app') {
                return { text: btn.text, web_app: { url: btn.value } };
              }
              return { text: btn.text, callback_data: btn.value };
            })
          )
        };
      } else if (replyKeyboard) {
        // 如果没有内联键盘，附带最新的底部键盘（实现菜单自动刷新）
        body.reply_markup = replyKeyboard;
      }
      
      // 标记需要额外发送底部键盘刷新（当有内联键盘时）
      const needExtraKeyboardRefresh = reply.inlineKeyboard && reply.inlineKeyboard.length > 0 && replyKeyboard;
      
      try {
        if (reply.type === 'photo' && reply.mediaUrl) {
          body.photo = reply.mediaUrl;
          body.caption = reply.content;
          await sendTelegramMessage(botToken, 'sendPhoto', body);
        } else if (reply.type === 'video' && reply.mediaUrl) {
          // 视频消息支持
          body.video = reply.mediaUrl;
          body.caption = reply.content;
          await sendTelegramMessage(botToken, 'sendVideo', body);
        } else {
          body.text = reply.content;
          await sendTelegramMessage(botToken, 'sendMessage', body);
        }
        
        // 如果发送的消息带有内联键盘，由于内联键盘和底部键盘不能同时发送
        // 底部键盘将在最后一条消息后自动刷新（通过最后一条消息携带底部键盘）
        // 不再发送额外的刷新提示消息，避免消息过多
      } catch (e) {
        console.error("Auto-reply send failed:", e);
      }
    }
    return true;
  }
  return false;
}

// 处理callback_query（内联按钮点击）
async function handleCallbackQuery(
  botToken: string,
  callbackQuery: any,
  autoReplyRules: AutoReplyRule[]
): Promise<boolean> {
  const callbackData = callbackQuery.data;
  const chatId = callbackQuery.message?.chat?.id;
  const messageId = callbackQuery.message?.message_id;
  
  if (!callbackData || !chatId) return false;
  
  console.log(`Callback query received: ${callbackData}`);
  
  // 先回应callback_query，避免loading状态
  await sendTelegramMessage(botToken, 'answerCallbackQuery', {
    callback_query_id: callbackQuery.id
  });
  
  // 查找匹配的自动回复规则
  const matchedRule = autoReplyRules.find(r => {
    const ruleVal = r.triggerValue.toLowerCase();
    return callbackData.toLowerCase() === ruleVal;
  });
  
  if (matchedRule) {
    console.log(`Callback matched rule: ${matchedRule.triggerValue}`);
    
    for (const reply of matchedRule.replyMessages) {
      const body: any = { chat_id: chatId, parse_mode: 'HTML' };
      
      if (reply.disableWebPagePreview) {
        body.disable_web_page_preview = true;
      }
      
      if (reply.inlineKeyboard && reply.inlineKeyboard.length > 0) {
        body.reply_markup = {
          inline_keyboard: reply.inlineKeyboard.map(row =>
            row.map(btn => {
              if (btn.type === 'url') {
                return { text: btn.text, url: btn.value };
              } else if (btn.type === 'callback_data') {
                return { text: btn.text, callback_data: btn.value };
              } else if (btn.type === 'web_app') {
                return { text: btn.text, web_app: { url: btn.value } };
              }
              return { text: btn.text, callback_data: btn.value };
            })
          )
        };
      }
      
      try {
        if (reply.type === 'photo' && reply.mediaUrl) {
          body.photo = reply.mediaUrl;
          body.caption = reply.content;
          await sendTelegramMessage(botToken, 'sendPhoto', body);
        } else if (reply.type === 'video' && reply.mediaUrl) {
          // 视频消息支持
          body.video = reply.mediaUrl;
          body.caption = reply.content;
          await sendTelegramMessage(botToken, 'sendVideo', body);
        } else {
          body.text = reply.content;
          await sendTelegramMessage(botToken, 'sendMessage', body);
        }
      } catch (e) {
        console.error("Callback reply failed:", e);
      }
    }
    return true;
  }
  
  return false;
}

// 发送主菜单
async function sendMainMenu(
  botToken: string,
  chatId: number,
  menuPages: MenuPage[],
  greetingMessage?: string,
  language: 'zh' | 'en' = 'zh',
  bilingualEnabled: boolean = false
) {
  const mainPage = menuPages.find(p => p.id === 'main');
  if (mainPage && mainPage.rows.length > 0) {
    const keyboard = generateKeyboardWithLanguage(mainPage, language, bilingualEnabled);
    await sendTelegramMessage(botToken, 'sendMessage', {
      chat_id: chatId,
      text: greetingMessage || (language === 'en' ? '📂 Welcome! Please select from the menu' : '📂 欢迎使用，请选择菜单'),
      reply_markup: keyboard ? {
        keyboard,
        resize_keyboard: true,
        one_time_keyboard: false
      } : undefined
    });
    console.log('Main menu sent to user');
    return true;
  }
  return false;
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

    const body = await req.json();
    console.log('Received webhook:', JSON.stringify(body, null, 2));

    // Extract bot token from URL path
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const botToken = pathParts[pathParts.length - 1];

    if (!botToken || botToken === 'telegram-webhook') {
      console.log('No bot token in path');
      return new Response(JSON.stringify({ error: 'Missing bot token' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Find the bot activation by token (可能为空，菜单键盘可独立运行)
    const { data: activation } = await supabase
      .from('bot_activations')
      .select('*')
      .eq('bot_token', botToken)
      .maybeSingle();

    // 检查双向聊天的授权状态（如果有绑定）
    let bidirectionalChatEnabled = false;
    let personalUserId = 0;
    
    if (activation) {
      // 首先检查管理员是否手动关闭了双向聊天功能
      if (activation.is_active === false) {
        console.log('Bidirectional chat disabled by admin toggle');
        // 不返回错误，继续处理菜单键盘功能
      } else if (activation.expire_at && new Date(activation.expire_at) < new Date()) {
        // Check if bot is expired
        console.log('Bot activation expired - disabling bidirectional chat');
        await supabase
          .from('bot_activations')
          .update({ is_active: false })
          .eq('id', activation.id);
        // 不返回错误，继续处理菜单键盘功能
      } else if (activation.is_authorized || (activation.trial_messages_used < activation.trial_limit)) {
        // 双向聊天功能可用
        bidirectionalChatEnabled = activation.app_enabled !== false;
        personalUserId = parseInt(activation.personal_user_id);
      } else {
        console.log('Trial limit reached - bidirectional chat disabled');
      }
    }

    // 获取菜单键盘配置
    const { data: keyboardConfig } = await supabase
      .from('keyboard_configs')
      .select('*')
      .eq('bot_token', botToken)
      .maybeSingle();

    // 检查菜单键盘是否过期或试用已结束
    let keyboardMenuEnabled = true;
    if (keyboardConfig) {
      const now = new Date();
      const keyboardExpireAt = keyboardConfig.keyboard_expire_at ? new Date(keyboardConfig.keyboard_expire_at) : null;
      const keyboardTrialStartedAt = keyboardConfig.keyboard_trial_started_at ? new Date(keyboardConfig.keyboard_trial_started_at) : null;
      
      // 如果已激活授权，检查是否过期
      if (keyboardExpireAt) {
        if (keyboardExpireAt < now) {
          console.log('Keyboard menu expired - disabling keyboard features');
          keyboardMenuEnabled = false;
        }
      } else if (keyboardTrialStartedAt) {
        // 试用模式：24小时后过期
        const trialEndTime = new Date(keyboardTrialStartedAt.getTime() + 24 * 60 * 60 * 1000);
        if (now > trialEndTime) {
          console.log('Keyboard menu trial expired (24h) - disabling keyboard features');
          keyboardMenuEnabled = false;
        }
      }
    }

    const menuPages: MenuPage[] = keyboardMenuEnabled ? (keyboardConfig?.reply_keyboard || []) : [];
    const autoReplyRules: AutoReplyRule[] = keyboardMenuEnabled ? (keyboardConfig?.auto_reply_rules || []) : [];
    const forceMenuOnStart: boolean = keyboardMenuEnabled ? (keyboardConfig?.force_menu_on_start || false) : false;
    const activityLogEnabled: boolean = keyboardConfig?.activity_log_enabled !== false; // 默认为true
    const bilingualEnabled: boolean = keyboardMenuEnabled ? (keyboardConfig?.bilingual_button_enabled || false) : false;
    let userLanguagePreferences: Record<string, string> = keyboardConfig?.user_language_preferences || {};
    const menuAdminChatId: number = keyboardConfig?.menu_admin_chat_id ? Number(keyboardConfig.menu_admin_chat_id) : 0;

    console.log(`Keyboard config loaded: ${menuPages.length} pages, ${autoReplyRules.length} rules, activityLog: ${activityLogEnabled}, bilingual: ${bilingualEnabled}, bidirectionalChat: ${bidirectionalChatEnabled}, menuAdminChatId: ${menuAdminChatId}, keyboardMenuEnabled: ${keyboardMenuEnabled}`);

    // 处理 callback_query（内联按钮点击）
    if (body.callback_query) {
      const handled = await handleCallbackQuery(botToken, body.callback_query, autoReplyRules);
      console.log(`Callback query handled: ${handled}`);
      
      // 确定活动记录接收者：优先双向聊天的personalUserId，否则使用菜单键盘的menuAdminChatId
      const activityRecipient = bidirectionalChatEnabled && personalUserId > 0 ? personalUserId : menuAdminChatId;
      
      // 如果活动记录开启且有接收者，转发内联按钮点击事件
      if (activityLogEnabled && activityRecipient > 0) {
        const cbFromUser = body.callback_query.from;
        const cbChatId = body.callback_query.message?.chat?.id;
        const cbUserName = cbFromUser.first_name + (cbFromUser.last_name ? ' ' + cbFromUser.last_name : '');
        const callbackData = body.callback_query.data || '';
        
        if (cbChatId && cbChatId !== activityRecipient) {
          const activityText = `📋 用户操作记录\n来自: ${cbUserName}\n用户ID: ${cbChatId}\n操作: 点击内联按钮\n按钮数据: ${callbackData}`;
          await sendTelegramMessage(botToken, 'sendMessage', {
            chat_id: activityRecipient,
            text: activityText,
          });
        }
      }
      
      return new Response(JSON.stringify({ ok: true, callback_handled: handled }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const message = body.message;
    if (!message) {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const chatId = message.chat.id;
    const fromUser = message.from;
    let text = message.text || message.caption || '';
    const messageId = message.message_id;

    // 处理图片消息
    let photoUrl = '';
    let photoFileId = '';
    if (message.photo && message.photo.length > 0) {
      const largestPhoto = message.photo[message.photo.length - 1];
      photoFileId = largestPhoto.file_id;
      
      const fileResponse = await fetch(
        `https://api.telegram.org/bot${botToken}/getFile?file_id=${photoFileId}`
      );
      const fileData = await fileResponse.json();
      
      if (fileData.ok && fileData.result.file_path) {
        photoUrl = `https://api.telegram.org/file/bot${botToken}/${fileData.result.file_path}`;
        text = `[图片] ${photoUrl}` + (text ? `\n${text}` : '');
      }
      console.log('Photo received:', { photoFileId, photoUrl });
    }

    // Check if this is a reply from personal user to forward (仅当双向聊天可用时)
    if (bidirectionalChatEnabled && activation && chatId === personalUserId && message.reply_to_message) {
      if (activation.app_enabled === false) {
        console.log('App port disabled - reply blocked');
        return new Response(JSON.stringify({ ok: true, blocked: 'app_port_disabled' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const replyText = message.reply_to_message.text || message.reply_to_message.caption || '';
      const chatIdMatch = replyText.match(/\[CHATID:(\d+):MSGID:(\d+)\]/);
      
      if (chatIdMatch) {
        const targetChatId = parseInt(chatIdMatch[1]);
        const originalMsgId = parseInt(chatIdMatch[2]);
        
        console.log(`Routing reply to chatId: ${targetChatId}, originalMsgId: ${originalMsgId}`);
        
        let sendResult;
        let messageContent = message.text || message.caption || '';
        
        if (message.photo && message.photo.length > 0) {
          const replyPhotoFileId = message.photo[message.photo.length - 1].file_id;
          const sendResponse = await fetch(
            `https://api.telegram.org/bot${botToken}/sendPhoto`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: targetChatId,
                photo: replyPhotoFileId,
                caption: messageContent,
                reply_to_message_id: originalMsgId,
              }),
            }
          );
          sendResult = await sendResponse.json();
          
          const fileResponse = await fetch(
            `https://api.telegram.org/bot${botToken}/getFile?file_id=${replyPhotoFileId}`
          );
          const fileData = await fileResponse.json();
          if (fileData.ok && fileData.result.file_path) {
            const replyPhotoUrl = `https://api.telegram.org/file/bot${botToken}/${fileData.result.file_path}`;
            messageContent = `[图片] ${replyPhotoUrl}` + (messageContent ? `\n${messageContent}` : '');
          } else {
            messageContent = `[图片]` + (messageContent ? `\n${messageContent}` : '');
          }
        } else {
          const sendResponse = await fetch(
            `https://api.telegram.org/bot${botToken}/sendMessage`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: targetChatId,
                text: messageContent,
                reply_to_message_id: originalMsgId,
              }),
            }
          );
          sendResult = await sendResponse.json();
        }

        console.log('Reply sent result:', JSON.stringify(sendResult, null, 2));

        if (sendResult.ok) {
          await supabase.from('messages').insert({
            bot_activation_id: activation.id,
            telegram_chat_id: targetChatId,
            telegram_message_id: sendResult.result?.message_id,
            telegram_user_name: '我',
            content: messageContent,
            direction: 'outgoing',
          });
        }

        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Skip messages from personal user that are not replies (仅当双向聊天可用时)
    if (bidirectionalChatEnabled && personalUserId > 0 && chatId === personalUserId) {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 存储消息到数据库 (仅当双向聊天可用时)
    const userName = fromUser.first_name + (fromUser.last_name ? ' ' + fromUser.last_name : '');
    
    if (bidirectionalChatEnabled && activation) {
      await supabase.from('messages').insert({
        bot_activation_id: activation.id,
        telegram_chat_id: chatId,
        telegram_user_name: userName,
        telegram_message_id: messageId,
        content: text,
        direction: 'incoming',
        is_read: activation.web_enabled === false ? null : false,
      });
    }

    // 自动抓取用户数据到 bot_users 表 (菜单键盘功能需要)
    try {
      await supabase.from('bot_users').upsert({
        bot_token: botToken,
        telegram_user_id: chatId,
        first_name: fromUser.first_name || '',
        last_name: fromUser.last_name || null,
        username: fromUser.username || null,
        last_seen_at: new Date().toISOString(),
      }, { 
        onConflict: 'bot_token,telegram_user_id',
        ignoreDuplicates: false 
      });
      console.log(`User ${chatId} saved/updated in bot_users`);
    } catch (e) {
      console.error('Failed to save user to bot_users:', e);
    }

    // Update trial messages count if not authorized (仅当有activation时)
    if (activation && !activation.is_authorized) {
      await supabase
        .from('bot_activations')
        .update({ trial_messages_used: activation.trial_messages_used + 1 })
        .eq('id', activation.id);
        
      await supabase
        .from('bot_trial_records')
        .upsert({
          bot_token: botToken,
          messages_used: activation.trial_messages_used + 1,
          is_blocked: activation.trial_messages_used + 1 >= activation.trial_limit,
        }, { onConflict: 'bot_token' });
    }

    // 菜单键盘功能 - 独立运行，不依赖双向聊天
    let keyboardHandled = false;
    
    // 获取用户的语言偏好
    let userLanguage = getUserLanguage(chatId, userLanguagePreferences);
    
    // 检查是否是语言切换按钮点击
    if (bilingualEnabled && (text === '🌐 English' || text === '🌐 中文')) {
      // 切换语言
      const newLanguage: 'zh' | 'en' = text === '🌐 English' ? 'en' : 'zh';
      userLanguagePreferences[chatId.toString()] = newLanguage;
      userLanguage = newLanguage;
      
      // 保存语言偏好到数据库
      await supabase
        .from('keyboard_configs')
        .update({ user_language_preferences: userLanguagePreferences })
        .eq('bot_token', botToken);
      
      // 发送切换确认并更新键盘
      const mainPage = menuPages.find((p: MenuPage) => p.id === 'main');
      const keyboard = generateKeyboardWithLanguage(mainPage, newLanguage, bilingualEnabled);
      
      await sendTelegramMessage(botToken, 'sendMessage', {
        chat_id: chatId,
        text: newLanguage === 'en' ? '🌐 Switched to English' : '🌐 已切换为中文',
        reply_markup: keyboard ? {
          keyboard,
          resize_keyboard: true,
          one_time_keyboard: false
        } : undefined
      });
      
      console.log(`Language switched to ${newLanguage} for user ${chatId}`);
      keyboardHandled = true;
    }
    
    // 处理 /start 命令
    if (!keyboardHandled && text === '/start') {
      // 欢迎语逻辑：
      // 1. 同时有双向聊天和菜单键盘时 → 使用菜单键盘的/start自动回复
      // 2. 只有双向聊天时 → 使用双向聊天的欢迎语(activation.greeting_message)
      
      const hasBidirectionalChat = bidirectionalChatEnabled && activation;
      const hasKeyboardMenu = keyboardMenuEnabled && menuPages.length > 0;
      
      // 如果同时有双向聊天和菜单键盘，优先使用菜单键盘的/start自动回复
      if (hasBidirectionalChat && hasKeyboardMenu) {
        // 先检查自动回复规则中是否有 /start 命令
        const hasStartAutoReply = autoReplyRules.some(r => {
          const ruleVal = (r.triggerValue || '').trim().toLowerCase().replace(/^\//, '');
          return r.triggerType === 'command' && ruleVal === 'start';
        });
        
        if (hasStartAutoReply) {
          // 使用菜单键盘的/start自动回复
          keyboardHandled = await handleAutoReply(botToken, chatId, text, autoReplyRules, menuPages, userLanguage, bilingualEnabled);
        } else if (forceMenuOnStart) {
          // 没有/start自动回复但配置了强制显示菜单
          await sendMainMenu(botToken, chatId, menuPages, undefined, userLanguage, bilingualEnabled);
          keyboardHandled = true;
        } else {
          // 没有配置/start自动回复，发送默认菜单
          await sendMainMenu(botToken, chatId, menuPages, undefined, userLanguage, bilingualEnabled);
          keyboardHandled = true;
        }
      } else if (hasKeyboardMenu) {
        // 只有菜单键盘，使用菜单键盘的自动回复或默认菜单
        if (forceMenuOnStart) {
          await sendMainMenu(botToken, chatId, menuPages, undefined, userLanguage, bilingualEnabled);
          keyboardHandled = true;
        } else {
          keyboardHandled = await handleAutoReply(botToken, chatId, text, autoReplyRules, menuPages, userLanguage, bilingualEnabled);
          if (!keyboardHandled && menuPages.length > 0) {
            await sendMainMenu(botToken, chatId, menuPages, undefined, userLanguage, bilingualEnabled);
            keyboardHandled = true;
          }
        }
      } else if (hasBidirectionalChat && activation?.greeting_message) {
        // 只有双向聊天，使用双向聊天的欢迎语
        await sendTelegramMessage(botToken, 'sendMessage', {
          chat_id: chatId,
          text: activation.greeting_message,
        });
        keyboardHandled = true;
      }
      
      // 如果以上都没处理，检查自动回复规则
      if (!keyboardHandled) {
        keyboardHandled = await handleAutoReply(botToken, chatId, text, autoReplyRules, menuPages, userLanguage, bilingualEnabled);
      }
    } else if (!keyboardHandled) {
      // 先检查菜单导航
      if (menuPages.length > 0) {
        keyboardHandled = await handleMenuNavigation(botToken, chatId, text, menuPages, userLanguage, bilingualEnabled);
      }

      // 如果菜单没有处理，检查自动回复 - 自动回复消息也附带最新键盘
      if (!keyboardHandled && autoReplyRules.length > 0) {
        keyboardHandled = await handleAutoReply(botToken, chatId, text, autoReplyRules, menuPages, userLanguage, bilingualEnabled);
      }
      
      // 非双向聊天模式下：无论消息是否被处理，都确保用户收到最新的底部键盘
      // 如果消息已被处理（自动回复/菜单按钮），handleAutoReply 已经附带了键盘
      // 如果消息未被处理，这里补发最新键盘
      if (!keyboardHandled && !bidirectionalChatEnabled && menuPages.length > 0) {
        const mainPage = menuPages.find((p: MenuPage) => p.id === 'main');
        if (mainPage && mainPage.rows.length > 0) {
          const keyboard = generateKeyboardWithLanguage(mainPage, userLanguage, bilingualEnabled);
          if (keyboard) {
            await sendTelegramMessage(botToken, 'sendMessage', {
              chat_id: chatId,
              text: '📂 请使用菜单选择功能',
              reply_markup: {
                keyboard,
                resize_keyboard: true,
                one_time_keyboard: false
              }
            });
            console.log('Keyboard refreshed for unhandled message (menu-only mode)');
          }
        }
      }
    }

    // 确定活动记录接收者：优先双向聊天的personalUserId，否则使用菜单键盘的menuAdminChatId
    const activityRecipient = bidirectionalChatEnabled && personalUserId > 0 ? personalUserId : menuAdminChatId;
    
    // 转发消息给管理员（支持无双向聊天绑定的菜单键盘机器人）
    if (activityRecipient > 0 && chatId !== activityRecipient) {
      
      if (bidirectionalChatEnabled && personalUserId > 0) {
        // ===== 双向聊天模式：转发完整消息带发起私聊按钮 =====
        // 根据 activityLogEnabled 设置决定是否转发已自动处理的消息
        const shouldForward = activityLogEnabled || !keyboardHandled;
        
        if (shouldForward) {
          // 构建发起私聊按钮 - 点击可直接跳转到用户私聊
          const privateChatButton = {
            inline_keyboard: [[
              { text: `💬 发起私聊 (${fromUser.first_name})`, url: `tg://user?id=${chatId}` }
            ]]
          };
          
          // 转发消息到管理员（带发起私聊按钮）
          if (photoFileId) {
            const forwardCaption = `📨 新消息\n来自: ${userName}\n[CHATID:${chatId}:MSGID:${messageId}]\n${keyboardHandled ? '✅ 已自动处理' : ''}\n\n${message.caption || ''}`;
            await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: personalUserId,
                photo: photoFileId,
                caption: forwardCaption,
                reply_markup: privateChatButton,
              }),
            });
          } else {
            const forwardText = `📨 新消息\n来自: ${userName}\n[CHATID:${chatId}:MSGID:${messageId}]\n${keyboardHandled ? '✅ 已自动处理' : ''}\n\n${text}`;
            await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: personalUserId,
                text: forwardText,
                reply_markup: privateChatButton,
              }),
            });
          }
          console.log(`Bidirectional chat: Message forwarded to personalUserId: ${personalUserId}`);
        } else {
          console.log('Activity log disabled - auto-processed message not forwarded');
        }
        
      } else if (menuAdminChatId > 0 && activityLogEnabled) {
        // ===== 菜单键盘模式（无双向聊天）：只发送简洁的活动记录，不带发起私聊按钮 =====
        // 仅在 activityLogEnabled 开启时发送活动记录
        
        // 确定操作类型
        let operationType = '发送消息';
        if (text === '/start') {
          operationType = '点击 /start 启动机器人';
        } else if (text.startsWith('/')) {
          operationType = `发送指令: ${text}`;
        } else if (keyboardHandled) {
          operationType = `点击菜单按钮: ${text}`;
        } else {
          operationType = `发送文字: ${text.substring(0, 50)}${text.length > 50 ? '...' : ''}`;
        }
        
        // 如果是图片
        if (photoFileId) {
          operationType = `发送图片${message.caption ? ` (附言: ${message.caption.substring(0, 30)}...)` : ''}`;
        }
        
        const activityText = `📋 用户操作记录\n来自: ${userName}\n用户ID: ${chatId}\n操作: ${operationType}`;
        
        await sendTelegramMessage(botToken, 'sendMessage', {
          chat_id: menuAdminChatId,
          text: activityText,
        });
        
        console.log(`Menu bot: Activity record sent to menuAdminChatId: ${menuAdminChatId}`);
      } else {
        console.log('Activity log disabled or no recipient configured');
      }
    } else {
      console.log('No activity recipient configured or message from admin - skipping forward');
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Webhook error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
