import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Bot, Plus } from "lucide-react";
import type { BotActivation } from "@/types/bot";
import { useLanguage } from "@/hooks/use-language";

interface AddBotDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBotAdded: (bot: BotActivation) => void;
  userId?: string;
}

export const AddBotDialog = ({ open, onOpenChange, onBotAdded, userId }: AddBotDialogProps) => {
  const { t, language } = useLanguage();
  const [botToken, setBotToken] = useState("");
  const [personalUserId, setPersonalUserId] = useState("");
  const [greetingMessage, setGreetingMessage] = useState(language === 'en' ? "Hello! 👋 How can I help you?" : "你好！👋 有什么可以帮助你的吗？");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!botToken || !personalUserId) {
      toast({
        title: t('common.error'),
        description: t('bot.fillRequired'),
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-bot', {
        body: {
          action: 'add',
          botToken: botToken.trim(),
          personalUserId: personalUserId.trim(),
          greetingMessage: greetingMessage.trim(),
          userId: userId || null,
        }
      });

      if (error) throw error;
      
      if (!data.ok) {
        toast({
          title: t('bot.addFailed'),
          description: data.error || t('bot.addFailed'),
          variant: "destructive",
        });
        return;
      }

      // 重置表单
      setBotToken("");
      setPersonalUserId("");
      setGreetingMessage(language === 'en' ? "Hello! 👋 How can I help you?" : "你好！👋 有什么可以帮助你的吗？");
      onOpenChange(false);
      
      onBotAdded(data.data);
    } catch (error: any) {
      toast({
        title: t('bot.addFailed'),
        description: error.message || t('bot.checkToken'),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            {t('bot.addTitle')}
          </DialogTitle>
          <DialogDescription>
            {t('bot.addDesc')}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="botToken">{t('bot.token')} *</Label>
            <Input
              id="botToken"
              placeholder={t('bot.tokenPlaceholder')}
              value={botToken}
              onChange={(e) => setBotToken(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {t('bot.tokenHint')}
            </p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="personalUserId">{t('bot.userId')} *</Label>
            <Input
              id="personalUserId"
              placeholder={t('bot.userIdPlaceholder')}
              value={personalUserId}
              onChange={(e) => setPersonalUserId(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {t('bot.userIdHint')}
            </p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="greetingMessage">{t('bot.greeting')}</Label>
            <Textarea
              id="greetingMessage"
              placeholder={t('bot.greetingPlaceholder')}
              value={greetingMessage}
              onChange={(e) => setGreetingMessage(e.target.value)}
              rows={3}
            />
          </div>
        </div>
        
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            <Plus className="h-4 w-4 mr-1" />
            {isLoading ? t('bot.adding') : t('bot.startTrial')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AddBotDialog;