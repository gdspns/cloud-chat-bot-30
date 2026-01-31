import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Bot, Trash2, Key, CheckCircle, XCircle, AlertTriangle, WifiOff } from "lucide-react";
import { AddBotDialog } from "@/components/AddBotDialog";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/hooks/use-language";
import type { BotActivation } from "@/types/bot";

export const UserCenter = () => {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const { t, language } = useLanguage();
  const [bots, setBots] = useState<BotActivation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddBot, setShowAddBot] = useState(false);
  const [bindingBotId, setBindingBotId] = useState<string | null>(null);
  const [activationCode, setActivationCode] = useState("");
  const [isBinding, setIsBinding] = useState(false);
  const [isUserDisabled, setIsUserDisabled] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      navigate('/auth', { replace: true });
      return;
    }
    
    setIsLoading(false);
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      loadBots();
      checkUserDisabled(user.id);
    }
  }, [user]);

  const checkUserDisabled = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('disabled_users')
        .select('id')
        .eq('user_id', userId)
        .single();
      
      setIsUserDisabled(!!data && !error);
    } catch (error) {
      setIsUserDisabled(false);
    }
  };

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('user-center-bots-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bot_activations'
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newBot = payload.new as unknown as BotActivation;
            if (newBot.user_id === user.id) {
              setBots(prev => {
                if (prev.find(b => b.id === newBot.id)) return prev;
                return [newBot, ...prev];
              });
            }
          } else if (payload.eventType === 'UPDATE') {
            const updatedBot = payload.new as unknown as BotActivation;
            if (updatedBot.user_id === user.id) {
              setBots(prev => {
                const existing = prev.find(b => b.id === updatedBot.id);
                if (existing) {
                  return prev.map(b => b.id === updatedBot.id ? updatedBot : b);
                }
                return [updatedBot, ...prev];
              });
            }
          } else if (payload.eventType === 'DELETE') {
            const deletedBot = payload.old as unknown as BotActivation;
            setBots(prev => prev.filter(b => b.id !== deletedBot.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const loadBots = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await (supabase
        .from('bot_activations')
        .select('*') as any)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBots((data || []) as BotActivation[]);
    } catch (error) {
      console.error('Failed to load bots:', error);
    }
  };

  const handleDeleteBot = async (id: string) => {
    if (isUserDisabled) return;
    
    try {
      const { error } = await supabase.functions.invoke('manage-bot', {
        body: { action: 'delete', botId: id }
      });
      
      if (error) throw error;
      
      setBots(prev => prev.filter(b => b.id !== id));
      
      toast({
        title: t('user.deleteSuccess'),
        description: t('user.botRemoved'),
      });
    } catch (error: any) {
      toast({
        title: t('user.deleteFailed'),
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleBindCode = async (botId: string) => {
    if (isUserDisabled) return;
    
    if (!activationCode.trim()) {
      toast({
        title: t('common.error'),
        description: t('user.enterCodeError'),
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
        title: t('user.bindSuccess'),
        description: t('user.codeBindSuccess'),
      });
      setActivationCode("");
      setBindingBotId(null);
      
      if (data.bot) {
        setBots(prev => prev.map(b => b.id === botId ? data.bot : b));
      }
    } catch (error: any) {
      toast({
        title: t('user.bindFailed'),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsBinding(false);
    }
  };

  const handleBotAdded = (newBot: BotActivation) => {
    if (isUserDisabled) {
      setShowAddBot(false);
      return;
    }
    
    setBots(prev => [newBot, ...prev.filter(b => b.id !== newBot.id)]);
    setShowAddBot(false);
    toast({
      title: t('user.addSuccess'),
      description: `${t('user.canTrial')} ${newBot.trial_limit} ${t('user.messages')}`,
    });
  };

  const getStatusDisplay = (bot: BotActivation) => {
    const isExpired = bot.expire_at && new Date(bot.expire_at) < new Date();
    const trialExceeded = !bot.is_authorized && bot.trial_messages_used >= bot.trial_limit;
    
    if (isExpired) {
      return { text: t('user.expired'), color: 'bg-destructive/20 text-destructive' };
    }
    if (trialExceeded) {
      return { text: t('user.trialFull'), color: 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-300' };
    }
    if (bot.is_authorized) {
      return { text: t('user.activated'), color: 'bg-green-500/20 text-green-700 dark:text-green-300' };
    }
    return { text: t('user.trialing'), color: 'bg-blue-500/20 text-blue-700 dark:text-blue-300' };
  };

  const formatExpireDate = (expireAt: string | null) => {
    if (!expireAt) return t('user.forever');
    const date = new Date(expireAt);
    const now = new Date();
    if (date < now) return t('user.expired');
    return date.toLocaleDateString(language === 'en' ? 'en-US' : 'zh-CN');
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col animate-in fade-in duration-200">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-muted-foreground text-sm">{t('user.loading')}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <div className="container mx-auto max-w-4xl p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">{t('user.center')}</h1>
          <Button onClick={() => setShowAddBot(true)}>
            <Bot className="h-4 w-4 mr-2" />
            {t('user.addBot')}
          </Button>
        </div>

        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">{t('user.bots')}</h2>
          
          {bots.length === 0 ? (
            <div className="text-center py-8">
              <Bot className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground">{t('user.noBot')}</p>
              <p className="text-sm text-muted-foreground mt-1">{t('user.addFirstBot')}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {bots.map((bot) => {
                const status = getStatusDisplay(bot);
                const isExpired = bot.expire_at && new Date(bot.expire_at) < new Date();
                const trialExceeded = !bot.is_authorized && bot.trial_messages_used >= bot.trial_limit;
                const webDisabled = !bot.web_enabled;
                
                return (
                  <Card key={bot.id} className={`p-4 ${isExpired || trialExceeded ? 'border-destructive/50' : ''}`}>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${status.color}`}>
                            {status.text}
                          </span>
                          {bot.is_authorized ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-yellow-500" />
                          )}
                          {webDisabled && (
                            <span className="flex items-center gap-1 text-xs text-destructive">
                              <WifiOff className="h-3 w-3" />
                              {t('user.webPortClosed')}
                            </span>
                          )}
                          {!bot.is_authorized && (
                            <span className="text-xs text-muted-foreground">
                              {t('user.trial')}: {bot.trial_messages_used}/{bot.trial_limit}
                            </span>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDeleteBot(bot.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      
                      <div className="text-sm">
                        <span className="font-medium">{t('user.token')}:</span>{' '}
                        <span className="text-muted-foreground">{bot.bot_token.substring(0, 20)}...</span>
                      </div>
                      
                      <div className="text-sm flex items-center gap-2">
                        <span className="font-medium">{t('user.validity')}:</span>{' '}
                        <span className={`${isExpired ? 'text-destructive' : 'text-muted-foreground'}`}>
                          {bot.is_authorized ? formatExpireDate(bot.expire_at) : `${t('user.trial')}: ${bot.trial_messages_used}/${bot.trial_limit}`}
                        </span>
                        {bot.is_authorized && !isExpired && bindingBotId !== bot.id && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 text-xs px-2 ml-auto"
                            onClick={() => setBindingBotId(bot.id)}
                          >
                            <Key className="h-3 w-3 mr-1" />
                            {t('user.renew')}
                          </Button>
                        )}
                      </div>
                      
                      {(isExpired || trialExceeded) && (
                        <div className="flex items-center gap-2 p-2 bg-destructive/10 rounded text-sm">
                          <AlertTriangle className="h-4 w-4 text-destructive" />
                          <span className="text-destructive">
                            {isExpired ? t('user.serviceExpired') : t('user.trialUsedUp')}
                          </span>
                        </div>
                      )}
                      
                      {(!bot.is_authorized || isExpired || bindingBotId === bot.id) && (
                        <div className="pt-2 border-t">
                          {bindingBotId === bot.id ? (
                            <div className="flex gap-2">
                              <Input
                                placeholder={t('user.enterCode')}
                                value={activationCode}
                                onChange={(e) => setActivationCode(e.target.value)}
                                className="flex-1"
                              />
                              <Button 
                                size="sm" 
                                onClick={() => handleBindCode(bot.id)}
                                disabled={isBinding}
                              >
                                {isBinding ? t('user.binding') : t('user.bind')}
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => {
                                  setBindingBotId(null);
                                  setActivationCode("");
                                }}
                              >
                                {t('common.cancel')}
                              </Button>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setBindingBotId(bot.id)}
                              className="w-full"
                            >
                              <Key className="h-4 w-4 mr-2" />
                              {isExpired ? t('user.renewActivate') : t('user.bindCode')}
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      <AddBotDialog 
        open={showAddBot} 
        onOpenChange={setShowAddBot} 
        onBotAdded={handleBotAdded}
        userId={user?.id}
      />
    </div>
  );
};

export default UserCenter;