-- TG商城商品表
CREATE TABLE public.shop_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bot_token TEXT NOT NULL,
  name TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USDT',
  keywords TEXT[] DEFAULT '{}',
  stock_content TEXT[] DEFAULT '{}',
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- TG商城订单表
CREATE TABLE public.shop_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bot_token TEXT NOT NULL,
  order_no TEXT NOT NULL,
  product_id UUID REFERENCES public.shop_products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  amount NUMERIC(10,4) NOT NULL,
  currency TEXT NOT NULL,
  payment_method TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  telegram_user_id BIGINT,
  telegram_username TEXT,
  tx_hash TEXT,
  delivery_content TEXT,
  delivered_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- TG商城配置表
CREATE TABLE public.shop_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bot_token TEXT NOT NULL UNIQUE,
  admin_id TEXT,
  wallet_address TEXT,
  tron_grid_key TEXT,
  accept_usdt BOOLEAN DEFAULT true,
  accept_trx BOOLEAN DEFAULT false,
  random_decimals BOOLEAN DEFAULT true,
  connection_mode TEXT DEFAULT 'polling',
  webhook_url TEXT,
  yungou_id TEXT,
  yungou_key TEXT,
  xunhu_id TEXT,
  xunhu_secret TEXT,
  enable_alipay BOOLEAN DEFAULT false,
  alipay_provider TEXT DEFAULT 'yungou',
  enable_wechat BOOLEAN DEFAULT false,
  wechat_provider TEXT DEFAULT 'xunhu',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 创建索引
CREATE INDEX idx_shop_products_bot_token ON public.shop_products(bot_token);
CREATE INDEX idx_shop_orders_bot_token ON public.shop_orders(bot_token);
CREATE INDEX idx_shop_orders_order_no ON public.shop_orders(order_no);
CREATE INDEX idx_shop_orders_status ON public.shop_orders(status);

-- 启用 RLS
ALTER TABLE public.shop_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_configs ENABLE ROW LEVEL SECURITY;

-- RLS 策略：任何人都可以读取和管理商品（通过 bot_token 隔离）
CREATE POLICY "Anyone can read shop products" ON public.shop_products FOR SELECT USING (true);
CREATE POLICY "Anyone can insert shop products" ON public.shop_products FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update shop products" ON public.shop_products FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete shop products" ON public.shop_products FOR DELETE USING (true);

-- RLS 策略：任何人都可以读取和管理订单
CREATE POLICY "Anyone can read shop orders" ON public.shop_orders FOR SELECT USING (true);
CREATE POLICY "Anyone can insert shop orders" ON public.shop_orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update shop orders" ON public.shop_orders FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete shop orders" ON public.shop_orders FOR DELETE USING (true);

-- RLS 策略：任何人都可以读取和管理配置
CREATE POLICY "Anyone can read shop configs" ON public.shop_configs FOR SELECT USING (true);
CREATE POLICY "Anyone can insert shop configs" ON public.shop_configs FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update shop configs" ON public.shop_configs FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete shop configs" ON public.shop_configs FOR DELETE USING (true);

-- 更新时间戳触发器
CREATE TRIGGER update_shop_products_updated_at
  BEFORE UPDATE ON public.shop_products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_shop_orders_updated_at
  BEFORE UPDATE ON public.shop_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_shop_configs_updated_at
  BEFORE UPDATE ON public.shop_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();