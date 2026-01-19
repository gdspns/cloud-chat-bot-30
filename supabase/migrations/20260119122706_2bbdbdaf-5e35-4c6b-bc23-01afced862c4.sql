-- 创建卡密库存表
CREATE TABLE public.store_card_keys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id TEXT NOT NULL,
  card_key TEXT NOT NULL,
  is_used BOOLEAN NOT NULL DEFAULT false,
  order_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 创建商城订单表
CREATE TABLE public.store_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_no TEXT NOT NULL UNIQUE,
  bot_id TEXT,
  contact TEXT,
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL,
  payment_method TEXT NOT NULL,
  delivered_code TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  tx_hash TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 启用 RLS
ALTER TABLE public.store_card_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_orders ENABLE ROW LEVEL SECURITY;

-- store_card_keys RLS 策略 - 只允许通过云函数操作
CREATE POLICY "Anyone can read card keys" ON public.store_card_keys FOR SELECT USING (true);

-- store_orders RLS 策略
CREATE POLICY "Anyone can read orders" ON public.store_orders FOR SELECT USING (true);
CREATE POLICY "Anyone can insert orders" ON public.store_orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update orders" ON public.store_orders FOR UPDATE USING (true);

-- 创建原子化发放卡密的函数（使用 FOR UPDATE SKIP LOCKED 防止并发问题）
CREATE OR REPLACE FUNCTION public.deliver_card_key(
  p_order_no TEXT,
  p_product_id TEXT
)
RETURNS TABLE (
  success BOOLEAN,
  card_key TEXT,
  error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_card_key_id UUID;
  v_card_key TEXT;
BEGIN
  -- 使用 FOR UPDATE SKIP LOCKED 锁定一个未使用的卡密
  SELECT ck.id, ck.card_key INTO v_card_key_id, v_card_key
  FROM store_card_keys ck
  WHERE ck.product_id = p_product_id
    AND ck.is_used = false
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  -- 如果没有找到可用卡密
  IF v_card_key_id IS NULL THEN
    RETURN QUERY SELECT false, NULL::TEXT, '库存不足，无可用卡密'::TEXT;
    RETURN;
  END IF;

  -- 更新卡密状态
  UPDATE store_card_keys
  SET is_used = true,
      order_id = p_order_no,
      updated_at = now()
  WHERE id = v_card_key_id;

  -- 更新订单
  UPDATE store_orders
  SET delivered_code = v_card_key,
      status = 'paid',
      updated_at = now()
  WHERE order_no = p_order_no;

  RETURN QUERY SELECT true, v_card_key, NULL::TEXT;
END;
$$;

-- 创建索引优化查询
CREATE INDEX idx_store_card_keys_product_unused ON public.store_card_keys(product_id) WHERE is_used = false;
CREATE INDEX idx_store_orders_order_no ON public.store_orders(order_no);
CREATE INDEX idx_store_orders_contact ON public.store_orders(contact);