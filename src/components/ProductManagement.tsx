import React, { useState, useEffect } from 'react';
import { 
  Settings,
  Edit3,
  Package,
  Loader2,
  Layers,
  ClipboardList,
  Copy,
  Plus,
  Trash2,
  Database,
  ArrowRightLeft,
  CreditCard,
  Shuffle,
  Calculator,
  RefreshCw
} from 'lucide-react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useStoreProducts, StoreProduct } from "@/hooks/useStoreProducts";
import { supabase } from "@/integrations/supabase/client";

// --- 全局工具组件 ---
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

const copyToClipboard = (text: string, successMessage = "复制成功") => {
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).then(() => alert(successMessage)).catch(() => alert("复制失败"));
  } else {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-9999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
      alert(successMessage);
    } catch (err) {
      alert("复制失败");
    }
    document.body.removeChild(textArea);
  }
};

interface Order {
  orderNo: string;
  botId: string;
  contact: string;
  productName: string;
  amount: string;
  paymentMethod: string;
  code: string;
  type: string;
  time: string;
  status: 'pending' | 'paid' | 'expired';
}

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

// --- 初始数据常量 ---
const CATEGORY_TAGS = [
  { id: 'chat', label: '双向聊天' },
  { id: 'keyboard', label: '菜单键盘' },
  { id: 'mall', label: 'TG商城' }
];

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

interface NewProduct {
  name: string;
  type: 'card' | 'auto';
  duration: number;
  price: string;
  usdt: string;
  trx: string;
  desc: string;
  codesText: string;
  tags: string[];
}

