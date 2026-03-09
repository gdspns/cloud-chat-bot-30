import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Bot, Trash2, Key, CheckCircle, XCircle, AlertTriangle, WifiOff, MessageSquare, Keyboard, ShoppingBag } from "lucide-react";
import { AddBotDialog } from "@/components/AddBotDialog";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/hooks/use-language";
import type { BotActivation } from "@/types/bot";

interface FeatureStatus {
  chat: { active: boolean; expireAt: string | null };
  keyboard: { active: boolean; expireAt: string | null };
  shop: { active: boolean; expireAt: string | null };
}

export const UserCenter = () => {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const { t, language } = useLanguage();
  const [bots, setBots] = useState<BotActivation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddBot, setShowAddBot] = useState(false);
  const [bindingBotId, setBindingBotId] = useState<string | null>(null);
  const [bindingFeature, setBindingFeature] = useState<string | null>(null);
  const [activationCode, setActivationCode] = useState("");
  const [isBinding, setIsBinding] = useState(false);
  const [isUserDisabled, setIsUserDisabled] = useState(false);
  const [featureStatuses, setFeatureStatuses] = useState<Record<string, FeatureStatus>>({});
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

  const loadFeatureStatuses = async (botList: BotActivation[]) => {
    if (botList.length === 0) return;
    const tokens = botList.map(b => b.bot_token);
    
    const [keyboardRes, shopRes] = await Promise.all([
      supabase.from('keyboard_configs').select('bot_token, keyboard_expire_at, keyboard_trial_started_at').in('bot_token', tokens),
      supabase.from('shop_configs').select('bot_token, shop_expire_at, shop_trial_started_at').in('bot_token', tokens),
    ]);

    const keyboardMap: Record<string, { expireAt: string | null; trialStartedAt: string | null }> = {};
    (keyboardRes.data || []).forEach((k: any) => { 
      keyboardMap[k.bot_token] = { 
        expireAt: k.keyboard_expire_at, 
        trialStartedAt: k.keyboard_trial_started_at 
      }; 
    });

    const shopMap: Record<string, { expireAt: string | null; trialStartedAt: string | null }> = {};
    (shopRes.data || []).forEach((s: any) => { 
      shopMap[s.bot_token] = { 
        expireAt: s.shop_expire_at, 
        trialStartedAt: s.shop_trial_started_at 
      }; 
    });

    const now = new Date();
    const TRIAL_HOURS = 24;
    const statuses: Record<string, FeatureStatus> = {};

    botList.forEach(bot => {
      // Chat feature: only show "永久" if is_authorized AND no expire_at
      const chatExpired = bot.expire_at ? new Date(bot.expire_at) < now : false;
      const chatActive = bot.is_authorized && !chatExpired;
      // For chat, if is_authorized but expire_at is null, it's truly forever
      const chatExpireDisplay = bot.is_authorized && !bot.expire_at ? null : bot.expire_at;

      // Keyboard feature
      const kbData = keyboardMap[bot.bot_token];
      const kbExists = bot.bot_token in keyboardMap;
      let kbExpireAt = kbData?.expireAt ?? null;
      let kbActive = false;
      
      if (kbExists) {
        if (kbExpireAt) {
          // Has explicit expire date
          kbActive = new Date(kbExpireAt) > now;
        } else if (kbData?.trialStartedAt) {
          // In trial mode - calculate trial expiry
          const trialEnd = new Date(new Date(kbData.trialStartedAt).getTime() + TRIAL_HOURS * 60 * 60 * 1000);
          kbActive = trialEnd > now;
          kbExpireAt = trialEnd.toISOString(); // Show trial end as expire date
        }
        // If no expire and no trial, feature is not active (never initialized properly)
      }

      // Shop feature
      const shopData = shopMap[bot.bot_token];
      const shopExists = bot.bot_token in shopMap;
      let shopExpireAt = shopData?.expireAt ?? null;
      let shopActive = false;
      
      if (shopExists) {
        if (shopExpireAt) {
          // Has explicit expire date
          shopActive = new Date(shopExpireAt) > now;
        } else if (shopData?.trialStartedAt) {
          // In trial mode - calculate trial expiry
          const trialEnd = new Date(new Date(shopData.trialStartedAt).getTime() + TRIAL_HOURS * 60 * 60 * 1000);
          shopActive = trialEnd > now;
          shopExpireAt = trialEnd.toISOString(); // Show trial end as expire date
        }
        // If no expire and no trial, feature is not active
      }

      statuses[bot.id] = {
        chat: { active: chatActive, expireAt: chatExpireDisplay },
        keyboard: { active: kbActive, expireAt: kbExpireAt },
        shop: { active: shopActive, expireAt: shopExpireAt },
      };
    });

    setFeatureStatuses(statuses);
  };

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('user-center-bots-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bot_activations' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newBot = payload.new as unknown as BotActivation;
            if (newBot.user_id === user.id) {
              setBots(prev => prev.find(b => b.id === newBot.id) ? prev : [newBot, ...prev]);
            }
          } else if (payload.eventType === 'UPDATE') {
            const updatedBot = payload.new as unknown as BotActivation;
            if (updatedBot.user_id === user.id) {
              setBots(prev => prev.find(b => b.id === updatedBot.id)
                ? prev.map(b => b.id === updatedBot.id ? updatedBot : b)
                : [updatedBot, ...prev]);
            }
          } else if (payload.eventType === 'DELETE') {
            const deletedBot = payload.old as unknown as BotActivation;
            setBots(prev => prev.filter(b => b.id !== deletedBot.id));
          }
        }
      ).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  useEffect(() => {
    if (bots.length > 0) loadFeatureStatuses(bots);
  }, [bots]);

  const loadBots = async () => {
    if (!user) return;
    try {
      const { data, error } = await (supabase.from('bot_activations').select('*') as any)
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
      const { error } = await supabase.functions.invoke('manage-bot', { body: { action: 'delete', botId: id } });
      if (error) throw error;
      setBots(prev => prev.filter(b => b.id !== id));
      toast({ title: t('user.deleteSuccess'), description: t('user.botRemoved') });
    } catch (error: any) {
      toast({ title: t('user.deleteFailed'), description: error.message, variant: "destructive" });
    }
  };

  const handleBindCode = async (botId: string) => {
    if (isUserDisabled) return;
    if (!activationCode.trim()) {
      toast({ title: t('common.error'), description: t('user.enterCodeError'), variant: "destructive" });
      return;
    }
    setIsBinding(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-bot', {
        body: { action: 'bind-code', botId, code: activationCode.trim() }
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      toast({ title: t('user.bindSuccess'), description: t('user.codeBindSuccess') });
      setActivationCode("");
      setBindingBotId(null);
      if (data.bot) setBots(prev => prev.map(b => b.id === botId ? data.bot : b));
    } catch (error: any) {
      toast({ title: t('user.bindFailed'), description: error.message, variant: "destructive" });
    } finally {
      setIsBinding(false);
    }
  };

  const handleBotAdded = (newBot: BotActivation) => {
    if (isUserDisabled) { setShowAddBot(false); return; }
    setBots(prev => [newBot, ...prev.filter(b => b.id !== newBot.id)]);
    setShowAddBot(false);
    toast({ title: t('user.addSuccess'), description: `${t('user.canTrial')} ${newBot.trial_limit} ${t('user.messages')}` });
  };

  const getStatusDisplay = (bot: BotActivation) => {
    const isExpired = bot.expire_at && new Date(bot.expire_at) < new Date();
    const trialExceeded = !bot.is_authorized && bot.trial_messages_used >= bot.trial_limit;
    if (isExpired) return { text: t('user.expired'), color: 'bg-destructive/20 text-destructive' };
    if (trialExceeded) return { text: t('user.trialFull'), color: 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-300' };
    if (bot.is_authorized) return { text: t('user.activated'), color: 'bg-green-500/20 text-green-700 dark:text-green-300' };
    return { text: t('user.trialing'), color: 'bg-blue-500/20 text-blue-700 dark:text-blue-300' };
  };

  const formatExpireDate = (expireAt: string | null) => {
    if (!expireAt) return t('user.forever');
    const date = new Date(expireAt);
    if (date < new Date()) return t('user.expired');
    return date.toLocaleDateString(language === 'en' ? 'en-US' : 'zh-CN');
  };

  const renderFeatureBadges = (bot: BotActivation) => {
    const fs = featureStatuses[bot.id];
    if (!fs) return null;

    const features = [
      { key: 'chat', icon: MessageSquare, label: language === 'zh' ? '双向聊天' : 'Chat', status: fs.chat },
      { key: 'keyboard', icon: Keyboard, label: language === 'zh' ? '菜单键盘' : 'Keyboard', status: fs.keyboard },
      { key: 'shop', icon: ShoppingBag, label: language === 'zh' ? 'TG商城' : 'TG Shop', status: fs.shop },
    ];

    return (
      <div className="space-y-1 mt-1">
        <div className="flex gap-2 flex-wrap">
          {features.map(f => {
            const Icon = f.icon;
            const isActive = f.status.active;
            const isBinding = bindingBotId === bot.id && bindingFeature === f.key;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => {
                  if (bindingBotId === bot.id && bindingFeature === f.key) {
                    setBindingBotId(null);
                    setBindingFeature(null);
                    setActivationCode("");
                  } else {
                    setBindingBotId(bot.id);
                    setBindingFeature(f.key);
                    setActivationCode("");
                  }
                }}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border transition-all cursor-pointer hover:opacity-80 ${
                  isBinding
                    ? 'bg-primary/15 text-primary border-primary/40 ring-1 ring-primary/30'
                    : isActive
                      ? 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20'
                      : 'bg-muted text-muted-foreground border-border'
                }`}
              >
                <Icon className="h-3 w-3" />
                {f.label}
                {f.status.expireAt ? (
                  <span className="ml-0.5 opacity-70">
                    {new Date(f.status.expireAt) < new Date()
                      ? (language === 'zh' ? '已过期' : 'Expired')
                      : new Date(f.status.expireAt).toLocaleDateString(language === 'en' ? 'en-US' : 'zh-CN')}
                  </span>
                ) : isActive ? (
                  <span className="ml-0.5 opacity-70">{language === 'zh' ? '永久' : '∞'}</span>
                ) : null}
                <span className={`ml-0.5 w-1.5 h-1.5 rounded-full ${isActive ? 'bg-green-500' : 'bg-muted-foreground/30'}`} />
              </button>
            );
          })}
        </div>
        {bindingBotId === bot.id && bindingFeature && (
          <div className="flex gap-2 pt-1">
            <Input
              placeholder={`${language === 'zh' ? '输入激活码续期' : 'Enter code to renew'} ${features.find(f => f.key === bindingFeature)?.label || ''}`}
              value={activationCode}
              onChange={(e) => setActivationCode(e.target.value)}
              className="flex-1 h-7 text-xs"
            />
            <Button size="sm" className="h-7 text-xs px-2" onClick={() => handleBindCode(bot.id)} disabled={isBinding}>
              {isBinding ? (language === 'zh' ? '绑定中...' : 'Binding...') : (language === 'zh' ? '绑定' : 'Bind')}
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={() => { setBindingBotId(null); setBindingFeature(null); setActivationCode(""); }}>
              {t('common.cancel')}
            </Button>
          </div>
        )}
      </div>
    );
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
                        <Button size="sm" variant="destructive" onClick={() => handleDeleteBot(bot.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      
                      <div className="text-sm">
                        <span className="font-medium">{t('user.token')}:</span>{' '}
                        <span className="text-muted-foreground">{bot.bot_token.substring(0, 20)}...</span>
                      </div>

                      {renderFeatureBadges(bot)}
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
