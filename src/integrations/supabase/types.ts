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
      bot_activations: {
        Row: {
          activation_code: string
          app_enabled: boolean | null
          bot_token: string
          created_at: string
          expire_at: string | null
          greeting_message: string | null
          id: string
          is_active: boolean | null
          is_authorized: boolean | null
          keyboard_expire_at: string | null
          keyboard_menu_first_used_at: string | null
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
          bot_token: string
          created_at?: string
          expire_at?: string | null
          greeting_message?: string | null
          id?: string
          is_active?: boolean | null
          is_authorized?: boolean | null
          keyboard_expire_at?: string | null
          keyboard_menu_first_used_at?: string | null
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
          bot_token?: string
          created_at?: string
          expire_at?: string | null
          greeting_message?: string | null
          id?: string
          is_active?: boolean | null
          is_authorized?: boolean | null
          keyboard_expire_at?: string | null
          keyboard_menu_first_used_at?: string | null
          personal_user_id?: string
          trial_limit?: number | null
          trial_messages_used?: number | null
          updated_at?: string
          user_id?: string | null
          web_enabled?: boolean | null
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
          commands: Json | null
          created_at: string
          flow_messages: Json | null
          force_menu_on_start: boolean | null
          id: string
          keyboard_expire_at: string | null
          keyboard_trial_started_at: string | null
          last_cleanup_at: string | null
          menu_admin_chat_id: number | null
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
          commands?: Json | null
          created_at?: string
          flow_messages?: Json | null
          force_menu_on_start?: boolean | null
          id?: string
          keyboard_expire_at?: string | null
          keyboard_trial_started_at?: string | null
          last_cleanup_at?: string | null
          menu_admin_chat_id?: number | null
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
          commands?: Json | null
          created_at?: string
          flow_messages?: Json | null
          force_menu_on_start?: boolean | null
          id?: string
          keyboard_expire_at?: string | null
          keyboard_trial_started_at?: string | null
          last_cleanup_at?: string | null
          menu_admin_chat_id?: number | null
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
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
