-- 为虎皮椒添加支付宝独立配置字段
ALTER TABLE public.shop_configs
ADD COLUMN IF NOT EXISTS xunhu_alipay_id text,
ADD COLUMN IF NOT EXISTS xunhu_alipay_secret text;