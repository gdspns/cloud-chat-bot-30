import React, { useState, useEffect } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle, Database, Plus, X, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Product {
  id: string;
  name: string;
}

interface ParsedKey {
  product_id: string;
  card_key: string;
  is_used: boolean;
}

const BatchKeyImport = () => {
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [importMode, setImportMode] = useState('text');
  const [rawText, setRawText] = useState('');
  const [parsedKeys, setParsedKeys] = useState<ParsedKey[]>([]);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // 加载商品列表
  useEffect(() => {
    const loadProducts = async () => {
      try {
        setLoadingProducts(true);
        const { data, error } = await supabase
          .from('store_products')
          .select('id, name')
          .order('sort_order', { ascending: true });

        if (error) throw error;
        setProducts(data || []);
      } catch (error) {
        console.error('加载商品列表失败:', error);
        toast({
          title: '加载失败',
          description: '无法加载商品列表',
          variant: 'destructive',
        });
      } finally {
        setLoadingProducts(false);
      }
    };

    loadProducts();
  }, [toast]);

  // 解析输入的文本
  const handleParse = () => {
    if (!selectedProduct) {
      setStatus({ type: 'error', message: '请先选择所属商品！' });
      return;
    }

    if (!rawText.trim()) {
      setStatus({ type: 'error', message: '请输入卡密内容！' });
      return;
    }

    // 按行分割，去除空行和首尾空格
    const lines = rawText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    // 去重逻辑
    const uniqueLines = [...new Set(lines)];
    
    // 生成预览数据
    const keysToImport: ParsedKey[] = uniqueLines.map(key => ({
      product_id: selectedProduct,
      card_key: key,
      is_used: false,
    }));

    setParsedKeys(keysToImport);
    setIsPreviewing(true);
    setStatus(null);
  };

  // 提交到数据库
  const handleSubmitToDatabase = async () => {
    setIsLoading(true);
    
    try {
      const { error } = await supabase
        .from('store_card_keys')
        .insert(parsedKeys);

      if (error) throw error;

      setStatus({ 
        type: 'success', 
        message: `成功导入 ${parsedKeys.length} 个卡密！` 
      });
      
      toast({
        title: '导入成功',
        description: `已成功导入 ${parsedKeys.length} 个卡密`,
      });
      
      // 重置表单
      setRawText('');
      setParsedKeys([]);
      setIsPreviewing(false);

    } catch (error: any) {
      console.error('导入失败:', error);
      setStatus({ type: 'error', message: '导入失败，请检查网络或权限。' });
      toast({
        title: '导入失败',
        description: error.message || '请检查网络或权限',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setIsPreviewing(false);
    setParsedKeys([]);
    setStatus(null);
  };

  const selectedProductName = products.find(p => p.id === selectedProduct)?.name || '';

  return (
    <div className="max-w-4xl mx-auto p-6 bg-card rounded-xl shadow-sm border border-border">
      <div className="mb-8 border-b border-border pb-4">
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Database className="w-6 h-6 text-primary" />
          卡密库存管理
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">批量导入卡密到数据库，自动绑定指定商品ID。</p>
      </div>

      {/* 步骤 1: 选择配置 */}
      {!isPreviewing && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          
          {/* 商品选择器 */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              1. 选择归属商品 <span className="text-destructive">*</span>
            </label>
            <div className="relative">
              <select 
                value={selectedProduct}
                onChange={(e) => setSelectedProduct(e.target.value)}
                disabled={loadingProducts}
                className="w-full p-3 border border-border rounded-lg bg-muted focus:ring-2 focus:ring-primary focus:border-primary transition-all outline-none appearance-none disabled:opacity-50"
              >
                <option value="" disabled>
                  {loadingProducts ? '正在加载商品...' : '-- 请选择商品 --'}
                </option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-muted-foreground">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                </svg>
              </div>
            </div>
            {products.length === 0 && !loadingProducts && (
              <p className="text-sm text-muted-foreground mt-2">暂无商品，请先在商品管理中添加商品</p>
            )}
          </div>

          {/* 导入方式切换 */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              2. 输入卡密数据
            </label>
            <div className="flex gap-4 mb-3">
              <button 
                onClick={() => setImportMode('text')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                  importMode === 'text' 
                    ? 'bg-primary/10 border-primary/30 text-primary' 
                    : 'bg-card border-border text-muted-foreground hover:bg-muted'
                }`}
              >
                <FileText className="w-4 h-4" />
                文本粘贴 (推荐)
              </button>
              <button 
                onClick={() => setImportMode('csv')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                  importMode === 'csv' 
                    ? 'bg-primary/10 border-primary/30 text-primary' 
                    : 'bg-card border-border text-muted-foreground hover:bg-muted'
                }`}
              >
                <Upload className="w-4 h-4" />
                Excel/CSV 上传
              </button>
            </div>

            {importMode === 'text' ? (
              <div className="relative">
                <textarea
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder={`在此粘贴卡密，一行一个，例如：\nABCD-1234-EFGH-5678\nIJKL-9012-MNOP-3456`}
                  className="w-full h-64 p-4 border border-border rounded-lg font-mono text-sm focus:ring-2 focus:ring-primary outline-none resize-none bg-muted"
                />
                <div className="absolute bottom-4 right-4 text-xs text-muted-foreground bg-card px-2 py-1 rounded shadow-sm border border-border">
                  已输入行数: {rawText ? rawText.split('\n').filter(l => l.trim()).length : 0}
                </div>
              </div>
            ) : (
              <div className="h-64 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center text-muted-foreground bg-muted">
                <Upload className="w-10 h-10 mb-2 text-muted-foreground/50" />
                <p>点击或拖拽上传 CSV 文件</p>
                <p className="text-xs mt-2 text-muted-foreground/70">(此功能为预留扩展接口)</p>
              </div>
            )}
          </div>

          {/* 错误提示 */}
          {status?.type === 'error' && (
            <div className="flex items-center gap-2 text-destructive bg-destructive/10 p-3 rounded-lg text-sm">
              <AlertCircle className="w-4 h-4" />
              {status.message}
            </div>
          )}

          {/* 操作按钮 */}
          <div className="flex justify-end pt-4">
            <button
              onClick={handleParse}
              disabled={loadingProducts || products.length === 0}
              className="bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-2.5 rounded-lg font-medium transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="w-4 h-4" />
              解析并预览
            </button>
          </div>
        </div>
      )}

      {/* 步骤 2: 预览确认 */}
      {isPreviewing && (
        <div className="animate-in zoom-in-95 duration-300">
          <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 mb-6 flex justify-between items-center">
            <div>
              <h3 className="font-bold text-foreground">准备导入</h3>
              <p className="text-sm text-muted-foreground mt-1">
                即将为 <span className="font-bold underline text-foreground">{selectedProductName}</span> 添加 <span className="font-bold text-lg mx-1 text-primary">{parsedKeys.length}</span> 个卡密
              </p>
            </div>
            <div className="bg-card p-2 rounded-md shadow-sm border border-border">
              <span className="text-xs font-mono text-muted-foreground">Product ID: {selectedProduct.slice(0, 8)}...</span>
            </div>
          </div>

          {/* 数据表格预览 */}
          <div className="border border-border rounded-lg overflow-hidden mb-6 max-h-80 overflow-y-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted text-muted-foreground sticky top-0">
                <tr>
                  <th className="px-4 py-3 font-medium border-b border-border">序号</th>
                  <th className="px-4 py-3 font-medium border-b border-border">卡密内容预览</th>
                  <th className="px-4 py-3 font-medium border-b border-border">状态</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {parsedKeys.map((item, index) => (
                  <tr key={index} className="hover:bg-muted/50">
                    <td className="px-4 py-2 text-muted-foreground w-16">{index + 1}</td>
                    <td className="px-4 py-2 font-mono text-foreground">{item.card_key}</td>
                    <td className="px-4 py-2">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-700 dark:text-green-300">
                        待导入
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <button
              onClick={handleCancel}
              disabled={isLoading}
              className="px-5 py-2.5 rounded-lg border border-border text-foreground hover:bg-muted font-medium transition-colors disabled:opacity-50"
            >
              返回修改
            </button>
            <button
              onClick={handleSubmitToDatabase}
              disabled={isLoading}
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-2.5 rounded-lg font-medium transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  正在入库...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  确认导入数据库
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* 成功反馈 */}
      {status?.type === 'success' && !isPreviewing && (
        <div className="mt-6 p-4 bg-green-500/10 text-green-700 dark:text-green-300 rounded-lg flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
          <CheckCircle className="w-5 h-5 flex-shrink-0" />
          <p>{status.message}</p>
          <button onClick={() => setStatus(null)} className="ml-auto hover:bg-green-500/20 p-1 rounded-full">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};

export default BatchKeyImport;
