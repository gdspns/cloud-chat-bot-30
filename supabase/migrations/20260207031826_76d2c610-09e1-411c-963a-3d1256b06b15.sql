-- 为 store_products 表添加英文名称字段
ALTER TABLE public.store_products 
ADD COLUMN name_en text;

-- 添加英文描述字段
ALTER TABLE public.store_products 
ADD COLUMN description_en text;

-- 添加注释
COMMENT ON COLUMN public.store_products.name_en IS 'Product name in English for bilingual display';
COMMENT ON COLUMN public.store_products.description_en IS 'Product description in English for bilingual display';