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
      channel_messages: {
        Row: {
          body: string
          channel_id: string
          created_at: string
          id: number
          thread_id: number | null
          user_id: string
        }
        Insert: {
          body: string
          channel_id: string
          created_at?: string
          id?: number
          thread_id?: number | null
          user_id: string
        }
        Update: {
          body?: string
          channel_id?: string
          created_at?: string
          id?: number
          thread_id?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "court_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "channel_messages"
            referencedColumns: ["id"]
          },
        ]
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
            foreignKeyName: "check_ins_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
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
      citi_event_attendees: {
        Row: {
          checkin_timestamp: string | null
          event_id: string
          id: string
          joined_at: string
          promoted_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          checkin_timestamp?: string | null
          event_id: string
          id?: string
          joined_at?: string
          promoted_at?: string | null
          status: string
          user_id: string
        }
        Update: {
          checkin_timestamp?: string | null
          event_id?: string
          id?: string
          joined_at?: string
          promoted_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "citi_event_attendees_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "citi_events"
            referencedColumns: ["id"]
          },
        ]
      }
      citi_events: {
        Row: {
          court_id: string
          created_at: string
          created_by: string
          description: string | null
          end_time: string
          id: string
          is_published: boolean
          max_players: number
          price_label: string | null
          skill_tag: string | null
          start_time: string
          title: string
          updated_at: string
          waitlist_enabled: boolean
          waitlist_max: number | null
        }
        Insert: {
          court_id: string
          created_at?: string
          created_by: string
          description?: string | null
          end_time: string
          id?: string
          is_published?: boolean
          max_players: number
          price_label?: string | null
          skill_tag?: string | null
          start_time: string
          title: string
          updated_at?: string
          waitlist_enabled?: boolean
          waitlist_max?: number | null
        }
        Update: {
          court_id?: string
          created_at?: string
          created_by?: string
          description?: string | null
          end_time?: string
          id?: string
          is_published?: boolean
          max_players?: number
          price_label?: string | null
          skill_tag?: string | null
          start_time?: string
          title?: string
          updated_at?: string
          waitlist_enabled?: boolean
          waitlist_max?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "citi_events_court_id_fkey"
            columns: ["court_id"]
            isOneToOne: false
            referencedRelation: "courts"
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
            foreignKeyName: "contested_matches_contested_by_fkey"
            columns: ["contested_by"]
            isOneToOne: false
            referencedRelation: "profiles_public"
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
          {
            foreignKeyName: "contested_matches_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      court_channels: {
        Row: {
          court_id: string
          created_at: string
          id: string
        }
        Insert: {
          court_id: string
          created_at?: string
          id?: string
        }
        Update: {
          court_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "court_channels_court_id_fkey"
            columns: ["court_id"]
            isOneToOne: true
            referencedRelation: "courts"
            referencedColumns: ["id"]
          },
        ]
      }
      court_checkins: {
        Row: {
          checked_out_at: string | null
          court_id: string
          created_at: string
          ends_at: string
          id: string
          user_id: string
        }
        Insert: {
          checked_out_at?: string | null
          court_id: string
          created_at?: string
          ends_at: string
          id?: string
          user_id: string
        }
        Update: {
          checked_out_at?: string | null
          court_id?: string
          created_at?: string
          ends_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "court_checkins_court_id_fkey"
            columns: ["court_id"]
            isOneToOne: false
            referencedRelation: "courts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "court_checkins_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "court_checkins_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      court_post_comments: {
        Row: {
          author_user_id: string
          content: string
          created_at: string
          id: string
          parent_comment_id: string | null
          post_id: string
          updated_at: string
        }
        Insert: {
          author_user_id: string
          content: string
          created_at?: string
          id?: string
          parent_comment_id?: string | null
          post_id: string
          updated_at?: string
        }
        Update: {
          author_user_id?: string
          content?: string
          created_at?: string
          id?: string
          parent_comment_id?: string | null
          post_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "court_post_comments_author_user_id_fkey"
            columns: ["author_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "court_post_comments_author_user_id_fkey"
            columns: ["author_user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "court_post_comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "court_post_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "court_post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "court_posts"
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
          {
            foreignKeyName: "court_post_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      court_post_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "court_post_reactions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "court_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "court_post_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "court_post_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
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
          {
            foreignKeyName: "court_posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      courts: {
        Row: {
          citi_admins: string[] | null
          city: string
          created_at: string
          id: string
          location: string
          name: string
          state: string
          updated_at: string
        }
        Insert: {
          citi_admins?: string[] | null
          city: string
          created_at?: string
          id?: string
          location: string
          name: string
          state: string
          updated_at?: string
        }
        Update: {
          citi_admins?: string[] | null
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
      lfg_posts: {
        Row: {
          capacity: number
          court_id: string
          created_at: string
          created_by: string
          ends_at: string
          format: string
          id: string
          intensity: string
          notes: string | null
          starts_at: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          capacity?: number
          court_id: string
          created_at?: string
          created_by: string
          ends_at: string
          format?: string
          id?: string
          intensity?: string
          notes?: string | null
          starts_at: string
          status?: string
          title?: string
          updated_at?: string
        }
        Update: {
          capacity?: number
          court_id?: string
          created_at?: string
          created_by?: string
          ends_at?: string
          format?: string
          id?: string
          intensity?: string
          notes?: string | null
          starts_at?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lfg_posts_court_id_fkey"
            columns: ["court_id"]
            isOneToOne: false
            referencedRelation: "courts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lfg_posts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lfg_posts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      lfg_rsvps: {
        Row: {
          created_at: string
          id: string
          lfg_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lfg_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lfg_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lfg_rsvps_lfg_id_fkey"
            columns: ["lfg_id"]
            isOneToOne: false
            referencedRelation: "lfg_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lfg_rsvps_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lfg_rsvps_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
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
          {
            foreignKeyName: "match_approvals_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
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
            foreignKeyName: "match_issues_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_issues_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_issues_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles_public"
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
          {
            foreignKeyName: "match_participants_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
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
            foreignKeyName: "match_tickets_team1_player1_id_fkey"
            columns: ["team1_player1_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
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
            foreignKeyName: "match_tickets_team1_player2_id_fkey"
            columns: ["team1_player2_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
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
            foreignKeyName: "match_tickets_team2_player1_id_fkey"
            columns: ["team2_player1_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_tickets_team2_player2_id_fkey"
            columns: ["team2_player2_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_tickets_team2_player2_id_fkey"
            columns: ["team2_player2_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
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
            foreignKeyName: "matches_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_public"
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
      mfa_verification_codes: {
        Row: {
          code: string
          created_at: string
          expires_at: string
          id: string
          method: string
          used: boolean
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          expires_at: string
          id?: string
          method: string
          used?: boolean
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          expires_at?: string
          id?: string
          method?: string
          used?: boolean
          user_id?: string
        }
        Relationships: []
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
          {
            foreignKeyName: "player_badges_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
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
          date_of_birth: string | null
          display_name: string | null
          dupr_rating: number | null
          email: string
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          first_name: string | null
          full_name: string
          gender: string | null
          handedness: string | null
          home_court_id: string | null
          id: string
          last_name: string | null
          last_rating_update: string | null
          losses: number | null
          mfa_method: string | null
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
          phone_number: string | null
          phonetic_name: string | null
          play_side: string | null
          pronouns: string | null
          shirt_size: string | null
          skill_level_self: string | null
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
          date_of_birth?: string | null
          display_name?: string | null
          dupr_rating?: number | null
          email: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          first_name?: string | null
          full_name: string
          gender?: string | null
          handedness?: string | null
          home_court_id?: string | null
          id: string
          last_name?: string | null
          last_rating_update?: string | null
          losses?: number | null
          mfa_method?: string | null
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
          phone_number?: string | null
          phonetic_name?: string | null
          play_side?: string | null
          pronouns?: string | null
          shirt_size?: string | null
          skill_level_self?: string | null
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
          date_of_birth?: string | null
          display_name?: string | null
          dupr_rating?: number | null
          email?: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          first_name?: string | null
          full_name?: string
          gender?: string | null
          handedness?: string | null
          home_court_id?: string | null
          id?: string
          last_name?: string | null
          last_rating_update?: string | null
          losses?: number | null
          mfa_method?: string | null
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
          phone_number?: string | null
          phonetic_name?: string | null
          play_side?: string | null
          pronouns?: string | null
          shirt_size?: string | null
          skill_level_self?: string | null
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
            foreignKeyName: "queue_entries_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
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
      round_robin_audit: {
        Row: {
          change_type: string
          changes: Json
          created_at: string
          edited_at: string
          editor_id: string
          event_id: string
          id: string
          reason: string | null
        }
        Insert: {
          change_type: string
          changes: Json
          created_at?: string
          edited_at?: string
          editor_id: string
          event_id: string
          id?: string
          reason?: string | null
        }
        Update: {
          change_type?: string
          changes?: Json
          created_at?: string
          edited_at?: string
          editor_id?: string
          event_id?: string
          id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "round_robin_audit_editor_id_fkey"
            columns: ["editor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "round_robin_audit_editor_id_fkey"
            columns: ["editor_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "round_robin_audit_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "round_robin_events"
            referencedColumns: ["id"]
          },
        ]
      }
      round_robin_events: {
        Row: {
          completed_at: string | null
          created_at: string
          current_round: number | null
          date: string
          games_per_player: number | null
          id: string
          location: string | null
          name: string
          notes: string | null
          num_courts: number
          num_rounds: number
          organizer_id: string
          organizer_pin: string | null
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
          games_per_player?: number | null
          id?: string
          location?: string | null
          name: string
          notes?: string | null
          num_courts: number
          num_rounds: number
          organizer_id: string
          organizer_pin?: string | null
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
          games_per_player?: number | null
          id?: string
          location?: string | null
          name?: string
          notes?: string | null
          num_courts?: number
          num_rounds?: number
          organizer_id?: string
          organizer_pin?: string | null
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
          {
            foreignKeyName: "round_robin_players_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
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
            foreignKeyName: "round_robin_schedule_a1_player_id_fkey"
            columns: ["a1_player_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
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
            foreignKeyName: "round_robin_schedule_a2_player_id_fkey"
            columns: ["a2_player_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
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
            foreignKeyName: "round_robin_schedule_b1_player_id_fkey"
            columns: ["b1_player_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
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
            foreignKeyName: "round_robin_schedule_b2_player_id_fkey"
            columns: ["b2_player_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
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
      tournament_customization: {
        Row: {
          about_image_url: string | null
          about_markdown: string | null
          conduct_policy: string | null
          created_at: string
          event_id: string
          extra_notes: string | null
          hero_image_url: string | null
          hero_overlay_color: string | null
          id: string
          is_published: boolean
          last_updated_by: string | null
          liability_policy: string | null
          map_embed: string | null
          organizer_contact_email: string | null
          organizer_contact_name: string | null
          organizer_message: string | null
          organizer_phone: string | null
          organizer_preferred_contact: string | null
          organizer_social_links: Json | null
          policies_text: string | null
          refund_policy: string | null
          sponsors: Json | null
          tagline: string | null
          theme_accent: string | null
          updated_at: string
          venue_details: Json | null
          venue_photo_url: string | null
          weather_policy: string | null
        }
        Insert: {
          about_image_url?: string | null
          about_markdown?: string | null
          conduct_policy?: string | null
          created_at?: string
          event_id: string
          extra_notes?: string | null
          hero_image_url?: string | null
          hero_overlay_color?: string | null
          id?: string
          is_published?: boolean
          last_updated_by?: string | null
          liability_policy?: string | null
          map_embed?: string | null
          organizer_contact_email?: string | null
          organizer_contact_name?: string | null
          organizer_message?: string | null
          organizer_phone?: string | null
          organizer_preferred_contact?: string | null
          organizer_social_links?: Json | null
          policies_text?: string | null
          refund_policy?: string | null
          sponsors?: Json | null
          tagline?: string | null
          theme_accent?: string | null
          updated_at?: string
          venue_details?: Json | null
          venue_photo_url?: string | null
          weather_policy?: string | null
        }
        Update: {
          about_image_url?: string | null
          about_markdown?: string | null
          conduct_policy?: string | null
          created_at?: string
          event_id?: string
          extra_notes?: string | null
          hero_image_url?: string | null
          hero_overlay_color?: string | null
          id?: string
          is_published?: boolean
          last_updated_by?: string | null
          liability_policy?: string | null
          map_embed?: string | null
          organizer_contact_email?: string | null
          organizer_contact_name?: string | null
          organizer_message?: string | null
          organizer_phone?: string | null
          organizer_preferred_contact?: string | null
          organizer_social_links?: Json | null
          policies_text?: string | null
          refund_policy?: string | null
          sponsors?: Json | null
          tagline?: string | null
          theme_accent?: string | null
          updated_at?: string
          venue_details?: Json | null
          venue_photo_url?: string | null
          weather_policy?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tournament_customization_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "tournaments_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_customization_last_updated_by_fkey"
            columns: ["last_updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_customization_last_updated_by_fkey"
            columns: ["last_updated_by"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_registration_notifications: {
        Row: {
          id: string
          notification_type: string
          payload: Json | null
          registration_id: string
          sent_at: string
          to_email: string
        }
        Insert: {
          id?: string
          notification_type: string
          payload?: Json | null
          registration_id: string
          sent_at?: string
          to_email: string
        }
        Update: {
          id?: string
          notification_type?: string
          payload?: Json | null
          registration_id?: string
          sent_at?: string
          to_email?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_registration_notifications_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "tournament_registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_registrations: {
        Row: {
          additional_info: Json | null
          captain_user_id: string
          created_at: string
          division_id: string
          event_id: string
          id: string
          notes: string | null
          partner_user_id: string | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          registration_date: string
          status: Database["public"]["Enums"]["registration_status"]
          team_name: string
          updated_at: string
        }
        Insert: {
          additional_info?: Json | null
          captain_user_id: string
          created_at?: string
          division_id: string
          event_id: string
          id?: string
          notes?: string | null
          partner_user_id?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          registration_date?: string
          status?: Database["public"]["Enums"]["registration_status"]
          team_name: string
          updated_at?: string
        }
        Update: {
          additional_info?: Json | null
          captain_user_id?: string
          created_at?: string
          division_id?: string
          event_id?: string
          id?: string
          notes?: string | null
          partner_user_id?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          registration_date?: string
          status?: Database["public"]["Enums"]["registration_status"]
          team_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_registrations_captain_user_id_fkey"
            columns: ["captain_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_registrations_captain_user_id_fkey"
            columns: ["captain_user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_registrations_division_id_fkey"
            columns: ["division_id"]
            isOneToOne: false
            referencedRelation: "tournaments_divisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_registrations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "tournaments_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_registrations_partner_user_id_fkey"
            columns: ["partner_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_registrations_partner_user_id_fkey"
            columns: ["partner_user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      tournaments_courts: {
        Row: {
          available: boolean
          court_name: string | null
          court_number: number
          created_at: string
          event_id: string
          id: string
        }
        Insert: {
          available?: boolean
          court_name?: string | null
          court_number: number
          created_at?: string
          event_id: string
          id?: string
        }
        Update: {
          available?: boolean
          court_name?: string | null
          court_number?: number
          created_at?: string
          event_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournaments_courts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "tournaments_events"
            referencedColumns: ["id"]
          },
        ]
      }
      tournaments_divisions: {
        Row: {
          created_at: string
          description: string | null
          event_id: string
          format: string
          id: string
          max_teams: number | null
          name: string
          scoring_ruleset_id: string | null
          status: Database["public"]["Enums"]["division_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          event_id: string
          format?: string
          id?: string
          max_teams?: number | null
          name: string
          scoring_ruleset_id?: string | null
          status?: Database["public"]["Enums"]["division_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          event_id?: string
          format?: string
          id?: string
          max_teams?: number | null
          name?: string
          scoring_ruleset_id?: string | null
          status?: Database["public"]["Enums"]["division_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournaments_divisions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "tournaments_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournaments_divisions_scoring_ruleset_id_fkey"
            columns: ["scoring_ruleset_id"]
            isOneToOne: false
            referencedRelation: "tournaments_scoring_rulesets"
            referencedColumns: ["id"]
          },
        ]
      }
      tournaments_events: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          end_date: string
          id: string
          location: string | null
          name: string
          public_view_enabled: boolean
          registration_close_date: string | null
          registration_enabled: boolean | null
          registration_fee: number | null
          registration_open_date: string | null
          start_date: string
          status: Database["public"]["Enums"]["tournament_status"]
          updated_at: string
          waitlist_enabled: boolean | null
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          end_date: string
          id?: string
          location?: string | null
          name: string
          public_view_enabled?: boolean
          registration_close_date?: string | null
          registration_enabled?: boolean | null
          registration_fee?: number | null
          registration_open_date?: string | null
          start_date: string
          status?: Database["public"]["Enums"]["tournament_status"]
          updated_at?: string
          waitlist_enabled?: boolean | null
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          end_date?: string
          id?: string
          location?: string | null
          name?: string
          public_view_enabled?: boolean
          registration_close_date?: string | null
          registration_enabled?: boolean | null
          registration_fee?: number | null
          registration_open_date?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["tournament_status"]
          updated_at?: string
          waitlist_enabled?: boolean | null
        }
        Relationships: []
      }
      tournaments_matches: {
        Row: {
          actual_duration_minutes: number | null
          completed_at: string | null
          court_id: string | null
          created_at: string
          division_id: string
          id: string
          match_number: number
          notes: string | null
          round_number: number
          scheduled_time: string | null
          score_edited_at: string | null
          score_edited_by: string | null
          started_at: string | null
          status: string
          team1_id: string
          team1_score: number | null
          team2_id: string
          team2_score: number | null
          updated_at: string
        }
        Insert: {
          actual_duration_minutes?: number | null
          completed_at?: string | null
          court_id?: string | null
          created_at?: string
          division_id: string
          id?: string
          match_number: number
          notes?: string | null
          round_number: number
          scheduled_time?: string | null
          score_edited_at?: string | null
          score_edited_by?: string | null
          started_at?: string | null
          status?: string
          team1_id: string
          team1_score?: number | null
          team2_id: string
          team2_score?: number | null
          updated_at?: string
        }
        Update: {
          actual_duration_minutes?: number | null
          completed_at?: string | null
          court_id?: string | null
          created_at?: string
          division_id?: string
          id?: string
          match_number?: number
          notes?: string | null
          round_number?: number
          scheduled_time?: string | null
          score_edited_at?: string | null
          score_edited_by?: string | null
          started_at?: string | null
          status?: string
          team1_id?: string
          team1_score?: number | null
          team2_id?: string
          team2_score?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournaments_matches_court_id_fkey"
            columns: ["court_id"]
            isOneToOne: false
            referencedRelation: "tournaments_courts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournaments_matches_division_id_fkey"
            columns: ["division_id"]
            isOneToOne: false
            referencedRelation: "tournaments_divisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournaments_matches_team1_id_fkey"
            columns: ["team1_id"]
            isOneToOne: false
            referencedRelation: "tournaments_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournaments_matches_team2_id_fkey"
            columns: ["team2_id"]
            isOneToOne: false
            referencedRelation: "tournaments_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      tournaments_scoring_rulesets: {
        Row: {
          best_of: number
          created_at: string
          description: string | null
          games_to: number
          id: string
          name: string
          win_by_2: boolean
        }
        Insert: {
          best_of?: number
          created_at?: string
          description?: string | null
          games_to?: number
          id?: string
          name: string
          win_by_2?: boolean
        }
        Update: {
          best_of?: number
          created_at?: string
          description?: string | null
          games_to?: number
          id?: string
          name?: string
          win_by_2?: boolean
        }
        Relationships: []
      }
      tournaments_teams: {
        Row: {
          created_at: string
          division_id: string
          id: string
          player1_id: string | null
          player2_id: string | null
          seed_number: number | null
          team_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          division_id: string
          id?: string
          player1_id?: string | null
          player2_id?: string | null
          seed_number?: number | null
          team_name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          division_id?: string
          id?: string
          player1_id?: string | null
          player2_id?: string | null
          seed_number?: number | null
          team_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournaments_teams_division_id_fkey"
            columns: ["division_id"]
            isOneToOne: false
            referencedRelation: "tournaments_divisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournaments_teams_player1_id_fkey"
            columns: ["player1_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournaments_teams_player1_id_fkey"
            columns: ["player1_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournaments_teams_player2_id_fkey"
            columns: ["player2_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournaments_teams_player2_id_fkey"
            columns: ["player2_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
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
      user_court_prefs: {
        Row: {
          court_id: string
          created_at: string
          hidden_until: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          court_id: string
          created_at?: string
          hidden_until?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          court_id?: string
          created_at?: string
          hidden_until?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_court_prefs_court_id_fkey"
            columns: ["court_id"]
            isOneToOne: false
            referencedRelation: "courts"
            referencedColumns: ["id"]
          },
        ]
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
      profiles_public: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          current_rating: number | null
          display_name: string | null
          first_name: string | null
          full_name: string | null
          handedness: string | null
          home_court_id: string | null
          id: string | null
          last_name: string | null
          losses: number | null
          paddle_brand: string | null
          paddle_model: string | null
          play_side: string | null
          total_matches: number | null
          wins: number | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          current_rating?: number | null
          display_name?: string | null
          first_name?: string | null
          full_name?: string | null
          handedness?: string | null
          home_court_id?: string | null
          id?: string | null
          last_name?: string | null
          losses?: number | null
          paddle_brand?: string | null
          paddle_model?: string | null
          play_side?: string | null
          total_matches?: number | null
          wins?: number | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          current_rating?: number | null
          display_name?: string | null
          first_name?: string | null
          full_name?: string | null
          handedness?: string | null
          home_court_id?: string | null
          id?: string | null
          last_name?: string | null
          losses?: number | null
          paddle_brand?: string | null
          paddle_model?: string | null
          play_side?: string | null
          total_matches?: number | null
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
      cleanup_expired_mfa_codes: { Args: never; Returns: undefined }
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
      insert_mfa_code: {
        Args: {
          p_code: string
          p_expires_at: string
          p_method: string
          p_user_id: string
        }
        Returns: string
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
      verify_and_use_mfa_code: {
        Args: { p_code: string; p_method: string; p_user_id: string }
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
      division_status: "draft" | "active" | "completed"
      payment_status: "unpaid" | "paid" | "refunded"
      rating_type: "ladder" | "league" | "playoffs" | "casual"
      registration_status: "pending" | "confirmed" | "waitlisted" | "cancelled"
      round_robin_status: "draft" | "live" | "completed"
      tournament_status:
        | "draft"
        | "upcoming"
        | "live"
        | "completed"
        | "cancelled"
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
      division_status: ["draft", "active", "completed"],
      payment_status: ["unpaid", "paid", "refunded"],
      rating_type: ["ladder", "league", "playoffs", "casual"],
      registration_status: ["pending", "confirmed", "waitlisted", "cancelled"],
      round_robin_status: ["draft", "live", "completed"],
      tournament_status: [
        "draft",
        "upcoming",
        "live",
        "completed",
        "cancelled",
      ],
    },
  },
} as const
