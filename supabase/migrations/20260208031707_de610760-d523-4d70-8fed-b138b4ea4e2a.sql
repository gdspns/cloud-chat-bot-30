-- 添加自定义分类存储字段
ALTER TABLE public.shop_configs 
ADD COLUMN IF NOT EXISTS custom_categories text[] DEFAULT '{}';

-- 添加自定义内联按钮配置字段（数组存储多个按钮）
ALTER TABLE public.shop_configs 
ADD COLUMN IF NOT EXISTS start_custom_buttons jsonb DEFAULT '[]';