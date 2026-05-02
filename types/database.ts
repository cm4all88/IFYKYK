export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      creators: {
        Row: {
          id: string;
          user_id: string;
          handle: string;
          display_name: string;
          bio: string | null;
          avatar_url: string | null;
          cover_url: string | null;
          location: string | null;
          creator_type: "sfw" | "adult" | "young";
          subscription_price: number | null;
          stripe_account_id: string | null;
          ccbill_account_number: string | null;
          veriff_verified: boolean;
          is_active: boolean;
          founded: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["creators"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["creators"]["Insert"]>;
      };
      channels: {
        Row: {
          id: string;
          creator_id: string;
          name: string;
          slug: string;
          description: string | null;
          content_rating: "G" | "PG" | "M" | "R" | "X";
          subscription_price: number | null;
          is_visible: boolean;
          sort_order: number;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["channels"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["channels"]["Insert"]>;
      };
      posts: {
        Row: {
          id: string;
          creator_id: string;
          channel_id: string | null;
          caption: string | null;
          media_url: string | null;
          media_type: "image" | "video" | "gallery" | null;
          tier: "free" | "premium";
          content_rating: string;
          status: "live" | "archive" | "deleted" | "scheduled";
          scheduled_at: string | null;
          archive_reason: string | null;
          likes_count: number;
          views_count: number;
          collab_creator_id: string | null;
          collab_approved: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["posts"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["posts"]["Insert"]>;
      };
      subscriptions: {
        Row: {
          id: string;
          fan_user_id: string;
          creator_id: string;
          channel_id: string | null;
          stripe_subscription_id: string | null;
          stripe_customer_id: string | null;
          status: "trialing" | "active" | "past_due" | "canceled" | "incomplete";
          tier: string;
          price: number | null;
          trial_end: string | null;
          current_period_start: string | null;
          current_period_end: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["subscriptions"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["subscriptions"]["Insert"]>;
      };
      tips: {
        Row: {
          id: string;
          fan_user_id: string;
          creator_id: string;
          post_id: string | null;
          amount: number;
          creator_receives: number;
          platform_receives: number;
          message: string | null;
          is_live_tip: boolean;
          stripe_payment_intent_id: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["tips"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["tips"]["Insert"]>;
      };
      wallets: {
        Row: {
          id: string;
          user_id: string;
          balance: number;
          parent_user_id: string | null;
          monthly_budget: number | null;
          per_tip_limit: number | null;
          is_young_account: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["wallets"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["wallets"]["Insert"]>;
      };
    };
    Views: {};
    Functions: {};
    Enums: {};
  };
}
