import React, { useState, useMemo } from "react";
import { Plus, Trash2, Edit2, Check, X, FolderOpen, Loader2, Tag } from "lucide-react";
import { Product } from "./types";
import { useLanguage } from "@/hooks/use-language";

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
  const { t } = useLanguage();
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const defaultCategory = t('tgshop.category.default');

  // Get all categories and their product counts (including custom categories)
  const categoriesWithCount = useMemo(() => {
    const catMap: Record<string, number> = {};
    products.forEach(p => {
      const cat = p.category || defaultCategory;
      catMap[cat] = (catMap[cat] || 0) + 1;
    });
    // Add custom categories (with no products)
    customCategories.forEach(cat => {
      if (!(cat in catMap)) {
        catMap[cat] = 0;
      }
    });
    return Object.entries(catMap).map(([name, count]) => ({ name, count }));
  }, [products, customCategories, defaultCategory]);

  // Create new category
  const handleAddCategory = () => {
    const name = newCategoryName.trim();
    if (!name) {
      showToast("error", t('tgshop.category.enterName'));
      return;
    }
    if (categoriesWithCount.some(c => c.name === name)) {
      showToast("error", t('tgshop.category.exists'));
      return;
    }
    // Add to custom category list
    onAddCustomCategory(name);
    showToast("success", t('tgshop.category.created').replace('{name}', name));
    setNewCategoryName('');
  };

  // Edit category name
  const handleEditCategory = async (oldName: string) => {
    const newName = editingName.trim();
    if (!newName) {
      showToast("error", t('tgshop.category.nameRequired'));
      return;
    }
    if (newName === oldName) {
      setEditingCategory(null);
      return;
    }
    if (categoriesWithCount.some(c => c.name === newName)) {
      showToast("error", t('tgshop.category.nameExists'));
      return;
    }

    setIsUpdating(true);
    try {
      // Update all products in this category
      const productsToUpdate = products.filter(p => (p.category || defaultCategory) === oldName);
      let successCount = 0;
      
      for (const product of productsToUpdate) {
        const success = await onUpdateProduct(product.id, { category: newName });
        if (success) successCount++;
      }

      if (successCount === productsToUpdate.length) {
        showToast("success", t('tgshop.category.renamed').replace('{name}', newName));
      } else {
        showToast("error", t('tgshop.category.partialFailed').replace('{success}', String(successCount)).replace('{total}', String(productsToUpdate.length)));
      }
      setEditingCategory(null);
    } finally {
      setIsUpdating(false);
    }
  };

  // Delete category (move products to default category)
  const handleDeleteCategory = async (categoryName: string) => {
    if (categoryName === defaultCategory) {
      showToast("error", t('tgshop.category.cannotDeleteDefault'));
      return;
    }
    
    const productsInCategory = products.filter(p => (p.category || defaultCategory) === categoryName);
    if (productsInCategory.length > 0) {
      if (!confirm(t('tgshop.category.confirmDeleteWithProducts').replace('{count}', String(productsInCategory.length)))) {
        return;
      }
    } else {
      if (!confirm(t('tgshop.category.confirmDelete').replace('{name}', categoryName))) {
        return;
      }
    }

    setIsUpdating(true);
    try {
      let successCount = 0;
      for (const product of productsInCategory) {
        const success = await onUpdateProduct(product.id, { category: defaultCategory });
        if (success) successCount++;
      }

      // Remove from custom categories
      onRemoveCustomCategory(categoryName);

      if (productsInCategory.length === 0 || successCount === productsInCategory.length) {
        showToast("success", t('tgshop.category.deleted').replace('{name}', categoryName));
      } else {
        showToast("error", t('tgshop.category.moveFailed').replace('{success}', String(successCount)).replace('{total}', String(productsInCategory.length)));
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
      {/* Header */}
      <div className="p-4 border-b bg-muted shrink-0">
        <div className="flex items-center gap-2 mb-3">
          <Tag className="text-primary" size={20} />
          <h2 className="font-semibold text-foreground text-lg">{t('tgshop.category.title')}</h2>
          {isSyncing && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground ml-2">
              <Loader2 size={12} className="animate-spin" />
              <span>{t('tgshop.panel.syncing')}</span>
            </div>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          {t('tgshop.category.desc')}
        </p>
      </div>

      {/* Create new category */}
      <div className="p-4 border-b shrink-0">
        <label className="block text-sm font-medium text-foreground mb-2">{t('tgshop.category.new')}</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            placeholder={t('tgshop.category.placeholder')}
            className="flex-1 p-2.5 border rounded bg-background text-foreground focus:ring-2 focus:ring-primary outline-none text-sm"
            onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
          />
          <button
            onClick={handleAddCategory}
            disabled={isUpdating || isSyncing}
            className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors flex items-center gap-1.5 disabled:opacity-50"
          >
            <Plus size={16} />
            <span>{t('common.add')}</span>
          </button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          💡 {t('tgshop.category.hint')}
        </p>
      </div>

      {/* Category list */}
      <div className="flex-1 overflow-y-auto p-4">
        <h3 className="text-sm font-medium text-foreground mb-3">
          {t('tgshop.category.existing')} ({categoriesWithCount.length})
        </h3>
        
        {categoriesWithCount.length === 0 ? (
          <div className="p-6 text-center border rounded-lg bg-muted/50">
            <FolderOpen className="mx-auto mb-2 text-muted-foreground" size={32} />
            <p className="text-sm text-muted-foreground">{t('tgshop.category.noCategories')}</p>
            <p className="text-xs text-muted-foreground mt-1">{t('tgshop.category.autoCreate')}</p>
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
                      title={t('common.save')}
                    >
                      {isUpdating ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                    </button>
                    <button
                      onClick={cancelEdit}
                      disabled={isUpdating}
                      className="p-2 text-muted-foreground hover:bg-muted rounded disabled:opacity-50"
                      title={t('common.cancel')}
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
                          {count} {t('tgshop.category.products')}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => startEdit(name)}
                        disabled={isUpdating || isSyncing}
                        className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded transition-colors disabled:opacity-50"
                        title={t('common.edit')}
                      >
                        <Edit2 size={14} />
                      </button>
                      {name !== defaultCategory && (
                        <button
                          onClick={() => handleDeleteCategory(name)}
                          disabled={isUpdating || isSyncing}
                          className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors disabled:opacity-50"
                          title={t('common.delete')}
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

      {/* Footer notes */}
      <div className="p-4 border-t bg-muted/30 shrink-0">
        <div className="text-xs text-muted-foreground space-y-1">
          <p>• {t('tgshop.category.note1')}</p>
          <p>• {t('tgshop.category.note2')}</p>
          <p>• {t('tgshop.category.note3')}</p>
        </div>
      </div>
    </div>
  );
}
