
ALTER TABLE public.keyboard_configs
ADD COLUMN chat_start_enabled boolean DEFAULT true,
ADD COLUMN keyboard_start_enabled boolean DEFAULT true;
