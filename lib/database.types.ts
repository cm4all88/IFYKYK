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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ccbill_subscriptions: {
        Row: {
          ccbill_subscription_id: string
          client_accnum: string | null
          client_subacc: string | null
          created_at: string
          event_type: string | null
          fan_email: string
          last_renewal: string | null
          next_renewal_at: string | null
          raw_payload: Json | null
          status: string
          updated_at: string
        }
        Insert: {
          ccbill_subscription_id: string
          client_accnum?: string | null
          client_subacc?: string | null
          created_at?: string
          event_type?: string | null
          fan_email: string
          last_renewal?: string | null
          next_renewal_at?: string | null
          raw_payload?: Json | null
          status: string
          updated_at?: string
        }
        Update: {
          ccbill_subscription_id?: string
          client_accnum?: string | null
          client_subacc?: string | null
          created_at?: string
          event_type?: string | null
          fan_email?: string
          last_renewal?: string | null
          next_renewal_at?: string | null
          raw_payload?: Json | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      channels: {
        Row: {
          created_at: string
          creator_id: string
          description: string | null
          id: string
          is_default: boolean
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          creator_id: string
          description?: string | null
          id?: string
          is_default?: boolean
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          creator_id?: string
          description?: string | null
          id?: string
          is_default?: boolean
          name?: string
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "channels_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
        ]
      }
      creators: {
        Row: {
          age_verified_at: string | null
          avatar_url: string | null
          bio: string | null
          cover_url: string | null
          created_at: string
          display_name: string
          handle: string
          id: string
          is_active: boolean
          payout_email: string | null
          subscription_price_cents: number
          updated_at: string
          user_id: string
        }
        Insert: {
          age_verified_at?: string | null
          avatar_url?: string | null
          bio?: string | null
          cover_url?: string | null
          created_at?: string
          display_name: string
          handle: string
          id?: string
          is_active?: boolean
          payout_email?: string | null
          subscription_price_cents?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          age_verified_at?: string | null
          avatar_url?: string | null
          bio?: string | null
          cover_url?: string | null
          created_at?: string
          display_name?: string
          handle?: string
          id?: string
          is_active?: boolean
          payout_email?: string | null
          subscription_price_cents?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      message_purchases: {
        Row: {
          amount_cents: number
          ccbill_transaction_id: string | null
          fan_email: string
          id: string
          message_id: string
          purchased_at: string
        }
        Insert: {
          amount_cents: number
          ccbill_transaction_id?: string | null
          fan_email: string
          id?: string
          message_id: string
          purchased_at?: string
        }
        Update: {
          amount_cents?: number
          ccbill_transaction_id?: string | null
          fan_email?: string
          id?: string
          message_id?: string
          purchased_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_purchases_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string | null
          created_at: string
          creator_id: string
          direction: string
          fan_email: string
          id: string
          media_urls: string[]
          ppv_price_cents: number | null
          read_at: string | null
          unlocked_by_fan: boolean
        }
        Insert: {
          body?: string | null
          created_at?: string
          creator_id: string
          direction: string
          fan_email: string
          id?: string
          media_urls?: string[]
          ppv_price_cents?: number | null
          read_at?: string | null
          unlocked_by_fan?: boolean
        }
        Update: {
          body?: string | null
          created_at?: string
          creator_id?: string
          direction?: string
          fan_email?: string
          id?: string
          media_urls?: string[]
          ppv_price_cents?: number | null
          read_at?: string | null
          unlocked_by_fan?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "messages_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
        ]
      }
      post_purchases: {
        Row: {
          amount_cents: number
          ccbill_transaction_id: string | null
          fan_email: string
          id: string
          post_id: string
          purchased_at: string
        }
        Insert: {
          amount_cents: number
          ccbill_transaction_id?: string | null
          fan_email: string
          id?: string
          post_id: string
          purchased_at?: string
        }
        Update: {
          amount_cents?: number
          ccbill_transaction_id?: string | null
          fan_email?: string
          id?: string
          post_id?: string
          purchased_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_purchases_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          body: string | null
          channel_id: string | null
          created_at: string
          creator_id: string
          id: string
          is_published: boolean
          media_urls: string[]
          ppv_price_cents: number | null
          published_at: string | null
          thumbnail_url: string | null
          type: string
          updated_at: string
          visibility: string
        }
        Insert: {
          body?: string | null
          channel_id?: string | null
          created_at?: string
          creator_id: string
          id?: string
          is_published?: boolean
          media_urls?: string[]
          ppv_price_cents?: number | null
          published_at?: string | null
          thumbnail_url?: string | null
          type: string
          updated_at?: string
          visibility: string
        }
        Update: {
          body?: string | null
          channel_id?: string | null
          created_at?: string
          creator_id?: string
          id?: string
          is_published?: boolean
          media_urls?: string[]
          ppv_price_cents?: number | null
          published_at?: string | null
          thumbnail_url?: string | null
          type?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
        ]
      }
      stream_purchases: {
        Row: {
          amount_cents: number
          ccbill_transaction_id: string | null
          fan_email: string
          id: string
          purchased_at: string
          stream_id: string
        }
        Insert: {
          amount_cents: number
          ccbill_transaction_id?: string | null
          fan_email: string
          id?: string
          purchased_at?: string
          stream_id: string
        }
        Update: {
          amount_cents?: number
          ccbill_transaction_id?: string | null
          fan_email?: string
          id?: string
          purchased_at?: string
          stream_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stream_purchases_stream_id_fkey"
            columns: ["stream_id"]
            isOneToOne: false
            referencedRelation: "streams"
            referencedColumns: ["id"]
          },
        ]
      }
      streams: {
        Row: {
          created_at: string
          creator_id: string
          description: string | null
          ended_at: string | null
          id: string
          ingest_url: string | null
          playback_url: string | null
          ppv_price_cents: number | null
          recording_url: string | null
          scheduled_for: string | null
          started_at: string | null
          status: string
          title: string
          updated_at: string
          visibility: string
        }
        Insert: {
          created_at?: string
          creator_id: string
          description?: string | null
          ended_at?: string | null
          id?: string
          ingest_url?: string | null
          playback_url?: string | null
          ppv_price_cents?: number | null
          recording_url?: string | null
          scheduled_for?: string | null
          started_at?: string | null
          status?: string
          title: string
          updated_at?: string
          visibility: string
        }
        Update: {
          created_at?: string
          creator_id?: string
          description?: string | null
          ended_at?: string | null
          id?: string
          ingest_url?: string | null
          playback_url?: string | null
          ppv_price_cents?: number | null
          recording_url?: string | null
          scheduled_for?: string | null
          started_at?: string | null
          status?: string
          title?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "streams_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          canceled_at: string | null
          ccbill_subscription_id: string | null
          created_at: string
          creator_id: string
          fan_email: string
          id: string
          next_renewal_at: string | null
          started_at: string
          status: string
          updated_at: string
        }
        Insert: {
          canceled_at?: string | null
          ccbill_subscription_id?: string | null
          created_at?: string
          creator_id: string
          fan_email: string
          id?: string
          next_renewal_at?: string | null
          started_at?: string
          status: string
          updated_at?: string
        }
        Update: {
          canceled_at?: string | null
          ccbill_subscription_id?: string | null
          created_at?: string
          creator_id?: string
          fan_email?: string
          id?: string
          next_renewal_at?: string | null
          started_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_ccbill_subscription_id_fkey"
            columns: ["ccbill_subscription_id"]
            isOneToOne: false
            referencedRelation: "ccbill_subscriptions"
            referencedColumns: ["ccbill_subscription_id"]
          },
          {
            foreignKeyName: "subscriptions_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
        ]
      }
      tips: {
        Row: {
          amount_cents: number
          ccbill_transaction_id: string | null
          created_at: string
          creator_id: string
          fan_email: string
          id: string
          message: string | null
        }
        Insert: {
          amount_cents: number
          ccbill_transaction_id?: string | null
          created_at?: string
          creator_id: string
          fan_email: string
          id?: string
          message?: string | null
        }
        Update: {
          amount_cents?: number
          ccbill_transaction_id?: string | null
          created_at?: string
          creator_id?: string
          fan_email?: string
          id?: string
          message?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tips_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_creator_owner: { Args: { cid: string }; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
