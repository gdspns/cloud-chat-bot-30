-- 创建自助商城商品表（与TG商城的shop_products分开）
CREATE TABLE public.store_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'card', -- 'card' 卡密类型, 'auto' 直充类型
  tags TEXT[] NOT NULL DEFAULT '{}', -- 分类标签: chat, keyboard, mall
  duration INTEGER NOT NULL DEFAULT 30, -- 有效天数
  price NUMERIC NOT NULL DEFAULT 0, -- CNY价格
  usdt NUMERIC NOT NULL DEFAULT 0, -- USDT价格
  trx NUMERIC NOT NULL DEFAULT 0, -- TRX价格
  description TEXT, -- 商品描述
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0, -- 排序
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 启用RLS
ALTER TABLE public.store_products ENABLE ROW LEVEL SECURITY;

-- RLS策略：任何人可读取（商城公开展示）
CREATE POLICY "Anyone can read store products"
ON public.store_products
FOR SELECT
USING (true);

-- RLS策略：管理员可管理
CREATE POLICY "Admins can manage store products"
ON public.store_products
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- 更新 store_card_keys 表的 product_id 字段说明：
-- 现在 product_id 将关联到 store_products.id (UUID格式)

-- 为方便管理员操作，也允许通过Edge Function管理
CREATE POLICY "Allow insert for service role"
ON public.store_products
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Allow update for service role"
ON public.store_products
FOR UPDATE
USING (true);

CREATE POLICY "Allow delete for service role"
ON public.store_products
FOR DELETE
USING (true);

-- 同样更新 store_card_keys 的 RLS 策略
DROP POLICY IF EXISTS "Anyone can read card keys" ON public.store_card_keys;

CREATE POLICY "Anyone can read card keys"
ON public.store_card_keys
FOR SELECT
USING (true);

CREATE POLICY "Allow insert card keys"
ON public.store_card_keys
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Allow update card keys"
ON public.store_card_keys
FOR UPDATE
USING (true);

CREATE POLICY "Allow delete card keys"
ON public.store_card_keys
FOR DELETE
USING (true);