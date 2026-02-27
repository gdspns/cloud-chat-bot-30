
-- 1. 用户余额表
CREATE TABLE public.shop_user_balances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bot_token TEXT NOT NULL,
  telegram_user_id BIGINT NOT NULL,
  telegram_username TEXT,
  first_name TEXT,
  balance NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USDT',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(bot_token, telegram_user_id)
);

ALTER TABLE public.shop_user_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read shop user balances" ON public.shop_user_balances FOR SELECT USING (true);
CREATE POLICY "Anyone can insert shop user balances" ON public.shop_user_balances FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update shop user balances" ON public.shop_user_balances FOR UPDATE USING (true);

-- 2. 资金流水表
CREATE TABLE public.shop_balance_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bot_token TEXT NOT NULL,
  telegram_user_id BIGINT NOT NULL,
  type TEXT NOT NULL, -- 'recharge' | 'purchase' | 'adjust'
  amount NUMERIC NOT NULL, -- 正数=增加, 负数=扣除
  balance_after NUMERIC NOT NULL,
  order_no TEXT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.shop_balance_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read balance transactions" ON public.shop_balance_transactions FOR SELECT USING (true);
CREATE POLICY "Anyone can insert balance transactions" ON public.shop_balance_transactions FOR INSERT WITH CHECK (true);

-- 3. 给 shop_products 加 type 字段区分发卡商品和充值商品
ALTER TABLE public.shop_products ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'goods';

-- 4. 给 shop_orders 加 order_type 字段标记是购买还是充值
ALTER TABLE public.shop_orders ADD COLUMN IF NOT EXISTS order_type TEXT NOT NULL DEFAULT 'purchase';

-- 5. 更新时间触发器
CREATE TRIGGER update_shop_user_balances_updated_at
  BEFORE UPDATE ON public.shop_user_balances
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
