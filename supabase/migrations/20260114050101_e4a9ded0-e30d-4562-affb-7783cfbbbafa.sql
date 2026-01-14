-- 添加商品分类字段
ALTER TABLE public.shop_products
ADD COLUMN IF NOT EXISTS category TEXT DEFAULT '默认分类';