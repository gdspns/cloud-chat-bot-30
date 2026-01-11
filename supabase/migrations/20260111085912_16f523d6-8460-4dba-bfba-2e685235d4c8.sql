-- 添加二维码消息ID字段用于超时删除
ALTER TABLE public.shop_orders 
ADD COLUMN IF NOT EXISTS telegram_qr_message_id integer;