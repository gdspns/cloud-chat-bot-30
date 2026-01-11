-- 添加字段存储 Telegram 消息ID和过期时间
ALTER TABLE public.shop_orders 
ADD COLUMN IF NOT EXISTS telegram_message_id bigint,
ADD COLUMN IF NOT EXISTS telegram_chat_id bigint,
ADD COLUMN IF NOT EXISTS expires_at timestamp with time zone;

-- 为过期订单创建索引
CREATE INDEX IF NOT EXISTS idx_shop_orders_expires_at ON public.shop_orders (expires_at) WHERE status = 'pending';

-- 创建清理过期订单的函数
CREATE OR REPLACE FUNCTION public.invoke_cleanup_expired_orders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  supabase_url text;
  service_key text;
  log_id uuid;
BEGIN
  supabase_url := current_setting('app.settings.supabase_url', true);
  IF supabase_url IS NULL THEN
    supabase_url := 'https://qqzhzezgtjchfzhahcnx.supabase.co';
  END IF;
  
  INSERT INTO public.cron_job_logs (job_name, status)
  VALUES ('cleanup-expired-orders', 'running')
  RETURNING id INTO log_id;
  
  PERFORM net.http_post(
    url := supabase_url || '/functions/v1/cleanup-expired-orders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(service_key, current_setting('supabase.service_role_key', true))
    ),
    body := '{}'::jsonb
  );
  
  UPDATE public.cron_job_logs
  SET status = 'completed', finished_at = now(), result = 'HTTP request sent'
  WHERE id = log_id;
  
EXCEPTION WHEN OTHERS THEN
  UPDATE public.cron_job_logs
  SET status = 'failed', finished_at = now(), error = SQLERRM
  WHERE id = log_id;
END;
$function$;

-- 添加定时任务：每分钟检查过期订单
SELECT cron.schedule(
  'cleanup-expired-orders',
  '* * * * *',
  'SELECT public.invoke_cleanup_expired_orders()'
);