import React, { useState, useEffect } from "react";
import { Settings, Package, ShoppingCart, Terminal, Activity } from "lucide-react";
import { Product, Order, ShopConfig, ShopTab } from "./types";
import { ShopNavButton } from "./ShopNavButton";
import { ProductManager } from "./ProductManager";
import { OrderManager } from "./OrderManager";
import { ShopSettings } from "./ShopSettings";
import { BotSimulator } from "./BotSimulator";

interface TgShopPanelProps {
  botToken?: string;
  showToast: (type: "success" | "error" | "info", message: string) => void;
}

const defaultConfig: ShopConfig = {
  token: '',
  adminId: '',
  status: 'offline',
  walletAddress: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
  tronGridKey: '',
  acceptUsdt: true,
  acceptTrx: false,
  randomDecimals: true,
  connectionMode: 'polling',
  webhookUrl: '',
  yungouId: '',
  yungouKey: '',
  xunhuId: '',
  xunhuSecret: '',
  enableAlipay: false,
  alipayProvider: 'yungou',
  enableWechat: false,
  wechatProvider: 'xunhu'
};

export function TgShopPanel({ botToken, showToast }: TgShopPanelProps) {
  const [activeTab, setActiveTab] = useState<ShopTab>('settings');
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [config, setConfig] = useState<ShopConfig>(defaultConfig);

  // 从 localStorage 加载数据
  useEffect(() => {
    const storageKey = botToken ? `tg_shop_${botToken.slice(-8)}` : 'tg_shop_default';
    
    const savedProducts = localStorage.getItem(`${storageKey}_products`);
    const savedOrders = localStorage.getItem(`${storageKey}_orders`);
    const savedConfig = localStorage.getItem(`${storageKey}_config`);

    if (savedProducts) {
      try {
        setProducts(JSON.parse(savedProducts));
      } catch (e) {}
    }
    if (savedOrders) {
      try {
        setOrders(JSON.parse(savedOrders));
      } catch (e) {}
    }
    if (savedConfig) {
      try {
        setConfig(prev => ({ ...prev, ...JSON.parse(savedConfig) }));
      } catch (e) {}
    }
  }, [botToken]);

  // 保存到 localStorage
  useEffect(() => {
    const storageKey = botToken ? `tg_shop_${botToken.slice(-8)}` : 'tg_shop_default';
    localStorage.setItem(`${storageKey}_products`, JSON.stringify(products));
  }, [products, botToken]);

  useEffect(() => {
    const storageKey = botToken ? `tg_shop_${botToken.slice(-8)}` : 'tg_shop_default';
    localStorage.setItem(`${storageKey}_orders`, JSON.stringify(orders));
  }, [orders, botToken]);

  const handleSaveConfig = (newConfig: Partial<ShopConfig>) => {
    const mergedConfig = { ...config, ...newConfig };
    setConfig(mergedConfig);
    const storageKey = botToken ? `tg_shop_${botToken.slice(-8)}` : 'tg_shop_default';
    localStorage.setItem(`${storageKey}_config`, JSON.stringify(mergedConfig));
  };

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
              icon={<ShoppingCart size={16}/>} 
              label="订单中心" 
              active={activeTab === 'orders'} 
              onClick={() => setActiveTab('orders')} 
            />
            <ShopNavButton 
              icon={<Terminal size={16}/>} 
              label="Bot 模拟器" 
              active={activeTab === 'simulator'} 
              onClick={() => setActiveTab('simulator')} 
            />
          </nav>
        </div>

        <div className="flex items-center gap-4">
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

      {/* 主内容区 */}
      <main className="flex-1 overflow-hidden">
        <div className="h-full bg-muted/30">
          {activeTab === 'settings' && (
            <ShopSettings 
              config={config} 
              onSave={handleSaveConfig} 
              showToast={showToast} 
            />
          )}
          {activeTab === 'products' && (
            <ProductManager 
              products={products} 
              setProducts={setProducts} 
              showToast={showToast} 
            />
          )}
          {activeTab === 'orders' && (
            <OrderManager orders={orders} />
          )}
          {activeTab === 'simulator' && (
            <BotSimulator 
              products={products} 
              orders={orders}
              setOrders={setOrders}
              config={config} 
              showToast={showToast} 
            />
          )}
        </div>
      </main>
    </div>
  );
}
