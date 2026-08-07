export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      households: {
        Row: {
          id: string;
          name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          household_id: string;
          display_name: string;
          created_at: string;
        };
        Insert: {
          id: string;
          household_id: string;
          display_name: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          household_id?: string;
          display_name?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      household_subscriptions: {
        Row: {
          household_id: string;
          plan_id: string;
          status: string;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          current_period_end: string | null;
          cancel_at_period_end: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          household_id: string;
          plan_id?: string;
          status?: string;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          current_period_end?: string | null;
          cancel_at_period_end?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          household_id?: string;
          plan_id?: string;
          status?: string;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          current_period_end?: string | null;
          cancel_at_period_end?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      household_invites: {
        Row: {
          id: string;
          household_id: string;
          invite_token: string;
          created_by: string | null;
          accepted_by: string | null;
          expires_at: string;
          accepted_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          invite_token?: string;
          created_by?: string | null;
          accepted_by?: string | null;
          expires_at?: string;
          accepted_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          household_id?: string;
          invite_token?: string;
          created_by?: string | null;
          accepted_by?: string | null;
          expires_at?: string;
          accepted_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      accept_household_invite: {
        Args: {
          invite_token_input: string;
        };
        Returns: string;
      };
      ensure_current_user_household: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      get_household_invite: {
        Args: {
          invite_token_input: string;
        };
        Returns: {
          household_name: string;
          expires_at: string;
          accepted_at: string | null;
        }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
