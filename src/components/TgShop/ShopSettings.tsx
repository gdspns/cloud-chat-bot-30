import React, { useState, useEffect } from "react";
import { Bot, CreditCard, Wallet, Power, PlugZap, RefreshCw, Coins, Copy, Check, ExternalLink, Plus, X, Key, MessageCircle, Globe, Image, Video, Link, Type, Eye, EyeOff, Smile, Languages } from "lucide-react";
import { ShopConfig } from "./types";
import { useLanguage } from "@/hooks/use-language";

interface ShopSettingsProps {
  config: ShopConfig;
  onSave: (config: Partial<ShopConfig>) => void;
  showToast: (type: "success" | "error" | "info", message: string) => void;
  botToken?: string;
}

export function ShopSettings({ config, onSave, showToast, botToken }: ShopSettingsProps) {
  const { t, language } = useLanguage();
  const [localConfig, setLocalConfig] = useState(config);
  const [isVerifying, setIsVerifying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [webhookCopied, setWebhookCopied] = useState(false);

  useEffect(() => {
    setLocalConfig(config);
  }, [config]);

  const handleChange = (key: keyof ShopConfig, value: any) => {
    setLocalConfig(prev => ({ ...prev, [key]: value }));
  };

  const handleVerifyConnection = async () => {
    const token = botToken || localConfig.token;
    if (!token) {
      showToast("error", t('tgshop.settings.enterToken'));
      return;
    }
    setIsVerifying(true);
    
    try {
      const response = await fetch(`https://api.telegram.org/bot${token}/getMe`);
      const data = await response.json();
      
      if (data.ok && data.result) {
        const botInfo = data.result;
        const newConfig = { 
          ...localConfig, 
          status: 'online' as const,
          botUsername: botInfo.username,
          botFirstName: botInfo.first_name
        };
        setLocalConfig(newConfig);
        onSave(newConfig);
        showToast("success", t('tgshop.settings.connectSuccess').replace('{username}', botInfo.username));
      } else {
        showToast("error", `${t('tgshop.settings.verifyFailed')}: ${data.description || t('tgshop.settings.tokenInvalid')}`);
      }
    } catch (error) {
      console.error('Bot verification error:', error);
      showToast("error", t('tgshop.settings.networkError'));
    } finally {
      setIsVerifying(false);
    }
  };

  const handleDisconnect = () => {
    if (!confirm(t('tgshop.settings.confirmDisconnect'))) return;
    
    const newConfig = { ...localConfig, status: 'offline' as const };
    setLocalConfig(newConfig);
    onSave(newConfig);
    showToast("info", t('tgshop.settings.disconnected'));
  };

  const isExpiredOrTrialEnded = (): boolean => {
    if (localConfig.shopExpireAt) {
      return new Date(localConfig.shopExpireAt) < new Date();
    }
    if (localConfig.shopTrialStartedAt) {
      const trialStart = new Date(localConfig.shopTrialStartedAt);
      const trialEnd = new Date(trialStart.getTime() + 24 * 60 * 60 * 1000);
      return new Date() > trialEnd;
    }
    return false;
  };

  const expired = isExpiredOrTrialEnded();

  const handleSaveClick = () => {
    if (expired) {
      showToast("error", t('tgshop.settings.expiredOrTrialEnded'));
      return;
    }
    onSave(localConfig);
  };

  const handleCopyAddress = () => {
    if (!localConfig.walletAddress) return;
    navigator.clipboard.writeText(localConfig.walletAddress).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      showToast("error", t('tgshop.settings.copyFailed'));
    });
  };

  const getWebhookUrl = () => {
    const token = botToken || localConfig.token;
    if (!token) return '';
    const baseUrl = import.meta.env.VITE_SUPABASE_URL || '';
    return `${baseUrl}/functions/v1/shop-payment-webhook?bot_token=${token}`;
  };

  const handleCopyWebhook = (type: string) => {
    const token = botToken || localConfig.token;
    if (!token) return;
    const url = `${getWebhookUrl()}&type=${type}`;
    navigator.clipboard.writeText(url).then(() => {
      setWebhookCopied(true);
      setTimeout(() => setWebhookCopied(false), 2000);
      showToast("success", t('tgshop.settings.webhookCopied'));
    }).catch(() => {
      showToast("error", t('tgshop.settings.copyFailed'));
    });
  };

  const shopBtnText = localConfig.shopButtonText || t('tgshop.settings.shop');
  const orderBtnText = localConfig.orderButtonText || t('tgshop.settings.myOrders');

  return (
    <div className="p-8 max-w-6xl mx-auto overflow-y-auto h-full pb-20">
      <h2 className="text-2xl font-bold text-foreground mb-6">{t('tgshop.settings.title')}</h2>
      
      <div className="space-y-6">
        {/* 机器人连接 */}
        <div className="bg-card p-6 rounded-xl border shadow-sm">
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-foreground">
            <Bot size={20} className="text-primary"/> {t('tgshop.settings.botAdmin')}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {!botToken && (
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-foreground mb-1">{t('tgshop.settings.botToken')}</label>
                <input 
                  type="password" 
                  value={localConfig.token}
                  onChange={(e) => handleChange('token', e.target.value)}
                  placeholder="123456789:ABCdefGHIjklMNOpqrs..."
                  className="w-full p-2 bg-background border rounded font-mono text-sm focus:ring-2 focus:ring-primary outline-none"
                />
              </div>
            )}
            {botToken && (
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-foreground mb-1">Telegram Bot Token</label>
                <div className="flex items-center gap-2 p-2 bg-muted border rounded">
                  <span className="font-mono text-sm text-muted-foreground">***{botToken.slice(-8)}</span>
                  <span className="text-xs text-green-600 bg-green-500/10 px-2 py-0.5 rounded">{t('tgshop.settings.tokenInherited')}</span>
                </div>
              </div>
            )}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-foreground mb-1">{t('tgshop.settings.adminId')}</label>
              <input 
                type="text" 
                value={localConfig.adminId}
                onChange={(e) => handleChange('adminId', e.target.value)}
                placeholder={language === 'zh' ? '例如: 12345678' : 'e.g. 12345678'}
                className="w-full p-2 bg-background border rounded font-mono text-sm focus:ring-2 focus:ring-primary outline-none"
              />
            </div>
          </div>

          {/* 状态与操作区域 */}
          <div className="mt-4 grid grid-cols-1 xl:grid-cols-2 gap-4">
            {/* 左侧：机器人状态 */}
            <div className="p-3 bg-muted rounded-lg border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${localConfig.status === 'online' ? 'bg-green-500 animate-pulse' : 'bg-muted-foreground'}`}></div>
                  <span className="text-sm font-medium text-foreground">
                    {t('tgshop.settings.status')}: {localConfig.status === 'online' ? t('tgshop.settings.online') : t('tgshop.settings.offline')}
                  </span>
                </div>
                
                {localConfig.status === 'online' ? (
                  <button 
                    onClick={handleDisconnect}
                    className="flex items-center gap-2 text-destructive hover:text-destructive/80 text-xs font-bold border border-destructive/20 bg-background hover:bg-destructive/10 px-3 py-1.5 rounded transition-colors"
                  >
                    <Power size={12} /> {t('tgshop.settings.disconnect')}
                  </button>
                ) : (
                  <button 
                    onClick={handleVerifyConnection}
                    disabled={isVerifying}
                    className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold px-4 py-1.5 rounded transition-colors disabled:opacity-50"
                  >
                    {isVerifying ? <RefreshCw className="animate-spin" size={12}/> : <PlugZap size={12}/>}
                    {isVerifying ? t('tgshop.settings.verifying') : t('tgshop.settings.verifyConnect')}
                  </button>
                )}
              </div>
            </div>

            {/* 右侧：激活绑定 */}
            <div className="p-3 bg-muted rounded-lg border">
              <div className="flex items-center gap-2">
                <input 
                  type="text" 
                  value={localConfig.activationCode || ''}
                  onChange={(e) => handleChange('activationCode', e.target.value)}
                  placeholder={t('tgshop.settings.enterCode')}
                  className="flex-1 p-2 bg-background border rounded font-mono text-xs focus:ring-2 focus:ring-primary outline-none"
                />
                <button 
                  onClick={async () => {
                    if (!localConfig.activationCode?.trim()) {
                      showToast("error", t('tgshop.settings.enterCodeFirst'));
                      return;
                    }
                    try {
                      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-bot`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          action: 'bind-shop-code',
                          botToken: botToken || localConfig.token,
                          activationCode: localConfig.activationCode.trim()
                        })
                      });
                      const data = await response.json();
                      if (data.ok) {
                        showToast("success", data.message || t('tgshop.settings.bindSuccess'));
                        setLocalConfig(prev => ({
                          ...prev,
                          shopExpireAt: data.expireAt,
                          activationCode: ''
                        }));
                        onSave({ shopExpireAt: data.expireAt });
                      } else {
                        showToast("error", data.error || t('tgshop.settings.bindFailed'));
                      }
                    } catch (error) {
                      showToast("error", t('tgshop.settings.bindNetworkError'));
                    }
                  }}
                  className="flex items-center gap-1 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold px-3 py-2 rounded transition-colors"
                >
                  <Key size={12} /> {t('tgshop.settings.bind')}
                </button>
              </div>
              {/* 状态提示 */}
              <div className="mt-2 text-xs">
                {localConfig.shopExpireAt ? (
                  new Date(localConfig.shopExpireAt) > new Date() ? (
                    <span className="text-green-600">
                      ✅ {t('tgshop.settings.validUntil')}: {new Date(localConfig.shopExpireAt).toLocaleDateString(language === 'zh' ? 'zh-CN' : 'en-US')}
                    </span>
                  ) : (
                    <span className="text-destructive">
                      ❌ {t('tgshop.settings.expired')} ({new Date(localConfig.shopExpireAt).toLocaleDateString(language === 'zh' ? 'zh-CN' : 'en-US')}) - {t('tgshop.settings.renewCode')}
                    </span>
                  )
                ) : localConfig.shopTrialStartedAt ? (
                  (() => {
                    const trialStart = new Date(localConfig.shopTrialStartedAt);
                    const trialEnd = new Date(trialStart.getTime() + 24 * 60 * 60 * 1000);
                    const now = new Date();
                    if (now > trialEnd) {
                      return <span className="text-destructive">❌ {t('tgshop.settings.trialExpired')}</span>;
                    }
                    const hoursLeft = Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60));
                    return <span className="text-amber-600">⏳ {t('tgshop.settings.trialRemaining').replace('{hours}', hoursLeft.toString())}</span>;
                  })()
                ) : (
                  <span className="text-muted-foreground">💡 {t('tgshop.settings.trialHint')}</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* /start 欢迎消息配置 */}
        <div className="bg-card p-6 rounded-xl border shadow-sm">
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-foreground">
            <MessageCircle size={20} className="text-green-600"/> {t('tgshop.settings.startConfig')}
          </h3>
          
          {/* /start 开关 */}
          <div className="flex items-center gap-3 p-3 bg-muted rounded-lg mb-4">
            <input 
              type="checkbox"
              checked={localConfig.startEnabled || false}
              onChange={(e) => handleChange('startEnabled', e.target.checked)}
              className="rounded w-4 h-4"
            />
            <div className="flex-1">
              <div className="text-sm font-medium">{t('tgshop.settings.startEnabled')}</div>
              <div className="text-xs text-muted-foreground">{t('tgshop.settings.startEnabledDesc')}</div>
            </div>
          </div>

          {localConfig.startEnabled && (
            <div className="space-y-4">
              {/* 自定义按钮文字 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">{t('tgshop.settings.shopBtnText')}</label>
                  <input 
                    type="text" 
                    value={localConfig.shopButtonText || (language === 'zh' ? '商城' : 'Shop')}
                    onChange={(e) => handleChange('shopButtonText', e.target.value)}
                    className="w-full p-2 bg-background border rounded text-sm"
                    placeholder={language === 'zh' ? '商城' : 'Shop'}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">{t('tgshop.settings.orderBtnText')}</label>
                  <input 
                    type="text" 
                    value={localConfig.orderButtonText || (language === 'zh' ? '我的订单' : 'My Orders')}
                    onChange={(e) => handleChange('orderButtonText', e.target.value)}
                    className="w-full p-2 bg-background border rounded text-sm"
                    placeholder={language === 'zh' ? '我的订单' : 'My Orders'}
                  />
                </div>
              </div>
              
              {/* 欢迎消息内容 */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">{t('tgshop.settings.welcomeContent')}</label>
                <textarea
                  value={localConfig.startMessage || ''}
                  onChange={(e) => handleChange('startMessage', e.target.value)}
                  className="w-full p-3 bg-background border rounded text-sm min-h-[120px]"
                  placeholder={t('tgshop.settings.welcomePlaceholder')}
                />
              </div>
              
              {/* 媒体类型选择 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">{t('tgshop.settings.msgType')}</label>
                  <select
                    value={localConfig.startMessageMediaType || 'text'}
                    onChange={(e) => handleChange('startMessageMediaType', e.target.value)}
                    className="w-full p-2 bg-background border rounded text-sm"
                  >
                    <option value="text">{t('tgshop.settings.textOnly')}</option>
                    <option value="photo">{t('tgshop.settings.photoMsg')}</option>
                    <option value="video">{t('tgshop.settings.videoMsg')}</option>
                  </select>
                </div>
                {(localConfig.startMessageMediaType === 'photo' || localConfig.startMessageMediaType === 'video') && (
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">
                      {localConfig.startMessageMediaType === 'photo' ? t('tgshop.settings.photoUrl') : t('tgshop.settings.videoUrl')}
                    </label>
                    <input 
                      type="text" 
                      value={localConfig.startMessageMediaUrl || ''}
                      onChange={(e) => handleChange('startMessageMediaUrl', e.target.value)}
                      className="w-full p-2 bg-background border rounded text-sm"
                      placeholder={localConfig.startMessageMediaType === 'photo' ? 'https://example.com/image.jpg' : 'https://example.com/video.mp4'}
                    />
                  </div>
                )}
              </div>
              
              {/* 链接预览选项 */}
              <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                <input 
                  type="checkbox"
                  checked={localConfig.startDisablePreview || false}
                  onChange={(e) => handleChange('startDisablePreview', e.target.checked)}
                  className="rounded"
                />
                <div>
                  <div className="text-sm font-medium">{t('tgshop.settings.disablePreview')}</div>
                  <div className="text-xs text-muted-foreground">{t('tgshop.settings.disablePreviewDesc')}</div>
                </div>
              </div>
              
              <p className="text-xs text-muted-foreground bg-muted p-2 rounded">
                💡 {t('tgshop.settings.startMsgHint').replace('{shop}', shopBtnText).replace('{order}', orderBtnText)}
              </p>
            </div>
          )}
        </div>


        {/* Telegram 购买命令 + 支付说明并排 */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Telegram 购买命令说明 */}
          <div className="bg-card p-6 rounded-xl border shadow-sm">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-foreground">
              <Bot size={20} className="text-purple-600"/> {t('tgshop.settings.tgCommands')}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {t('tgshop.settings.tgCommandsDesc')}
            </p>
          
          <div className="space-y-4">
            {/* /shop 命令 */}
            <div className="p-3 bg-muted rounded-lg border">
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                  <code className="text-sm font-bold text-primary">/shop</code>
                  <span className="text-xs text-muted-foreground">{t('tgshop.settings.viewProducts')}</span>
                </div>
                <button
                  onClick={() => {
                    const newCommands = { ...localConfig.customCommands };
                    newCommands.shop = [...(newCommands.shop || []), ''];
                    handleChange('customCommands', newCommands);
                  }}
                  className="text-xs text-primary hover:text-primary/80 flex items-center gap-1"
                >
                  <Plus size={12}/> {t('tgshop.settings.addAlias')}
                </button>
              </div>
              <p className="text-xs text-muted-foreground mb-2">{t('tgshop.settings.viewProductsDesc')}</p>
              {localConfig.customCommands?.shop?.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {localConfig.customCommands.shop.map((cmd, idx) => (
                    <div key={idx} className="flex items-center gap-1 bg-background px-2 py-1 rounded border">
                      <input
                        type="text"
                        value={cmd}
                        onChange={(e) => {
                          const newCommands = { ...localConfig.customCommands };
                          newCommands.shop[idx] = e.target.value;
                          handleChange('customCommands', newCommands);
                        }}
                        placeholder={language === 'zh' ? '例如: 商城' : 'e.g. shop'}
                        className="w-16 text-xs bg-transparent outline-none"
                      />
                      <button
                        onClick={() => {
                          const newCommands = { ...localConfig.customCommands };
                          newCommands.shop = newCommands.shop.filter((_, i) => i !== idx);
                          handleChange('customCommands', newCommands);
                        }}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <X size={12}/>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {/* /buy 命令 */}
            <div className="p-3 bg-muted rounded-lg border">
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                  <code className="text-sm font-bold text-primary">/buy &lt;{language === 'zh' ? '商品名' : 'product'}&gt;</code>
                  <span className="text-xs text-muted-foreground">{t('tgshop.settings.buyProduct')}</span>
                </div>
                <button
                  onClick={() => {
                    const newCommands = { ...localConfig.customCommands };
                    newCommands.buy = [...(newCommands.buy || []), ''];
                    handleChange('customCommands', newCommands);
                  }}
                  className="text-xs text-primary hover:text-primary/80 flex items-center gap-1"
                >
                  <Plus size={12}/> {t('tgshop.settings.addAlias')}
                </button>
              </div>
              <p className="text-xs text-muted-foreground mb-2">{t('tgshop.settings.buyExample')}</p>
              {localConfig.customCommands?.buy?.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {localConfig.customCommands.buy.map((cmd, idx) => (
                    <div key={idx} className="flex items-center gap-1 bg-background px-2 py-1 rounded border">
                      <input
                        type="text"
                        value={cmd}
                        onChange={(e) => {
                          const newCommands = { ...localConfig.customCommands };
                          newCommands.buy[idx] = e.target.value;
                          handleChange('customCommands', newCommands);
                        }}
                        placeholder={language === 'zh' ? '例如: 购买' : 'e.g. buy'}
                        className="w-16 text-xs bg-transparent outline-none"
                      />
                      <button
                        onClick={() => {
                          const newCommands = { ...localConfig.customCommands };
                          newCommands.buy = newCommands.buy.filter((_, i) => i !== idx);
                          handleChange('customCommands', newCommands);
                        }}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <X size={12}/>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {/* /order 命令 */}
            <div className="p-3 bg-muted rounded-lg border">
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                  <code className="text-sm font-bold text-primary">/order</code>
                  <span className="text-xs text-muted-foreground">{t('tgshop.settings.viewOrders')}</span>
                </div>
                <button
                  onClick={() => {
                    const newCommands = { ...localConfig.customCommands };
                    newCommands.order = [...(newCommands.order || []), ''];
                    handleChange('customCommands', newCommands);
                  }}
                  className="text-xs text-primary hover:text-primary/80 flex items-center gap-1"
                >
                  <Plus size={12}/> {t('tgshop.settings.addAlias')}
                </button>
              </div>
              <p className="text-xs text-muted-foreground mb-2">{t('tgshop.settings.viewOrdersDesc')}</p>
              {localConfig.customCommands?.order?.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {localConfig.customCommands.order.map((cmd, idx) => (
                    <div key={idx} className="flex items-center gap-1 bg-background px-2 py-1 rounded border">
                      <input
                        type="text"
                        value={cmd}
                        onChange={(e) => {
                          const newCommands = { ...localConfig.customCommands };
                          newCommands.order[idx] = e.target.value;
                          handleChange('customCommands', newCommands);
                        }}
                        placeholder={language === 'zh' ? '例如: 订单' : 'e.g. orders'}
                        className="w-16 text-xs bg-transparent outline-none"
                      />
                      <button
                        onClick={() => {
                          const newCommands = { ...localConfig.customCommands };
                          newCommands.order = newCommands.order.filter((_, i) => i !== idx);
                          handleChange('customCommands', newCommands);
                        }}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <X size={12}/>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          
            <p className="text-xs text-green-600 bg-green-500/10 p-2 rounded mt-4">
              ✅ {t('tgshop.settings.commandsAutoIntegrated')}
            </p>
          </div>

          {/* 支付说明自定义 */}
          <div className="bg-card p-6 rounded-xl border shadow-sm">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-foreground">
              <CreditCard size={20} className="text-blue-600"/> {t('tgshop.settings.paymentNotice')}
            </h3>
            <p className="text-sm text-muted-foreground mb-3">
              {t('tgshop.settings.paymentNoticeDesc')}
            </p>
            <textarea
              value={localConfig.paymentNotice || ''}
              onChange={(e) => handleChange('paymentNotice', e.target.value)}
              className="w-full p-3 bg-background border rounded font-mono text-sm min-h-[200px]"
              placeholder={t('tgshop.settings.paymentNoticePlaceholder')}
            />
            <p className="text-xs text-muted-foreground mt-2">
              💡 {t('tgshop.settings.paymentNoticeHint')}
            </p>
          </div>
        </div>

        {/* 虚拟货币设置 */}
        <div className="bg-card p-6 rounded-xl border shadow-sm">
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-foreground">
            <CreditCard size={20} className="text-green-600"/> {t('tgshop.settings.cryptoSettings')}
          </h3>
          
          <div className="space-y-5">
            {/* 钱包地址和API Key + USDT/TRX选项并排 */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              <div className="xl:col-span-2 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">{t('tgshop.settings.walletAddress')}</label>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={localConfig.walletAddress}
                      onChange={(e) => handleChange('walletAddress', e.target.value)}
                      className="flex-1 p-2 bg-background border rounded font-mono text-sm"
                    />
                    <button 
                      onClick={handleCopyAddress}
                      className="px-3 py-2 border rounded bg-muted hover:bg-muted/80 transition-colors"
                    >
                      {copied ? <Check size={16} className="text-green-500"/> : <Copy size={16}/>}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">{t('tgshop.settings.tronGridKey')}</label>
                  <input 
                    type="password" 
                    value={localConfig.tronGridKey}
                    onChange={(e) => handleChange('tronGridKey', e.target.value)}
                    className="w-full p-2 bg-background border rounded font-mono text-sm"
                  />
                </div>
              </div>

              {/* USDT/TRX 接收选项 */}
              <div className="space-y-3">
                <div 
                  className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                    localConfig.acceptUsdt ? 'bg-green-500/10 border-green-500' : 'bg-muted border-border'
                  }`} 
                  onClick={() => handleChange('acceptUsdt', !localConfig.acceptUsdt)}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Coins size={18} className={localConfig.acceptUsdt ? 'text-green-600' : 'text-muted-foreground'}/>
                    <span className="font-bold text-sm">{t('tgshop.settings.acceptUsdt')}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{t('tgshop.settings.stablecoin')}</p>
                </div>
                
                <div 
                  className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                    localConfig.acceptTrx ? 'bg-primary/10 border-primary' : 'bg-muted border-border'
                  }`} 
                  onClick={() => handleChange('acceptTrx', !localConfig.acceptTrx)}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Coins size={18} className={localConfig.acceptTrx ? 'text-primary' : 'text-muted-foreground'}/>
                    <span className="font-bold text-sm">{t('tgshop.settings.acceptTrx')}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{t('tgshop.settings.nativeToken')}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              <input 
                type="checkbox"
                checked={localConfig.randomDecimals}
                onChange={(e) => handleChange('randomDecimals', e.target.checked)}
                className="rounded"
              />
              <div>
                <div className="text-sm font-medium">{t('tgshop.settings.randomDecimals')}</div>
                <div className="text-xs text-muted-foreground">{t('tgshop.settings.randomDecimalsDesc')}</div>
              </div>
            </div>
          </div>
        </div>

        {/* 法币支付配置 */}
        <div className="bg-card p-6 rounded-xl border shadow-sm">
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-foreground">
            <Wallet size={20} className="text-purple-600"/> {t('tgshop.settings.fiatSettings')}
          </h3>
          
          <div className="space-y-6">
            {/* 虎皮椒微信和支付宝并排 */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {/* 虎皮椒 (XunHuPay) - 微信 */}
              <div className="p-4 bg-muted rounded-lg border">
                <h4 className="font-bold text-sm text-foreground mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span> 
                  {t('tgshop.settings.xunhuWechat')}
                </h4>
                <p className="text-xs text-muted-foreground mb-3">{t('tgshop.settings.xunhuSite')}</p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">{t('tgshop.settings.appId')}</label>
                    <input 
                      type="text" 
                      value={localConfig.xunhuId}
                      onChange={(e) => handleChange('xunhuId', e.target.value)}
                      className="w-full p-2 bg-background border rounded text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">{t('tgshop.settings.appSecret')}</label>
                    <input 
                      type="password" 
                      value={localConfig.xunhuSecret}
                      onChange={(e) => handleChange('xunhuSecret', e.target.value)}
                      className="w-full p-2 bg-background border rounded text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* 虎皮椒 (XunHuPay) - 支付宝 */}
              <div className="p-4 bg-muted rounded-lg border">
                <h4 className="font-bold text-sm text-foreground mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 bg-blue-500 rounded-full"></span> 
                  {t('tgshop.settings.xunhuAlipay')}
                </h4>
                <p className="text-xs text-muted-foreground mb-3">{t('tgshop.settings.xunhuSite')}</p>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-2 bg-background rounded-lg border">
                    <input 
                      type="checkbox"
                      checked={localConfig.xunhuAlipayH5}
                      onChange={(e) => handleChange('xunhuAlipayH5', e.target.checked)}
                      className="rounded shrink-0"
                    />
                    <div>
                      <div className="text-xs font-medium">{t('tgshop.settings.enableH5')}</div>
                      <div className="text-[10px] text-muted-foreground">{t('tgshop.settings.h5Hint')}</div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">{t('tgshop.settings.appId')}</label>
                    <input 
                      type="text" 
                      value={localConfig.xunhuAlipayId}
                      onChange={(e) => handleChange('xunhuAlipayId', e.target.value)}
                      className="w-full p-2 bg-background border rounded text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">{t('tgshop.settings.appSecret')}</label>
                    <input 
                      type="password" 
                      value={localConfig.xunhuAlipaySecret}
                      onChange={(e) => handleChange('xunhuAlipaySecret', e.target.value)}
                      className="w-full p-2 bg-background border rounded text-sm"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* YunGouOS 微信和支付宝并排 */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {/* YunGouOS - 微信 */}
              <div className="p-4 bg-muted rounded-lg border">
                <h4 className="font-bold text-sm text-foreground mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span> 
                  {t('tgshop.settings.yungouWechat')}
                </h4>
                <p className="text-xs text-muted-foreground mb-3">{t('tgshop.settings.yungouSite')}</p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">{t('tgshop.settings.merchantId')}</label>
                    <input 
                      type="text" 
                      value={localConfig.yungouWechatId}
                      onChange={(e) => handleChange('yungouWechatId', e.target.value)}
                      className="w-full p-2 bg-background border rounded text-sm"
                      placeholder={language === 'zh' ? '例如: 1234567890' : 'e.g. 1234567890'}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">{t('tgshop.settings.merchantKey')}</label>
                    <input 
                      type="password" 
                      value={localConfig.yungouWechatKey}
                      onChange={(e) => handleChange('yungouWechatKey', e.target.value)}
                      className="w-full p-2 bg-background border rounded text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* YunGouOS - 支付宝 */}
              <div className="p-4 bg-muted rounded-lg border">
                <h4 className="font-bold text-sm text-foreground mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 bg-blue-500 rounded-full"></span> 
                  {t('tgshop.settings.yungouAlipay')}
                </h4>
                <p className="text-xs text-muted-foreground mb-3">{t('tgshop.settings.yungouSite')}</p>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-2 bg-background rounded-lg border">
                    <input 
                      type="checkbox"
                      checked={localConfig.yungouAlipayH5}
                      onChange={(e) => handleChange('yungouAlipayH5', e.target.checked)}
                      className="rounded shrink-0"
                    />
                    <div>
                      <div className="text-xs font-medium">{t('tgshop.settings.enableH5')}</div>
                      <div className="text-[10px] text-muted-foreground">{t('tgshop.settings.h5Hint')}</div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">{t('tgshop.settings.merchantId')}</label>
                    <input 
                      type="text" 
                      value={localConfig.yungouAlipayId}
                      onChange={(e) => handleChange('yungouAlipayId', e.target.value)}
                      className="w-full p-2 bg-background border rounded text-sm"
                      placeholder={language === 'zh' ? '例如: 1234567890' : 'e.g. 1234567890'}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">{t('tgshop.settings.merchantKey')}</label>
                    <input 
                      type="password" 
                      value={localConfig.yungouAlipayKey}
                      onChange={(e) => handleChange('yungouAlipayKey', e.target.value)}
                      className="w-full p-2 bg-background border rounded text-sm"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 支付渠道开关 */}
            <div className="p-4 bg-muted rounded-lg border">
              <h4 className="font-bold text-sm text-foreground mb-3">{t('tgshop.settings.enableChannels')}</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className={`p-3 rounded-lg border flex flex-col gap-2 ${
                  localConfig.enableAlipay ? 'bg-blue-500/10 border-blue-500' : 'bg-card border-border'
                }`}>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                      <div className="w-5 h-5 bg-blue-500 text-white rounded flex items-center justify-center text-[10px]">{language === 'zh' ? '支' : 'A'}</div> {t('tgshop.settings.alipay')}
                    </div>
                    <button 
                      onClick={() => handleChange('enableAlipay', !localConfig.enableAlipay)}
                      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        localConfig.enableAlipay ? 'bg-blue-600' : 'bg-muted'
                      }`}
                    >
                      <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        localConfig.enableAlipay ? 'translate-x-4' : 'translate-x-0'
                      }`} />
                    </button>
                  </div>
                  {localConfig.enableAlipay && (
                    <select 
                      value={localConfig.alipayProvider || 'xunhu'} 
                      onChange={(e) => handleChange('alipayProvider', e.target.value as 'yungou' | 'xunhu')}
                      className="w-full text-xs p-1 border rounded bg-background"
                    >
                      <option value="xunhu">{t('tgshop.settings.useXunhu')}</option>
                      <option value="yungou">{t('tgshop.settings.useYungou')}</option>
                    </select>
                  )}
                </div>

                <div className={`p-3 rounded-lg border flex flex-col gap-2 ${
                  localConfig.enableWechat ? 'bg-green-500/10 border-green-500' : 'bg-card border-border'
                }`}>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                      <div className="w-5 h-5 bg-green-500 text-white rounded flex items-center justify-center text-[10px]">{language === 'zh' ? '微' : 'W'}</div> {t('tgshop.settings.wechat')}
                    </div>
                    <button 
                      onClick={() => handleChange('enableWechat', !localConfig.enableWechat)}
                      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        localConfig.enableWechat ? 'bg-green-600' : 'bg-muted'
                      }`}
                    >
                      <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        localConfig.enableWechat ? 'translate-x-4' : 'translate-x-0'
                      }`} />
                    </button>
                  </div>
                  {localConfig.enableWechat && (
                    <select 
                      value={localConfig.wechatProvider || 'xunhu'} 
                      onChange={(e) => handleChange('wechatProvider', e.target.value as 'yungou' | 'xunhu')}
                      className="w-full text-xs p-1 border rounded bg-background"
                    >
                      <option value="xunhu">{t('tgshop.settings.useXunhu')}</option>
                      <option value="yungou">{t('tgshop.settings.useYungou')}</option>
                    </select>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>


        {/* 过期提示和保存按钮 */}
        {expired && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 mb-4">
            <div className="flex items-center gap-2 text-destructive">
              <span className="text-lg">⚠️</span>
              <div>
                <div className="font-bold">{t('tgshop.settings.expiredWarning')}</div>
                <div className="text-sm">{t('tgshop.settings.expiredWarningDesc')}</div>
              </div>
            </div>
          </div>
        )}
        
        <button 
          onClick={handleSaveClick}
          disabled={expired}
          className={`w-full font-bold py-3 rounded-lg shadow-lg transition-all ${
            expired 
              ? 'bg-muted text-muted-foreground cursor-not-allowed' 
              : 'bg-primary hover:bg-primary/90 text-primary-foreground'
          }`}
        >
          {expired ? t('tgshop.settings.activateFirst') : t('tgshop.settings.saveAll')}
        </button>
      </div>
    </div>
  );
}