-- 添加虎皮椒支付宝H5模式开关
ALTER TABLE public.shop_configs
ADD COLUMN IF NOT EXISTS xunhu_alipay_h5 boolean DEFAULT false;