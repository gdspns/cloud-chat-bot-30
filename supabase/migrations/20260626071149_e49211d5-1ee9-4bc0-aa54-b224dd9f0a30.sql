ALTER TABLE public.keyboard_configs
  ADD COLUMN IF NOT EXISTS bot_description_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS bot_description_text text DEFAULT '',
  ADD COLUMN IF NOT EXISTS bot_short_description_text text DEFAULT '';