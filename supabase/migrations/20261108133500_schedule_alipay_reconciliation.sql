CREATE OR REPLACE FUNCTION public.invoke_reconcile_alipay_orders()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  runtime_config public.deployment_runtime_config%ROWTYPE;
BEGIN
  SELECT * INTO STRICT runtime_config FROM public.deployment_runtime_config WHERE id = true;
  PERFORM net.http_post(
    url := runtime_config.supabase_url || '/functions/v1/reconcile-alipay-orders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || runtime_config.invocation_key,
      'apikey', runtime_config.invocation_key
    ),
    body := '{}'::jsonb
  );
END;
$$;

DO $$
DECLARE job_id bigint;
BEGIN
  FOR job_id IN SELECT jobid FROM cron.job WHERE jobname = 'reconcile-alipay-orders'
  LOOP
    PERFORM cron.unschedule(job_id);
  END LOOP;
END $$;

SELECT cron.schedule(
  'reconcile-alipay-orders',
  '* * * * *',
  'SELECT public.invoke_reconcile_alipay_orders()'
);
