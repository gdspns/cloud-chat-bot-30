import React from "react";
import { CreditCard, Wallet, Coins, Copy, Check, Plus, X } from "lucide-react";
import { ShopConfig } from "./types";
import { useLanguage } from "@/hooks/use-language";

interface PaymentSettingsProps {
  config: ShopConfig;
  onSave: (config: Partial<ShopConfig>) => void;
  showToast: (type: "success" | "error" | "info", message: string) => void;
  readOnly?: boolean;
}

export function PaymentSettings({ config, onSave, showToast, readOnly }: PaymentSettingsProps) {
  const { t, language } = useLanguage();
  const [localConfig, setLocalConfig] = React.useState(config);
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    setLocalConfig(config);
  }, [config]);

  const handleChange = (key: keyof ShopConfig, value: any) => {
    setLocalConfig(prev => ({ ...prev, [key]: value }));
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

  const handleSaveClick = () => {
    onSave(localConfig);
  };

  return (
    <div className="p-8 max-w-6xl mx-auto overflow-y-auto h-full pb-20">
      <h2 className="text-2xl font-bold text-foreground mb-6">
        {language === 'zh' ? '支付网关' : 'Payment Gateway'}
      </h2>
      
      <div className="space-y-6">
        {/* 虚拟货币设置 */}
        <div className="bg-card p-6 rounded-xl border shadow-sm">
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-foreground">
            <CreditCard size={20} className="text-green-600"/> {t('tgshop.settings.cryptoSettings')}
          </h3>
          
          <div className="space-y-5">
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

        {/* 保存按钮 */}
        <button 
          onClick={handleSaveClick}
          disabled={readOnly}
          className="w-full font-bold py-3 rounded-lg shadow-lg transition-all bg-primary hover:bg-primary/90 text-primary-foreground disabled:opacity-50"
        >
          {language === 'zh' ? '保存支付配置' : 'Save Payment Config'}
        </button>
      </div>
    </div>
  );
}
