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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      match_participants: {
        Row: {
          created_at: string | null
          id: string
          match_id: string | null
          player_id: string | null
          rating_after: number | null
          rating_before: number | null
          rating_change: number | null
          team: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          match_id?: string | null
          player_id?: string | null
          rating_after?: number | null
          rating_before?: number | null
          rating_change?: number | null
          team: number
        }
        Update: {
          created_at?: string | null
          id?: string
          match_id?: string | null
          player_id?: string | null
          rating_after?: number | null
          rating_before?: number | null
          rating_change?: number | null
          team?: number
        }
        Relationships: [
          {
            foreignKeyName: "match_participants_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_participants_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          match_date: string
          match_type: string | null
          team1_score: number
          team2_score: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          match_date: string
          match_type?: string | null
          team1_score: number
          team2_score: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          match_date?: string
          match_type?: string | null
          team1_score?: number
          team2_score?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matches_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          current_rating: number | null
          email: string
          full_name: string
          id: string
          last_rating_update: string | null
          losses: number | null
          total_matches: number | null
          updated_at: string | null
          week_start_date: string | null
          week_start_rating: number | null
          wins: number | null
        }
        Insert: {
          created_at?: string | null
          current_rating?: number | null
          email: string
          full_name: string
          id: string
          last_rating_update?: string | null
          losses?: number | null
          total_matches?: number | null
          updated_at?: string | null
          week_start_date?: string | null
          week_start_rating?: number | null
          wins?: number | null
        }
        Update: {
          created_at?: string | null
          current_rating?: number | null
          email?: string
          full_name?: string
          id?: string
          last_rating_update?: string | null
          losses?: number | null
          total_matches?: number | null
          updated_at?: string | null
          week_start_date?: string | null
          week_start_rating?: number | null
          wins?: number | null
        }
        Relationships: []
      }
      rating_parameters: {
        Row: {
          clamp_max: number
          clamp_min: number
          created_at: string
          id: string
          inactivity_days: number
          k_format_doubles: number
          k_format_singles: number
          k_ladder: number
          k_league: number
          k_playoffs: number
          mean_rating: number
          mov_cap: number
          points_per_game: number
          provisional_bonus: number
          provisional_matches: number
          regress_coeff: number
          tau: number
          updated_at: string
        }
        Insert: {
          clamp_max?: number
          clamp_min?: number
          created_at?: string
          id?: string
          inactivity_days?: number
          k_format_doubles?: number
          k_format_singles?: number
          k_ladder?: number
          k_league?: number
          k_playoffs?: number
          mean_rating?: number
          mov_cap?: number
          points_per_game?: number
          provisional_bonus?: number
          provisional_matches?: number
          regress_coeff?: number
          tau?: number
          updated_at?: string
        }
        Update: {
          clamp_max?: number
          clamp_min?: number
          created_at?: string
          id?: string
          inactivity_days?: number
          k_format_doubles?: number
          k_format_singles?: number
          k_ladder?: number
          k_league?: number
          k_playoffs?: number
          mean_rating?: number
          mov_cap?: number
          points_per_game?: number
          provisional_bonus?: number
          provisional_matches?: number
          regress_coeff?: number
          tau?: number
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_pulse_rating_change: {
        Args: {
          p_match_type?: string
          p_opponent_score: number
          p_opponent1_rating: number
          p_opponent2_rating: number
          p_partner_rating: number
          p_player_matches?: number
          p_player_rating: number
          p_team_score: number
          p_won: boolean
        }
        Returns: number
      }
      calculate_rating_change: {
        Args: {
          opponent1_rating: number
          opponent2_rating: number
          partner_rating: number
          player_rating: number
          won: boolean
        }
        Returns: number
      }
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
