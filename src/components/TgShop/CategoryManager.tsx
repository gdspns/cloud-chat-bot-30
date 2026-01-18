import React, { useState, useMemo } from "react";
import { Plus, Trash2, Edit2, Check, X, FolderOpen, Loader2, Tag } from "lucide-react";
import { Product } from "./types";

interface CategoryManagerProps {
  products: Product[];
  onUpdateProduct: (id: string, updates: Partial<Product>) => Promise<boolean>;
  showToast: (type: "success" | "error" | "info", message: string) => void;
  isSyncing: boolean;
  customCategories: string[];
  onAddCustomCategory: (category: string) => void;
  onRemoveCustomCategory: (category: string) => void;
}

export function CategoryManager({ 
  products, 
  onUpdateProduct, 
  showToast,
  isSyncing,
  customCategories,
  onAddCustomCategory,
  onRemoveCustomCategory
}: CategoryManagerProps) {
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  // 获取所有分类及其商品数量（包含自定义分类）
  const categoriesWithCount = useMemo(() => {
    const catMap: Record<string, number> = {};
    products.forEach(p => {
      const cat = p.category || '默认分类';
      catMap[cat] = (catMap[cat] || 0) + 1;
    });
    // 添加自定义分类（没有商品的）
    customCategories.forEach(cat => {
      if (!(cat in catMap)) {
        catMap[cat] = 0;
      }
    });
    return Object.entries(catMap).map(([name, count]) => ({ name, count }));
  }, [products, customCategories]);

  // 新建分类
  const handleAddCategory = () => {
    const name = newCategoryName.trim();
    if (!name) {
      showToast("error", "请输入分类名称");
      return;
    }
    if (categoriesWithCount.some(c => c.name === name)) {
      showToast("error", "分类已存在");
      return;
    }
    // 添加到自定义分类列表
    onAddCustomCategory(name);
    showToast("success", `分类 "${name}" 已创建`);
    setNewCategoryName('');
  };

  // 编辑分类名称
  const handleEditCategory = async (oldName: string) => {
    const newName = editingName.trim();
    if (!newName) {
      showToast("error", "分类名称不能为空");
      return;
    }
    if (newName === oldName) {
      setEditingCategory(null);
      return;
    }
    if (categoriesWithCount.some(c => c.name === newName)) {
      showToast("error", "分类名称已存在");
      return;
    }

    setIsUpdating(true);
    try {
      // 更新所有属于该分类的商品
      const productsToUpdate = products.filter(p => (p.category || '默认分类') === oldName);
      let successCount = 0;
      
      for (const product of productsToUpdate) {
        const success = await onUpdateProduct(product.id, { category: newName });
        if (success) successCount++;
      }

      if (successCount === productsToUpdate.length) {
        showToast("success", `分类已重命名为 "${newName}"`);
      } else {
        showToast("error", `部分商品更新失败 (${successCount}/${productsToUpdate.length})`);
      }
      setEditingCategory(null);
    } finally {
      setIsUpdating(false);
    }
  };

  // 删除分类（将商品移到默认分类）
  const handleDeleteCategory = async (categoryName: string) => {
    if (categoryName === '默认分类') {
      showToast("error", "默认分类不能删除");
      return;
    }
    
    const productsInCategory = products.filter(p => (p.category || '默认分类') === categoryName);
    if (productsInCategory.length > 0) {
      if (!confirm(`该分类下有 ${productsInCategory.length} 个商品，删除后将移至"默认分类"，确定继续？`)) {
        return;
      }
    } else {
      if (!confirm(`确定删除分类 "${categoryName}"？`)) {
        return;
      }
    }

    setIsUpdating(true);
    try {
      let successCount = 0;
      for (const product of productsInCategory) {
        const success = await onUpdateProduct(product.id, { category: '默认分类' });
        if (success) successCount++;
      }

      // 从自定义分类中移除
      onRemoveCustomCategory(categoryName);

      if (productsInCategory.length === 0 || successCount === productsInCategory.length) {
        showToast("success", `分类 "${categoryName}" 已删除`);
      } else {
        showToast("error", `部分商品移动失败 (${successCount}/${productsInCategory.length})`);
      }
    } finally {
      setIsUpdating(false);
    }
  };

  const startEdit = (categoryName: string) => {
    setEditingCategory(categoryName);
    setEditingName(categoryName);
  };

  const cancelEdit = () => {
    setEditingCategory(null);
    setEditingName('');
  };

  return (
    <div className="h-full flex flex-col bg-card">
      {/* 头部 */}
      <div className="p-4 border-b bg-muted shrink-0">
        <div className="flex items-center gap-2 mb-3">
          <Tag className="text-primary" size={20} />
          <h2 className="font-semibold text-foreground text-lg">分类管理</h2>
          {isSyncing && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground ml-2">
              <Loader2 size={12} className="animate-spin" />
              <span>同步中...</span>
            </div>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          管理商品分类，支持新建、重命名和删除分类
        </p>
      </div>

      {/* 新建分类 */}
      <div className="p-4 border-b shrink-0">
        <label className="block text-sm font-medium text-foreground mb-2">新建分类</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            placeholder="输入分类名称"
            className="flex-1 p-2.5 border rounded bg-background text-foreground focus:ring-2 focus:ring-primary outline-none text-sm"
            onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
          />
          <button
            onClick={handleAddCategory}
            disabled={isUpdating || isSyncing}
            className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors flex items-center gap-1.5 disabled:opacity-50"
          >
            <Plus size={16} />
            <span>新建</span>
          </button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          💡 提示：新建分类后，在商品管理中选择该分类即可使用
        </p>
      </div>

      {/* 分类列表 */}
      <div className="flex-1 overflow-y-auto p-4">
        <h3 className="text-sm font-medium text-foreground mb-3">
          现有分类 ({categoriesWithCount.length})
        </h3>
        
        {categoriesWithCount.length === 0 ? (
          <div className="p-6 text-center border rounded-lg bg-muted/50">
            <FolderOpen className="mx-auto mb-2 text-muted-foreground" size={32} />
            <p className="text-sm text-muted-foreground">暂无分类</p>
            <p className="text-xs text-muted-foreground mt-1">添加商品时会自动创建分类</p>
          </div>
        ) : (
          <div className="space-y-2">
            {categoriesWithCount.map(({ name, count }) => (
              <div
                key={name}
                className="p-3 border rounded-lg bg-background hover:bg-muted/50 transition-colors"
              >
                {editingCategory === name ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      className="flex-1 p-2 border rounded bg-background text-foreground focus:ring-2 focus:ring-primary outline-none text-sm"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleEditCategory(name);
                        if (e.key === 'Escape') cancelEdit();
                      }}
                    />
                    <button
                      onClick={() => handleEditCategory(name)}
                      disabled={isUpdating}
                      className="p-2 text-green-600 hover:bg-green-500/10 rounded disabled:opacity-50"
                      title="保存"
                    >
                      {isUpdating ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                    </button>
                    <button
                      onClick={cancelEdit}
                      disabled={isUpdating}
                      className="p-2 text-muted-foreground hover:bg-muted rounded disabled:opacity-50"
                      title="取消"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FolderOpen size={18} className="text-primary" />
                      <div>
                        <span className="font-medium text-foreground">{name}</span>
                        <span className="ml-2 text-xs text-muted-foreground">
                          {count} 个商品
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => startEdit(name)}
                        disabled={isUpdating || isSyncing}
                        className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded transition-colors disabled:opacity-50"
                        title="编辑"
                      >
                        <Edit2 size={14} />
                      </button>
                      {name !== '默认分类' && (
                        <button
                          onClick={() => handleDeleteCategory(name)}
                          disabled={isUpdating || isSyncing}
                          className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors disabled:opacity-50"
                          title="删除"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 底部说明 */}
      <div className="p-4 border-t bg-muted/30 shrink-0">
        <div className="text-xs text-muted-foreground space-y-1">
          <p>• 删除分类会将其下的商品移至"默认分类"</p>
          <p>• 重命名分类会同步更新所有相关商品</p>
          <p>• "默认分类"是系统保留分类，不可删除</p>
        </div>
      </div>
    </div>
  );
}
