import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// 前端使用的商品类型（兼容旧结构）
export interface StoreProduct {
  id: string; // UUID from database
  numericId?: number; // 兼容旧代码
  type: 'card' | 'auto';
  tags: string[];
  name: string;
  duration: number;
  price: number;
  usdt: number;
  trx: number;
  desc: string;
  codes: string[]; // 从 store_card_keys 表获取
  isActive: boolean;
}

// 数据库返回的商品类型
interface DBStoreProduct {
  id: string;
  name: string;
  type: string;
  tags: string[];
  duration: number;
  price: number;
  usdt: number;
  trx: number;
  description: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

// 数据库卡密类型
interface DBCardKey {
  id: string;
  product_id: string;
  card_key: string;
  is_used: boolean;
}

export function useStoreProducts() {
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const { toast } = useToast();

  // 加载商品和卡密
  const loadProducts = useCallback(async () => {
    try {
      setLoading(true);
      
      // 并行获取商品和卡密
      const [productsRes, cardKeysRes] = await Promise.all([
        supabase.from('store_products').select('*').order('sort_order', { ascending: true }),
        supabase.from('store_card_keys').select('*').eq('is_used', false)
      ]);

      if (productsRes.error) throw productsRes.error;
      if (cardKeysRes.error) throw cardKeysRes.error;

      const dbProducts = productsRes.data as DBStoreProduct[];
      const cardKeys = cardKeysRes.data as DBCardKey[];

      // 按 product_id 分组卡密
      const cardKeysByProduct: Record<string, string[]> = {};
      cardKeys.forEach(ck => {
        if (!cardKeysByProduct[ck.product_id]) {
          cardKeysByProduct[ck.product_id] = [];
        }
        cardKeysByProduct[ck.product_id].push(ck.card_key);
      });

      // 转换为前端格式
      const frontendProducts: StoreProduct[] = dbProducts.map(p => ({
        id: p.id,
        type: p.type as 'card' | 'auto',
        tags: p.tags || [],
        name: p.name,
        duration: p.duration,
        price: Number(p.price),
        usdt: Number(p.usdt),
        trx: Number(p.trx),
        desc: p.description || '',
        codes: cardKeysByProduct[p.id] || [],
        isActive: p.is_active
      }));

      setProducts(frontendProducts);
    } catch (error) {
      console.error('加载商品失败:', error);
      toast({ title: '加载失败', description: '无法加载商品列表', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // 添加商品
  const addProduct = useCallback(async (product: Omit<StoreProduct, 'id'>) => {
    try {
      setSyncing(true);
      
      // 插入商品
      const { data: newProduct, error: productError } = await supabase
        .from('store_products')
        .insert({
          name: product.name,
          type: product.type,
          tags: product.tags,
          duration: product.duration,
          price: product.price,
          usdt: product.usdt,
          trx: product.trx,
          description: product.desc,
          is_active: true
        })
        .select()
        .single();

      if (productError) throw productError;

      // 如果是卡密商品，插入卡密
      if (product.type === 'card' && product.codes.length > 0) {
        const cardKeysToInsert = product.codes.map(code => ({
          product_id: newProduct.id,
          card_key: code,
          is_used: false
        }));

        const { error: cardKeyError } = await supabase
          .from('store_card_keys')
          .insert(cardKeysToInsert);

        if (cardKeyError) {
          console.error('插入卡密失败:', cardKeyError);
        }
      }

      await loadProducts();
      toast({ title: '添加成功', description: '商品已上架' });
      return newProduct.id;
    } catch (error) {
      console.error('添加商品失败:', error);
      toast({ title: '添加失败', description: '无法添加商品', variant: 'destructive' });
      return null;
    } finally {
      setSyncing(false);
    }
  }, [loadProducts, toast]);

  // 更新商品
  const updateProduct = useCallback(async (productId: string, updates: Partial<StoreProduct>) => {
    try {
      setSyncing(true);

      // 更新商品基础信息
      const { error: productError } = await supabase
        .from('store_products')
        .update({
          name: updates.name,
          type: updates.type,
          tags: updates.tags,
          duration: updates.duration,
          price: updates.price,
          usdt: updates.usdt,
          trx: updates.trx,
          description: updates.desc,
          is_active: updates.isActive ?? true,
          updated_at: new Date().toISOString()
        })
        .eq('id', productId);

      if (productError) throw productError;

      // 如果是卡密商品且提供了新卡密列表，更新卡密
      if (updates.type === 'card' && updates.codes !== undefined) {
        // 删除该商品的所有未使用卡密
        await supabase
          .from('store_card_keys')
          .delete()
          .eq('product_id', productId)
          .eq('is_used', false);

        // 插入新卡密
        if (updates.codes.length > 0) {
          const cardKeysToInsert = updates.codes.map(code => ({
            product_id: productId,
            card_key: code,
            is_used: false
          }));

          await supabase.from('store_card_keys').insert(cardKeysToInsert);
        }
      }

      await loadProducts();
      toast({ title: '更新成功', description: '商品已更新' });
      return true;
    } catch (error) {
      console.error('更新商品失败:', error);
      toast({ title: '更新失败', description: '无法更新商品', variant: 'destructive' });
      return false;
    } finally {
      setSyncing(false);
    }
  }, [loadProducts, toast]);

  // 删除商品
  const deleteProduct = useCallback(async (productId: string) => {
    try {
      setSyncing(true);

      // 先删除关联的卡密
      await supabase.from('store_card_keys').delete().eq('product_id', productId);

      // 再删除商品
      const { error } = await supabase.from('store_products').delete().eq('id', productId);
      if (error) throw error;

      await loadProducts();
      toast({ title: '删除成功', description: '商品已删除' });
      return true;
    } catch (error) {
      console.error('删除商品失败:', error);
      toast({ title: '删除失败', description: '无法删除商品', variant: 'destructive' });
      return false;
    } finally {
      setSyncing(false);
    }
  }, [loadProducts, toast]);

  // 获取商品库存（卡密数量）
  const getStockCount = useCallback((product: StoreProduct) => {
    if (!product) return 0;
    if (product.type === 'auto') return 9999;
    return product.codes.length;
  }, []);

  // 初始加载
  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  return {
    products,
    loading,
    syncing,
    loadProducts,
    addProduct,
    updateProduct,
    deleteProduct,
    getStockCount
  };
}

export default useStoreProducts;
