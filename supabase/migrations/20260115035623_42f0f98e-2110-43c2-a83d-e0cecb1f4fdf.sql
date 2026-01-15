-- 为TG商城添加开始消息和自定义命令配置
ALTER TABLE public.shop_configs 
ADD COLUMN IF NOT EXISTS start_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS start_message text DEFAULT '',
ADD COLUMN IF NOT EXISTS start_message_media_url text DEFAULT '',
ADD COLUMN IF NOT EXISTS start_message_media_type text DEFAULT 'text',
ADD COLUMN IF NOT EXISTS start_message_entities jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS start_disable_preview boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS shop_button_text text DEFAULT '商城',
ADD COLUMN IF NOT EXISTS shop_button_text_en text DEFAULT 'Shop',
ADD COLUMN IF NOT EXISTS order_button_text text DEFAULT '我的订单',
ADD COLUMN IF NOT EXISTS order_button_text_en text DEFAULT 'My Orders',
ADD COLUMN IF NOT EXISTS shop_welcome_content text DEFAULT '',
ADD COLUMN IF NOT EXISTS shop_welcome_media_url text DEFAULT '',
ADD COLUMN IF NOT EXISTS shop_welcome_media_type text DEFAULT 'text',
ADD COLUMN IF NOT EXISTS shop_welcome_entities jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS shop_welcome_disable_preview boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS order_welcome_content text DEFAULT '',
ADD COLUMN IF NOT EXISTS order_welcome_media_url text DEFAULT '',
ADD COLUMN IF NOT EXISTS order_welcome_media_type text DEFAULT 'text',
ADD COLUMN IF NOT EXISTS order_welcome_entities jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS order_welcome_disable_preview boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS user_language_preferences jsonb DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.shop_configs.start_enabled IS '是否启用/start开始消息';
COMMENT ON COLUMN public.shop_configs.start_message IS '/start消息内容';
COMMENT ON COLUMN public.shop_configs.start_message_media_url IS '/start消息媒体URL';
COMMENT ON COLUMN public.shop_configs.start_message_media_type IS '/start消息类型：text/photo/video';
COMMENT ON COLUMN public.shop_configs.shop_button_text IS '/shop自定义按钮文字';
COMMENT ON COLUMN public.shop_configs.order_button_text IS '/order自定义按钮文字';
COMMENT ON COLUMN public.shop_configs.user_language_preferences IS '用户语言偏好存储';