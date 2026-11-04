import { telegramConfig } from "@/config/telegram";

const TELEGRAM_API = `${window.location.origin}/telegram/bot`;

export interface TelegramMessage {
  id: number;
  from: string;
  text: string;
  timestamp: number;
  chatId: number;
}

export const sendMessage = async (chatId: string | number, text: string) => {
  try {
    const response = await fetch(
      `${TELEGRAM_API}${telegramConfig.botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: text,
        }),
      }
    );
    
    const data = await response.json();
    
    if (!response.ok) {
      const errorMsg = data.description || response.statusText;
      console.error("Telegram API Error:", data);
      throw new Error(`发送失败: ${errorMsg}`);
    }
    
    return data;
  } catch (error: any) {
    console.error("发送消息错误:", error);
    throw new Error(error.message || "发送消息失败，请检查网络连接");
  }
};

export const getUpdates = async (offset?: number) => {
  try {
    const url = new URL(`${TELEGRAM_API}${telegramConfig.botToken}/getUpdates`);
    if (offset) url.searchParams.set("offset", offset.toString());
    
    const response = await fetch(url.toString());
    const data = await response.json();
    
    if (!response.ok) {
      const errorMsg = data.description || response.statusText;
      console.error("Telegram API Error:", data);
      throw new Error(errorMsg);
    }
    
    return data.result;
  } catch (error: any) {
    console.error("获取更新错误:", error);
    throw error;
  }
};

export const sendGreeting = async (chatId: string | number) => {
  return sendMessage(chatId, telegramConfig.greetingMessage);
};

export const deleteWebhook = async () => {
  try {
    const response = await fetch(
      `${TELEGRAM_API}${telegramConfig.botToken}/deleteWebhook`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }
    );
    
    if (!response.ok) {
      throw new Error(`Failed to delete webhook: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error("Error deleting webhook:", error);
    throw error;
  }
};

// 转发消息到个人账户 - 包含特殊标记用于回复识别
export const forwardMessageToPersonal = async (
  fromChatId: number,
  fromName: string,
  messageText: string,
  messageId: number
) => {
  const forwardText = `📩 来自: ${fromName}\n💬 ${messageText}\n\n[CHATID:${fromChatId}:MSGID:${messageId}]`;
  return sendMessage(telegramConfig.personalUserId, forwardText);
};

// 从回复的消息中提取chatId
export const extractChatIdFromReply = (replyText: string): number | null => {
  const match = replyText.match(/\[CHATID:(\d+):MSGID:\d+\]/);
  return match ? parseInt(match[1]) : null;
};

// 处理来自个人账户的消息（支持Telegram原生回复）
export const processPersonalMessage = (
  message: string,
  lastChatId: number | null,
  replyToMessageText?: string
): {
  isCommand: boolean;
  targetChatId?: number;
  messageText?: string;
  commandType?: 'reply' | 'quickReply' | 'directReply' | 'nativeReply';
} => {
  // 优先检测Telegram原生回复
  if (replyToMessageText) {
    const chatId = extractChatIdFromReply(replyToMessageText);
    if (chatId) {
      return {
        isCommand: true,
        commandType: 'nativeReply',
        targetChatId: chatId,
        messageText: message
      };
    }
  }

  // 命令格式1: /reply <chatId> <message>
  const replyMatch = message.match(/^\/reply\s+(\d+)\s+(.+)$/s);
  if (replyMatch) {
    return {
      isCommand: true,
      commandType: 'reply',
      targetChatId: parseInt(replyMatch[1]),
      messageText: replyMatch[2]
    };
  }

  // 命令格式2: /r <message> (回复最近聊天)
  const quickReplyMatch = message.match(/^\/r\s+(.+)$/s);
  if (quickReplyMatch && lastChatId) {
    return {
      isCommand: true,
      commandType: 'quickReply',
      targetChatId: lastChatId,
      messageText: quickReplyMatch[1]
    };
  }

  // 直接回复（不是命令，但有最近聊天ID）
  if (lastChatId && !message.startsWith('/')) {
    return {
      isCommand: true,
      commandType: 'directReply',
      targetChatId: lastChatId,
      messageText: message
    };
  }

  return { isCommand: false };
};
