ALTER TABLE public.bot_activations 
  ADD COLUMN IF NOT EXISTS auto_refresh_webhook boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_refresh_interval integer DEFAULT 60,
  ADD COLUMN IF NOT EXISTS last_auto_refresh_at timestamp with time zone DEFAULT NULL;