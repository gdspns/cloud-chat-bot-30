import React, { useState, useEffect, useMemo, useRef } from "react";
import { Plus, Trash2, Search, Cloud, Loader2, Tag, FolderOpen, ChevronDown } from "lucide-react";
import { Product } from "./types";

interface ProductManagerProps {
  products: Product[];
  onAddProduct: (product: Omit<Product, 'id'>) => Promise<Product | null>;
  onUpdateProduct: (id: string, updates: Partial<Product>) => Promise<boolean>;
  onDeleteProduct: (id: string) => Promise<boolean>;
  showToast: (type: "success" | "error" | "info", message: string) => void;
  isSyncing: boolean;
  customCategories?: string[];
}

const defaultFormData: Omit<Product, 'id' | 'keywordsList'> = {
  name: 'Netflix 4K 高级独享',
  price: 10,
  currency: 'USDT',
  keywords: 'nf,netflix,奈飞',
  stockContent: 'user:pass\nuser2:pass2',
  stockCount: 0,
  description: '✅ 4K HDR\n✅ 独享账号\n✅ 质保30天',
  type: 'auto',
  category: '默认分类'
};

export function ProductManager({ 
  products, 
  onAddProduct, 
  onUpdateProduct, 
  onDeleteProduct, 
  showToast,
  isSyncing,
  customCategories = []
}: ProductManagerProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState(defaultFormData);
  const [isSaving, setIsSaving] = useState(false);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const categoryInputRef = useRef<HTMLInputElement>(null);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);

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

  const handleSave = async () => {
    if (!formData.name.trim()) {
      showToast("error", "请输入商品名称");
      return;
    }

    setIsSaving(true);
    const keywordsList = formData.keywords.split(',').map(k => k.trim().toLowerCase()).filter(k => k);
    const now = new Date().toISOString();
    
    try {
      if (editingId) {
        const success = await onUpdateProduct(editingId, { 
          ...formData, 
          keywordsList, 
          updatedAt: now 
        });
        if (success) {
          showToast("success", "商品已更新并同步到云端");
        } else {
          showToast("error", "更新失败，请重试");
        }
      } else {
        const newProduct = await onAddProduct({
          ...formData,
          keywordsList,
          createdAt: now,
          updatedAt: now
        });
        if (newProduct) {
          showToast("success", "商品已创建并同步到云端");
        } else {
          showToast("error", "创建失败，请重试");
        }
      }
      
      setEditingId(null);
      setFormData(defaultFormData);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确定删除吗？此操作不可撤销。")) return;
    
    const success = await onDeleteProduct(id);
    if (success) {
      if (editingId === id) setEditingId(null);
      showToast("info", "商品已删除");
    } else {
      showToast("error", "删除失败，请重试");
    }
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
      type: 'auto',
      category: '默认分类'
    });
  };

  // 获取所有分类（包含自定义分类）
  const categories = useMemo(() => {
    const cats = new Set(products.map(p => p.category || '默认分类'));
    // 添加自定义分类
    customCategories.forEach(cat => cats.add(cat));
    return Array.from(cats).sort((a, b) => {
      if (a === '默认分类') return -1;
      if (b === '默认分类') return 1;
      return a.localeCompare(b);
    });
  }, [products, customCategories]);

  // 按分类分组商品
  const productsByCategory = useMemo(() => {
    const grouped: Record<string, Product[]> = {};
    products.forEach(p => {
      const cat = p.category || '默认分类';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(p);
    });
    return grouped;
  }, [products]);

  // 点击外部关闭下拉框
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        categoryDropdownRef.current &&
        !categoryDropdownRef.current.contains(event.target as Node) &&
        categoryInputRef.current &&
        !categoryInputRef.current.contains(event.target as Node)
      ) {
        setShowCategoryDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectCategory = (cat: string) => {
    setFormData({ ...formData, category: cat });
    setShowCategoryDropdown(false);
  };

  return (
    <div className="flex flex-col xl:flex-row h-full">
      {/* 新建商品区域 - 左半边 */}
      <div className="flex-1 xl:w-1/2 bg-card p-6 overflow-y-auto order-2 xl:order-1 xl:border-r border-border">
        <div className="h-full">
          <div className="p-4 border-b flex justify-between items-center bg-muted rounded-t-lg">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-foreground">
                {editingId ? '编辑商品' : '新建商品'}
              </h2>
              {isSyncing && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Loader2 size={12} className="animate-spin" />
                  <span>同步中...</span>
                </div>
              )}
            </div>
            {editingId && (
              <button 
                onClick={() => handleDelete(editingId)} 
                className="text-destructive hover:bg-destructive/10 p-2 rounded"
                disabled={isSaving}
              >
                <Trash2 size={18}/>
              </button>
            )}
          </div>
          
          <div className="p-4 space-y-4 bg-card rounded-b-lg border border-t-0">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">商品名称</label>
              <input 
                type="text" 
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="w-full p-3 border rounded bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-primary outline-none"
              />
            </div>

            {/* 分类选择 */}
            <div className="relative">
              <label className="block text-sm font-medium text-foreground mb-1 flex items-center gap-1">
                <Tag size={14} /> 商品分类
              </label>
              <div className="relative">
                <input 
                  ref={categoryInputRef}
                  type="text" 
                  value={formData.category}
                  onChange={(e) => setFormData({...formData, category: e.target.value})}
                  onFocus={() => setShowCategoryDropdown(true)}
                  className="w-full p-2.5 pr-10 border rounded bg-background text-foreground focus:ring-2 focus:ring-primary outline-none text-sm"
                  placeholder="输入或选择分类"
                />
                <button
                  type="button"
                  onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                >
                  <ChevronDown size={16} className={`transition-transform ${showCategoryDropdown ? 'rotate-180' : ''}`} />
                </button>
              </div>
              
              {/* 分类下拉列表 */}
              {showCategoryDropdown && categories.length > 0 && (
                <div 
                  ref={categoryDropdownRef}
                  className="absolute z-50 w-full mt-1 bg-background border rounded-lg shadow-lg max-h-48 overflow-y-auto"
                >
                  {categories.map(cat => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => handleSelectCategory(cat)}
                      className={`w-full px-3 py-2 text-left text-sm hover:bg-muted flex items-center gap-2 ${
                        formData.category === cat ? 'bg-primary/10 text-primary' : 'text-foreground'
                      }`}
                    >
                      <FolderOpen size={14} className="text-muted-foreground" />
                      {cat}
                    </button>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-1">点击输入框选择已有分类或输入新分类名称</p>
            </div>

            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-sm font-medium text-foreground mb-1">价格</label>
                <input 
                  type="number" 
                  value={formData.price}
                  onChange={(e) => setFormData({...formData, price: Number(e.target.value)})}
                  className="w-full p-3 border rounded outline-none bg-background text-foreground text-xl font-bold placeholder:text-muted-foreground"
                  placeholder="0.00"
                />
              </div>
              <div className="w-28">
                <label className="block text-sm font-medium text-foreground mb-1">货币</label>
                <select 
                  value={formData.currency}
                  onChange={(e) => setFormData({...formData, currency: e.target.value as Product['currency']})}
                  className="w-full p-3 border rounded bg-background text-foreground outline-none h-[46px]"
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
                <Search className="absolute left-3 top-3 text-muted-foreground" size={16} />
                <input 
                  type="text" 
                  value={formData.keywords}
                  onChange={(e) => setFormData({...formData, keywords: e.target.value})}
                  className="w-full pl-9 p-2.5 border rounded bg-background text-foreground focus:ring-2 focus:ring-primary outline-none text-sm"
                  placeholder="用户输入这些词会自动弹出该商品"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">商品描述</label>
              <textarea 
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                className="w-full p-2 border rounded bg-background text-foreground focus:ring-2 focus:ring-primary outline-none font-mono text-sm"
              />
            </div>

            <div className="bg-primary/5 p-3 rounded-lg border border-primary/20">
              <label className="block text-sm font-medium text-foreground mb-1 flex justify-between">
                <span>虚拟卡密库存 (一行一个)</span>
                <span className="text-primary font-bold">{formData.stockCount} 个可用</span>
              </label>
              <textarea 
                rows={4}
                value={formData.stockContent}
                onChange={(e) => setFormData({...formData, stockContent: e.target.value})}
                className="w-full p-2 border rounded bg-background text-foreground focus:ring-2 focus:ring-primary outline-none font-mono text-xs"
                placeholder="user:pass&#10;code-1234&#10;https://gift.link"
              />
              <p className="text-xs text-muted-foreground mt-1">系统会自动按行分割，付款成功后自动取出一行发给用户。</p>
            </div>

            <button 
              onClick={handleSave}
              disabled={isSaving || isSyncing}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-2.5 rounded-lg shadow-lg transition-all flex justify-center items-center gap-2 disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> 保存中...
                </>
              ) : (
                <>
                  <Cloud size={16} /> 保存并同步到云端
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 商品列表区域 - 右半边 */}
      <div className="flex-1 xl:w-1/2 bg-card flex flex-col order-1 xl:order-2 max-h-[200px] xl:max-h-none">
        <div className="p-4 border-b flex justify-between items-center bg-muted sticky top-0 z-10">
          <h2 className="font-semibold text-foreground">商品列表</h2>
          <button 
            onClick={handleNew} 
            className="p-1.5 hover:bg-primary/10 text-primary rounded flex items-center gap-1 text-sm"
          >
            <Plus size={16} />
            <span>新建</span>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {products.length === 0 && (
            <div className="p-4 text-sm text-muted-foreground text-center border rounded-lg bg-muted/50">暂无商品</div>
          )}
          <div className="space-y-4">
            {Object.entries(productsByCategory).map(([category, categoryProducts]) => (
              <div key={category} className="border rounded-lg overflow-hidden">
                <div className="bg-muted px-3 py-2 flex items-center gap-2 border-b">
                  <FolderOpen size={14} className="text-primary" />
                  <span className="font-medium text-sm text-foreground">{category}</span>
                  <span className="text-xs text-muted-foreground">({categoryProducts.length})</span>
                </div>
                <div className="grid grid-cols-1 gap-2 p-2">
                  {categoryProducts.map(p => (
                    <div 
                      key={p.id} 
                      onClick={() => setEditingId(p.id)}
                      className={`p-3 border rounded-lg cursor-pointer hover:bg-muted transition-colors ${
                        editingId === p.id ? 'bg-primary/5 border-primary ring-1 ring-primary' : 'bg-background'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-foreground truncate text-sm">{p.name}</div>
                          <div className="flex items-center gap-2 mt-1">
                            <code className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded font-mono">
                              /buy_{p.id.slice(0, 8)}
                            </code>
                            <span className="text-xs text-muted-foreground">库存: {p.stockCount || 0}</span>
                          </div>
                        </div>
                        <span className="font-bold text-primary text-sm shrink-0 ml-2">{p.price} {p.currency}</span>
                      </div>
                      {p.keywordsList?.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {p.keywordsList.slice(0, 4).map(k => (
                            <span key={k} className="bg-muted px-1.5 py-0.5 rounded text-[10px] text-muted-foreground">{k}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}