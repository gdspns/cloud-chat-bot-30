import React, { useState, useEffect } from 'react';
import { 
  Edit3,
  Package,
  Loader2,
  Layers,
  Copy,
  Plus,
  Trash2,
  Calculator,
  RefreshCw
} from 'lucide-react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useStoreProducts, StoreProduct } from "@/hooks/useStoreProducts";
import { supabase } from "@/integrations/supabase/client";

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

// --- 初始数据常量 ---
const CATEGORY_TAGS = [
  { id: 'chat', label: '双向聊天' },
  { id: 'keyboard', label: '菜单键盘' },
  { id: 'mall', label: 'TG商城' }
];

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

  // 使用数据库 hook 管理商品
  const { products, loading, syncing, addProduct, updateProduct, deleteProduct, getStockCount, loadProducts } = useStoreProducts();

  // 从 localStorage 读取汇率配置
  const getExchangeRate = () => {
    try {
      const saved = localStorage.getItem('app_config_v41');
      if (saved) {
        const config = JSON.parse(saved);
        return config.exchangeRateUsdtCny || 7.4;
      }
    } catch {}
    return 7.4;
  };

  const [isCalculating, setIsCalculating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newProduct, setNewProduct] = useState<NewProduct>({
    name: '', type: 'card', duration: 30, price: '', usdt: '', trx: '', desc: '', codesText: '', tags: []
  });

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
      codesText: '', // 编辑时清空卡密输入框，追加模式
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
      const rate = getExchangeRate();
      const usdtVal = (parseFloat(newProduct.price) / rate).toFixed(3);
      const trxVal = (parseFloat(usdtVal) / 0.155).toFixed(3);
      setNewProduct(prev => ({ ...prev, usdt: usdtVal, trx: trxVal }));
      setIsCalculating(false);
    }, 500);
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
              <label className="text-xs font-bold text-primary flex items-center gap-2">
                <Layers size={14} /> 
                {editingId ? '追加卡密 (一行一个，保留原有库存)' : '卡密库 (一行一个)'}
              </label>
              <textarea placeholder="在此粘贴卡密数据..." className="w-full min-h-[120px] p-4 bg-foreground text-green-400 border border-border rounded-lg font-mono text-xs outline-none" value={newProduct.codesText} onChange={e => setNewProduct({...newProduct, codesText: e.target.value})} />
              <p className="text-xs text-muted-foreground">当前识别: {newProduct.codesText ? newProduct.codesText.split('\n').filter(s => s.trim() !== "").length : 0} 行</p>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
          <div>
            {saveResultMessage && <p className="text-xs text-muted-foreground">{saveResultMessage}</p>}
          </div>
          <div className="flex gap-2">
            {editingId && <Button variant="outline" onClick={handleCancelEdit}>取消</Button>}
            <Button onClick={handleSaveProduct} disabled={syncing || isSavingProduct}>
              {(syncing || isSavingProduct) ? <Loader2 className="animate-spin mr-2" size={16}/> : null}
              {editingId ? '保存修改' : '发布商品'}
            </Button>
          </div>
        </div>
      </Card>

      {/* 商品列表 */}
      <Card className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-lg flex items-center gap-3"><Package size={20} /> 商品列表 ({products.length})</h3>
          <Button variant="ghost" size="sm" onClick={() => loadProducts()} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </Button>
        </div>
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="animate-spin" size={32} />
          </div>
        ) : products.length === 0 ? (
          <div className="text-center text-muted-foreground py-12">暂无商品，请先发布</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {products.map(p => {
              const stock = getStockCount(p);
              return (
                <Card key={p.id} className={`p-4 flex justify-between items-start ${editingId === p.id ? 'ring-2 ring-primary' : ''}`}>
                  <div className="space-y-1">
                    <h4 className="font-bold text-base flex items-center gap-2">
                      {p.name}
                      <span className={`text-xs px-1.5 py-0.5 rounded ${p.type === 'auto' ? 'bg-blue-500/20 text-blue-500' : 'bg-purple-500/20 text-purple-500'}`}>
                        {p.type === 'auto' ? '直充' : '卡密'}
                      </span>
                    </h4>
                    <div className="flex gap-1 flex-wrap">
                      {(p.tags || []).map(tag => (
                        <span key={tag} className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                          {CATEGORY_TAGS.find(t => t.id === tag)?.label || tag}
                        </span>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">{p.duration}天 | ¥{p.price} | {p.usdt}U | {p.trx}TRX</p>
                    <p className={`text-xs font-bold ${stock > 0 ? 'text-green-500' : 'text-destructive'}`}>
                      库存: {stock}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => handleEditClick(p)}><Edit3 size={16} /></Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDeleteProduct(p.id)} className="text-destructive hover:text-destructive"><Trash2 size={16} /></Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
};

export default ProductManagement;
