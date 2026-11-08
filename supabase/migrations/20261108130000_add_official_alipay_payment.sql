ALTER TABLE public.shop_configs
  ADD COLUMN IF NOT EXISTS official_alipay_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS official_alipay_app_id text,
  ADD COLUMN IF NOT EXISTS official_alipay_private_key text,
  ADD COLUMN IF NOT EXISTS official_alipay_public_key text;
