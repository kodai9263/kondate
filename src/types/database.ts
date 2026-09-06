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
      shopping_lists: {
        Row: {
          id: string;
          household_id: string;
          week_start: string;
          generated_at: string | null;
        };
        Insert: {
          id?: string;
          household_id: string;
          week_start: string;
          generated_at?: string | null;
        };
        Update: {
          id?: string;
          household_id?: string;
          week_start?: string;
          generated_at?: string | null;
        };
        Relationships: [];
      };
      shopping_items: {
        Row: {
          id: string;
          list_id: string;
          name: string;
          quantity: number | null;
          unit: string | null;
          category: string;
          source: "auto" | "manual";
          checked: boolean;
          dismissed: boolean;
          checked_by: string | null;
          position: number;
        };
        Insert: {
          id?: string;
          list_id: string;
          name: string;
          quantity?: number | null;
          unit?: string | null;
          category?: string;
          source?: "auto" | "manual";
          checked?: boolean;
          dismissed?: boolean;
          checked_by?: string | null;
          position?: number;
        };
        Update: {
          id?: string;
          list_id?: string;
          name?: string;
          quantity?: number | null;
          unit?: string | null;
          category?: string;
          source?: "auto" | "manual";
          checked?: boolean;
          dismissed?: boolean;
          checked_by?: string | null;
          position?: number;
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
      dismiss_seasoning_shopping_item: {
        Args: {
          target_week_start: string;
          target_name: string;
          target_position: number;
        };
        Returns: boolean;
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
      set_shopping_item_checked: {
        Args: {
          target_week_start: string;
          target_category: string;
          target_name: string;
          target_position: number;
          target_checked: boolean;
        };
        Returns: boolean;
      };
      update_current_household_account: {
        Args: {
          display_name_input: string;
          household_name_input: string;
          adult_count_input: number;
          child_count_input: number;
          shopping_day_input: number;
          allergies_input: string[];
        };
        Returns: undefined;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