// --- 管理后台组件 ---
export const ProductManagement = () => {
  const { toast } = useToast();
  const [adminTab, setAdminTab] = useState('products'); 

  // 使用数据库 hook 管理商品
  const { products, loading, syncing, addProduct, updateProduct, deleteProduct, getStockCount, loadProducts } = useStoreProducts();

  const [config, setConfig] = useState<Config>(() => {
    const saved = localStorage.getItem('app_config_v41');
    return saved ? { ...DEFAULT_CONFIG, ...JSON.parse(saved) } : DEFAULT_CONFIG;
  });
  const [orders, setOrders] = useState<Order[]>(() => {
    const saved = localStorage.getItem('app_orders_v41');
    return saved ? JSON.parse(saved) : [];
  });

  const [isCalculating, setIsCalculating] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false); 
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newProduct, setNewProduct] = useState<NewProduct>({
    name: '', type: 'card', duration: 30, price: '', usdt: '', trx: '', desc: '', codesText: '', tags: []
  });
  const [orderFilter, setOrderFilter] = useState('all');

  // 保存配置和订单到 localStorage
  useEffect(() => { localStorage.setItem('app_orders_v41', JSON.stringify(orders)); }, [orders]);
  useEffect(() => { localStorage.setItem('app_config_v41', JSON.stringify(config)); }, [config]);


  // --- 管理逻辑 ---
  const handleEditClick = (product: StoreProduct) => {
    setEditingId(product.id);
    setNewProduct({ 
      name: product.name,
      type: product.type,
      duration: product.duration,
      price: product.price.toString(),
      usdt: product.usdt.toString(),
      trx: product.trx.toString(),
      desc: product.desc,
      codesText: (product.codes || []).join('\n'),
      tags: product.tags || [] 
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setNewProduct({ name: '', type: 'card', duration: 30, price: '', usdt: '', trx: '', desc: '', codesText: '', tags: [] });
  };

  const handleDeleteProduct = async (id: string) => {
    if (confirm("确定删除此商品？")) {
      await deleteProduct(id);
      if (editingId === id) handleCancelEdit();
    }
  };

  const [isSavingProduct, setIsSavingProduct] = useState(false);
  const [saveResultMessage, setSaveResultMessage] = useState('');

  // 规范化 tags - mall 和 shop 视为等价，统一为 'shop'
  const normalizeTags = (tags: string[]): string[] => {
    const normalized = new Set<string>();
    tags.forEach(tag => {
      if (tag === 'mall') {
        normalized.add('shop');
      } else {
        normalized.add(tag);
      }
    });
    return Array.from(normalized).sort();
  };

  // feature_type 到规范化 tags 的映射（严格对应）
  const featureTypeToNormalizedTags: Record<string, string[]> = {
    'chat': ['chat'],
    'keyboard': ['keyboard'],
    'shop': ['shop'],
    'both': ['chat', 'keyboard'],
    'chat_shop': ['chat', 'shop'],
    'keyboard_shop': ['keyboard', 'shop'],
    'all': ['chat', 'keyboard', 'shop'],
  };

  // 检查 feature_type 是否与商品 tags 严格匹配
  const isFeatureTypeCompatible = (featureType: string, productTags: string[]): boolean => {
    const requiredTags = featureTypeToNormalizedTags[featureType];
    if (!requiredTags) return true; // 未知类型允许导入
    
    const normalizedProductTags = normalizeTags(productTags);
    
    // 严格匹配：商品 tags 必须完全等于 feature_type 需要的 tags
    if (normalizedProductTags.length !== requiredTags.length) return false;
    return requiredTags.every(tag => normalizedProductTags.includes(tag));
  };

  const handleSaveProduct = async () => {
    if (!newProduct.name || !newProduct.price) {
      toast({ title: "错误", description: "名称/价格必填", variant: "destructive" });
      return;
    }

    setIsSavingProduct(true);
    setSaveResultMessage('');

    try {
      // 解析卡密文本
      const rawLines = newProduct.codesText 
        ? newProduct.codesText.split('\n').map(l => l.trim()).filter(l => l !== "") 
        : [];
      
      // 1. 前端去重
      const uniqueLines = [...new Set(rawLines)];
      const frontendDuplicates = rawLines.length - uniqueLines.length;

      let finalCodes = uniqueLines;
      let dbDuplicates = 0;
      let mismatchedCount = 0;

      // 2. 如果有卡密，与数据库比对
      if (uniqueLines.length > 0) {
        const { data: existingKeys } = await supabase
          .from('store_card_keys')
          .select('card_key')
          .in('card_key', uniqueLines);

        const existingSet = new Set(existingKeys?.map(k => k.card_key) || []);
        const newKeys = uniqueLines.filter(key => !existingSet.has(key));
        dbDuplicates = uniqueLines.length - newKeys.length;

        // 3. 关键词匹配验证 - 查询 activation_codes 表
        if (newKeys.length > 0 && newProduct.tags.length > 0) {
          const { data: activationCodes } = await supabase
            .from('activation_codes')
            .select('code, feature_type')
            .in('code', newKeys);

          // 创建卡密到 feature_type 的映射
          const codeToFeatureType: Record<string, string> = {};
          (activationCodes || []).forEach(ac => {
            codeToFeatureType[ac.code] = ac.feature_type || 'both';
          });

          // 过滤不兼容的卡密
          finalCodes = newKeys.filter(key => {
            const featureType = codeToFeatureType[key];
            // 如果卡密不在 activation_codes 表中，允许导入
            if (!featureType) return true;
            return isFeatureTypeCompatible(featureType, newProduct.tags);
          });

          mismatchedCount = newKeys.length - finalCodes.length;
        } else {
          finalCodes = newKeys;
        }
      }
      
      const productData = {
        name: newProduct.name,
        type: newProduct.type,
        tags: newProduct.tags || [],
        duration: Number(newProduct.duration), 
        price: Number(newProduct.price), 
        usdt: Number(newProduct.usdt), 
        trx: Number(newProduct.trx),
        desc: newProduct.desc,
        codes: finalCodes,
        isActive: true
      };

      if (editingId) {
        await updateProduct(editingId, productData);
        setEditingId(null);
      } else {
        await addProduct(productData);
      }

      // 显示结果消息
      const messages: string[] = [];
      if (finalCodes.length > 0) messages.push(`成功添加 ${finalCodes.length} 个`);
      if (frontendDuplicates > 0) messages.push(`粘贴重复 ${frontendDuplicates} 个`);
      if (dbDuplicates > 0) messages.push(`库存已存在 ${dbDuplicates} 个`);
      if (mismatchedCount > 0) messages.push(`关键词不匹配 ${mismatchedCount} 个`);

      if (messages.length > 0) {
        const msg = messages.join('，');
        setSaveResultMessage(msg);
        toast({ 
          title: mismatchedCount > 0 ? "保存完成（部分卡密被过滤）" : "保存成功", 
          description: msg,
          variant: mismatchedCount > 0 ? "destructive" : "default"
        });
      } else {
        toast({ title: "保存成功", description: "商品已保存" });
      }

      setNewProduct({ name: '', type: 'card', duration: 30, price: '', usdt: '', trx: '', desc: '', codesText: '', tags: [] });

    } catch (error: any) {
      console.error('保存商品失败:', error);
      toast({ title: "保存失败", description: error.message || "请重试", variant: "destructive" });
    } finally {
      setIsSavingProduct(false);
    }
  };

  const handleAutoConvert = async () => {
    if (!newProduct.price) {
      toast({ title: "提示", description: "请输入CNY价格", variant: "destructive" });
      return;
    }
    setIsCalculating(true);
    setTimeout(() => {
      const rate = config.exchangeRateUsdtCny || 7.4;
      const usdtVal = (parseFloat(newProduct.price) / rate).toFixed(3);
      const trxVal = (parseFloat(usdtVal) / 0.155).toFixed(3);
      setNewProduct(prev => ({ ...prev, usdt: usdtVal, trx: trxVal }));
      setIsCalculating(false);
    }, 500);
  };

  const handleSaveConfig = () => {
    setIsSavingConfig(true);
    setTimeout(() => {
      setIsSavingConfig(false);
      toast({ title: "保存成功", description: "设置已保存" });
    }, 800);
  };

  const toggleAdminTag = (tagId: string) => {
    setNewProduct(prev => {
        const currentTags = prev.tags || [];
        return {
            ...prev,
            tags: currentTags.includes(tagId) 
                ? currentTags.filter(t => t !== tagId) 
                : [...currentTags, tagId]
        };
    });
  };

  return (
    <div className="space-y-6">
      {/* 顶部横向导航 */}
      <div className="flex items-center gap-4 border-b pb-4">
        <button onClick={() => setAdminTab('products')} className={`px-4 py-2 rounded-lg transition-all font-bold text-sm flex items-center gap-2 ${adminTab==='products'?'bg-foreground text-background':'text-muted-foreground hover:bg-muted'}`}>
          <Package size={16} /> 商品管理
        </button>
        <button onClick={() => setAdminTab('orders')} className={`px-4 py-2 rounded-lg transition-all font-bold text-sm flex items-center gap-2 ${adminTab==='orders'?'bg-foreground text-background':'text-muted-foreground hover:bg-muted'}`}>
          <ClipboardList size={16} /> 订单中心
        </button>
        <button onClick={() => setAdminTab('settings')} className={`px-4 py-2 rounded-lg transition-all font-bold text-sm flex items-center gap-2 ${adminTab==='settings'?'bg-foreground text-background':'text-muted-foreground hover:bg-muted'}`}>
          <Settings size={16} /> 网关配置
        </button>
      </div>

      {adminTab === 'products' && (
        <div className="space-y-6">
          {/* 录入区 */}
          <Card className="p-6">
            <h3 className="font-bold text-lg mb-6 flex items-center gap-3">
              {editingId ? <Edit3 size={20} className="text-orange-500"/> : <Plus size={20} className="text-primary"/>} 
              {editingId ? '编辑商品' : '发布新商品'}
            </h3>
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-2 space-y-1">
                  <label className="text-xs font-bold text-muted-foreground">名称</label>
                  <Input placeholder="商品标题..." value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground">模式</label>
                  <select className="w-full p-2 bg-muted border border-border rounded-lg outline-none font-bold text-sm" value={newProduct.type} onChange={e => setNewProduct({...newProduct, type: e.target.value as 'card' | 'auto'})}>
                    <option value="card">卡密 (CARD)</option>
                    <option value="auto">直充 (AUTO)</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground">天数</label>
                  <Input type="number" value={newProduct.duration} onChange={e => setNewProduct({...newProduct, duration: Number(e.target.value)})} />
                </div>
              </div>
              
              {/* 分类标签 */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground">分类标签 (支持多选)</label>
                <div className="flex gap-2 flex-wrap">
                  {CATEGORY_TAGS.map(tag => (
                    <button
                      key={tag.id}
                      onClick={() => toggleAdminTag(tag.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${newProduct.tags.includes(tag.id) ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted text-muted-foreground border-border'}`}
                    >
                      {tag.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground">定价 (¥)</label>
                  <Input type="number" value={newProduct.price} onChange={e => setNewProduct({...newProduct, price: e.target.value})} />
                </div>
                <div className="flex items-end">
                  <Button onClick={handleAutoConvert} disabled={isCalculating} variant="outline" className="w-full h-10">
                    {isCalculating ? <Loader2 size={14} className="animate-spin mr-2"/> : <Calculator size={14} className="mr-2"/>} 自动算价
                  </Button>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground">USDT</label>
                  <Input type="number" step="0.001" className="font-mono text-primary" value={newProduct.usdt} onChange={e => setNewProduct({...newProduct, usdt: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground">TRX</label>
                  <Input type="number" step="0.001" className="font-mono text-destructive" value={newProduct.trx} onChange={e => setNewProduct({...newProduct, trx: e.target.value})} />
                </div>
              </div>
              {newProduct.type === 'card' && (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-primary flex items-center gap-2"><Layers size={14} /> 卡密库 (一行一个)</label>
                  <textarea placeholder="在此粘贴卡密数据..." className="w-full min-h-[120px] p-4 bg-foreground text-green-400 border border-border rounded-lg font-mono text-xs outline-none" value={newProduct.codesText} onChange={e => setNewProduct({...newProduct, codesText: e.target.value})} />
                  <p className="text-xs text-muted-foreground">当前识别: {newProduct.codesText ? newProduct.codesText.split('\n').filter(s => s.trim() !== "").length : 0} 行</p>
                </div>
              )}
            </div>
            <div className="flex gap-4 mt-6 pt-6 border-t">
              <Button onClick={handleSaveProduct} disabled={isSavingProduct} className="flex-1">
                {isSavingProduct ? <><Loader2 size={16} className="animate-spin mr-2" /> 检测重复中...</> : (editingId ? '保存修改' : '确认上架')}
              </Button>
              {editingId && (<Button onClick={handleCancelEdit} variant="outline">取消</Button>)}
            </div>
            {saveResultMessage && (
              <div className="mt-4 p-3 bg-green-500/10 text-green-700 dark:text-green-300 rounded-lg text-sm">
                {saveResultMessage}
              </div>
            )}
          </Card>

          {/* 商品列表 */}
          <div className="space-y-4">
            <div className="font-bold text-sm text-muted-foreground">商品列表 ({products.length})</div>
            {products.map(p => {
              const stock = getStockCount(p);
              return (
                <Card key={p.id} className="p-4 flex flex-col md:flex-row items-center gap-4 relative overflow-hidden group">
                  <div className={`absolute top-0 right-0 px-3 py-1 rounded-bl-lg text-xs font-bold ${p.type === 'auto' ? 'bg-primary text-primary-foreground' : 'bg-orange-500 text-white'}`}>
                    {p.type === 'auto' ? '直充' : '卡密'}
                  </div>
                  <div className="flex-1 min-w-[200px]">
                    <h5 className="font-bold text-base">{p.name}</h5>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {(p.tags || []).map(tid => <span key={tid} className="text-xs bg-muted text-muted-foreground px-1.5 rounded">{CATEGORY_TAGS.find(t=>t.id===tid)?.label}</span>)}
                    </div>
                  </div>
                  <div className="flex-1 flex flex-col items-center md:items-start gap-1">
                    <div className="bg-muted px-3 py-1 rounded-lg font-mono font-bold text-sm border">¥{p.price}</div>
                    <div className="flex gap-2 text-xs font-bold">
                      <span className="text-primary">{p.usdt.toFixed(3)} U</span>
                      <span className="text-destructive">{p.trx.toFixed(3)} T</span>
                    </div>
                  </div>
                  <div className="flex-1 text-center">
                    <span className="text-xs text-muted-foreground uppercase font-bold mb-1 block">库存</span>
                    <span className={`px-3 py-1 rounded-lg font-bold text-xs ${p.type === 'auto' ? 'bg-green-500/20 text-green-600' : (stock > 0 ? 'bg-primary/20 text-primary' : 'bg-destructive/20 text-destructive')}`}>
                      {p.type === 'auto' ? '不限' : stock}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => handleEditClick(p)}><Edit3 size={16} /></Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDeleteProduct(p.id)} className="text-destructive hover:text-destructive"><Trash2 size={16} /></Button>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {adminTab === 'orders' && (
        <div className="space-y-6">
          <Card className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-lg flex items-center gap-3"><ClipboardList size={20} /> 订单管理中心</h3>
              <div className="flex bg-muted p-1 rounded-lg">
                {['all', 'pending', 'paid', 'expired'].map(status => (
                  <button 
                    key={status} 
                    onClick={() => setOrderFilter(status)}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${orderFilter === status ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    {status === 'all' ? '全部' : (status === 'pending' ? '待付款' : (status === 'paid' ? '已成交' : '已过期'))}
                  </button>
                ))}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-muted text-muted-foreground text-xs border-b">
                  <tr>
                    <th className="p-4 font-bold">订单号</th>
                    <th className="p-4 font-bold">商品名称</th>
                    <th className="p-4 font-bold">支付金额</th>
                    <th className="p-4 font-bold">联系/账号</th>
                    <th className="p-4 font-bold">时间</th>
                    <th className="p-4 font-bold text-center">状态</th>
                    <th className="p-4 font-bold">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-xs">
                  {orders.filter(o => orderFilter === 'all' || o.status === orderFilter).map(order => (
                    <tr key={order.orderNo} className="hover:bg-muted/50 transition-colors">
                      <td className="p-4 font-mono font-bold text-muted-foreground">{order.orderNo}</td>
                      <td className="p-4 font-bold">{order.productName}</td>
                      <td className="p-4 font-mono font-bold text-primary">{order.amount}</td>
                      <td className="p-4 text-muted-foreground">{order.type === 'auto' ? order.botId : order.contact}</td>
                      <td className="p-4 text-muted-foreground">{order.time}</td>
                      <td className="p-4 text-center">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                          order.status === 'paid' ? 'bg-green-500/20 text-green-600' : 
                          (order.status === 'expired' ? 'bg-destructive/20 text-destructive' : 'bg-yellow-500/20 text-yellow-600')
                        }`}>
                          {order.status === 'paid' ? '已成交' : (order.status === 'expired' ? '已过期' : '待付款')}
                        </span>
                      </td>
                      <td className="p-4">
                        {order.status === 'paid' && order.code && (
                          <Button size="sm" variant="outline" onClick={() => {copyToClipboard(order.code, '卡密已复制')}}>复制卡密</Button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {orders.filter(o => orderFilter === 'all' || o.status === orderFilter).length === 0 && (
                    <tr><td colSpan={7} className="p-10 text-center text-muted-foreground font-bold">暂无相关订单记录</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {adminTab === 'settings' && (
        <div className="space-y-6 max-w-3xl">
          <Card className="p-6 space-y-6">
            <div className="flex items-center gap-3 border-b pb-4">
              <div className="bg-primary p-2 rounded-lg"><ArrowRightLeft size={20} className="text-primary-foreground"/></div>
              <h4 className="font-bold text-base">汇率设置</h4>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground">1 USDT = ? CNY</label>
              <Input type="number" step="0.01" value={config.exchangeRateUsdtCny} onChange={e=>setConfig({...config,exchangeRateUsdtCny:parseFloat(e.target.value)})} className="text-2xl font-bold text-center" />
            </div>
          </Card>

          <Card className="p-6 space-y-6">
            <div className="flex items-center gap-3 border-b pb-4">
              <div className="bg-primary p-2 rounded-lg"><Database size={20} className="text-primary-foreground"/></div>
              <h4 className="font-bold text-base">区块链监听</h4>
            </div>
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                <ToggleSwitch label="USDT" checked={config.enableUsdt} onChange={(v)=>setConfig({...config, enableUsdt: v})} />
                <ToggleSwitch label="TRX" checked={config.enableTrx} onChange={(v)=>setConfig({...config, enableTrx: v})} />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground">收款地址</label>
                <Input type="text" value={config.usdtAddress} onChange={e=>setConfig({...config,usdtAddress:e.target.value})} className="font-mono text-xs" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground">TronGrid Key</label>
                <Input type="text" value={config.tronGridApiKey} onChange={e=>setConfig({...config,tronGridApiKey:e.target.value})} className="font-mono text-xs" />
              </div>
            </div>
          </Card>

          <Card className="p-6 space-y-6">
            <div className="flex items-center gap-3 border-b pb-4">
              <div className="bg-green-600 p-2 rounded-lg"><CreditCard size={20} className="text-white"/></div>
              <h4 className="font-bold text-base">虎皮椒接口</h4>
            </div>
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                <ToggleSwitch label="微信" checked={config.enableWechat} onChange={(v)=>setConfig({...config, enableWechat: v})} />
                <ToggleSwitch label="支付宝" checked={config.enableAlipay} onChange={(v)=>setConfig({...config, enableAlipay: v})} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground">微信 App ID</label>
                  <Input type="text" value={config.hupiWechatAppId} onChange={e=>setConfig({...config,hupiWechatAppId:e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground">微信 Secret</label>
                  <Input type="password" value={config.hupiWechatSecret} onChange={e=>setConfig({...config,hupiWechatSecret:e.target.value})} />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground">支付宝 App ID</label>
                  <Input type="text" value={config.hupiAlipayAppId} onChange={e=>setConfig({...config,hupiAlipayAppId:e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground">支付宝 Secret</label>
                  <Input type="password" value={config.hupiAlipaySecret} onChange={e=>setConfig({...config,hupiAlipaySecret:e.target.value})} />
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-6 flex items-center justify-between bg-yellow-500/10 border-yellow-500/30">
            <div className="flex-1">
              <h4 className="font-bold text-sm flex items-center gap-2"><Shuffle size={16}/> 防撞单算法</h4>
              <p className="text-xs text-muted-foreground mt-1">自动生成毫级随机尾数</p>
            </div>
            <div className="p-3 bg-background rounded-lg">
              <ToggleSwitch label="" checked={config.enableAntiCollision} onChange={(v)=>setConfig({...config, enableAntiCollision: v})} />
            </div>
          </Card>
          
          <Button onClick={handleSaveConfig} disabled={isSavingConfig} className="w-full">
            {isSavingConfig ? <Loader2 className="animate-spin mr-2"/> : null} 保存所有配置
          </Button>
        </div>
      )}
    </div>
  );
};

export default ProductManagement;
