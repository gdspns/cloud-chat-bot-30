-- 添加 YunGouOS 微信和支付宝独立凭据字段
ALTER TABLE public.shop_configs
ADD COLUMN IF NOT EXISTS yungou_wechat_id TEXT,
ADD COLUMN IF NOT EXISTS yungou_wechat_key TEXT,
ADD COLUMN IF NOT EXISTS yungou_alipay_id TEXT,
ADD COLUMN IF NOT EXISTS yungou_alipay_key TEXT,
ADD COLUMN IF NOT EXISTS yungou_alipay_h5 BOOLEAN DEFAULT false;