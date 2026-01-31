import React, { useState, useEffect } from 'react';
import { Database, CreditCard, Shuffle, Loader2 } from 'lucide-react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/hooks/use-language";

const ToggleSwitch = ({ label, checked, onChange }: { label: string; checked: boolean; onChange: (val: boolean) => void }) => (
  <div className="flex items-center justify-between py-2 px-1">
    <span className="text-sm font-semibold text-foreground">{label}</span>
    <button 
      onClick={() => onChange(!checked)} 
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-all duration-300 ${checked ? 'bg-primary' : 'bg-muted'}`}
    >
      <span className={`inline-block h-3 w-3 transform rounded-full bg-background transition-transform ${checked ? 'translate-x-5' : 'translate-x-1'}`} />
    </button>
  </div>
);

interface Config {
  usdtAddress: string;
  tronGridApiKey: string;
  hupiWechatAppId: string;
  hupiWechatSecret: string;
  hupiAlipayAppId: string;
  hupiAlipaySecret: string;
  hupiGateway: string;
  enableUsdt: boolean;
  enableTrx: boolean;
  enableWechat: boolean;
  enableAlipay: boolean;
  enableAntiCollision: boolean;
  exchangeRateUsdtCny: number;
}

const DEFAULT_CONFIG: Config = {
  usdtAddress: '', 
  tronGridApiKey: '', 
  hupiWechatAppId: '',   
  hupiWechatSecret: '',     
  hupiAlipayAppId: '',
  hupiAlipaySecret: '',
  hupiGateway: 'https://api.xunhupay.com/payment/do.html',
  enableUsdt: true,
  enableTrx: true,
  enableWechat: true,
  enableAlipay: true,
  enableAntiCollision: false,
  exchangeRateUsdtCny: 7.40,
};

export const GatewayConfig = () => {
  const { toast } = useToast();
  const { t } = useLanguage();
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [config, setConfig] = useState<Config>(() => {
    const saved = localStorage.getItem('app_config_v41');
    return saved ? { ...DEFAULT_CONFIG, ...JSON.parse(saved) } : DEFAULT_CONFIG;
  });

  useEffect(() => { localStorage.setItem('app_config_v41', JSON.stringify(config)); }, [config]);

  const handleSaveConfig = () => {
    setIsSavingConfig(true);
    setTimeout(() => {
      setIsSavingConfig(false);
      toast({ title: t('gateway.saved'), description: t('gateway.settingsSaved') });
    }, 800);
  };

  return (
    <div className="space-y-6 max-w-3xl">

      <Card className="p-6 space-y-6">
        <div className="flex items-center gap-3 border-b pb-4">
          <div className="bg-primary p-2 rounded-lg"><Database size={20} className="text-primary-foreground"/></div>
          <h4 className="font-bold text-base">{t('gateway.blockchain')}</h4>
        </div>
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
            <ToggleSwitch label="USDT" checked={config.enableUsdt} onChange={(v)=>setConfig({...config, enableUsdt: v})} />
            <ToggleSwitch label="TRX" checked={config.enableTrx} onChange={(v)=>setConfig({...config, enableTrx: v})} />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-muted-foreground">{t('gateway.receiveAddress')}</label>
            <Input type="text" value={config.usdtAddress} onChange={e=>setConfig({...config,usdtAddress:e.target.value})} className="font-mono text-xs" />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-muted-foreground">{t('gateway.tronGridKey')}</label>
            <Input type="text" value={config.tronGridApiKey} onChange={e=>setConfig({...config,tronGridApiKey:e.target.value})} className="font-mono text-xs" />
          </div>
        </div>
      </Card>

      <Card className="p-6 space-y-6">
        <div className="flex items-center gap-3 border-b pb-4">
          <div className="bg-green-600 p-2 rounded-lg"><CreditCard size={20} className="text-white"/></div>
          <h4 className="font-bold text-base">{t('gateway.hupi')}</h4>
        </div>
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
            <ToggleSwitch label={t('gateway.wechat')} checked={config.enableWechat} onChange={(v)=>setConfig({...config, enableWechat: v})} />
            <ToggleSwitch label={t('gateway.alipay')} checked={config.enableAlipay} onChange={(v)=>setConfig({...config, enableAlipay: v})} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground">{t('gateway.wechat')} {t('gateway.appId')}</label>
              <Input type="text" value={config.hupiWechatAppId} onChange={e=>setConfig({...config,hupiWechatAppId:e.target.value})} />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground">{t('gateway.wechat')} {t('gateway.secret')}</label>
              <Input type="password" value={config.hupiWechatSecret} onChange={e=>setConfig({...config,hupiWechatSecret:e.target.value})} />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground">{t('gateway.alipay')} {t('gateway.appId')}</label>
              <Input type="text" value={config.hupiAlipayAppId} onChange={e=>setConfig({...config,hupiAlipayAppId:e.target.value})} />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground">{t('gateway.alipay')} {t('gateway.secret')}</label>
              <Input type="password" value={config.hupiAlipaySecret} onChange={e=>setConfig({...config,hupiAlipaySecret:e.target.value})} />
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-6 flex items-center justify-between bg-yellow-500/10 border-yellow-500/30">
        <div className="flex-1">
          <h4 className="font-bold text-sm flex items-center gap-2"><Shuffle size={16}/> {t('gateway.antiCollision')}</h4>
          <p className="text-xs text-muted-foreground mt-1">{t('gateway.antiCollisionDesc')}</p>
        </div>
        <div className="p-3 bg-background rounded-lg">
          <ToggleSwitch label="" checked={config.enableAntiCollision} onChange={(v)=>setConfig({...config, enableAntiCollision: v})} />
        </div>
      </Card>
      
      <Button onClick={handleSaveConfig} disabled={isSavingConfig} className="w-full">
        {isSavingConfig ? <Loader2 className="animate-spin mr-2"/> : null} {t('gateway.saveAll')}
      </Button>
    </div>
  );
};

export default GatewayConfig;
