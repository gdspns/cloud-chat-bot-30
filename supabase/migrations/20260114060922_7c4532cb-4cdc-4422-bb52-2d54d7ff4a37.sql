-- 为 shop_configs 添加激活相关字段
ALTER TABLE public.shop_configs 
ADD COLUMN IF NOT EXISTS shop_expire_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS shop_trial_started_at TIMESTAMP WITH TIME ZONE;

-- 更新 activation_codes 表的 feature_type 注释，支持更多类型
-- feature_type 现在支持: chat, keyboard, shop, both, chat_shop, keyboard_shop, all
COMMENT ON COLUMN public.activation_codes.feature_type IS 'Feature type: chat, keyboard, shop, both (chat+keyboard), chat_shop, keyboard_shop, all (all three)';

-- 为现有的 feature_type 列修改默认值
ALTER TABLE public.activation_codes ALTER COLUMN feature_type SET DEFAULT 'both';