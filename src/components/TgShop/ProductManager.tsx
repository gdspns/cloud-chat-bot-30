import React, { useState, useEffect } from "react";
import { Plus, Trash2, Save, Search } from "lucide-react";
import { Product } from "./types";

interface ProductManagerProps {
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  showToast: (type: "success" | "error" | "info", message: string) => void;
}

const defaultFormData: Omit<Product, 'id' | 'keywordsList'> = {
  name: 'Netflix 4K 高级独享',
  price: 10,
  currency: 'USDT',
  keywords: 'nf,netflix,奈飞',
  stockContent: 'user:pass\nuser2:pass2',
  stockCount: 0,
  description: '✅ 4K HDR\n✅ 独享账号\n✅ 质保30天',
  type: 'auto'
};

export function ProductManager({ products, setProducts, showToast }: ProductManagerProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState(defaultFormData);

  useEffect(() => {
    if (editingId) {
      const p = products.find(p => p.id === editingId);
      if (p) setFormData({ ...p, stockContent: p.stockContent || '' });
    }
  }, [editingId, products]);

  useEffect(() => {
    const lines = formData.stockContent.split('\n').filter(l => l.trim() !== '').length;
    setFormData(prev => ({ ...prev, stockCount: lines }));
  }, [formData.stockContent]);

  const handleSave = () => {
    const keywordsList = formData.keywords.split(',').map(k => k.trim().toLowerCase());
    const now = new Date().toISOString();
    
    if (editingId) {
      setProducts(prev => prev.map(p => 
        p.id === editingId 
          ? { ...p, ...formData, keywordsList, updatedAt: now }
          : p
      ));
      showToast("success", "商品已更新");
    } else {
      const newProduct: Product = {
        id: crypto.randomUUID(),
        ...formData,
        keywordsList,
        createdAt: now,
        updatedAt: now
      };
      setProducts(prev => [...prev, newProduct]);
      showToast("success", "商品已创建");
    }
    
    setEditingId(null);
    setFormData(defaultFormData);
  };

  const handleDelete = (id: string) => {
    if (!confirm("确定删除吗？")) return;
    setProducts(prev => prev.filter(p => p.id !== id));
    if (editingId === id) setEditingId(null);
    showToast("info", "商品已删除");
  };

  const handleNew = () => {
    setEditingId(null);
    setFormData({
      name: '',
      price: 0,
      currency: 'USDT',
      keywords: '',
      stockContent: '',
      stockCount: 0,
      description: '',
      type: 'auto'
    });
  };

  return (
    <div className="flex h-full">
      {/* 商品列表侧边栏 */}
      <div className="w-[180px] bg-card border-r flex flex-col shrink-0">
        <div className="p-4 border-b flex justify-between items-center bg-muted sticky top-0 z-10">
          <h2 className="font-semibold text-foreground text-sm">商品列表</h2>
          <button 
            onClick={handleNew} 
            className="p-1 hover:bg-primary/10 text-primary rounded"
          >
            <Plus size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {products.length === 0 && (
            <div className="p-4 text-sm text-muted-foreground text-center">暂无商品</div>
          )}
          {products.map(p => (
            <div 
              key={p.id} 
              onClick={() => setEditingId(p.id)}
              className={`p-4 border-b cursor-pointer hover:bg-muted transition-colors ${
                editingId === p.id ? 'bg-primary/5 border-l-4 border-l-primary' : ''
              }`}
            >
              <div className="font-medium text-foreground truncate text-sm">{p.name}</div>
              <div className="flex justify-between mt-1 text-xs">
                <span className="text-muted-foreground">库存: {p.stockCount || 0}</span>
                <span className="font-bold text-primary">{p.price} {p.currency}</span>
              </div>
              <div className="mt-1 flex flex-wrap gap-1">
                {p.keywordsList?.slice(0, 3).map(k => (
                  <span key={k} className="bg-muted px-1 rounded text-[10px] text-muted-foreground">{k}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 编辑区域 */}
      <div className="flex-1 bg-muted/50 p-8 overflow-y-auto min-w-[400px]">
        <div className="max-w-2xl mx-auto bg-card rounded-xl shadow-sm border overflow-hidden">
          <div className="p-6 border-b flex justify-between items-center">
            <h2 className="text-lg font-bold text-foreground">
              {editingId ? '编辑商品' : '新建商品'}
            </h2>
            {editingId && (
              <button 
                onClick={() => handleDelete(editingId)} 
                className="text-destructive hover:bg-destructive/10 p-2 rounded"
              >
                <Trash2 size={18}/>
              </button>
            )}
          </div>
          
          <div className="p-6 space-y-5">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">商品名称</label>
              <input 
                type="text" 
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="w-full p-4 border rounded bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-primary outline-none text-lg"
              />
            </div>

            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-foreground mb-1">价格</label>
                <input 
                  type="number" 
                  value={formData.price}
                  onChange={(e) => setFormData({...formData, price: Number(e.target.value)})}
                  className="w-full p-4 border rounded outline-none bg-background text-foreground text-2xl font-bold placeholder:text-muted-foreground"
                  placeholder="0.00"
                />
              </div>
              <div className="w-32">
                <label className="block text-sm font-medium text-foreground mb-1">货币</label>
                <select 
                  value={formData.currency}
                  onChange={(e) => setFormData({...formData, currency: e.target.value as Product['currency']})}
                  className="w-full p-4 border rounded bg-background text-foreground outline-none text-lg h-full"
                >
                  <option>USDT</option>
                  <option>TRX</option>
                  <option>CNY</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                触发关键词 <span className="text-xs text-muted-foreground font-normal">(英文逗号分隔)</span>
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-3.5 text-muted-foreground" size={18} />
                <input 
                  type="text" 
                  value={formData.keywords}
                  onChange={(e) => setFormData({...formData, keywords: e.target.value})}
                  className="w-full pl-10 p-3 border rounded bg-background text-foreground focus:ring-2 focus:ring-primary outline-none"
                  placeholder="用户输入这些词会自动弹出该商品"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">商品描述</label>
              <textarea 
                rows={4}
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                className="w-full p-2 border rounded bg-background text-foreground focus:ring-2 focus:ring-primary outline-none font-mono text-sm"
              />
            </div>

            <div className="bg-primary/5 p-4 rounded-lg border border-primary/20">
              <label className="block text-sm font-medium text-foreground mb-1 flex justify-between">
                <span>虚拟卡密库存 (一行一个)</span>
                <span className="text-primary font-bold">{formData.stockCount} 个可用</span>
              </label>
              <textarea 
                rows={5}
                value={formData.stockContent}
                onChange={(e) => setFormData({...formData, stockContent: e.target.value})}
                className="w-full p-2 border rounded bg-background text-foreground focus:ring-2 focus:ring-primary outline-none font-mono text-xs"
                placeholder="user:pass&#10;code-1234&#10;https://gift.link"
              />
              <p className="text-xs text-muted-foreground mt-2">系统会自动按行分割，付款成功后自动取出一行发给用户。</p>
            </div>

            <button 
              onClick={handleSave}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-3 rounded-lg shadow-lg transition-all flex justify-center items-center gap-2"
            >
              <Save size={18} /> 保存配置
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
