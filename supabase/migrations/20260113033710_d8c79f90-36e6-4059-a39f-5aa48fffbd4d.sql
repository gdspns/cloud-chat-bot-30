-- 为订单添加汇率锁定相关字段
ALTER TABLE public.shop_orders 
ADD COLUMN IF NOT EXISTS locked_rate_trx_usdt numeric,
ADD COLUMN IF NOT EXISTS locked_rate_cny_usd numeric,
ADD COLUMN IF NOT EXISTS original_amount numeric,
ADD COLUMN IF NOT EXISTS original_currency text;

-- 为商店配置添加自定义命令字段
ALTER TABLE public.shop_configs 
ADD COLUMN IF NOT EXISTS custom_commands jsonb DEFAULT '{"shop": [], "buy": [], "order": []}'::jsonb;

-- 添加注释说明
COMMENT ON COLUMN public.shop_orders.locked_rate_trx_usdt IS '锁定的TRX/USDT汇率';
COMMENT ON COLUMN public.shop_orders.locked_rate_cny_usd IS '锁定的CNY/USD汇率';
COMMENT ON COLUMN public.shop_orders.original_amount IS '原始商品金额';
COMMENT ON COLUMN public.shop_orders.original_currency IS '原始商品货币';
COMMENT ON COLUMN public.shop_configs.custom_commands IS '自定义中文命令别名，格式: {"shop": ["商城", "店铺"], "buy": ["购买", "下单"], "order": ["订单", "查询"]}';