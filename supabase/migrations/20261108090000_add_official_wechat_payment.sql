ALTER TABLE public.shop_configs
  ADD COLUMN IF NOT EXISTS official_wechat_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS official_wechat_app_id text,
  ADD COLUMN IF NOT EXISTS official_wechat_mch_id text,
  ADD COLUMN IF NOT EXISTS official_wechat_serial_no text,
  ADD COLUMN IF NOT EXISTS official_wechat_private_key text,
  ADD COLUMN IF NOT EXISTS official_wechat_api_v3_key text,
  ADD COLUMN IF NOT EXISTS official_wechat_platform_public_key text;
