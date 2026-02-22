import { useRef, useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send, AlertTriangle, Volume2, VolumeX, Bot, ShoppingCart, Image, ImagePlus, MessageSquare } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import type { BotActivation, Message } from "@/types/bot";
import { useLanguage } from "@/hooks/use-language";

interface ChatWindowProps {
  selectedBot: BotActivation | null;
  selectedChatId: number | null;
  messages: Message[];
  onSendMessage: (message: string, photoBase64?: string) => Promise<{ trialExceeded?: boolean; error?: string }>;
  enableSound: boolean;
  onToggleSound: () => void;
  soundType: string;
  onSoundTypeChange: (type: string) => void;
  onTestSound: () => void;
  chatStartEnabled?: boolean;
  onToggleChatStart?: () => void;
}

export const ChatWindow = ({
  selectedBot,
  selectedChatId,
  messages,
  onSendMessage,
  enableSound,
  onToggleSound,
  soundType,
  onSoundTypeChange,
  onTestSound,
  chatStartEnabled,
  onToggleChatStart,
}: ChatWindowProps) => {
  const { t } = useLanguage();
  const [replyText, setReplyText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [showTrialDialog, setShowTrialDialog] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!replyText.trim() && !selectedImage) return;
    
    if (selectedBot && !selectedBot.is_authorized && selectedBot.trial_messages_used >= selectedBot.trial_limit) {
      setShowTrialDialog(true);
      return;
    }
    
    setIsSending(true);
    const result = await onSendMessage(replyText, selectedImage || undefined);
    setIsSending(false);
    
    if (result.trialExceeded) {
      setShowTrialDialog(true);
    } else if (!result.error) {
      setReplyText("");
      setSelectedImage(null);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImageFile(file);
    }
    e.target.value = '';
  };

  const processImageFile = (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      alert(t('chat.imageSizeLimit'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setSelectedImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          processImageFile(file);
        }
        break;
      }
    }
  };

  const filteredMessages = messages.filter(m => m.telegram_chat_id === selectedChatId);
  const isExpired = selectedBot?.expire_at && new Date(selectedBot.expire_at) < new Date();
  const trialExceeded = selectedBot && !selectedBot.is_authorized && selectedBot.trial_messages_used >= selectedBot.trial_limit;
  const webDisabled = selectedBot && !selectedBot.web_enabled;
  const canSend = selectedBot?.is_active && !isExpired && !trialExceeded && selectedChatId && !webDisabled;

  const getProxyImageUrl = (telegramUrl: string, fileId?: string) => {
    if (!selectedBot) return '';
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (fileId) {
      return `${supabaseUrl}/functions/v1/get-telegram-image?fileId=${encodeURIComponent(fileId)}&botId=${selectedBot.id}`;
    }
    const encodedUrl = encodeURIComponent(telegramUrl);
    return `${supabaseUrl}/functions/v1/get-telegram-image?url=${encodedUrl}&botId=${selectedBot.id}`;
  };

  const renderMessageContent = (content: string) => {
    // 支持新格式 [图片:FILE_ID] 和旧格式 [图片]
    if (content.includes('[图片')) {
      const fileIdMatch = content.match(/\[图片:([^\]]+)\]/);
      const urlMatch = content.match(/(https:\/\/api\.telegram\.org\/file\/[^\s]+)/);
      const fileId = fileIdMatch?.[1];
      
      if ((fileId || urlMatch) && selectedBot) {
        const caption = content.replace(/\[图片(?::[^\]]+)?\]/, '').replace(urlMatch?.[0] || '', '').trim();
        const proxyUrl = getProxyImageUrl(urlMatch?.[0] || '', fileId);
        return (
          <div className="space-y-2">
            <img 
              src={proxyUrl} 
              alt={t('chat.imageMessage')} 
              className="max-w-full rounded-lg max-h-48 object-contain cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => setPreviewImage(proxyUrl)}
              onError={(e) => {
                const img = e.target as HTMLImageElement;
                img.style.display = 'none';
                console.error('Image load failed:', proxyUrl);
              }}
            />
            {caption && <p className="text-sm">{caption}</p>}
          </div>
        );
      }
      return (
        <div className="flex items-center gap-2 text-sm">
          <Image className="h-4 w-4" />
          <span>{content.replace(/\[图片(?::[^\]]+)?\]/, '').trim() || t('chat.imageMessage')}</span>
        </div>
      );
    }
    return <p className="text-sm whitespace-pre-wrap break-words">{content}</p>;
  };

  // No bot state
  if (!selectedBot) {
    return (
      <div className="flex-1 flex items-center justify-center bg-muted/20">
        <div className="text-center">
          <Bot className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-medium text-muted-foreground">{t('chat.welcome')}</h3>
          <p className="text-sm text-muted-foreground mt-2">
            {t('chat.addBotHint')}
          </p>
        </div>
      </div>
    );
  }

  // Web port disabled
  if (webDisabled) {
    return (
      <div className="flex-1 flex flex-col">
        <div className="p-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-medium">{t('chat.console')}</span>
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onToggleSound}>
              {enableSound ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <p>{t('chat.selectChat')}</p>
            <p className="text-sm mt-1">{t('chat.waitMessage')}</p>
          </div>
        </div>
      </div>
    );
  }

  // No selected chat
  if (!selectedChatId) {
    return (
      <div className="flex-1 flex flex-col">
        <div className="p-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-medium">{t('chat.console')}</span>
            <span className={`px-2 py-0.5 rounded text-xs ${
              selectedBot.is_active && !isExpired && !trialExceeded
                ? 'bg-green-500/20 text-green-700 dark:text-green-300' 
                : 'bg-red-500/20 text-red-700 dark:text-red-300'
            }`}>
              {selectedBot.is_active && !isExpired && !trialExceeded ? t('chat.online') : t('chat.offline')}
            </span>
            {!selectedBot.is_authorized && (
              <span className="px-2 py-0.5 rounded text-xs bg-yellow-500/20 text-yellow-700 dark:text-yellow-300">
                {t('sidebar.trial')}: {selectedBot.trial_messages_used}/{selectedBot.trial_limit}
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {onToggleChatStart && (
              <div className="flex items-center gap-1.5 mr-2">
                <span className="text-[10px] text-muted-foreground whitespace-nowrap">/start欢迎语</span>
                <button
                  onClick={onToggleChatStart}
                  className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${chatStartEnabled ? "bg-primary" : "bg-muted-foreground/30"}`}
                >
                  <span
                    className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${chatStartEnabled ? "translate-x-3.5" : "translate-x-0.5"}`}
                  />
                </button>
              </div>
            )}
            <Button variant="ghost" size="sm" onClick={onToggleSound}>
              {enableSound ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </Button>
            {enableSound && (
              <>
                <Select value={soundType} onValueChange={onSoundTypeChange}>
                  <SelectTrigger className="w-20 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="qq">{t('chat.qqSound')}</SelectItem>
                    <SelectItem value="ding">{t('chat.dingSound')}</SelectItem>
                    <SelectItem value="bell">{t('chat.bellSound')}</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="sm" onClick={onTestSound}>
                  {t('common.test')}
                </Button>
              </>
            )}
          </div>
        </div>
        
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <p>{t('chat.selectChat')}</p>
            <p className="text-sm mt-1">{t('chat.waitMessage')}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full md:h-auto overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-medium">
            {filteredMessages[0]?.telegram_user_name || t('sidebar.chatList')}
          </span>
          <span className={`px-2 py-0.5 rounded text-xs ${
            selectedBot.is_active && !isExpired && !trialExceeded
              ? 'bg-green-500/20 text-green-700 dark:text-green-300' 
              : 'bg-red-500/20 text-red-700 dark:text-red-300'
          }`}>
            {selectedBot.is_active && !isExpired && !trialExceeded ? t('chat.online') : t('chat.offline')}
          </span>
          {!selectedBot.is_authorized && (
            <span className="px-2 py-0.5 rounded text-xs bg-yellow-500/20 text-yellow-700 dark:text-yellow-300">
              {t('sidebar.trial')}: {selectedBot.trial_messages_used}/{selectedBot.trial_limit}
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {onToggleChatStart && (
            <div className="flex items-center gap-1.5 mr-2">
              <span className="text-[10px] text-muted-foreground whitespace-nowrap">/start欢迎语</span>
              <button
                onClick={onToggleChatStart}
                className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${chatStartEnabled ? "bg-primary" : "bg-muted-foreground/30"}`}
              >
                <span
                  className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${chatStartEnabled ? "translate-x-3.5" : "translate-x-0.5"}`}
                />
              </button>
            </div>
          )}
          <Button variant="ghost" size="sm" onClick={onToggleSound}>
            {enableSound ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </Button>
          {enableSound && (
            <>
              <Select value={soundType} onValueChange={onSoundTypeChange}>
                <SelectTrigger className="w-20 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="qq">{t('chat.qqSound')}</SelectItem>
                  <SelectItem value="ding">{t('chat.dingSound')}</SelectItem>
                  <SelectItem value="bell">{t('chat.bellSound')}</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="ghost" size="sm" onClick={onTestSound}>
                {t('common.test')}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 flex justify-center overflow-hidden">
        <ScrollArea ref={scrollAreaRef} className="p-4 h-[300px] w-full max-w-[400px]">
          {filteredMessages.map((message) => (
            <div
              key={message.id}
              className={`mb-3 p-3 rounded-lg max-w-[80%] md:max-w-[70%] ${
                message.direction === 'outgoing'
                  ? 'ml-auto bg-primary text-primary-foreground'
                  : 'bg-muted'
              }`}
            >
              <div className="flex justify-between items-start mb-1">
                <span className="font-medium text-sm">
                  {message.telegram_user_name}
                  {message.is_admin_reply && ` (${t('chat.admin')})`}
                </span>
                <span className="text-xs opacity-70 ml-2">
                  {new Date(message.created_at).toLocaleTimeString('zh-CN')}
                </span>
              </div>
              {renderMessageContent(message.content)}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </ScrollArea>
      </div>
      
      {/* Status alert */}
      {(trialExceeded || !selectedBot.is_active || isExpired) && (
        <div className="mx-4 mb-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
          <p className="text-sm text-destructive">
            {trialExceeded 
              ? t('chat.trialUsedUp')
              : isExpired 
                ? t('chat.serviceExpired')
                : t('chat.serviceStopped')}
          </p>
        </div>
      )}

      {/* Image preview */}
      {selectedImage && (
        <div className="mx-4 mb-2 relative inline-block">
          <img src={selectedImage} alt={t('chat.preview')} className="max-h-24 rounded-lg" />
          <button 
            onClick={() => setSelectedImage(null)}
            className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs"
          >
            ×
          </button>
        </div>
      )}

      {/* Send message */}
      <div className="p-3 md:p-4 border-t flex gap-2 bg-background sticky bottom-0 left-0 right-0 w-full">
        <input
          type="file"
          accept="image/*"
          ref={fileInputRef}
          onChange={handleImageSelect}
          className="hidden"
        />
        <Button 
          variant="ghost" 
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={!canSend}
          className="shrink-0"
        >
          <ImagePlus className="h-4 w-4" />
        </Button>
        <Input
          placeholder={t('chat.inputPlaceholder')}
          value={replyText}
          onChange={(e) => setReplyText(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
          onPaste={handlePaste}
          disabled={!canSend}
          className="flex-1 min-w-0"
        />
        <Button 
          onClick={handleSend} 
          disabled={!canSend || isSending || (!replyText.trim() && !selectedImage)}
          size="sm"
          className="shrink-0"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>

      {/* Trial limit dialog */}
      <Dialog open={showTrialDialog} onOpenChange={setShowTrialDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              {t('chat.needAuth')}
            </DialogTitle>
            <DialogDescription className="space-y-2 pt-2">
              <p>{t('chat.trialExceeded')} {selectedBot.trial_limit} {t('chat.freeMessages')}</p>
              <p>{t('chat.contactAdmin')}</p>
              <p className="text-primary font-medium">{t('chat.bindCodeToContinue')}</p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setShowTrialDialog(false)}>
              {t('chat.later')}
            </Button>
          <Button onClick={() => setShowTrialDialog(false)}>
            {t('chat.goBindCode')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Image zoom dialog */}
    <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
      <DialogContent className="max-w-[90vw] max-h-[90vh] p-2 bg-background/95 backdrop-blur">
        <div className="flex items-center justify-center w-full h-full">
          {previewImage && (
            <img 
              src={previewImage} 
              alt={t('chat.imagePreview')} 
              className="max-w-full max-h-[80vh] object-contain rounded-lg"
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
    </div>
  );
};

export default ChatWindow;