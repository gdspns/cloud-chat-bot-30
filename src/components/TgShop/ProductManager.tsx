import React, { useState, useEffect, useMemo, useRef } from "react";
import { Plus, Trash2, Search, Cloud, Loader2, Tag, FolderOpen, ChevronDown, ShoppingBag, Wallet, Package } from "lucide-react";
import { Product } from "./types";
import { useLanguage } from "@/hooks/use-language";

interface ProductManagerProps {
  products: Product[];
  onAddProduct: (product: Omit<Product, 'id'>) => Promise<Product | null>;
  onUpdateProduct: (id: string, updates: Partial<Product>) => Promise<boolean>;
  onDeleteProduct: (id: string) => Promise<boolean>;
  showToast: (type: "success" | "error" | "info", message: string) => void;
  isSyncing: boolean;
  customCategories?: string[];
  readOnly?: boolean;
}

export function ProductManager({ 
  products, 
  onAddProduct, 
  onUpdateProduct, 
  onDeleteProduct, 
  showToast,
  isSyncing,
  customCategories = [],
  readOnly = false
}: ProductManagerProps) {
  const { t, language } = useLanguage();
  const defaultCategory = t('tgshop.product.defaultCategory');
  
  const getDefaultFormData = (): Omit<Product, 'id' | 'keywordsList'> => ({
    name: language === 'zh' ? 'Netflix 4K 高级独享' : 'Netflix 4K Premium',
    price: 10,
    currency: 'USDT',
    keywords: language === 'zh' ? 'nf,netflix,奈飞' : 'nf,netflix',
    stockContent: 'user:pass\nuser2:pass2',
    stockCount: 0,
    description: language === 'zh' ? '✅ 4K HDR\n✅ 独享账号\n✅ 质保30天' : '✅ 4K HDR\n✅ Exclusive Account\n✅ 30-day Warranty',
    type: 'auto',
    category: defaultCategory
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Omit<Product, 'id' | 'keywordsList'>>(getDefaultFormData());
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
      showToast("error", t('tgshop.product.enterName'));
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
          showToast("success", t('tgshop.product.updated'));
        } else {
          showToast("error", t('tgshop.product.updateFailed'));
        }
      } else {
        const newProduct = await onAddProduct({
          ...formData,
          keywordsList,
          createdAt: now,
          updatedAt: now
        });
        if (newProduct) {
          showToast("success", t('tgshop.product.created'));
        } else {
          showToast("error", t('tgshop.product.createFailed'));
        }
      }
      
      setEditingId(null);
      setFormData(getDefaultFormData());
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('tgshop.product.confirmDelete'))) return;
    
    const success = await onDeleteProduct(id);
    if (success) {
      if (editingId === id) setEditingId(null);
      showToast("info", t('tgshop.product.deleted'));
    } else {
      showToast("error", t('tgshop.product.deleteFailed'));
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
      category: defaultCategory
    });
  };

  // 获取所有分类（包含自定义分类）
  const categories = useMemo(() => {
    const cats = new Set(products.map(p => p.category || defaultCategory));
    // 添加自定义分类
    customCategories.forEach(cat => cats.add(cat));
    return Array.from(cats).sort((a, b) => {
      if (a === defaultCategory) return -1;
      if (b === defaultCategory) return 1;
      return a.localeCompare(b);
    });
  }, [products, customCategories, defaultCategory]);

  // 按分类分组商品
  const productsByCategory = useMemo(() => {
    const grouped: Record<string, Product[]> = {};
    products.forEach(p => {
      const cat = p.category || defaultCategory;
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(p);
    });
    return grouped;
  }, [products, defaultCategory]);

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
                {editingId ? t('tgshop.product.editProduct') : t('tgshop.product.newProduct')}
              </h2>
              {isSyncing && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Loader2 size={12} className="animate-spin" />
                  <span>{t('tgshop.product.syncing')}</span>
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
            {/* 商品类型选择 */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                {language === 'zh' ? '商品类型' : 'Product Type'}
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setFormData({...formData, type: 'auto'})}
                  className={`flex items-center gap-2 p-3 border rounded-lg text-sm font-medium transition-colors ${
                    formData.type === 'auto'
                      ? 'bg-primary/10 border-primary text-primary ring-1 ring-primary'
                      : 'bg-background text-muted-foreground hover:bg-muted'
                  }`}
                >
                  <ShoppingBag size={16} />
                  {language === 'zh' ? '发卡商品' : 'Card'}
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({...formData, type: 'recharge', stockContent: '', stockCount: 0, stockQuantity: undefined})}
                  className={`flex items-center gap-2 p-3 border rounded-lg text-sm font-medium transition-colors ${
                    formData.type === 'recharge'
                      ? 'bg-primary/10 border-primary text-primary ring-1 ring-primary'
                      : 'bg-background text-muted-foreground hover:bg-muted'
                  }`}
                >
                  <Wallet size={16} />
                  {language === 'zh' ? '充值商品' : 'Recharge'}
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({...formData, type: 'physical', stockContent: '', stockCount: 0, stockQuantity: formData.stockQuantity ?? 10})}
                  className={`flex items-center gap-2 p-3 border rounded-lg text-sm font-medium transition-colors ${
                    formData.type === 'physical'
                      ? 'bg-primary/10 border-primary text-primary ring-1 ring-primary'
                      : 'bg-background text-muted-foreground hover:bg-muted'
                  }`}
                >
                  <Package size={16} />
                  {language === 'zh' ? '实物商品' : 'Physical'}
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {formData.type === 'recharge'
                  ? (language === 'zh' ? '充值商品：用户付款后金额自动充入余额账户' : 'Recharge: Payment amount is added to user balance')
                  : formData.type === 'physical'
                  ? (language === 'zh' ? '实物商品：用户需填写收货地址，付款后通知管理员发货' : 'Physical: User provides shipping address, admin is notified to ship')
                  : (language === 'zh' ? '发卡商品：用户付款后自动发送卡密' : 'Card: Card keys are delivered after payment')}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">{t('tgshop.product.productName')}</label>
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
                <Tag size={14} /> {t('tgshop.product.category')}
              </label>
              <div className="relative">
                <input 
                  ref={categoryInputRef}
                  type="text" 
                  value={formData.category}
                  onChange={(e) => setFormData({...formData, category: e.target.value})}
                  onFocus={() => setShowCategoryDropdown(true)}
                  className="w-full p-2.5 pr-10 border rounded bg-background text-foreground focus:ring-2 focus:ring-primary outline-none text-sm"
                  placeholder={language === 'zh' ? '输入或选择分类' : 'Enter or select category'}
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
              <p className="text-xs text-muted-foreground mt-1">{t('tgshop.product.selectOrInput')}</p>
            </div>

            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-sm font-medium text-foreground mb-1">{t('tgshop.product.price')}</label>
                <input 
                  type="number" 
                  value={formData.price}
                  onChange={(e) => setFormData({...formData, price: Number(e.target.value)})}
                  className="w-full p-3 border rounded outline-none bg-background text-foreground text-xl font-bold placeholder:text-muted-foreground"
                  placeholder="0.00"
                />
              </div>
              <div className="w-28">
                <label className="block text-sm font-medium text-foreground mb-1">{t('tgshop.product.currency')}</label>
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
                {t('tgshop.product.keywords')} <span className="text-xs text-muted-foreground font-normal">{t('tgshop.product.keywordsHint')}</span>
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-3 text-muted-foreground" size={16} />
                <input 
                  type="text" 
                  value={formData.keywords}
                  onChange={(e) => setFormData({...formData, keywords: e.target.value})}
                  className="w-full pl-9 p-2.5 border rounded bg-background text-foreground focus:ring-2 focus:ring-primary outline-none text-sm"
                  placeholder={t('tgshop.product.keywordsPlaceholder')}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">{t('tgshop.product.description')}</label>
              <textarea 
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                className="w-full p-2 border rounded bg-background text-foreground focus:ring-2 focus:ring-primary outline-none font-mono text-sm"
              />
            </div>

            {formData.type !== 'recharge' ? (
              <div className="bg-primary/5 p-3 rounded-lg border border-primary/20">
                <label className="block text-sm font-medium text-foreground mb-1 flex justify-between">
                  <span>{t('tgshop.product.stockTitle')}</span>
                  <span className="text-primary font-bold">{formData.stockCount} {t('tgshop.product.stockCount')}</span>
                </label>
                <textarea 
                  rows={4}
                  value={formData.stockContent}
                  onChange={(e) => setFormData({...formData, stockContent: e.target.value})}
                  className="w-full p-2 border rounded bg-background text-foreground focus:ring-2 focus:ring-primary outline-none font-mono text-xs"
                  placeholder={t('tgshop.product.stockPlaceholder')}
                />
                <p className="text-xs text-muted-foreground mt-1">{t('tgshop.product.stockHint')}</p>
              </div>
            ) : (
              <div className="bg-accent/50 p-3 rounded-lg border border-accent">
                <div className="flex items-center gap-2 text-sm text-foreground">
                  <Wallet size={16} className="text-primary" />
                  <span className="font-medium">{language === 'zh' ? '充值商品说明' : 'Recharge Product Info'}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {language === 'zh'
                    ? '充值商品无需库存卡密。用户购买后，商品价格金额将自动充入其余额账户。'
                    : 'No stock needed. The product price will be credited to the user\'s balance after payment.'}
                </p>
              </div>
            )}

            <button 
              onClick={handleSave}
              disabled={isSaving || isSyncing || readOnly}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-2.5 rounded-lg shadow-lg transition-all flex justify-center items-center gap-2 disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> {t('tgshop.product.saving')}
                </>
              ) : (
                <>
                  <Cloud size={16} /> {t('tgshop.product.saveAndSync')}
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 商品列表区域 - 右半边 */}
      <div className="flex-1 xl:w-1/2 bg-card flex flex-col order-1 xl:order-2 max-h-[200px] xl:max-h-none">
        <div className="p-4 border-b flex justify-between items-center bg-muted sticky top-0 z-10">
          <h2 className="font-semibold text-foreground">{t('tgshop.product.productList')}</h2>
          <button 
            onClick={handleNew} 
            disabled={readOnly}
            className="p-1.5 hover:bg-primary/10 text-primary rounded flex items-center gap-1 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus size={16} />
            <span>{t('tgshop.product.new')}</span>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {products.length === 0 && (
            <div className="p-4 text-sm text-muted-foreground text-center border rounded-lg bg-muted/50">{t('tgshop.product.noProducts')}</div>
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
                          <div className="font-medium text-foreground truncate text-sm flex items-center gap-1.5">
                            {p.name}
                            {p.type === 'recharge' && (
                              <span className="inline-flex items-center gap-0.5 bg-accent text-accent-foreground px-1.5 py-0.5 rounded text-[10px] font-normal shrink-0">
                                <Wallet size={10} /> {language === 'zh' ? '充值' : 'Recharge'}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <code className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded font-mono">
                              /buy_{p.id.slice(0, 8)}
                            </code>
                            {p.type !== 'recharge' && (
                              <span className="text-xs text-muted-foreground">{t('tgshop.product.stock')}: {p.stockCount || 0}</span>
                            )}
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