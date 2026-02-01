import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Plus, Bot, MessageCircle, User, Key, Trash2, Calendar, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { BotActivation, ChatItem } from "@/types/bot";
import { useLanguage } from "@/hooks/use-language";

interface ChatSidebarProps {
  bots: BotActivation[];
  chats: ChatItem[];
  selectedBotId: string | null;
  selectedChatId: number | null;
  onSelectBot: (botId: string) => void;
  onSelectChat: (chatId: number) => void;
  onAddBot: () => void;
  onDeleteBot: (botId: string) => void;
  onBotUpdated: (bot: BotActivation) => void;
  unreadChats: Set<number>;
}

export const ChatSidebar = ({
  bots,
  chats,
  selectedBotId,
  selectedChatId,
  onSelectBot,
  onSelectChat,
  onAddBot,
  onDeleteBot,
  onBotUpdated,
  unreadChats,
}: ChatSidebarProps) => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [bindingBotId, setBindingBotId] = useState<string | null>(null);
  const [activationCode, setActivationCode] = useState("");
  const [isBinding, setIsBinding] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const handleResetBinding = async () => {
    if (!selectedBotId) {
      toast({
        title: t('sidebar.error'),
        description: t('sidebar.selectBotFirst'),
        variant: "destructive",
      });
      return;
    }

    const selectedBot = bots.find(b => b.id === selectedBotId);
    if (!selectedBot) return;

    setIsResetting(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-bot', {
        body: { 
          action: 'reset-webhook',
          botToken: selectedBot.bot_token,
        }
      });
      
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      
      toast({
        title: t('sidebar.resetSuccess'),
        description: t('sidebar.webhookReset'),
      });
    } catch (error: any) {
      toast({
        title: t('sidebar.resetFailed'),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsResetting(false);
    }
  };

  const filteredChats = selectedBotId 
    ? chats.filter(chat => chat.botId === selectedBotId)
    : chats;


  const handleBindCode = async (botId: string) => {
    if (!activationCode.trim()) {
      toast({
        title: t('sidebar.error'),
        description: t('sidebar.enterCodeError'),
        variant: "destructive",
      });
      return;
    }

    setIsBinding(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-bot', {
        body: { 
          action: 'bind-code',
          botId: botId,
          code: activationCode.trim(),
        }
      });
      
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      
      toast({
        title: t('sidebar.bindSuccess'),
        description: t('sidebar.codeBindSuccess'),
      });
      setActivationCode("");
      setBindingBotId(null);
      
      if (data.bot) {
        onBotUpdated(data.bot);
      }
    } catch (error: any) {
      toast({
        title: t('sidebar.bindFailed'),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsBinding(false);
    }
  };

  const formatExpireDate = (expireAt: string | null) => {
    if (!expireAt) return t('user.forever');
    const date = new Date(expireAt);
    const now = new Date();
    if (date < now) return t('sidebar.expired');
    return date.toLocaleDateString('zh-CN');
  };


  return (
    <div className="w-full md:w-80 border-r md:border-b-0 border-b bg-muted/30 flex flex-col h-[450px]">
      {/* Add bot and reset buttons */}
      <div className="p-3 border-b">
        <div className="flex gap-2">
          <Button onClick={onAddBot} className="flex-1" size="sm">
            <Plus className="h-4 w-4 mr-1" />
            {t('sidebar.addBot')}
          </Button>
          <Button 
            onClick={handleResetBinding} 
            variant="outline"
            className="flex-1" 
            size="sm"
            disabled={isResetting || !selectedBotId}
          >
            <RefreshCw className={cn("h-4 w-4 mr-1", isResetting && "animate-spin")} />
            {t('sidebar.resetBinding')}
          </Button>
        </div>
      </div>

      {/* Bot list */}
      <div className="p-3 border-b">
        <h3 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
          <Bot className="h-3 w-3" />
          {t('sidebar.myBots')}
        </h3>
        <ScrollArea className="h-[180px]">
          <div className="space-y-2">
            {bots.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-2">
                {t('sidebar.noBots')}
              </p>
            ) : (
              bots.map((bot) => {
                const hasUnreadInBot = chats.some(
                  chat => chat.botId === bot.id && unreadChats.has(chat.chatId)
                );
                const isExpired = bot.expire_at && new Date(bot.expire_at) < new Date();
                const trialExceeded = !bot.is_authorized && bot.trial_messages_used >= bot.trial_limit;
                const needsActivation = !bot.is_authorized || isExpired;
                const webDisabled = !bot.web_enabled;
                
                return (
                  <div key={bot.id} className="space-y-1">
                    <div className="flex items-center gap-1">
                      <Button
                        variant={selectedBotId === bot.id ? "secondary" : "ghost"}
                        size="sm"
                        className={cn(
                          "flex-1 justify-start text-xs h-8",
                          hasUnreadInBot && bot.web_enabled && "animate-pulse ring-2 ring-primary"
                        )}
                        onClick={() => onSelectBot(bot.id)}
                      >
                        <Bot className="h-3 w-3 mr-1 shrink-0" />
                        <span className="truncate text-[10px]">
                          {bot.bot_token.split(':')[0]}...
                        </span>
                        {!bot.is_authorized && (
                          <Badge variant="outline" className="ml-1 text-[8px] px-1 py-0">
                            {t('sidebar.trial')}
                          </Badge>
                        )}
                        {isExpired && (
                          <Badge variant="destructive" className="ml-1 text-[8px] px-1 py-0">
                            {t('sidebar.expired')}
                          </Badge>
                        )}
                        {bot.is_active && !isExpired && !trialExceeded && bot.web_enabled && (
                          <span className="w-1.5 h-1.5 bg-green-500 rounded-full ml-1 shrink-0" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 shrink-0"
                        onClick={() => onDeleteBot(bot.id)}
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                    
                    {/* Status info and renew button */}
                    <div className="text-[10px] text-muted-foreground px-2 flex items-center gap-2">
                      <Calendar className="h-3 w-3" />
                      <span className={isExpired ? 'text-destructive' : trialExceeded ? 'text-yellow-600' : ''}>
                        {bot.is_authorized 
                          ? `${t('sidebar.validity')}: ${formatExpireDate(bot.expire_at)}` 
                          : `${t('sidebar.trialUsage')}: ${bot.trial_messages_used}/${bot.trial_limit}`}
                      </span>
                      {/* Renew button for active bots */}
                      {bot.is_authorized && !isExpired && bindingBotId !== bot.id && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-5 text-[10px] px-2 py-0 ml-auto"
                          onClick={() => setBindingBotId(bot.id)}
                        >
                          <Key className="h-2.5 w-2.5 mr-0.5" />
                          {t('sidebar.renew')}
                        </Button>
                      )}
                    </div>
                    
                    {/* Activation code input */}
                    {(needsActivation || bindingBotId === bot.id) && (
                      <div className="px-1">
                        {bindingBotId === bot.id ? (
                          <div className="flex gap-1">
                            <Input
                              placeholder={t('sidebar.enterCode')}
                              value={activationCode}
                              onChange={(e) => setActivationCode(e.target.value)}
                              className="h-6 text-xs flex-1"
                            />
                            <Button 
                              size="sm" 
                              className="h-6 text-xs px-2"
                              onClick={() => handleBindCode(bot.id)}
                              disabled={isBinding}
                            >
                              {isBinding ? '...' : t('sidebar.bind')}
                            </Button>
                            <Button 
                              size="sm" 
                              variant="ghost"
                              className="h-6 text-xs px-2"
                              onClick={() => {
                                setBindingBotId(null);
                                setActivationCode("");
                              }}
                            >
                              {t('sidebar.cancel')}
                            </Button>
                          </div>
                        ) : needsActivation && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full h-6 text-xs"
                            onClick={() => setBindingBotId(bot.id)}
                          >
                            <Key className="h-3 w-3 mr-1" />
                            {isExpired ? t('sidebar.renewActivate') : t('sidebar.bindCode')}
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
            
          </div>
        </ScrollArea>
      </div>

      {/* Chat list */}
      <div className="flex flex-col min-h-0 flex-1">
        <h3 className="text-xs font-semibold text-muted-foreground p-3 pb-2 flex items-center gap-1">
          <MessageCircle className="h-3 w-3" />
          {t('sidebar.chatList')}
        </h3>
        <ScrollArea className="flex-1">
          <div className="p-2 pt-0 space-y-1">
            {filteredChats.length === 0 ? (
              <div className="text-center py-4">
                <User className="h-6 w-6 mx-auto text-muted-foreground/50 mb-2" />
                <p className="text-xs text-muted-foreground">
                  {selectedBotId ? t('sidebar.waitUserMessage') : t('sidebar.selectBotFirst')}
                </p>
              </div>
            ) : (
              filteredChats.map((chat) => (
                <Button
                  key={`${chat.botId}-${chat.chatId}`}
                  variant={selectedChatId === chat.chatId ? "secondary" : "ghost"}
                  className={cn(
                    "w-full justify-start h-auto py-2 px-3",
                    unreadChats.has(chat.chatId) && "animate-pulse ring-2 ring-primary"
                  )}
                  onClick={() => onSelectChat(chat.chatId)}
                >
                  <div className="flex flex-col items-start w-full min-w-0">
                    <div className="flex items-center justify-between w-full">
                      <span className="font-medium text-sm truncate">
                        {chat.userName}
                      </span>
                      <span className="text-[10px] text-muted-foreground shrink-0 ml-2">
                        {chat.lastTime}
                      </span>
                    </div>
                    <div className="flex items-center justify-between w-full mt-0.5">
                      <span className="text-xs text-muted-foreground truncate">
                        {chat.lastMessage}
                      </span>
                      {unreadChats.has(chat.chatId) && (
                        <span className="w-2 h-2 bg-red-500 rounded-full shrink-0 ml-2" />
                      )}
                    </div>
                  </div>
                </Button>
              ))
            )}
            
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};

export default ChatSidebar;