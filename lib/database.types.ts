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
          created_at: string | null
          creator_id: string | null
          event_type: string | null
          fan_email: string
          id: string
          last_renewal: string | null
          status: string
        }
        Insert: {
          ccbill_subscription_id: string
          created_at?: string | null
          creator_id?: string | null
          event_type?: string | null
          fan_email: string
          id?: string
          last_renewal?: string | null
          status: string
        }
        Update: {
          ccbill_subscription_id?: string
          created_at?: string | null
          creator_id?: string | null
          event_type?: string | null
          fan_email?: string
          id?: string
          last_renewal?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "ccbill_subscriptions_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
        ]
      }
      channels: {
        Row: {
          content_rating: string
          created_at: string | null
          creator_id: string
          description: string | null
          id: string
          is_visible: boolean | null
          name: string
          slug: string
          sort_order: number | null
          subscription_price: number | null
        }
        Insert: {
          content_rating?: string
          created_at?: string | null
          creator_id: string
          description?: string | null
          id?: string
          is_visible?: boolean | null
          name: string
          slug: string
          sort_order?: number | null
          subscription_price?: number | null
        }
        Update: {
          content_rating?: string
          created_at?: string | null
          creator_id?: string
          description?: string | null
          id?: string
          is_visible?: boolean | null
          name?: string
          slug?: string
          sort_order?: number | null
          subscription_price?: number | null
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
          avatar_url: string | null
          bio: string | null
          ccbill_account_number: string | null
          cover_url: string | null
          created_at: string | null
          creator_type: string
          display_name: string
          founded: boolean | null
          handle: string
          id: string
          is_active: boolean | null
          location: string | null
          stripe_account_id: string | null
          subscription_price: number | null
          updated_at: string | null
          user_id: string
          veriff_verified: boolean | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          ccbill_account_number?: string | null
          cover_url?: string | null
          created_at?: string | null
          creator_type: string
          display_name: string
          founded?: boolean | null
          handle: string
          id?: string
          is_active?: boolean | null
          location?: string | null
          stripe_account_id?: string | null
          subscription_price?: number | null
          updated_at?: string | null
          user_id: string
          veriff_verified?: boolean | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          ccbill_account_number?: string | null
          cover_url?: string | null
          created_at?: string | null
          creator_type?: string
          display_name?: string
          founded?: boolean | null
          handle?: string
          id?: string
          is_active?: boolean | null
          location?: string | null
          stripe_account_id?: string | null
          subscription_price?: number | null
          updated_at?: string | null
          user_id?: string
          veriff_verified?: boolean | null
        }
        Relationships: []
      }
      live_offer_claims: {
        Row: {
          created_at: string | null
          fan_contact: string | null
          fan_name: string
          id: string
          offer_id: string
          status: string | null
        }
        Insert: {
          created_at?: string | null
          fan_contact?: string | null
          fan_name: string
          id?: string
          offer_id: string
          status?: string | null
        }
        Update: {
          created_at?: string | null
          fan_contact?: string | null
          fan_name?: string
          id?: string
          offer_id?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "live_offer_claims_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "live_offers"
            referencedColumns: ["id"]
          },
        ]
      }
      live_offers: {
        Row: {
          created_at: string | null
          creator_id: string
          expires_at: string | null
          id: string
          is_active: boolean | null
          offer_price: number
          regular_price: number
          service_name: string
          spots_claimed: number | null
          spots_total: number
        }
        Insert: {
          created_at?: string | null
          creator_id: string
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          offer_price: number
          regular_price: number
          service_name: string
          spots_claimed?: number | null
          spots_total: number
        }
        Update: {
          created_at?: string | null
          creator_id?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          offer_price?: number
          regular_price?: number
          service_name?: string
          spots_claimed?: number | null
          spots_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "live_offers_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
        ]
      }
      moderation_events: {
        Row: {
          action_taken: string | null
          content_id: string | null
          content_type: string
          created_at: string | null
          creator_id: string | null
          fan_user_id: string | null
          flag_reason: string | null
          flagged_text: string | null
          id: string
          reviewed_by: string | null
          severity: string | null
        }
        Insert: {
          action_taken?: string | null
          content_id?: string | null
          content_type: string
          created_at?: string | null
          creator_id?: string | null
          fan_user_id?: string | null
          flag_reason?: string | null
          flagged_text?: string | null
          id?: string
          reviewed_by?: string | null
          severity?: string | null
        }
        Update: {
          action_taken?: string | null
          content_id?: string | null
          content_type?: string
          created_at?: string | null
          creator_id?: string | null
          fan_user_id?: string | null
          flag_reason?: string | null
          flagged_text?: string | null
          id?: string
          reviewed_by?: string | null
          severity?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "moderation_events_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
        ]
      }
      pii_blocks: {
        Row: {
          created_at: string | null
          creator_id: string | null
          direction: string | null
          id: string
          pii_type: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          creator_id?: string | null
          direction?: string | null
          id?: string
          pii_type: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          creator_id?: string | null
          direction?: string | null
          id?: string
          pii_type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pii_blocks_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          archive_reason: string | null
          caption: string | null
          channel_id: string | null
          collab_approved: boolean | null
          collab_creator_id: string | null
          content_rating: string
          created_at: string | null
          creator_id: string
          id: string
          likes_count: number | null
          media_type: string | null
          media_url: string | null
          scheduled_at: string | null
          status: string
          tier: string
          updated_at: string | null
          views_count: number | null
        }
        Insert: {
          archive_reason?: string | null
          caption?: string | null
          channel_id?: string | null
          collab_approved?: boolean | null
          collab_creator_id?: string | null
          content_rating?: string
          created_at?: string | null
          creator_id: string
          id?: string
          likes_count?: number | null
          media_type?: string | null
          media_url?: string | null
          scheduled_at?: string | null
          status?: string
          tier?: string
          updated_at?: string | null
          views_count?: number | null
        }
        Update: {
          archive_reason?: string | null
          caption?: string | null
          channel_id?: string | null
          collab_approved?: boolean | null
          collab_creator_id?: string | null
          content_rating?: string
          created_at?: string | null
          creator_id?: string
          id?: string
          likes_count?: number | null
          media_type?: string | null
          media_url?: string | null
          scheduled_at?: string | null
          status?: string
          tier?: string
          updated_at?: string | null
          views_count?: number | null
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
            foreignKeyName: "posts_collab_creator_id_fkey"
            columns: ["collab_creator_id"]
            isOneToOne: false
            referencedRelation: "creators"
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
      records_2257: {
        Row: {
          created_at: string | null
          creator_id: string
          date_of_birth: string
          id: string
          id_document_type: string
          id_verified_at: string
          id_verified_by: string
          legal_name: string
          veriff_session_id: string | null
        }
        Insert: {
          created_at?: string | null
          creator_id: string
          date_of_birth: string
          id?: string
          id_document_type: string
          id_verified_at: string
          id_verified_by?: string
          legal_name: string
          veriff_session_id?: string | null
        }
        Update: {
          created_at?: string | null
          creator_id?: string
          date_of_birth?: string
          id?: string
          id_document_type?: string
          id_verified_at?: string
          id_verified_by?: string
          legal_name?: string
          veriff_session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "records_2257_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
        ]
      }
      referrals: {
        Row: {
          active_months: number | null
          commission_rate: number | null
          created_at: string | null
          id: string
          is_active: boolean | null
          max_months: number | null
          referred_id: string
          referrer_id: string
          total_earned: number | null
        }
        Insert: {
          active_months?: number | null
          commission_rate?: number | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          max_months?: number | null
          referred_id: string
          referrer_id: string
          total_earned?: number | null
        }
        Update: {
          active_months?: number | null
          commission_rate?: number | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          max_months?: number | null
          referred_id?: string
          referrer_id?: string
          total_earned?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "referrals_referred_id_fkey"
            columns: ["referred_id"]
            isOneToOne: true
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          channel_id: string | null
          created_at: string | null
          creator_id: string
          current_period_end: string | null
          current_period_start: string | null
          fan_user_id: string
          id: string
          price: number | null
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          tier: string
          trial_end: string | null
        }
        Insert: {
          channel_id?: string | null
          created_at?: string | null
          creator_id: string
          current_period_end?: string | null
          current_period_start?: string | null
          fan_user_id: string
          id?: string
          price?: number | null
          status: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tier?: string
          trial_end?: string | null
        }
        Update: {
          channel_id?: string | null
          created_at?: string | null
          creator_id?: string
          current_period_end?: string | null
          current_period_start?: string | null
          fan_user_id?: string
          id?: string
          price?: number | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tier?: string
          trial_end?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
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
          amount: number
          created_at: string | null
          creator_id: string
          creator_receives: number
          fan_user_id: string
          id: string
          is_live_tip: boolean | null
          message: string | null
          platform_receives: number
          post_id: string | null
          stripe_payment_intent_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          creator_id: string
          creator_receives: number
          fan_user_id: string
          id?: string
          is_live_tip?: boolean | null
          message?: string | null
          platform_receives: number
          post_id?: string | null
          stripe_payment_intent_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          creator_id?: string
          creator_receives?: number
          fan_user_id?: string
          id?: string
          is_live_tip?: boolean | null
          message?: string | null
          platform_receives?: number
          post_id?: string | null
          stripe_payment_intent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tips_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tips_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      wallets: {
        Row: {
          balance: number
          created_at: string | null
          id: string
          is_young_account: boolean | null
          monthly_budget: number | null
          parent_user_id: string | null
          per_tip_limit: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string | null
          id?: string
          is_young_account?: boolean | null
          monthly_budget?: number | null
          parent_user_id?: string | null
          per_tip_limit?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string | null
          id?: string
          is_young_account?: boolean | null
          monthly_budget?: number | null
          parent_user_id?: string | null
          per_tip_limit?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
