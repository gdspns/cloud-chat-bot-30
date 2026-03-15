
-- Rate limiting table for anti-spam protection
CREATE TABLE public.bot_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_token text NOT NULL,
  telegram_user_id bigint NOT NULL,
  message_count integer NOT NULL DEFAULT 1,
  window_start timestamp with time zone NOT NULL DEFAULT now(),
  is_blocked boolean NOT NULL DEFAULT false,
  blocked_at timestamp with time zone,
  blocked_reason text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(bot_token, telegram_user_id)
);

-- Add rate limit config columns to keyboard_configs
ALTER TABLE public.keyboard_configs
  ADD COLUMN IF NOT EXISTS rate_limit_enabled boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS rate_limit_per_minute integer DEFAULT 10,
  ADD COLUMN IF NOT EXISTS rate_limit_action text DEFAULT 'warn';

-- Enable RLS
ALTER TABLE public.bot_rate_limits ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Anyone can read rate limits" ON public.bot_rate_limits FOR SELECT USING (true);
CREATE POLICY "Anyone can insert rate limits" ON public.bot_rate_limits FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update rate limits" ON public.bot_rate_limits FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete rate limits" ON public.bot_rate_limits FOR DELETE USING (true);
