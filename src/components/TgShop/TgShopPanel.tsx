import React, { useState, useCallback, useEffect } from "react";
import { Settings, Package, ShoppingCart, Activity, Cloud, CloudOff, RefreshCw, Tag, CreditCard, Timer } from "lucide-react";
import { ShopTab } from "./types";
import { ShopNavButton } from "./ShopNavButton";
import { ProductManager } from "./ProductManager";
import { CategoryManager } from "./CategoryManager";
import { OrderManager } from "./OrderManager";
import { ShopSettings } from "./ShopSettings";
import { PaymentSettings } from "./PaymentSettings";
import { useShopData } from "./hooks/useShopData";
import { useLanguage } from "@/hooks/use-language";

interface TgShopPanelProps {
  botToken?: string;
  showToast: (type: "success" | "error" | "info", message: string) => void;
}

export function TgShopPanel({ botToken, showToast }: TgShopPanelProps) {
  const [activeTab, setActiveTab] = useState<ShopTab>('settings');
  const { t, language } = useLanguage();
  
  const {
    products,
    orders,
    config,
    isLoading,
    isSyncing,
    saveConfig,
    addProduct,
    updateProduct,
    deleteProduct,
    addOrder,
    updateOrderStatus,
    clearOrdersByStatus,
    refreshData,
    setOrders
  } = useShopData(botToken);

  // Custom categories from config (persisted to database)
  const customCategories = config.customCategories || [];

  // Countdown timer for trial/subscription
  const [countdown, setCountdown] = useState('');
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    const calcCountdown = () => {
      let expireTime: Date | null = null;
      
      if (config.shopExpireAt) {
        expireTime = new Date(config.shopExpireAt);
      } else if (config.shopTrialStartedAt) {
        const trialStart = new Date(config.shopTrialStartedAt);
        expireTime = new Date(trialStart.getTime() + 24 * 60 * 60 * 1000);
      }

      if (!expireTime) {
        setCountdown('');
        setIsExpired(false);
        return;
      }

      const now = new Date();
      const diff = expireTime.getTime() - now.getTime();

      if (diff <= 0) {
        setCountdown('00:00:00');
        setIsExpired(true);
        return;
      }

      setIsExpired(false);
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      
      if (h >= 24) {
        const days = Math.floor(h / 24);
        const remainH = h % 24;
        setCountdown(`${days}${language === 'zh' ? '天' : 'd'} ${String(remainH).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
      } else {
        setCountdown(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
      }
    };

    calcCountdown();
    const timer = setInterval(calcCountdown, 1000);
    return () => clearInterval(timer);
  }, [config.shopExpireAt, config.shopTrialStartedAt, language]);


  const handleClearOrders = async (status: 'pending' | 'paid' | 'cancelled') => {
    const success = await clearOrdersByStatus(status);
    if (success) {
      showToast("success", t('tgshop.panel.ordersCleared'));
    } else {
      showToast("error", t('tgshop.panel.clearFailed'));
    }
  };

  const handleSaveConfig = async (newConfig: Parameters<typeof saveConfig>[0]) => {
    const success = await saveConfig(newConfig);
    if (success) {
      showToast("success", t('tgshop.panel.configSaved'));
    } else {
      showToast("error", t('tgshop.panel.saveFailed'));
    }
  };

  // Custom category management - save to config
  const handleAddCustomCategory = useCallback((category: string) => {
    const newCategories = [...customCategories];
    if (!newCategories.includes(category)) {
      newCategories.push(category);
      saveConfig({ customCategories: newCategories });
    }
  }, [customCategories, saveConfig]);

  const handleRemoveCustomCategory = useCallback((category: string) => {
    const newCategories = customCategories.filter(c => c !== category);
    saveConfig({ customCategories: newCategories });
  }, [customCategories, saveConfig]);
  // Show prompt if no botToken
  if (!botToken) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-muted/30 p-8">
        <div className="max-w-md text-center space-y-4">
          <div className="w-16 h-16 mx-auto bg-muted rounded-full flex items-center justify-center">
            <CloudOff className="w-8 h-8 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-bold text-foreground">{t('tgshop.panel.notConnected')}</h2>
          <p className="text-sm text-muted-foreground">
            {t('tgshop.panel.connectHint')}
            <br />
            {t('tgshop.panel.dataIsolation')}
          </p>
          <div className="pt-4">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-lg text-sm text-primary">
              <Activity size={16} />
              <span>{t('tgshop.panel.connectFirst')}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Top navigation bar */}
      <header className="bg-card border-b px-3 md:px-6 py-2 md:py-3 shrink-0 space-y-2 md:space-y-0">
        {/* Top row: title + status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="text-primary shrink-0" size={18} />
            <div>
              <h1 className="text-sm md:text-lg font-bold leading-none">{t('tgshop.panel.title')}</h1>
              <p className="text-[10px] text-muted-foreground mt-0.5 hidden md:block">{t('tgshop.panel.subtitle')}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-4">
            {isSyncing ? (
              <div className="flex items-center gap-1 text-[10px] md:text-xs text-muted-foreground">
                <RefreshCw size={12} className="animate-spin" />
                <span className="hidden sm:inline">{t('tgshop.panel.syncing')}</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 text-[10px] md:text-xs text-green-600">
                <Cloud size={12} />
                <span className="hidden sm:inline">{t('tgshop.panel.synced')}</span>
              </div>
            )}

            <button
              onClick={refreshData}
              disabled={isLoading || isSyncing}
              className="p-1.5 rounded hover:bg-muted transition-colors disabled:opacity-50"
              title={t('tgshop.panel.refreshData')}
            >
              <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            </button>

            {countdown && (
              <div className={`flex items-center gap-1 px-2 py-1 md:px-3 md:py-1.5 rounded-full border text-[10px] md:text-xs font-mono font-medium ${
                isExpired
                  ? 'bg-destructive/10 border-destructive/50 text-destructive'
                  : 'bg-orange-500/10 border-orange-500/50 text-orange-600'
              }`}>
                <Timer size={12} className={isExpired ? '' : 'animate-pulse'} />
                <span>{isExpired ? (language === 'zh' ? '已过期' : 'Expired') : countdown}</span>
              </div>
            )}

            <div className={`flex items-center gap-1.5 px-2 py-1 md:px-3 md:py-1.5 rounded-full border ${
              config.status === 'online' 
                ? 'bg-green-500/10 border-green-500/50 text-green-600' 
                : 'bg-muted border-border text-muted-foreground'
            }`}>
              <div className={`w-2 h-2 rounded-full ${
                config.status === 'online' ? 'bg-green-500 animate-pulse' : 'bg-muted-foreground'
              }`} />
              <span className="text-[10px] md:text-xs font-medium">
                {config.status === 'online' ? t('tgshop.panel.botConfigured') : t('tgshop.panel.botNotConfigured')}
              </span>
            </div>
          </div>
        </div>

        {/* Nav row: scrollable on mobile */}
        <nav className="flex items-center gap-1 md:gap-2 overflow-x-auto no-scrollbar">
          <ShopNavButton 
            icon={<Settings size={16}/>} 
            label={t('tgshop.panel.navSettings')} 
            shortLabel={language === 'zh' ? '配置' : 'Config'}
            active={activeTab === 'settings'} 
            onClick={() => setActiveTab('settings')} 
          />
          <ShopNavButton 
            icon={<Package size={16}/>} 
            label={t('tgshop.panel.navProducts')} 
            shortLabel={language === 'zh' ? '商品' : 'Items'}
            active={activeTab === 'products'} 
            onClick={() => setActiveTab('products')} 
          />
          <ShopNavButton 
            icon={<Tag size={16}/>} 
            label={t('tgshop.panel.navCategories')} 
            shortLabel={language === 'zh' ? '分类' : 'Tags'}
            active={activeTab === 'categories'} 
            onClick={() => setActiveTab('categories')} 
          />
          <ShopNavButton 
            icon={<ShoppingCart size={16}/>} 
            label={t('tgshop.panel.navOrders')} 
            shortLabel={language === 'zh' ? '订单' : 'Orders'}
            active={activeTab === 'orders'} 
            onClick={() => setActiveTab('orders')} 
          />
          <ShopNavButton 
            icon={<CreditCard size={16}/>} 
            label={language === 'zh' ? '支付网关' : 'Payment'} 
            shortLabel={language === 'zh' ? '支付' : 'Pay'}
            active={activeTab === 'payment'} 
            onClick={() => setActiveTab('payment')} 
          />
        </nav>
      </header>

      {/* Loading state */}
      {isLoading && (
        <div className="flex-1 flex items-center justify-center bg-muted/30">
          <div className="flex flex-col items-center gap-3">
            <RefreshCw className="w-8 h-8 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">{t('tgshop.panel.loading')}</span>
          </div>
        </div>
      )}

      {/* Main content area */}
      {!isLoading && (
        <main className="flex-1 overflow-hidden">
          <div className="h-full bg-muted/30">
            {activeTab === 'settings' && (
              <ShopSettings 
                config={config} 
                onSave={handleSaveConfig} 
                showToast={showToast}
                botToken={botToken}
              />
            )}
            {activeTab === 'products' && (
              <ProductManager 
                products={products}
                onAddProduct={addProduct}
                onUpdateProduct={updateProduct}
                onDeleteProduct={deleteProduct}
                showToast={showToast}
                isSyncing={isSyncing}
                customCategories={customCategories}
              />
            )}
            {activeTab === 'categories' && (
              <CategoryManager 
                products={products}
                onUpdateProduct={updateProduct}
                showToast={showToast}
                isSyncing={isSyncing}
                customCategories={customCategories}
                onAddCustomCategory={handleAddCustomCategory}
                onRemoveCustomCategory={handleRemoveCustomCategory}
              />
            )}
            {activeTab === 'orders' && (
              <OrderManager 
                orders={orders} 
                onRefresh={refreshData}
                onClearOrders={handleClearOrders}
                isLoading={isLoading}
              />
            )}
            {activeTab === 'payment' && (
              <PaymentSettings 
                config={config}
                onSave={handleSaveConfig}
                showToast={showToast}
              />
            )}
          </div>
        </main>
      )}
    </div>
  );
}