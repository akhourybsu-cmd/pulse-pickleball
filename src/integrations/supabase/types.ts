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
      badges: {
        Row: {
          category: string
          code: string
          created_at: string | null
          description: string
          icon: string | null
          id: string
          name: string
          tier: number | null
        }
        Insert: {
          category: string
          code: string
          created_at?: string | null
          description: string
          icon?: string | null
          id?: string
          name: string
          tier?: number | null
        }
        Update: {
          category?: string
          code?: string
          created_at?: string | null
          description?: string
          icon?: string | null
          id?: string
          name?: string
          tier?: number | null
        }
        Relationships: []
      }
      check_ins: {
        Row: {
          checked_in_at: string | null
          id: string
          last_activity: string | null
          player_id: string
          session_id: string
          status: string
        }
        Insert: {
          checked_in_at?: string | null
          id?: string
          last_activity?: string | null
          player_id: string
          session_id: string
          status?: string
        }
        Update: {
          checked_in_at?: string | null
          id?: string
          last_activity?: string | null
          player_id?: string
          session_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "check_ins_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "check_ins_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      contested_matches: {
        Row: {
          contested_at: string
          contested_by: string
          id: string
          match_id: string
          reason: string | null
          resolved: boolean | null
          resolved_at: string | null
          resolved_by: string | null
        }
        Insert: {
          contested_at?: string
          contested_by: string
          id?: string
          match_id: string
          reason?: string | null
          resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
        }
        Update: {
          contested_at?: string
          contested_by?: string
          id?: string
          match_id?: string
          reason?: string | null
          resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contested_matches_contested_by_fkey"
            columns: ["contested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contested_matches_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contested_matches_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      court_post_participants: {
        Row: {
          comment: string | null
          id: string
          joined_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          comment?: string | null
          id?: string
          joined_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          comment?: string | null
          id?: string
          joined_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "court_post_participants_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "court_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "court_post_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      court_posts: {
        Row: {
          content: string
          court_id: string
          created_at: string
          id: string
          max_players: number
          session_date: string
          session_time: string
          status: string
          title: string
          updated_at: string
          user_id: string
          viewed_participants_count: number | null
        }
        Insert: {
          content: string
          court_id: string
          created_at?: string
          id?: string
          max_players?: number
          session_date?: string
          session_time?: string
          status?: string
          title: string
          updated_at?: string
          user_id: string
          viewed_participants_count?: number | null
        }
        Update: {
          content?: string
          court_id?: string
          created_at?: string
          id?: string
          max_players?: number
          session_date?: string
          session_time?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
          viewed_participants_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "court_posts_court_id_fkey"
            columns: ["court_id"]
            isOneToOne: false
            referencedRelation: "courts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "court_posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      courts: {
        Row: {
          city: string
          created_at: string
          id: string
          location: string
          name: string
          state: string
          updated_at: string
        }
        Insert: {
          city: string
          created_at?: string
          id?: string
          location: string
          name: string
          state: string
          updated_at?: string
        }
        Update: {
          city?: string
          created_at?: string
          id?: string
          location?: string
          name?: string
          state?: string
          updated_at?: string
        }
        Relationships: []
      }
      events: {
        Row: {
          created_at: string | null
          end_time: string | null
          event_date: string | null
          id: string
          location: string | null
          name: string
          num_courts: number | null
          organizer_id: string
          other_location: string | null
          points_to: number | null
          rating_eligible: boolean | null
          rating_type: string | null
          start_time: string | null
          status: string | null
          updated_at: string | null
          visibility: string | null
          win_by_2: boolean | null
        }
        Insert: {
          created_at?: string | null
          end_time?: string | null
          event_date?: string | null
          id?: string
          location?: string | null
          name: string
          num_courts?: number | null
          organizer_id: string
          other_location?: string | null
          points_to?: number | null
          rating_eligible?: boolean | null
          rating_type?: string | null
          start_time?: string | null
          status?: string | null
          updated_at?: string | null
          visibility?: string | null
          win_by_2?: boolean | null
        }
        Update: {
          created_at?: string | null
          end_time?: string | null
          event_date?: string | null
          id?: string
          location?: string | null
          name?: string
          num_courts?: number | null
          organizer_id?: string
          other_location?: string | null
          points_to?: number | null
          rating_eligible?: boolean | null
          rating_type?: string | null
          start_time?: string | null
          status?: string | null
          updated_at?: string | null
          visibility?: string | null
          win_by_2?: boolean | null
        }
        Relationships: []
      }
      match_approvals: {
        Row: {
          approved: boolean | null
          approved_at: string | null
          created_at: string
          id: string
          match_id: string
          player_id: string
        }
        Insert: {
          approved?: boolean | null
          approved_at?: string | null
          created_at?: string
          id?: string
          match_id: string
          player_id: string
        }
        Update: {
          approved?: boolean | null
          approved_at?: string | null
          created_at?: string
          id?: string
          match_id?: string
          player_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_approvals_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_approvals_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      match_edits: {
        Row: {
          changes: Json
          created_at: string | null
          edited_at: string
          editor_id: string
          id: string
          match_id: string
          reason: string | null
        }
        Insert: {
          changes: Json
          created_at?: string | null
          edited_at?: string
          editor_id: string
          id?: string
          match_id: string
          reason?: string | null
        }
        Update: {
          changes?: Json
          created_at?: string | null
          edited_at?: string
          editor_id?: string
          id?: string
          match_id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "match_edits_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      match_issues: {
        Row: {
          created_at: string
          details: string | null
          id: string
          issue_type: string
          match_id: string
          reported_by: string
          resolved: boolean | null
          resolved_at: string | null
          resolved_by: string | null
        }
        Insert: {
          created_at?: string
          details?: string | null
          id?: string
          issue_type: string
          match_id: string
          reported_by: string
          resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
        }
        Update: {
          created_at?: string
          details?: string | null
          id?: string
          issue_type?: string
          match_id?: string
          reported_by?: string
          resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "match_issues_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_issues_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_issues_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      match_participants: {
        Row: {
          created_at: string | null
          id: string
          match_id: string
          player_id: string
          rating_after: number | null
          rating_before: number | null
          rating_change: number | null
          team: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          match_id: string
          player_id: string
          rating_after?: number | null
          rating_before?: number | null
          rating_change?: number | null
          team: number
        }
        Update: {
          created_at?: string | null
          id?: string
          match_id?: string
          player_id?: string
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
      match_tickets: {
        Row: {
          completed_at: string | null
          court_number: number
          created_at: string | null
          id: string
          match_id: string | null
          session_id: string
          started_at: string | null
          status: string
          team1_player1_id: string
          team1_player2_id: string
          team1_score: number | null
          team2_player1_id: string
          team2_player2_id: string
          team2_score: number | null
        }
        Insert: {
          completed_at?: string | null
          court_number: number
          created_at?: string | null
          id?: string
          match_id?: string | null
          session_id: string
          started_at?: string | null
          status?: string
          team1_player1_id: string
          team1_player2_id: string
          team1_score?: number | null
          team2_player1_id: string
          team2_player2_id: string
          team2_score?: number | null
        }
        Update: {
          completed_at?: string | null
          court_number?: number
          created_at?: string | null
          id?: string
          match_id?: string | null
          session_id?: string
          started_at?: string | null
          status?: string
          team1_player1_id?: string
          team1_player2_id?: string
          team1_score?: number | null
          team2_player1_id?: string
          team2_player2_id?: string
          team2_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "match_tickets_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_tickets_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_tickets_team1_player1_id_fkey"
            columns: ["team1_player1_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_tickets_team1_player2_id_fkey"
            columns: ["team1_player2_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_tickets_team2_player1_id_fkey"
            columns: ["team2_player1_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_tickets_team2_player2_id_fkey"
            columns: ["team2_player2_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          court_id: string | null
          court_no: number | null
          created_at: string | null
          created_by: string
          event_court_number: number | null
          event_id: string | null
          id: string
          match_date: string
          match_type: string | null
          other_location: string | null
          round_no: number | null
          round_number: string | null
          source: string | null
          status: string | null
          team1_score: number
          team2_score: number
          updated_at: string | null
          verified_by: string[] | null
          void_reason: string | null
          voided: boolean | null
          voided_at: string | null
          voided_by: string | null
          week_start: string | null
        }
        Insert: {
          court_id?: string | null
          court_no?: number | null
          created_at?: string | null
          created_by: string
          event_court_number?: number | null
          event_id?: string | null
          id?: string
          match_date: string
          match_type?: string | null
          other_location?: string | null
          round_no?: number | null
          round_number?: string | null
          source?: string | null
          status?: string | null
          team1_score: number
          team2_score: number
          updated_at?: string | null
          verified_by?: string[] | null
          void_reason?: string | null
          voided?: boolean | null
          voided_at?: string | null
          voided_by?: string | null
          week_start?: string | null
        }
        Update: {
          court_id?: string | null
          court_no?: number | null
          created_at?: string | null
          created_by?: string
          event_court_number?: number | null
          event_id?: string | null
          id?: string
          match_date?: string
          match_type?: string | null
          other_location?: string | null
          round_no?: number | null
          round_number?: string | null
          source?: string | null
          status?: string | null
          team1_score?: number
          team2_score?: number
          updated_at?: string | null
          verified_by?: string[] | null
          void_reason?: string | null
          voided?: boolean | null
          voided_at?: string | null
          voided_by?: string | null
          week_start?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matches_court_id_fkey"
            columns: ["court_id"]
            isOneToOne: false
            referencedRelation: "courts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      player_badges: {
        Row: {
          badge_id: string
          earned_at: string | null
          id: string
          player_id: string
          progress: Json | null
        }
        Insert: {
          badge_id: string
          earned_at?: string | null
          id?: string
          player_id: string
          progress?: Json | null
        }
        Update: {
          badge_id?: string
          earned_at?: string | null
          id?: string
          player_id?: string
          progress?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "player_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_badges_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          accessibility_needs: string | null
          avatar_url: string | null
          avg_opponent_rating: number | null
          created_at: string | null
          current_rating: number | null
          display_name: string | null
          email: string
          first_name: string | null
          full_name: string
          handedness: string | null
          home_court_id: string | null
          id: string
          last_name: string | null
          last_rating_update: string | null
          losses: number | null
          notify_badges_email: boolean | null
          notify_badges_push: boolean | null
          notify_badges_sms: boolean | null
          notify_score_email: boolean | null
          notify_score_push: boolean | null
          notify_score_sms: boolean | null
          notify_weekly_digest: boolean | null
          paddle_brand: string | null
          paddle_model: string | null
          partner_preferences: string | null
          phonetic_name: string | null
          play_side: string | null
          pronouns: string | null
          total_matches: number | null
          total_points_against: number | null
          total_points_for: number | null
          tutorial_completed: boolean
          updated_at: string | null
          week_start_date: string | null
          week_start_rating: number | null
          wins: number | null
        }
        Insert: {
          accessibility_needs?: string | null
          avatar_url?: string | null
          avg_opponent_rating?: number | null
          created_at?: string | null
          current_rating?: number | null
          display_name?: string | null
          email: string
          first_name?: string | null
          full_name: string
          handedness?: string | null
          home_court_id?: string | null
          id: string
          last_name?: string | null
          last_rating_update?: string | null
          losses?: number | null
          notify_badges_email?: boolean | null
          notify_badges_push?: boolean | null
          notify_badges_sms?: boolean | null
          notify_score_email?: boolean | null
          notify_score_push?: boolean | null
          notify_score_sms?: boolean | null
          notify_weekly_digest?: boolean | null
          paddle_brand?: string | null
          paddle_model?: string | null
          partner_preferences?: string | null
          phonetic_name?: string | null
          play_side?: string | null
          pronouns?: string | null
          total_matches?: number | null
          total_points_against?: number | null
          total_points_for?: number | null
          tutorial_completed?: boolean
          updated_at?: string | null
          week_start_date?: string | null
          week_start_rating?: number | null
          wins?: number | null
        }
        Update: {
          accessibility_needs?: string | null
          avatar_url?: string | null
          avg_opponent_rating?: number | null
          created_at?: string | null
          current_rating?: number | null
          display_name?: string | null
          email?: string
          first_name?: string | null
          full_name?: string
          handedness?: string | null
          home_court_id?: string | null
          id?: string
          last_name?: string | null
          last_rating_update?: string | null
          losses?: number | null
          notify_badges_email?: boolean | null
          notify_badges_push?: boolean | null
          notify_badges_sms?: boolean | null
          notify_score_email?: boolean | null
          notify_score_push?: boolean | null
          notify_score_sms?: boolean | null
          notify_weekly_digest?: boolean | null
          paddle_brand?: string | null
          paddle_model?: string | null
          partner_preferences?: string | null
          phonetic_name?: string | null
          play_side?: string | null
          pronouns?: string | null
          total_matches?: number | null
          total_points_against?: number | null
          total_points_for?: number | null
          tutorial_completed?: boolean
          updated_at?: string | null
          week_start_date?: string | null
          week_start_rating?: number | null
          wins?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_home_court_id_fkey"
            columns: ["home_court_id"]
            isOneToOne: false
            referencedRelation: "courts"
            referencedColumns: ["id"]
          },
        ]
      }
      queue_entries: {
        Row: {
          games_played: number | null
          id: string
          joined_at: string | null
          player_id: string
          priority: number | null
          session_id: string
          status: string
        }
        Insert: {
          games_played?: number | null
          id?: string
          joined_at?: string | null
          player_id: string
          priority?: number | null
          session_id: string
          status?: string
        }
        Update: {
          games_played?: number | null
          id?: string
          joined_at?: string | null
          player_id?: string
          priority?: number | null
          session_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "queue_entries_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "queue_entries_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
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
      round_robin_events: {
        Row: {
          completed_at: string | null
          created_at: string
          current_round: number | null
          date: string
          id: string
          location: string | null
          name: string
          notes: string | null
          num_courts: number
          num_rounds: number
          organizer_id: string
          rating_eligible: boolean
          rating_type: Database["public"]["Enums"]["rating_type"]
          status: Database["public"]["Enums"]["round_robin_status"]
          updated_at: string
          void_reason: string | null
          voided: boolean | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          current_round?: number | null
          date?: string
          id?: string
          location?: string | null
          name: string
          notes?: string | null
          num_courts: number
          num_rounds: number
          organizer_id: string
          rating_eligible?: boolean
          rating_type?: Database["public"]["Enums"]["rating_type"]
          status?: Database["public"]["Enums"]["round_robin_status"]
          updated_at?: string
          void_reason?: string | null
          voided?: boolean | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          current_round?: number | null
          date?: string
          id?: string
          location?: string | null
          name?: string
          notes?: string | null
          num_courts?: number
          num_rounds?: number
          organizer_id?: string
          rating_eligible?: boolean
          rating_type?: Database["public"]["Enums"]["rating_type"]
          status?: Database["public"]["Enums"]["round_robin_status"]
          updated_at?: string
          void_reason?: string | null
          voided?: boolean | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: []
      }
      round_robin_players: {
        Row: {
          active: boolean
          bye_count: number
          event_id: string
          id: string
          joined_at: string
          player_id: string
        }
        Insert: {
          active?: boolean
          bye_count?: number
          event_id: string
          id?: string
          joined_at?: string
          player_id: string
        }
        Update: {
          active?: boolean
          bye_count?: number
          event_id?: string
          id?: string
          joined_at?: string
          player_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "round_robin_players_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "round_robin_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "round_robin_players_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      round_robin_schedule: {
        Row: {
          a1_player_id: string | null
          a2_player_id: string | null
          b1_player_id: string | null
          b2_player_id: string | null
          court_no: number
          created_at: string
          event_id: string
          id: string
          is_bye: boolean
          match_id: string | null
          round_no: number
          team1_score: number | null
          team2_score: number | null
        }
        Insert: {
          a1_player_id?: string | null
          a2_player_id?: string | null
          b1_player_id?: string | null
          b2_player_id?: string | null
          court_no: number
          created_at?: string
          event_id: string
          id?: string
          is_bye?: boolean
          match_id?: string | null
          round_no: number
          team1_score?: number | null
          team2_score?: number | null
        }
        Update: {
          a1_player_id?: string | null
          a2_player_id?: string | null
          b1_player_id?: string | null
          b2_player_id?: string | null
          court_no?: number
          created_at?: string
          event_id?: string
          id?: string
          is_bye?: boolean
          match_id?: string | null
          round_no?: number
          team1_score?: number | null
          team2_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "round_robin_schedule_a1_player_id_fkey"
            columns: ["a1_player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "round_robin_schedule_a2_player_id_fkey"
            columns: ["a2_player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "round_robin_schedule_b1_player_id_fkey"
            columns: ["b1_player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "round_robin_schedule_b2_player_id_fkey"
            columns: ["b2_player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "round_robin_schedule_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "round_robin_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "round_robin_schedule_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          court_id: string
          created_at: string | null
          created_by: string
          end_time: string | null
          id: string
          match_type: string
          name: string
          num_courts: number
          session_date: string
          start_time: string
          status: string
          updated_at: string | null
        }
        Insert: {
          court_id: string
          created_at?: string | null
          created_by: string
          end_time?: string | null
          id?: string
          match_type?: string
          name: string
          num_courts?: number
          session_date?: string
          start_time: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          court_id?: string
          created_at?: string | null
          created_by?: string
          end_time?: string | null
          id?: string
          match_type?: string
          name?: string
          num_courts?: number
          session_date?: string
          start_time?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sessions_court_id_fkey"
            columns: ["court_id"]
            isOneToOne: false
            referencedRelation: "courts"
            referencedColumns: ["id"]
          },
        ]
      }
      user_availability: {
        Row: {
          created_at: string | null
          day_of_week: number
          end_time: string
          id: string
          start_time: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          day_of_week: number
          end_time: string
          id?: string
          start_time: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          day_of_week?: number
          end_time?: string
          id?: string
          start_time?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
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
      calculate_win_probability: {
        Args: {
          opponent1_rating: number
          opponent2_rating: number
          partner_rating: number
          player_rating: number
        }
        Returns: number
      }
      check_and_award_badges: {
        Args: { player_id_param: string }
        Returns: undefined
      }
      cleanup_completed_match: {
        Args: { match_ticket_id: string }
        Returns: undefined
      }
      clear_all_match_history: { Args: never; Returns: undefined }
      clear_all_match_history_authenticated: { Args: never; Returns: undefined }
      delete_old_court_posts: { Args: never; Returns: undefined }
      delete_round_robin_event: {
        Args: { p_event_id: string }
        Returns: undefined
      }
      freeze_week_ratings: {
        Args: { target_week_start: string }
        Returns: undefined
      }
      get_own_email: { Args: never; Returns: string }
      get_own_private_fields: {
        Args: { profile_id: string }
        Returns: {
          accessibility_needs: string
          partner_preferences: string
        }[]
      }
      get_partner_id: {
        Args: { match_id_param: string; player_id_param: string }
        Returns: string
      }
      get_profile_email: { Args: { profile_id: string }; Returns: string }
      get_week_start: { Args: { match_date: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_event_participant: {
        Args: { _event_id: string; _user_id: string }
        Returns: boolean
      }
      recalculate_all_player_stats: { Args: never; Returns: undefined }
      recalculate_all_ratings: { Args: never; Returns: undefined }
      recalculate_all_ratings_authenticated: { Args: never; Returns: undefined }
      recalculate_player_stats: {
        Args: { p_player_id: string }
        Returns: undefined
      }
      user_created_match: {
        Args: { match_id_param: string; user_id_param: string }
        Returns: boolean
      }
      user_in_match: {
        Args: { match_id_param: string; user_id_param: string }
        Returns: boolean
      }
      verify_match: {
        Args: { p_match_id: string }
        Returns: {
          court_id: string | null
          court_no: number | null
          created_at: string | null
          created_by: string
          event_court_number: number | null
          event_id: string | null
          id: string
          match_date: string
          match_type: string | null
          other_location: string | null
          round_no: number | null
          round_number: string | null
          source: string | null
          status: string | null
          team1_score: number
          team2_score: number
          updated_at: string | null
          verified_by: string[] | null
          void_reason: string | null
          voided: boolean | null
          voided_at: string | null
          voided_by: string | null
          week_start: string | null
        }
        SetofOptions: {
          from: "*"
          to: "matches"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      void_round_robin_event: {
        Args: { p_event_id: string; p_reason?: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "user"
      rating_type: "ladder" | "league" | "playoffs" | "casual"
      round_robin_status: "draft" | "live" | "completed"
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
      rating_type: ["ladder", "league", "playoffs", "casual"],
      round_robin_status: ["draft", "live", "completed"],
    },
  },
} as const
