import React, { useState, useCallback } from "react";
import { Settings, Package, ShoppingCart, Activity, Cloud, CloudOff, RefreshCw, Tag } from "lucide-react";
import { ShopTab } from "./types";
import { ShopNavButton } from "./ShopNavButton";
import { ProductManager } from "./ProductManager";
import { CategoryManager } from "./CategoryManager";
import { OrderManager } from "./OrderManager";
import { ShopSettings } from "./ShopSettings";
import { useShopData } from "./hooks/useShopData";
import { useLanguage } from "@/hooks/use-language";

interface TgShopPanelProps {
  botToken?: string;
  showToast: (type: "success" | "error" | "info", message: string) => void;
}

export function TgShopPanel({ botToken, showToast }: TgShopPanelProps) {
  const [activeTab, setActiveTab] = useState<ShopTab>('settings');
  const { t } = useLanguage();
  
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
      <header className="bg-card border-b px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 pr-4 border-r">
            <Activity className="text-primary" />
            <div>
              <h1 className="text-lg font-bold leading-none">{t('tgshop.panel.title')}</h1>
              <p className="text-[10px] text-muted-foreground mt-0.5">{t('tgshop.panel.subtitle')}</p>
            </div>
          </div>
          
          <nav className="flex items-center gap-2">
            <ShopNavButton 
              icon={<Settings size={16}/>} 
              label={t('tgshop.panel.navSettings')} 
              active={activeTab === 'settings'} 
              onClick={() => setActiveTab('settings')} 
            />
            <ShopNavButton 
              icon={<Package size={16}/>} 
              label={t('tgshop.panel.navProducts')} 
              active={activeTab === 'products'} 
              onClick={() => setActiveTab('products')} 
            />
            <ShopNavButton 
              icon={<Tag size={16}/>} 
              label={t('tgshop.panel.navCategories')} 
              active={activeTab === 'categories'} 
              onClick={() => setActiveTab('categories')} 
            />
            <ShopNavButton 
              icon={<ShoppingCart size={16}/>} 
              label={t('tgshop.panel.navOrders')} 
              active={activeTab === 'orders'} 
              onClick={() => setActiveTab('orders')} 
            />
          </nav>
        </div>

        <div className="flex items-center gap-4">
          {/* Sync status indicator */}
          <div className="flex items-center gap-2">
            {isSyncing ? (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <RefreshCw size={12} className="animate-spin" />
                <span>{t('tgshop.panel.syncing')}</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-xs text-green-600">
                <Cloud size={12} />
                <span>{t('tgshop.panel.synced')}</span>
              </div>
            )}
          </div>

          <button
            onClick={refreshData}
            disabled={isLoading || isSyncing}
            className="p-1.5 rounded hover:bg-muted transition-colors disabled:opacity-50"
            title={t('tgshop.panel.refreshData')}
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          </button>

          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${
            config.status === 'online' 
              ? 'bg-green-500/10 border-green-500/50 text-green-600' 
              : 'bg-muted border-border text-muted-foreground'
          }`}>
            <div className={`w-2 h-2 rounded-full ${
              config.status === 'online' ? 'bg-green-500 animate-pulse' : 'bg-muted-foreground'
            }`} />
            <span className="text-xs font-medium">
              {config.status === 'online' ? t('tgshop.panel.botConfigured') : t('tgshop.panel.botNotConfigured')}
            </span>
          </div>
        </div>
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
          </div>
        </main>
      )}
    </div>
  );
}