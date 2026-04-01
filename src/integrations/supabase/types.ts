export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      activation_codes: {
        Row: {
          code: string
          created_at: string
          expire_at: string | null
          feature_type: string
          id: string
          is_used: boolean | null
          used_by_bot_id: string | null
          validity_days: number | null
        }
        Insert: {
          code: string
          created_at?: string
          expire_at?: string | null
          feature_type?: string
          id?: string
          is_used?: boolean | null
          used_by_bot_id?: string | null
          validity_days?: number | null
        }
        Update: {
          code?: string
          created_at?: string
          expire_at?: string | null
          feature_type?: string
          id?: string
          is_used?: boolean | null
          used_by_bot_id?: string | null
          validity_days?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "activation_codes_used_by_bot_id_fkey"
            columns: ["used_by_bot_id"]
            isOneToOne: false
            referencedRelation: "bot_activations"
            referencedColumns: ["id"]
          },
        ]
      }
      articles: {
        Row: {
          category: string
          content: string
          created_at: string
          id: string
          title: string
          updated_at: string
        }
        Insert: {
          category?: string
          content?: string
          created_at?: string
          id?: string
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          content?: string
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      bot_activations: {
        Row: {
          activation_code: string
          app_enabled: boolean | null
          auto_refresh_interval: number | null
          auto_refresh_webhook: boolean | null
          bot_token: string
          created_at: string
          expire_at: string | null
          greeting_message: string | null
          id: string
          is_active: boolean | null
          is_authorized: boolean | null
          keyboard_expire_at: string | null
          keyboard_menu_first_used_at: string | null
          last_auto_refresh_at: string | null
          personal_user_id: string
          trial_limit: number | null
          trial_messages_used: number | null
          updated_at: string
          user_id: string | null
          web_enabled: boolean | null
        }
        Insert: {
          activation_code: string
          app_enabled?: boolean | null
          auto_refresh_interval?: number | null
          auto_refresh_webhook?: boolean | null
          bot_token: string
          created_at?: string
          expire_at?: string | null
          greeting_message?: string | null
          id?: string
          is_active?: boolean | null
          is_authorized?: boolean | null
          keyboard_expire_at?: string | null
          keyboard_menu_first_used_at?: string | null
          last_auto_refresh_at?: string | null
          personal_user_id: string
          trial_limit?: number | null
          trial_messages_used?: number | null
          updated_at?: string
          user_id?: string | null
          web_enabled?: boolean | null
        }
        Update: {
          activation_code?: string
          app_enabled?: boolean | null
          auto_refresh_interval?: number | null
          auto_refresh_webhook?: boolean | null
          bot_token?: string
          created_at?: string
          expire_at?: string | null
          greeting_message?: string | null
          id?: string
          is_active?: boolean | null
          is_authorized?: boolean | null
          keyboard_expire_at?: string | null
          keyboard_menu_first_used_at?: string | null
          last_auto_refresh_at?: string | null
          personal_user_id?: string
          trial_limit?: number | null
          trial_messages_used?: number | null
          updated_at?: string
          user_id?: string | null
          web_enabled?: boolean | null
        }
        Relationships: []
      }
      bot_rate_limits: {
        Row: {
          blocked_at: string | null
          blocked_reason: string | null
          bot_token: string
          created_at: string
          id: string
          is_blocked: boolean
          message_count: number
          telegram_user_id: number
          updated_at: string
          window_start: string
        }
        Insert: {
          blocked_at?: string | null
          blocked_reason?: string | null
          bot_token: string
          created_at?: string
          id?: string
          is_blocked?: boolean
          message_count?: number
          telegram_user_id: number
          updated_at?: string
          window_start?: string
        }
        Update: {
          blocked_at?: string | null
          blocked_reason?: string | null
          bot_token?: string
          created_at?: string
          id?: string
          is_blocked?: boolean
          message_count?: number
          telegram_user_id?: number
          updated_at?: string
          window_start?: string
        }
        Relationships: []
      }
      bot_trial_records: {
        Row: {
          bot_token: string
          created_at: string
          id: string
          is_blocked: boolean | null
          last_authorized_expire_at: string | null
          messages_used: number | null
          updated_at: string
          was_authorized: boolean | null
        }
        Insert: {
          bot_token: string
          created_at?: string
          id?: string
          is_blocked?: boolean | null
          last_authorized_expire_at?: string | null
          messages_used?: number | null
          updated_at?: string
          was_authorized?: boolean | null
        }
        Update: {
          bot_token?: string
          created_at?: string
          id?: string
          is_blocked?: boolean | null
          last_authorized_expire_at?: string | null
          messages_used?: number | null
          updated_at?: string
          was_authorized?: boolean | null
        }
        Relationships: []
      }
      bot_users: {
        Row: {
          bot_token: string
          created_at: string
          first_name: string
          first_seen_at: string
          id: string
          last_name: string | null
          last_seen_at: string
          telegram_user_id: number
          updated_at: string
          username: string | null
        }
        Insert: {
          bot_token: string
          created_at?: string
          first_name: string
          first_seen_at?: string
          id?: string
          last_name?: string | null
          last_seen_at?: string
          telegram_user_id: number
          updated_at?: string
          username?: string | null
        }
        Update: {
          bot_token?: string
          created_at?: string
          first_name?: string
          first_seen_at?: string
          id?: string
          last_name?: string | null
          last_seen_at?: string
          telegram_user_id?: number
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      cron_job_logs: {
        Row: {
          error: string | null
          finished_at: string | null
          id: string
          job_name: string
          result: string | null
          started_at: string
          status: string
        }
        Insert: {
          error?: string | null
          finished_at?: string | null
          id?: string
          job_name: string
          result?: string | null
          started_at?: string
          status?: string
        }
        Update: {
          error?: string | null
          finished_at?: string | null
          id?: string
          job_name?: string
          result?: string | null
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      disabled_users: {
        Row: {
          disabled_at: string
          disabled_by: string | null
          id: string
          reason: string | null
          user_id: string
        }
        Insert: {
          disabled_at?: string
          disabled_by?: string | null
          id?: string
          reason?: string | null
          user_id: string
        }
        Update: {
          disabled_at?: string
          disabled_by?: string | null
          id?: string
          reason?: string | null
          user_id?: string
        }
        Relationships: []
      }
      keyboard_configs: {
        Row: {
          activity_log_enabled: boolean | null
          auto_cleanup_days: number | null
          auto_cleanup_enabled: boolean | null
          auto_reply_rules: Json | null
          bilingual_button_enabled: boolean | null
          bot_first_name: string | null
          bot_token: string
          bot_username: string | null
          chat_start_enabled: boolean | null
          commands: Json | null
          created_at: string
          flow_messages: Json | null
          force_menu_on_start: boolean | null
          id: string
          keyboard_expire_at: string | null
          keyboard_start_enabled: boolean | null
          keyboard_trial_started_at: string | null
          last_cleanup_at: string | null
          menu_admin_chat_id: number | null
          rate_limit_action: string | null
          rate_limit_enabled: boolean | null
          rate_limit_per_minute: number | null
          reply_keyboard: Json | null
          updated_at: string
          user_language_preferences: Json | null
        }
        Insert: {
          activity_log_enabled?: boolean | null
          auto_cleanup_days?: number | null
          auto_cleanup_enabled?: boolean | null
          auto_reply_rules?: Json | null
          bilingual_button_enabled?: boolean | null
          bot_first_name?: string | null
          bot_token: string
          bot_username?: string | null
          chat_start_enabled?: boolean | null
          commands?: Json | null
          created_at?: string
          flow_messages?: Json | null
          force_menu_on_start?: boolean | null
          id?: string
          keyboard_expire_at?: string | null
          keyboard_start_enabled?: boolean | null
          keyboard_trial_started_at?: string | null
          last_cleanup_at?: string | null
          menu_admin_chat_id?: number | null
          rate_limit_action?: string | null
          rate_limit_enabled?: boolean | null
          rate_limit_per_minute?: number | null
          reply_keyboard?: Json | null
          updated_at?: string
          user_language_preferences?: Json | null
        }
        Update: {
          activity_log_enabled?: boolean | null
          auto_cleanup_days?: number | null
          auto_cleanup_enabled?: boolean | null
          auto_reply_rules?: Json | null
          bilingual_button_enabled?: boolean | null
          bot_first_name?: string | null
          bot_token?: string
          bot_username?: string | null
          chat_start_enabled?: boolean | null
          commands?: Json | null
          created_at?: string
          flow_messages?: Json | null
          force_menu_on_start?: boolean | null
          id?: string
          keyboard_expire_at?: string | null
          keyboard_start_enabled?: boolean | null
          keyboard_trial_started_at?: string | null
          last_cleanup_at?: string | null
          menu_admin_chat_id?: number | null
          rate_limit_action?: string | null
          rate_limit_enabled?: boolean | null
          rate_limit_per_minute?: number | null
          reply_keyboard?: Json | null
          updated_at?: string
          user_language_preferences?: Json | null
        }
        Relationships: []
      }
      messages: {
        Row: {
          bot_activation_id: string
          content: string
          created_at: string
          direction: string
          id: string
          is_admin_reply: boolean | null
          is_read: boolean | null
          telegram_chat_id: number
          telegram_message_id: number | null
          telegram_user_name: string | null
        }
        Insert: {
          bot_activation_id: string
          content: string
          created_at?: string
          direction: string
          id?: string
          is_admin_reply?: boolean | null
          is_read?: boolean | null
          telegram_chat_id: number
          telegram_message_id?: number | null
          telegram_user_name?: string | null
        }
        Update: {
          bot_activation_id?: string
          content?: string
          created_at?: string
          direction?: string
          id?: string
          is_admin_reply?: boolean | null
          is_read?: boolean | null
          telegram_chat_id?: number
          telegram_message_id?: number | null
          telegram_user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_bot_activation_id_fkey"
            columns: ["bot_activation_id"]
            isOneToOne: false
            referencedRelation: "bot_activations"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_balance_transactions: {
        Row: {
          amount: number
          balance_after: number
          bot_token: string
          created_at: string
          description: string | null
          id: string
          order_no: string | null
          telegram_user_id: number
          type: string
        }
        Insert: {
          amount: number
          balance_after: number
          bot_token: string
          created_at?: string
          description?: string | null
          id?: string
          order_no?: string | null
          telegram_user_id: number
          type: string
        }
        Update: {
          amount?: number
          balance_after?: number
          bot_token?: string
          created_at?: string
          description?: string | null
          id?: string
          order_no?: string | null
          telegram_user_id?: number
          type?: string
        }
        Relationships: []
      }
      shop_configs: {
        Row: {
          accept_trx: boolean | null
          accept_usdt: boolean | null
          admin_id: string | null
          alipay_provider: string | null
          bot_token: string
          connection_mode: string | null
          created_at: string
          custom_categories: string[] | null
          custom_commands: Json | null
          enable_alipay: boolean | null
          enable_wechat: boolean | null
          id: string
          order_button_text: string | null
          order_button_text_en: string | null
          order_welcome_content: string | null
          order_welcome_disable_preview: boolean | null
          order_welcome_entities: Json | null
          order_welcome_media_type: string | null
          order_welcome_media_url: string | null
          payment_notice: string | null
          random_decimals: boolean | null
          shop_button_text: string | null
          shop_button_text_en: string | null
          shop_expire_at: string | null
          shop_saved_expire_at: string | null
          shop_trial_started_at: string | null
          shop_welcome_content: string | null
          shop_welcome_disable_preview: boolean | null
          shop_welcome_entities: Json | null
          shop_welcome_media_type: string | null
          shop_welcome_media_url: string | null
          start_custom_buttons: Json | null
          start_disable_preview: boolean | null
          start_enabled: boolean | null
          start_message: string | null
          start_message_entities: Json | null
          start_message_media_type: string | null
          start_message_media_url: string | null
          tron_grid_key: string | null
          updated_at: string
          user_language_preferences: Json | null
          wallet_address: string | null
          webhook_url: string | null
          wechat_provider: string | null
          xunhu_alipay_h5: boolean | null
          xunhu_alipay_id: string | null
          xunhu_alipay_secret: string | null
          xunhu_id: string | null
          xunhu_secret: string | null
          yungou_alipay_h5: boolean | null
          yungou_alipay_id: string | null
          yungou_alipay_key: string | null
          yungou_id: string | null
          yungou_key: string | null
          yungou_wechat_id: string | null
          yungou_wechat_key: string | null
        }
        Insert: {
          accept_trx?: boolean | null
          accept_usdt?: boolean | null
          admin_id?: string | null
          alipay_provider?: string | null
          bot_token: string
          connection_mode?: string | null
          created_at?: string
          custom_categories?: string[] | null
          custom_commands?: Json | null
          enable_alipay?: boolean | null
          enable_wechat?: boolean | null
          id?: string
          order_button_text?: string | null
          order_button_text_en?: string | null
          order_welcome_content?: string | null
          order_welcome_disable_preview?: boolean | null
          order_welcome_entities?: Json | null
          order_welcome_media_type?: string | null
          order_welcome_media_url?: string | null
          payment_notice?: string | null
          random_decimals?: boolean | null
          shop_button_text?: string | null
          shop_button_text_en?: string | null
          shop_expire_at?: string | null
          shop_saved_expire_at?: string | null
          shop_trial_started_at?: string | null
          shop_welcome_content?: string | null
          shop_welcome_disable_preview?: boolean | null
          shop_welcome_entities?: Json | null
          shop_welcome_media_type?: string | null
          shop_welcome_media_url?: string | null
          start_custom_buttons?: Json | null
          start_disable_preview?: boolean | null
          start_enabled?: boolean | null
          start_message?: string | null
          start_message_entities?: Json | null
          start_message_media_type?: string | null
          start_message_media_url?: string | null
          tron_grid_key?: string | null
          updated_at?: string
          user_language_preferences?: Json | null
          wallet_address?: string | null
          webhook_url?: string | null
          wechat_provider?: string | null
          xunhu_alipay_h5?: boolean | null
          xunhu_alipay_id?: string | null
          xunhu_alipay_secret?: string | null
          xunhu_id?: string | null
          xunhu_secret?: string | null
          yungou_alipay_h5?: boolean | null
          yungou_alipay_id?: string | null
          yungou_alipay_key?: string | null
          yungou_id?: string | null
          yungou_key?: string | null
          yungou_wechat_id?: string | null
          yungou_wechat_key?: string | null
        }
        Update: {
          accept_trx?: boolean | null
          accept_usdt?: boolean | null
          admin_id?: string | null
          alipay_provider?: string | null
          bot_token?: string
          connection_mode?: string | null
          created_at?: string
          custom_categories?: string[] | null
          custom_commands?: Json | null
          enable_alipay?: boolean | null
          enable_wechat?: boolean | null
          id?: string
          order_button_text?: string | null
          order_button_text_en?: string | null
          order_welcome_content?: string | null
          order_welcome_disable_preview?: boolean | null
          order_welcome_entities?: Json | null
          order_welcome_media_type?: string | null
          order_welcome_media_url?: string | null
          payment_notice?: string | null
          random_decimals?: boolean | null
          shop_button_text?: string | null
          shop_button_text_en?: string | null
          shop_expire_at?: string | null
          shop_saved_expire_at?: string | null
          shop_trial_started_at?: string | null
          shop_welcome_content?: string | null
          shop_welcome_disable_preview?: boolean | null
          shop_welcome_entities?: Json | null
          shop_welcome_media_type?: string | null
          shop_welcome_media_url?: string | null
          start_custom_buttons?: Json | null
          start_disable_preview?: boolean | null
          start_enabled?: boolean | null
          start_message?: string | null
          start_message_entities?: Json | null
          start_message_media_type?: string | null
          start_message_media_url?: string | null
          tron_grid_key?: string | null
          updated_at?: string
          user_language_preferences?: Json | null
          wallet_address?: string | null
          webhook_url?: string | null
          wechat_provider?: string | null
          xunhu_alipay_h5?: boolean | null
          xunhu_alipay_id?: string | null
          xunhu_alipay_secret?: string | null
          xunhu_id?: string | null
          xunhu_secret?: string | null
          yungou_alipay_h5?: boolean | null
          yungou_alipay_id?: string | null
          yungou_alipay_key?: string | null
          yungou_id?: string | null
          yungou_key?: string | null
          yungou_wechat_id?: string | null
          yungou_wechat_key?: string | null
        }
        Relationships: []
      }
      shop_orders: {
        Row: {
          amount: number
          bot_token: string
          created_at: string
          currency: string
          delivered_at: string | null
          delivery_content: string | null
          expires_at: string | null
          id: string
          locked_rate_cny_usd: number | null
          locked_rate_trx_usdt: number | null
          order_no: string
          order_type: string
          original_amount: number | null
          original_currency: string | null
          payment_method: string
          product_id: string | null
          product_name: string
          status: string
          telegram_chat_id: number | null
          telegram_message_id: number | null
          telegram_qr_message_id: number | null
          telegram_user_id: number | null
          telegram_username: string | null
          tx_hash: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          bot_token: string
          created_at?: string
          currency: string
          delivered_at?: string | null
          delivery_content?: string | null
          expires_at?: string | null
          id?: string
          locked_rate_cny_usd?: number | null
          locked_rate_trx_usdt?: number | null
          order_no: string
          order_type?: string
          original_amount?: number | null
          original_currency?: string | null
          payment_method: string
          product_id?: string | null
          product_name: string
          status?: string
          telegram_chat_id?: number | null
          telegram_message_id?: number | null
          telegram_qr_message_id?: number | null
          telegram_user_id?: number | null
          telegram_username?: string | null
          tx_hash?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          bot_token?: string
          created_at?: string
          currency?: string
          delivered_at?: string | null
          delivery_content?: string | null
          expires_at?: string | null
          id?: string
          locked_rate_cny_usd?: number | null
          locked_rate_trx_usdt?: number | null
          order_no?: string
          order_type?: string
          original_amount?: number | null
          original_currency?: string | null
          payment_method?: string
          product_id?: string | null
          product_name?: string
          status?: string
          telegram_chat_id?: number | null
          telegram_message_id?: number | null
          telegram_qr_message_id?: number | null
          telegram_user_id?: number | null
          telegram_username?: string | null
          tx_hash?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "shop_products"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_products: {
        Row: {
          bot_token: string
          category: string | null
          created_at: string
          currency: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          keywords: string[] | null
          name: string
          price: number
          stock_content: string[] | null
          stock_quantity: number | null
          type: string
          updated_at: string
        }
        Insert: {
          bot_token: string
          category?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          keywords?: string[] | null
          name: string
          price: number
          stock_content?: string[] | null
          stock_quantity?: number | null
          type?: string
          updated_at?: string
        }
        Update: {
          bot_token?: string
          category?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          keywords?: string[] | null
          name?: string
          price?: number
          stock_content?: string[] | null
          stock_quantity?: number | null
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      shop_user_balances: {
        Row: {
          balance: number
          bot_token: string
          created_at: string
          currency: string
          first_name: string | null
          id: string
          telegram_user_id: number
          telegram_username: string | null
          updated_at: string
        }
        Insert: {
          balance?: number
          bot_token: string
          created_at?: string
          currency?: string
          first_name?: string | null
          id?: string
          telegram_user_id: number
          telegram_username?: string | null
          updated_at?: string
        }
        Update: {
          balance?: number
          bot_token?: string
          created_at?: string
          currency?: string
          first_name?: string | null
          id?: string
          telegram_user_id?: number
          telegram_username?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      store_card_keys: {
        Row: {
          card_key: string
          created_at: string
          id: string
          is_used: boolean
          order_id: string | null
          product_id: string
          updated_at: string
        }
        Insert: {
          card_key: string
          created_at?: string
          id?: string
          is_used?: boolean
          order_id?: string | null
          product_id: string
          updated_at?: string
        }
        Update: {
          card_key?: string
          created_at?: string
          id?: string
          is_used?: boolean
          order_id?: string | null
          product_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      store_orders: {
        Row: {
          amount: number
          bot_id: string | null
          contact: string | null
          created_at: string
          currency: string
          delivered_code: string | null
          id: string
          order_no: string
          payment_method: string
          product_id: string
          product_name: string
          status: string
          tx_hash: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          bot_id?: string | null
          contact?: string | null
          created_at?: string
          currency: string
          delivered_code?: string | null
          id?: string
          order_no: string
          payment_method: string
          product_id: string
          product_name: string
          status?: string
          tx_hash?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          bot_id?: string | null
          contact?: string | null
          created_at?: string
          currency?: string
          delivered_code?: string | null
          id?: string
          order_no?: string
          payment_method?: string
          product_id?: string
          product_name?: string
          status?: string
          tx_hash?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      store_products: {
        Row: {
          created_at: string
          description: string | null
          description_en: string | null
          duration: number
          id: string
          is_active: boolean
          name: string
          name_en: string | null
          price: number
          sort_order: number
          tags: string[]
          trx: number
          type: string
          updated_at: string
          usdt: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          description_en?: string | null
          duration?: number
          id?: string
          is_active?: boolean
          name: string
          name_en?: string | null
          price?: number
          sort_order?: number
          tags?: string[]
          trx?: number
          type?: string
          updated_at?: string
          usdt?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          description_en?: string | null
          duration?: number
          id?: string
          is_active?: boolean
          name?: string
          name_en?: string | null
          price?: number
          sort_order?: number
          tags?: string[]
          trx?: number
          type?: string
          updated_at?: string
          usdt?: number
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      decrement_stock_quantity: {
        Args: { p_product_id: string }
        Returns: number
      }
      deliver_card_key: {
        Args: { p_order_no: string; p_product_id: string }
        Returns: {
          card_key: string
          error_message: string
          success: boolean
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      invoke_check_tron_payment: { Args: never; Returns: undefined }
      invoke_cleanup_expired_orders: { Args: never; Returns: undefined }
    }
    Enums: {
      app_role: "admin" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
