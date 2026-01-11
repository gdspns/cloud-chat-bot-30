-- 创建 pg_net 扩展（用于HTTP请求）
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 创建 pg_cron 调用记录表
CREATE TABLE IF NOT EXISTS public.cron_job_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_name text NOT NULL,
  status text NOT NULL DEFAULT 'running',
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  finished_at timestamp with time zone,
  result text,
  error text
);

-- 启用RLS
ALTER TABLE public.cron_job_logs ENABLE ROW LEVEL SECURITY;

-- 只有管理员可以查看日志
CREATE POLICY "Admins can manage cron logs" 
ON public.cron_job_logs 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

-- 创建定时任务函数：调用 check-tron-payment Edge Function
CREATE OR REPLACE FUNCTION public.invoke_check_tron_payment()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  supabase_url text;
  service_key text;
  log_id uuid;
BEGIN
  -- 获取配置
  supabase_url := current_setting('app.settings.supabase_url', true);
  service_key := current_setting('app.settings.service_role_key', true);
  
  -- 如果没有配置，使用硬编码的值（生产环境应使用配置）
  IF supabase_url IS NULL THEN
    supabase_url := 'https://qqzhzezgtjchfzhahcnx.supabase.co';
  END IF;
  
  -- 记录日志
  INSERT INTO public.cron_job_logs (job_name, status)
  VALUES ('check-tron-payment', 'running')
  RETURNING id INTO log_id;
  
  -- 调用 Edge Function (使用 pg_net)
  PERFORM net.http_post(
    url := supabase_url || '/functions/v1/check-tron-payment',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(service_key, current_setting('supabase.service_role_key', true))
    ),
    body := '{}'::jsonb
  );
  
  -- 更新日志
  UPDATE public.cron_job_logs
  SET status = 'completed', finished_at = now(), result = 'HTTP request sent'
  WHERE id = log_id;
  
EXCEPTION WHEN OTHERS THEN
  -- 记录错误
  UPDATE public.cron_job_logs
  SET status = 'failed', finished_at = now(), error = SQLERRM
  WHERE id = log_id;
END;
$$;

-- 创建 pg_cron 定时任务：每分钟执行一次
SELECT cron.schedule(
  'check-tron-payment-job',
  '* * * * *',  -- 每分钟
  'SELECT public.invoke_check_tron_payment()'
);

-- 添加清理旧日志的定时任务（保留7天）
SELECT cron.schedule(
  'cleanup-cron-logs',
  '0 0 * * *',  -- 每天午夜
  $$DELETE FROM public.cron_job_logs WHERE started_at < now() - interval '7 days'$$
);