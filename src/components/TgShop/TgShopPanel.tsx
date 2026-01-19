import React, { useState, useCallback } from "react";
import { Settings, Package, ShoppingCart, Activity, Cloud, CloudOff, RefreshCw, Tag } from "lucide-react";
import { ShopTab } from "./types";
import { ShopNavButton } from "./ShopNavButton";
import { ProductManager } from "./ProductManager";
import { CategoryManager } from "./CategoryManager";
import { OrderManager } from "./OrderManager";
import { ShopSettings } from "./ShopSettings";
import { useShopData } from "./hooks/useShopData";

interface TgShopPanelProps {
  botToken?: string;
  showToast: (type: "success" | "error" | "info", message: string) => void;
}

export function TgShopPanel({ botToken, showToast }: TgShopPanelProps) {
  const [activeTab, setActiveTab] = useState<ShopTab>('settings');
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  
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

  const handleClearOrders = async (status: 'pending' | 'paid' | 'cancelled') => {
    const success = await clearOrdersByStatus(status);
    if (success) {
      showToast("success", "订单已清空");
    } else {
      showToast("error", "清空失败，请重试");
    }
  };

  const handleSaveConfig = async (newConfig: Parameters<typeof saveConfig>[0]) => {
    const success = await saveConfig(newConfig);
    if (success) {
      showToast("success", "配置已保存并同步到云端");
    } else {
      showToast("error", "保存失败，请重试");
    }
  };

  // 自定义分类管理
  const handleAddCustomCategory = useCallback((category: string) => {
    setCustomCategories(prev => {
      if (prev.includes(category)) return prev;
      return [...prev, category];
    });
  }, []);

  const handleRemoveCustomCategory = useCallback((category: string) => {
    setCustomCategories(prev => prev.filter(c => c !== category));
  }, []);
  // 如果没有 botToken，显示提示
  if (!botToken) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-muted/30 p-8">
        <div className="max-w-md text-center space-y-4">
          <div className="w-16 h-16 mx-auto bg-muted rounded-full flex items-center justify-center">
            <CloudOff className="w-8 h-8 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-bold text-foreground">未连接机器人</h2>
          <p className="text-sm text-muted-foreground">
            请先在左侧"菜单键盘"中连接一个 Telegram 机器人，然后再使用 TG 商城功能。
            <br />
            商城数据将与该机器人绑定，确保数据隔离。
          </p>
          <div className="pt-4">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-lg text-sm text-primary">
              <Activity size={16} />
              <span>请先连接机器人</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* 顶部导航栏 */}
      <header className="bg-card border-b px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 pr-4 border-r">
            <Activity className="text-primary" />
            <div>
              <h1 className="text-lg font-bold leading-none">TG 商城</h1>
              <p className="text-[10px] text-muted-foreground mt-0.5">自动售货后台</p>
            </div>
          </div>
          
          <nav className="flex items-center gap-2">
            <ShopNavButton 
              icon={<Settings size={16}/>} 
              label="系统配置" 
              active={activeTab === 'settings'} 
              onClick={() => setActiveTab('settings')} 
            />
            <ShopNavButton 
              icon={<Package size={16}/>} 
              label="商品管理" 
              active={activeTab === 'products'} 
              onClick={() => setActiveTab('products')} 
            />
            <ShopNavButton 
              icon={<Tag size={16}/>} 
              label="分类管理" 
              active={activeTab === 'categories'} 
              onClick={() => setActiveTab('categories')} 
            />
            <ShopNavButton 
              icon={<ShoppingCart size={16}/>} 
              label="订单中心" 
              active={activeTab === 'orders'} 
              onClick={() => setActiveTab('orders')} 
            />
          </nav>
        </div>

        <div className="flex items-center gap-4">
          {/* 同步状态指示器 */}
          <div className="flex items-center gap-2">
            {isSyncing ? (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <RefreshCw size={12} className="animate-spin" />
                <span>同步中...</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-xs text-green-600">
                <Cloud size={12} />
                <span>已同步</span>
              </div>
            )}
          </div>

          <button
            onClick={refreshData}
            disabled={isLoading || isSyncing}
            className="p-1.5 rounded hover:bg-muted transition-colors disabled:opacity-50"
            title="刷新数据"
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
              {config.status === 'online' ? 'Bot 已配置' : 'Bot 未配置'}
            </span>
          </div>
        </div>
      </header>

      {/* 加载状态 */}
      {isLoading && (
        <div className="flex-1 flex items-center justify-center bg-muted/30">
          <div className="flex flex-col items-center gap-3">
            <RefreshCw className="w-8 h-8 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">加载数据中...</span>
          </div>
        </div>
      )}

      {/* 主内容区 */}
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