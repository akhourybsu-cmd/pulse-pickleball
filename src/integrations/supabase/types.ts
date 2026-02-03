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
      admin_audit_log: {
        Row: {
          action: string
          admin_user_id: string
          created_at: string
          details: Json | null
          id: string
          ip_address: string | null
          resource_id: string | null
          resource_type: string
          user_agent: string | null
        }
        Insert: {
          action: string
          admin_user_id: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          resource_id?: string | null
          resource_type: string
          user_agent?: string | null
        }
        Update: {
          action?: string
          admin_user_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          resource_id?: string | null
          resource_type?: string
          user_agent?: string | null
        }
        Relationships: []
      }
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
      biometric_analytics: {
        Row: {
          created_at: string
          device_info: Json | null
          error_type: string | null
          event_type: string
          id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          device_info?: Json | null
          error_type?: string | null
          event_type: string
          id?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          device_info?: Json | null
          error_type?: string | null
          event_type?: string
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      biometric_credentials: {
        Row: {
          created_at: string
          credential_id: string
          device_name: string
          id: string
          last_used_at: string | null
          public_key: string
          user_id: string
        }
        Insert: {
          created_at?: string
          credential_id: string
          device_name: string
          id?: string
          last_used_at?: string | null
          public_key: string
          user_id: string
        }
        Update: {
          created_at?: string
          credential_id?: string
          device_name?: string
          id?: string
          last_used_at?: string | null
          public_key?: string
          user_id?: string
        }
        Relationships: []
      }
      calendar_event_registrations: {
        Row: {
          created_at: string
          event_id: string
          id: string
          registered_at: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          registered_at?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          registered_at?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_event_registrations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          capacity: number | null
          court_number: number
          created_at: string | null
          current_registrations: number | null
          description: string | null
          end_time: string
          event_type: string
          facility_id: string
          id: string
          instructor: string | null
          price: number | null
          rental_status: string | null
          series_id: string | null
          skill_level: string | null
          start_time: string
          title: string
          updated_at: string | null
        }
        Insert: {
          capacity?: number | null
          court_number: number
          created_at?: string | null
          current_registrations?: number | null
          description?: string | null
          end_time: string
          event_type: string
          facility_id: string
          id?: string
          instructor?: string | null
          price?: number | null
          rental_status?: string | null
          series_id?: string | null
          skill_level?: string | null
          start_time: string
          title: string
          updated_at?: string | null
        }
        Update: {
          capacity?: number | null
          court_number?: number
          created_at?: string | null
          current_registrations?: number | null
          description?: string | null
          end_time?: string
          event_type?: string
          facility_id?: string
          id?: string
          instructor?: string | null
          price?: number | null
          rental_status?: string | null
          series_id?: string | null
          skill_level?: string | null
          start_time?: string
          title?: string
          updated_at?: string | null
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
      conversation_participants: {
        Row: {
          conversation_id: string
          id: string
          joined_at: string
          last_read_at: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          id?: string
          joined_at?: string
          last_read_at?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          id?: string
          joined_at?: string
          last_read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
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
          expires_at: string | null
          id: string
          last_activity_at: string | null
          lfg_format: string | null
          lfg_skill_max: number | null
          lfg_skill_min: number | null
          max_players: number | null
          pinned: boolean | null
          session_date: string | null
          session_time: string | null
          status: string
          title: string
          type: string | null
          updated_at: string
          user_id: string
          viewed_participants_count: number | null
        }
        Insert: {
          content: string
          court_id: string
          created_at?: string
          expires_at?: string | null
          id?: string
          last_activity_at?: string | null
          lfg_format?: string | null
          lfg_skill_max?: number | null
          lfg_skill_min?: number | null
          max_players?: number | null
          pinned?: boolean | null
          session_date?: string | null
          session_time?: string | null
          status?: string
          title: string
          type?: string | null
          updated_at?: string
          user_id: string
          viewed_participants_count?: number | null
        }
        Update: {
          content?: string
          court_id?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          last_activity_at?: string | null
          lfg_format?: string | null
          lfg_skill_max?: number | null
          lfg_skill_min?: number | null
          max_players?: number | null
          pinned?: boolean | null
          session_date?: string | null
          session_time?: string | null
          status?: string
          title?: string
          type?: string | null
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
      direct_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          sender_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          sender_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "direct_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      event_instruction: {
        Row: {
          coach_id: string | null
          created_at: string | null
          equipment_provided: boolean | null
          event_id: string
          focus_areas: string[] | null
          id: string
          instructor_id: string | null
          instructor_name: string | null
          updated_at: string | null
        }
        Insert: {
          coach_id?: string | null
          created_at?: string | null
          equipment_provided?: boolean | null
          event_id: string
          focus_areas?: string[] | null
          id?: string
          instructor_id?: string | null
          instructor_name?: string | null
          updated_at?: string | null
        }
        Update: {
          coach_id?: string | null
          created_at?: string | null
          equipment_provided?: boolean | null
          event_id?: string
          focus_areas?: string[] | null
          id?: string
          instructor_id?: string | null
          instructor_name?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_instruction_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "venue_coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_instruction_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "unified_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_instruction_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "v_browse_events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_registrations: {
        Row: {
          auto_expired: boolean | null
          cancelled_at: string | null
          checked_in_at: string | null
          confirmed_at: string | null
          event_id: string
          id: string
          notes: string | null
          promoted_at: string | null
          promotion_deadline: string | null
          promotion_notified_at: string | null
          registered_at: string | null
          status: string
          team_id: string | null
          team_role: string | null
          user_id: string
          waitlist_position: number | null
        }
        Insert: {
          auto_expired?: boolean | null
          cancelled_at?: string | null
          checked_in_at?: string | null
          confirmed_at?: string | null
          event_id: string
          id?: string
          notes?: string | null
          promoted_at?: string | null
          promotion_deadline?: string | null
          promotion_notified_at?: string | null
          registered_at?: string | null
          status?: string
          team_id?: string | null
          team_role?: string | null
          user_id: string
          waitlist_position?: number | null
        }
        Update: {
          auto_expired?: boolean | null
          cancelled_at?: string | null
          checked_in_at?: string | null
          confirmed_at?: string | null
          event_id?: string
          id?: string
          notes?: string | null
          promoted_at?: string | null
          promotion_deadline?: string | null
          promotion_notified_at?: string | null
          registered_at?: string | null
          status?: string
          team_id?: string | null
          team_role?: string | null
          user_id?: string
          waitlist_position?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "event_registrations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "unified_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_registrations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "v_browse_events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_reminders_sent: {
        Row: {
          event_id: string
          event_type: string
          id: string
          sent_at: string
          user_id: string
        }
        Insert: {
          event_id: string
          event_type: string
          id?: string
          sent_at?: string
          user_id: string
        }
        Update: {
          event_id?: string
          event_type?: string
          id?: string
          sent_at?: string
          user_id?: string
        }
        Relationships: []
      }
      event_round_robin: {
        Row: {
          completed_at: string | null
          created_at: string | null
          current_round: number | null
          event_id: string
          format: string | null
          games_per_player: number | null
          id: string
          num_courts: number
          num_rounds: number | null
          registration_deadline: string | null
          registration_mode: string | null
          updated_at: string | null
          void_reason: string | null
          voided: boolean | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          current_round?: number | null
          event_id: string
          format?: string | null
          games_per_player?: number | null
          id?: string
          num_courts?: number
          num_rounds?: number | null
          registration_deadline?: string | null
          registration_mode?: string | null
          updated_at?: string | null
          void_reason?: string | null
          voided?: boolean | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          current_round?: number | null
          event_id?: string
          format?: string | null
          games_per_player?: number | null
          id?: string
          num_courts?: number
          num_rounds?: number | null
          registration_deadline?: string | null
          registration_mode?: string | null
          updated_at?: string | null
          void_reason?: string | null
          voided?: boolean | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_round_robin_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "unified_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_round_robin_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "v_browse_events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_tournament: {
        Row: {
          created_at: string | null
          divisions_count: number | null
          event_id: string
          id: string
          payment_status: string | null
          public_view_enabled: boolean | null
          registration_close_date: string | null
          registration_enabled: boolean | null
          registration_fee: number | null
          registration_open_date: string | null
          stripe_checkout_session_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          divisions_count?: number | null
          event_id: string
          id?: string
          payment_status?: string | null
          public_view_enabled?: boolean | null
          registration_close_date?: string | null
          registration_enabled?: boolean | null
          registration_fee?: number | null
          registration_open_date?: string | null
          stripe_checkout_session_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          divisions_count?: number | null
          event_id?: string
          id?: string
          payment_status?: string | null
          public_view_enabled?: boolean | null
          registration_close_date?: string | null
          registration_enabled?: boolean | null
          registration_fee?: number | null
          registration_open_date?: string | null
          stripe_checkout_session_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_tournament_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "unified_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_tournament_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "v_browse_events"
            referencedColumns: ["id"]
          },
        ]
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
      feature_entitlements: {
        Row: {
          created_at: string
          enabled: boolean
          feature_key: string
          id: string
          limit_value: number | null
          tier: Database["public"]["Enums"]["subscription_tier"]
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          feature_key: string
          id?: string
          limit_value?: number | null
          tier: Database["public"]["Enums"]["subscription_tier"]
        }
        Update: {
          created_at?: string
          enabled?: boolean
          feature_key?: string
          id?: string
          limit_value?: number | null
          tier?: Database["public"]["Enums"]["subscription_tier"]
        }
        Relationships: []
      }
      financial_transactions: {
        Row: {
          amount_cents: number
          created_at: string | null
          created_by: string | null
          currency: string | null
          event_id: string | null
          failure_reason: string | null
          id: string
          metadata: Json | null
          notes: string | null
          registration_id: string | null
          status: string
          stripe_payment_intent_id: string | null
          stripe_payout_id: string | null
          stripe_refund_id: string | null
          stripe_transfer_id: string | null
          transaction_type: string
          updated_at: string | null
          user_id: string | null
          venue_id: string | null
        }
        Insert: {
          amount_cents: number
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          event_id?: string | null
          failure_reason?: string | null
          id?: string
          metadata?: Json | null
          notes?: string | null
          registration_id?: string | null
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_payout_id?: string | null
          stripe_refund_id?: string | null
          stripe_transfer_id?: string | null
          transaction_type: string
          updated_at?: string | null
          user_id?: string | null
          venue_id?: string | null
        }
        Update: {
          amount_cents?: number
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          event_id?: string | null
          failure_reason?: string | null
          id?: string
          metadata?: Json | null
          notes?: string | null
          registration_id?: string | null
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_payout_id?: string | null
          stripe_refund_id?: string | null
          stripe_transfer_id?: string | null
          transaction_type?: string
          updated_at?: string | null
          user_id?: string | null
          venue_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "financial_transactions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "unified_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "v_browse_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      friendships: {
        Row: {
          accepted_at: string | null
          created_at: string
          friend_id: string
          id: string
          status: string
          user_id: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          friend_id: string
          id?: string
          status?: string
          user_id: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          friend_id?: string
          id?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      group_event_rsvps: {
        Row: {
          created_at: string | null
          event_id: string
          id: string
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          event_id: string
          id?: string
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          event_id?: string
          id?: string
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_event_rsvps_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "group_events"
            referencedColumns: ["id"]
          },
        ]
      }
      group_events: {
        Row: {
          capacity: number | null
          court_id: string | null
          created_at: string | null
          created_by: string
          custom_location: string | null
          description: string | null
          end_time: string | null
          group_id: string
          id: string
          is_recurring: boolean | null
          location_type: string | null
          recurring_rule: string | null
          skill_level_max: number | null
          skill_level_min: number | null
          start_time: string
          title: string
          updated_at: string | null
          venue_id: string | null
        }
        Insert: {
          capacity?: number | null
          court_id?: string | null
          created_at?: string | null
          created_by: string
          custom_location?: string | null
          description?: string | null
          end_time?: string | null
          group_id: string
          id?: string
          is_recurring?: boolean | null
          location_type?: string | null
          recurring_rule?: string | null
          skill_level_max?: number | null
          skill_level_min?: number | null
          start_time: string
          title: string
          updated_at?: string | null
          venue_id?: string | null
        }
        Update: {
          capacity?: number | null
          court_id?: string | null
          created_at?: string | null
          created_by?: string
          custom_location?: string | null
          description?: string | null
          end_time?: string | null
          group_id?: string
          id?: string
          is_recurring?: boolean | null
          location_type?: string | null
          recurring_rule?: string | null
          skill_level_max?: number | null
          skill_level_min?: number | null
          start_time?: string
          title?: string
          updated_at?: string | null
          venue_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "group_events_court_id_fkey"
            columns: ["court_id"]
            isOneToOne: false
            referencedRelation: "courts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_events_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_events_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      group_files: {
        Row: {
          created_at: string | null
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          group_id: string
          id: string
          uploader_id: string
        }
        Insert: {
          created_at?: string | null
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          group_id: string
          id?: string
          uploader_id: string
        }
        Update: {
          created_at?: string | null
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          group_id?: string
          id?: string
          uploader_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_files_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_invites: {
        Row: {
          created_at: string | null
          created_by: string
          expires_at: string | null
          group_id: string
          id: string
          invite_code: string | null
          uses_remaining: number | null
        }
        Insert: {
          created_at?: string | null
          created_by: string
          expires_at?: string | null
          group_id: string
          id?: string
          invite_code?: string | null
          uses_remaining?: number | null
        }
        Update: {
          created_at?: string | null
          created_by?: string
          expires_at?: string | null
          group_id?: string
          id?: string
          invite_code?: string | null
          uses_remaining?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "group_invites_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_members: {
        Row: {
          display_order: number | null
          group_id: string
          id: string
          joined_at: string | null
          last_read_at: string | null
          role: Database["public"]["Enums"]["group_role"]
          status: string
          user_id: string
        }
        Insert: {
          display_order?: number | null
          group_id: string
          id?: string
          joined_at?: string | null
          last_read_at?: string | null
          role?: Database["public"]["Enums"]["group_role"]
          status?: string
          user_id: string
        }
        Update: {
          display_order?: number | null
          group_id?: string
          id?: string
          joined_at?: string | null
          last_read_at?: string | null
          role?: Database["public"]["Enums"]["group_role"]
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_messages: {
        Row: {
          content: string
          created_at: string | null
          group_id: string
          id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          group_id: string
          id?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          group_id?: string
          id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_messages_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_post_comments: {
        Row: {
          content: string
          created_at: string | null
          id: string
          parent_comment_id: string | null
          post_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          parent_comment_id?: string | null
          post_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          parent_comment_id?: string | null
          post_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_post_comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "group_post_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "group_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      group_post_participants: {
        Row: {
          created_at: string | null
          id: string
          post_id: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          post_id: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          post_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_post_participants_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "group_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      group_post_reactions: {
        Row: {
          created_at: string | null
          emoji: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          emoji: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          emoji?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_post_reactions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "group_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      group_posts: {
        Row: {
          content: string | null
          created_at: string | null
          group_id: string
          id: string
          image_url: string | null
          last_activity_at: string | null
          max_players: number | null
          pinned: boolean | null
          poll_options: Json | null
          session_date: string | null
          session_time: string | null
          title: string | null
          type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          group_id: string
          id?: string
          image_url?: string | null
          last_activity_at?: string | null
          max_players?: number | null
          pinned?: boolean | null
          poll_options?: Json | null
          session_date?: string | null
          session_time?: string | null
          title?: string | null
          type?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string | null
          created_at?: string | null
          group_id?: string
          id?: string
          image_url?: string | null
          last_activity_at?: string | null
          max_players?: number | null
          pinned?: boolean | null
          poll_options?: Json | null
          session_date?: string | null
          session_time?: string | null
          title?: string | null
          type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_posts_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          court_id: string | null
          cover_url: string | null
          created_at: string | null
          created_by: string
          description: string | null
          icon_url: string | null
          id: string
          invite_code: string | null
          is_venue_verified: boolean | null
          join_method: Database["public"]["Enums"]["group_join_method"]
          member_count: number | null
          name: string
          settings: Json | null
          type: Database["public"]["Enums"]["group_type"]
          updated_at: string | null
          venue_id: string | null
          visibility: Database["public"]["Enums"]["group_visibility"]
        }
        Insert: {
          court_id?: string | null
          cover_url?: string | null
          created_at?: string | null
          created_by: string
          description?: string | null
          icon_url?: string | null
          id?: string
          invite_code?: string | null
          is_venue_verified?: boolean | null
          join_method?: Database["public"]["Enums"]["group_join_method"]
          member_count?: number | null
          name: string
          settings?: Json | null
          type?: Database["public"]["Enums"]["group_type"]
          updated_at?: string | null
          venue_id?: string | null
          visibility?: Database["public"]["Enums"]["group_visibility"]
        }
        Update: {
          court_id?: string | null
          cover_url?: string | null
          created_at?: string | null
          created_by?: string
          description?: string | null
          icon_url?: string | null
          id?: string
          invite_code?: string | null
          is_venue_verified?: boolean | null
          join_method?: Database["public"]["Enums"]["group_join_method"]
          member_count?: number | null
          name?: string
          settings?: Json | null
          type?: Database["public"]["Enums"]["group_type"]
          updated_at?: string | null
          venue_id?: string | null
          visibility?: Database["public"]["Enums"]["group_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "groups_court_id_fkey"
            columns: ["court_id"]
            isOneToOne: false
            referencedRelation: "courts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "groups_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_match_players: {
        Row: {
          created_at: string | null
          display_name: string
          id: string
          match_id: string
          notes: string | null
          team: number
        }
        Insert: {
          created_at?: string | null
          display_name: string
          id?: string
          match_id: string
          notes?: string | null
          team: number
        }
        Update: {
          created_at?: string | null
          display_name?: string
          id?: string
          match_id?: string
          notes?: string | null
          team?: number
        }
        Relationships: [
          {
            foreignKeyName: "guest_match_players_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
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
          guest_player_id: string | null
          id: string
          match_id: string
          player_id: string | null
          rating_after: number | null
          rating_before: number | null
          rating_change: number | null
          team: number
        }
        Insert: {
          created_at?: string | null
          guest_player_id?: string | null
          id?: string
          match_id: string
          player_id?: string | null
          rating_after?: number | null
          rating_before?: number | null
          rating_change?: number | null
          team: number
        }
        Update: {
          created_at?: string | null
          guest_player_id?: string | null
          id?: string
          match_id?: string
          player_id?: string | null
          rating_after?: number | null
          rating_before?: number | null
          rating_change?: number | null
          team?: number
        }
        Relationships: [
          {
            foreignKeyName: "match_participants_guest_player_id_fkey"
            columns: ["guest_player_id"]
            isOneToOne: false
            referencedRelation: "guest_match_players"
            referencedColumns: ["id"]
          },
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
          match_format: string | null
          match_type: string | null
          other_location: string | null
          rating_eligible: boolean | null
          round_no: number | null
          round_number: string | null
          source: string | null
          status: string | null
          team1_score: number
          team2_score: number
          updated_at: string | null
          verification_status: string | null
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
          match_format?: string | null
          match_type?: string | null
          other_location?: string | null
          rating_eligible?: boolean | null
          round_no?: number | null
          round_number?: string | null
          source?: string | null
          status?: string | null
          team1_score: number
          team2_score: number
          updated_at?: string | null
          verification_status?: string | null
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
          match_format?: string | null
          match_type?: string | null
          other_location?: string | null
          rating_eligible?: boolean | null
          round_no?: number | null
          round_number?: string | null
          source?: string | null
          status?: string | null
          team1_score?: number
          team2_score?: number
          updated_at?: string | null
          verification_status?: string | null
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
      notification_preferences: {
        Row: {
          category: string
          created_at: string
          email_enabled: boolean
          id: string
          in_app_enabled: boolean
          push_enabled: boolean
          quiet_hours_end: string | null
          quiet_hours_start: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          category: string
          created_at?: string
          email_enabled?: boolean
          id?: string
          in_app_enabled?: boolean
          push_enabled?: boolean
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          email_enabled?: boolean
          id?: string
          in_app_enabled?: boolean
          push_enabled?: boolean
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          updated_at?: string
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
      player_favorite_venues: {
        Row: {
          created_at: string
          id: string
          user_id: string
          venue_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_id: string
          venue_id: string
        }
        Update: {
          created_at?: string
          id?: string
          user_id?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_favorite_venues_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          accessibility_needs: string | null
          avatar_url: string | null
          avg_opponent_rating: number | null
          biometric_enabled: boolean | null
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
          is_test_account: boolean | null
          last_name: string | null
          last_rating_update: string | null
          location_public: boolean | null
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
          player_state: Database["public"]["Enums"]["player_state"] | null
          pronouns: string | null
          shirt_size: string | null
          skill_level_self: string | null
          state: string | null
          total_matches: number | null
          total_points_against: number | null
          total_points_for: number | null
          town: string | null
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
          biometric_enabled?: boolean | null
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
          is_test_account?: boolean | null
          last_name?: string | null
          last_rating_update?: string | null
          location_public?: boolean | null
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
          player_state?: Database["public"]["Enums"]["player_state"] | null
          pronouns?: string | null
          shirt_size?: string | null
          skill_level_self?: string | null
          state?: string | null
          total_matches?: number | null
          total_points_against?: number | null
          total_points_for?: number | null
          town?: string | null
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
          biometric_enabled?: boolean | null
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
          is_test_account?: boolean | null
          last_name?: string | null
          last_rating_update?: string | null
          location_public?: boolean | null
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
          player_state?: Database["public"]["Enums"]["player_state"] | null
          pronouns?: string | null
          shirt_size?: string | null
          skill_level_self?: string | null
          state?: string | null
          total_matches?: number | null
          total_points_against?: number | null
          total_points_for?: number | null
          town?: string | null
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
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      queue_entries: {
        Row: {
          box_number: number | null
          games_played: number | null
          id: string
          joined_at: string | null
          player_id: string
          priority: number | null
          session_id: string
          status: string
        }
        Insert: {
          box_number?: number | null
          games_played?: number | null
          id?: string
          joined_at?: string | null
          player_id: string
          priority?: number | null
          session_id: string
          status?: string
        }
        Update: {
          box_number?: number | null
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
          format: string
          games_per_player: number | null
          id: string
          is_published: boolean | null
          location: string | null
          max_players: number | null
          name: string
          notes: string | null
          num_courts: number
          num_rounds: number
          organizer_id: string
          rating_eligible: boolean
          rating_type: Database["public"]["Enums"]["rating_type"]
          registration_deadline: string | null
          registration_mode: string | null
          start_time: string | null
          status: Database["public"]["Enums"]["round_robin_status"]
          updated_at: string
          venue_id: string | null
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
          format?: string
          games_per_player?: number | null
          id?: string
          is_published?: boolean | null
          location?: string | null
          max_players?: number | null
          name: string
          notes?: string | null
          num_courts: number
          num_rounds: number
          organizer_id: string
          rating_eligible?: boolean
          rating_type?: Database["public"]["Enums"]["rating_type"]
          registration_deadline?: string | null
          registration_mode?: string | null
          start_time?: string | null
          status?: Database["public"]["Enums"]["round_robin_status"]
          updated_at?: string
          venue_id?: string | null
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
          format?: string
          games_per_player?: number | null
          id?: string
          is_published?: boolean | null
          location?: string | null
          max_players?: number | null
          name?: string
          notes?: string | null
          num_courts?: number
          num_rounds?: number
          organizer_id?: string
          rating_eligible?: boolean
          rating_type?: Database["public"]["Enums"]["rating_type"]
          registration_deadline?: string | null
          registration_mode?: string | null
          start_time?: string | null
          status?: Database["public"]["Enums"]["round_robin_status"]
          updated_at?: string
          venue_id?: string | null
          void_reason?: string | null
          voided?: boolean | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "round_robin_events_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      round_robin_players: {
        Row: {
          active: boolean
          bye_count: number
          event_id: string
          id: string
          joined_at: string
          player_id: string
          registration_status: string | null
        }
        Insert: {
          active?: boolean
          bye_count?: number
          event_id: string
          id?: string
          joined_at?: string
          player_id: string
          registration_status?: string | null
        }
        Update: {
          active?: boolean
          bye_count?: number
          event_id?: string
          id?: string
          joined_at?: string
          player_id?: string
          registration_status?: string | null
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
          qr_join_url: string | null
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
          qr_join_url?: string | null
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
          qr_join_url?: string | null
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
      tournament_event_settings: {
        Row: {
          age_determination_date: string | null
          allow_player_score_entry: boolean | null
          allow_same_format_multiple: boolean | null
          auto_email_court_assignment: boolean | null
          auto_email_on_payment: boolean | null
          auto_email_on_register: boolean | null
          check_in_window_hours: number | null
          court_transition_minutes: number | null
          created_at: string | null
          default_match_duration: number | null
          event_id: string | null
          id: string
          max_events_per_day: number | null
          max_events_per_player: number | null
          require_emergency_contact: boolean | null
          require_full_address: boolean | null
          require_match_ready_confirm: boolean | null
          require_partner_account: boolean | null
          score_auto_confirm_minutes: number | null
          sms_enabled: boolean | null
          updated_at: string | null
        }
        Insert: {
          age_determination_date?: string | null
          allow_player_score_entry?: boolean | null
          allow_same_format_multiple?: boolean | null
          auto_email_court_assignment?: boolean | null
          auto_email_on_payment?: boolean | null
          auto_email_on_register?: boolean | null
          check_in_window_hours?: number | null
          court_transition_minutes?: number | null
          created_at?: string | null
          default_match_duration?: number | null
          event_id?: string | null
          id?: string
          max_events_per_day?: number | null
          max_events_per_player?: number | null
          require_emergency_contact?: boolean | null
          require_full_address?: boolean | null
          require_match_ready_confirm?: boolean | null
          require_partner_account?: boolean | null
          score_auto_confirm_minutes?: number | null
          sms_enabled?: boolean | null
          updated_at?: string | null
        }
        Update: {
          age_determination_date?: string | null
          allow_player_score_entry?: boolean | null
          allow_same_format_multiple?: boolean | null
          auto_email_court_assignment?: boolean | null
          auto_email_on_payment?: boolean | null
          auto_email_on_register?: boolean | null
          check_in_window_hours?: number | null
          court_transition_minutes?: number | null
          created_at?: string | null
          default_match_duration?: number | null
          event_id?: string | null
          id?: string
          max_events_per_day?: number | null
          max_events_per_player?: number | null
          require_emergency_contact?: boolean | null
          require_full_address?: boolean | null
          require_match_ready_confirm?: boolean | null
          require_partner_account?: boolean | null
          score_auto_confirm_minutes?: number | null
          sms_enabled?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tournament_event_settings_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "tournaments_events"
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
          check_in_notes: string | null
          checked_in_at: string | null
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
          check_in_notes?: string | null
          checked_in_at?: string | null
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
          check_in_notes?: string | null
          checked_in_at?: string | null
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
          age_group: string | null
          age_max: number | null
          age_min: number | null
          created_at: string
          description: string | null
          early_bird_deadline: string | null
          early_bird_fee: number | null
          estimated_match_duration: number | null
          event_id: string
          format: string
          gender: string | null
          id: string
          max_teams: number | null
          min_teams: number | null
          name: string
          play_type: string | null
          registration_fee: number | null
          scheduled_day: number | null
          scheduled_start_time: string | null
          scoring_ruleset_id: string | null
          skill_level_max: number | null
          skill_level_min: number | null
          status: Database["public"]["Enums"]["division_status"]
          updated_at: string
        }
        Insert: {
          age_group?: string | null
          age_max?: number | null
          age_min?: number | null
          created_at?: string
          description?: string | null
          early_bird_deadline?: string | null
          early_bird_fee?: number | null
          estimated_match_duration?: number | null
          event_id: string
          format?: string
          gender?: string | null
          id?: string
          max_teams?: number | null
          min_teams?: number | null
          name: string
          play_type?: string | null
          registration_fee?: number | null
          scheduled_day?: number | null
          scheduled_start_time?: string | null
          scoring_ruleset_id?: string | null
          skill_level_max?: number | null
          skill_level_min?: number | null
          status?: Database["public"]["Enums"]["division_status"]
          updated_at?: string
        }
        Update: {
          age_group?: string | null
          age_max?: number | null
          age_min?: number | null
          created_at?: string
          description?: string | null
          early_bird_deadline?: string | null
          early_bird_fee?: number | null
          estimated_match_duration?: number | null
          event_id?: string
          format?: string
          gender?: string | null
          id?: string
          max_teams?: number | null
          min_teams?: number | null
          name?: string
          play_type?: string | null
          registration_fee?: number | null
          scheduled_day?: number | null
          scheduled_start_time?: string | null
          scoring_ruleset_id?: string | null
          skill_level_max?: number | null
          skill_level_min?: number | null
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
          divisions_count: number | null
          end_date: string
          external_registration_url: string | null
          id: string
          is_public: boolean | null
          location: string | null
          name: string
          paid_at: string | null
          paid_divisions_count: number | null
          payment_status: string | null
          public_view_enabled: boolean
          registration_close_date: string | null
          registration_enabled: boolean | null
          registration_fee: number | null
          registration_open_date: string | null
          slug: string | null
          start_date: string
          status: Database["public"]["Enums"]["tournament_status"]
          stripe_checkout_session_id: string | null
          updated_at: string
          venue_id: string | null
          visibility:
            | Database["public"]["Enums"]["tournament_visibility"]
            | null
          waitlist_enabled: boolean | null
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          divisions_count?: number | null
          end_date: string
          external_registration_url?: string | null
          id?: string
          is_public?: boolean | null
          location?: string | null
          name: string
          paid_at?: string | null
          paid_divisions_count?: number | null
          payment_status?: string | null
          public_view_enabled?: boolean
          registration_close_date?: string | null
          registration_enabled?: boolean | null
          registration_fee?: number | null
          registration_open_date?: string | null
          slug?: string | null
          start_date: string
          status?: Database["public"]["Enums"]["tournament_status"]
          stripe_checkout_session_id?: string | null
          updated_at?: string
          venue_id?: string | null
          visibility?:
            | Database["public"]["Enums"]["tournament_visibility"]
            | null
          waitlist_enabled?: boolean | null
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          divisions_count?: number | null
          end_date?: string
          external_registration_url?: string | null
          id?: string
          is_public?: boolean | null
          location?: string | null
          name?: string
          paid_at?: string | null
          paid_divisions_count?: number | null
          payment_status?: string | null
          public_view_enabled?: boolean
          registration_close_date?: string | null
          registration_enabled?: boolean | null
          registration_fee?: number | null
          registration_open_date?: string | null
          slug?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["tournament_status"]
          stripe_checkout_session_id?: string | null
          updated_at?: string
          venue_id?: string | null
          visibility?:
            | Database["public"]["Enums"]["tournament_visibility"]
            | null
          waitlist_enabled?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "tournaments_events_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      tournaments_matches: {
        Row: {
          actual_duration_minutes: number | null
          auto_confirmed: boolean | null
          completed_at: string | null
          court_id: string | null
          created_at: string
          dispute_notes: string | null
          dispute_resolved_at: string | null
          dispute_resolved_by: string | null
          disputed: boolean | null
          division_id: string
          forfeit_reason: string | null
          forfeit_team_id: string | null
          id: string
          match_number: number
          notes: string | null
          opponent_confirmed: boolean | null
          opponent_confirmed_at: string | null
          player_score_submitted_at: string | null
          player_score_submitted_by: string | null
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
          auto_confirmed?: boolean | null
          completed_at?: string | null
          court_id?: string | null
          created_at?: string
          dispute_notes?: string | null
          dispute_resolved_at?: string | null
          dispute_resolved_by?: string | null
          disputed?: boolean | null
          division_id: string
          forfeit_reason?: string | null
          forfeit_team_id?: string | null
          id?: string
          match_number: number
          notes?: string | null
          opponent_confirmed?: boolean | null
          opponent_confirmed_at?: string | null
          player_score_submitted_at?: string | null
          player_score_submitted_by?: string | null
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
          auto_confirmed?: boolean | null
          completed_at?: string | null
          court_id?: string | null
          created_at?: string
          dispute_notes?: string | null
          dispute_resolved_at?: string | null
          dispute_resolved_by?: string | null
          disputed?: boolean | null
          division_id?: string
          forfeit_reason?: string | null
          forfeit_team_id?: string | null
          id?: string
          match_number?: number
          notes?: string | null
          opponent_confirmed?: boolean | null
          opponent_confirmed_at?: string | null
          player_score_submitted_at?: string | null
          player_score_submitted_by?: string | null
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
            foreignKeyName: "tournaments_matches_forfeit_team_id_fkey"
            columns: ["forfeit_team_id"]
            isOneToOne: false
            referencedRelation: "tournaments_teams"
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
          seed_locked: boolean | null
          seed_number: number | null
          seed_source: string | null
          team_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          division_id: string
          id?: string
          player1_id?: string | null
          player2_id?: string | null
          seed_locked?: boolean | null
          seed_number?: number | null
          seed_source?: string | null
          team_name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          division_id?: string
          id?: string
          player1_id?: string | null
          player2_id?: string | null
          seed_locked?: boolean | null
          seed_number?: number | null
          seed_source?: string | null
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
      unified_events: {
        Row: {
          court_id: string | null
          created_at: string | null
          created_by: string
          current_participants: number | null
          description: string | null
          end_time: string | null
          event_type: string
          host_court_id: string | null
          host_group_id: string | null
          host_type: string
          host_user_id: string | null
          host_venue_id: string | null
          id: string
          is_published: boolean | null
          is_recurring: boolean | null
          legacy_id: string | null
          legacy_table: string | null
          location_address: string | null
          location_name: string | null
          location_type: string | null
          max_participants: number | null
          notes: string | null
          price: number | null
          price_label: string | null
          rating_eligible: boolean | null
          rating_type: string | null
          recurrence_rule: string | null
          series_id: string | null
          skill_level: string | null
          skill_level_max: number | null
          skill_level_min: number | null
          start_time: string
          status: string | null
          timezone: string | null
          title: string
          updated_at: string | null
          venue_id: string | null
          visibility: string | null
          waitlist_enabled: boolean | null
          waitlist_max: number | null
        }
        Insert: {
          court_id?: string | null
          created_at?: string | null
          created_by: string
          current_participants?: number | null
          description?: string | null
          end_time?: string | null
          event_type: string
          host_court_id?: string | null
          host_group_id?: string | null
          host_type: string
          host_user_id?: string | null
          host_venue_id?: string | null
          id?: string
          is_published?: boolean | null
          is_recurring?: boolean | null
          legacy_id?: string | null
          legacy_table?: string | null
          location_address?: string | null
          location_name?: string | null
          location_type?: string | null
          max_participants?: number | null
          notes?: string | null
          price?: number | null
          price_label?: string | null
          rating_eligible?: boolean | null
          rating_type?: string | null
          recurrence_rule?: string | null
          series_id?: string | null
          skill_level?: string | null
          skill_level_max?: number | null
          skill_level_min?: number | null
          start_time: string
          status?: string | null
          timezone?: string | null
          title: string
          updated_at?: string | null
          venue_id?: string | null
          visibility?: string | null
          waitlist_enabled?: boolean | null
          waitlist_max?: number | null
        }
        Update: {
          court_id?: string | null
          created_at?: string | null
          created_by?: string
          current_participants?: number | null
          description?: string | null
          end_time?: string | null
          event_type?: string
          host_court_id?: string | null
          host_group_id?: string | null
          host_type?: string
          host_user_id?: string | null
          host_venue_id?: string | null
          id?: string
          is_published?: boolean | null
          is_recurring?: boolean | null
          legacy_id?: string | null
          legacy_table?: string | null
          location_address?: string | null
          location_name?: string | null
          location_type?: string | null
          max_participants?: number | null
          notes?: string | null
          price?: number | null
          price_label?: string | null
          rating_eligible?: boolean | null
          rating_type?: string | null
          recurrence_rule?: string | null
          series_id?: string | null
          skill_level?: string | null
          skill_level_max?: number | null
          skill_level_min?: number | null
          start_time?: string
          status?: string | null
          timezone?: string | null
          title?: string
          updated_at?: string | null
          venue_id?: string | null
          visibility?: string | null
          waitlist_enabled?: boolean | null
          waitlist_max?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "unified_events_court_id_fkey"
            columns: ["court_id"]
            isOneToOne: false
            referencedRelation: "courts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unified_events_host_court_id_fkey"
            columns: ["host_court_id"]
            isOneToOne: false
            referencedRelation: "courts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unified_events_host_group_id_fkey"
            columns: ["host_group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unified_events_host_venue_id_fkey"
            columns: ["host_venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unified_events_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
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
      user_notifications: {
        Row: {
          actor_id: string | null
          category: string | null
          created_at: string
          event_id: string | null
          event_type: string | null
          expires_at: string | null
          id: string
          link: string | null
          message: string
          metadata: Json | null
          notification_type: string
          priority: string | null
          read: boolean
          title: string
          user_id: string
        }
        Insert: {
          actor_id?: string | null
          category?: string | null
          created_at?: string
          event_id?: string | null
          event_type?: string | null
          expires_at?: string | null
          id?: string
          link?: string | null
          message: string
          metadata?: Json | null
          notification_type: string
          priority?: string | null
          read?: boolean
          title: string
          user_id: string
        }
        Update: {
          actor_id?: string | null
          category?: string | null
          created_at?: string
          event_id?: string | null
          event_type?: string | null
          expires_at?: string | null
          id?: string
          link?: string | null
          message?: string
          metadata?: Json | null
          notification_type?: string
          priority?: string | null
          read?: boolean
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_notifications_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_notifications_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      user_recent_locations: {
        Row: {
          city: string | null
          created_at: string | null
          id: string
          name: string
          state: string | null
          use_count: number | null
          used_at: string | null
          user_id: string
        }
        Insert: {
          city?: string | null
          created_at?: string | null
          id?: string
          name: string
          state?: string | null
          use_count?: number | null
          used_at?: string | null
          user_id: string
        }
        Update: {
          city?: string | null
          created_at?: string | null
          id?: string
          name?: string
          state?: string | null
          use_count?: number | null
          used_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_recent_locations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_recent_locations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
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
      venue_announcements: {
        Row: {
          channels: string[] | null
          created_at: string | null
          created_by: string
          id: string
          message: string
          recipient_count: number | null
          scheduled_for: string | null
          sent_at: string | null
          target_audience: string | null
          title: string
          updated_at: string | null
          venue_id: string
        }
        Insert: {
          channels?: string[] | null
          created_at?: string | null
          created_by: string
          id?: string
          message: string
          recipient_count?: number | null
          scheduled_for?: string | null
          sent_at?: string | null
          target_audience?: string | null
          title: string
          updated_at?: string | null
          venue_id: string
        }
        Update: {
          channels?: string[] | null
          created_at?: string | null
          created_by?: string
          id?: string
          message?: string
          recipient_count?: number | null
          scheduled_for?: string | null
          sent_at?: string | null
          target_audience?: string | null
          title?: string
          updated_at?: string | null
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venue_announcements_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_bookings: {
        Row: {
          court_id: string
          created_at: string
          customer_email: string | null
          customer_name: string
          customer_phone: string | null
          end_time: string
          id: string
          notes: string | null
          start_time: string
          status: string
          total_price: number | null
          updated_at: string
          user_id: string | null
          venue_id: string
        }
        Insert: {
          court_id: string
          created_at?: string
          customer_email?: string | null
          customer_name: string
          customer_phone?: string | null
          end_time: string
          id?: string
          notes?: string | null
          start_time: string
          status?: string
          total_price?: number | null
          updated_at?: string
          user_id?: string | null
          venue_id: string
        }
        Update: {
          court_id?: string
          created_at?: string
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string | null
          end_time?: string
          id?: string
          notes?: string | null
          start_time?: string
          status?: string
          total_price?: number | null
          updated_at?: string
          user_id?: string | null
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venue_bookings_court_id_fkey"
            columns: ["court_id"]
            isOneToOne: false
            referencedRelation: "venue_courts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venue_bookings_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_coaches: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          email: string | null
          hourly_rate: number | null
          id: string
          is_active: boolean | null
          name: string
          phone: string | null
          specialties: string[] | null
          updated_at: string
          user_id: string | null
          venue_id: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          email?: string | null
          hourly_rate?: number | null
          id?: string
          is_active?: boolean | null
          name: string
          phone?: string | null
          specialties?: string[] | null
          updated_at?: string
          user_id?: string | null
          venue_id: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          email?: string | null
          hourly_rate?: number | null
          id?: string
          is_active?: boolean | null
          name?: string
          phone?: string | null
          specialties?: string[] | null
          updated_at?: string
          user_id?: string | null
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venue_coaches_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_courts: {
        Row: {
          court_number: number
          court_type: string | null
          created_at: string | null
          hourly_rate: number | null
          id: string
          is_active: boolean | null
          is_premium: boolean | null
          linked_court_id: string | null
          name: string
          notes: string | null
          premium_fee: number | null
          surface_type: string | null
          updated_at: string | null
          venue_id: string
        }
        Insert: {
          court_number: number
          court_type?: string | null
          created_at?: string | null
          hourly_rate?: number | null
          id?: string
          is_active?: boolean | null
          is_premium?: boolean | null
          linked_court_id?: string | null
          name: string
          notes?: string | null
          premium_fee?: number | null
          surface_type?: string | null
          updated_at?: string | null
          venue_id: string
        }
        Update: {
          court_number?: number
          court_type?: string | null
          created_at?: string | null
          hourly_rate?: number | null
          id?: string
          is_active?: boolean | null
          is_premium?: boolean | null
          linked_court_id?: string | null
          name?: string
          notes?: string | null
          premium_fee?: number | null
          surface_type?: string | null
          updated_at?: string | null
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venue_courts_linked_court_id_fkey"
            columns: ["linked_court_id"]
            isOneToOne: false
            referencedRelation: "courts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venue_courts_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_event_registrations: {
        Row: {
          cancelled_at: string | null
          created_at: string
          event_id: string
          id: string
          notes: string | null
          registered_at: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cancelled_at?: string | null
          created_at?: string
          event_id: string
          id?: string
          notes?: string | null
          registered_at?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cancelled_at?: string | null
          created_at?: string
          event_id?: string
          id?: string
          notes?: string | null
          registered_at?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venue_event_registrations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "venue_events"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_events: {
        Row: {
          created_at: string
          created_by: string | null
          current_participants: number | null
          description: string | null
          end_time: string
          event_type: string
          id: string
          is_published: boolean | null
          max_participants: number | null
          price: number | null
          round_robin_event_id: string | null
          skill_level: string | null
          start_time: string
          title: string
          updated_at: string
          venue_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          current_participants?: number | null
          description?: string | null
          end_time: string
          event_type?: string
          id?: string
          is_published?: boolean | null
          max_participants?: number | null
          price?: number | null
          round_robin_event_id?: string | null
          skill_level?: string | null
          start_time: string
          title: string
          updated_at?: string
          venue_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          current_participants?: number | null
          description?: string | null
          end_time?: string
          event_type?: string
          id?: string
          is_published?: boolean | null
          max_participants?: number | null
          price?: number | null
          round_robin_event_id?: string | null
          skill_level?: string | null
          start_time?: string
          title?: string
          updated_at?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venue_events_round_robin_event_id_fkey"
            columns: ["round_robin_event_id"]
            isOneToOne: false
            referencedRelation: "round_robin_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venue_events_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_facility_details: {
        Row: {
          amenity_food_nearby: boolean | null
          amenity_parking: boolean | null
          amenity_pro_shop: boolean | null
          amenity_restrooms: boolean | null
          amenity_seating: boolean | null
          amenity_water: boolean | null
          beginner_friendly: boolean | null
          climate_controlled: boolean | null
          court_count: number | null
          has_lighting: boolean | null
          location_type:
            | Database["public"]["Enums"]["court_location_type"]
            | null
          offers_open_play: boolean | null
          open_play_notes: string | null
          programs_notes: string | null
          surface_type: Database["public"]["Enums"]["court_surface_type"] | null
          updated_at: string | null
          venue_id: string
        }
        Insert: {
          amenity_food_nearby?: boolean | null
          amenity_parking?: boolean | null
          amenity_pro_shop?: boolean | null
          amenity_restrooms?: boolean | null
          amenity_seating?: boolean | null
          amenity_water?: boolean | null
          beginner_friendly?: boolean | null
          climate_controlled?: boolean | null
          court_count?: number | null
          has_lighting?: boolean | null
          location_type?:
            | Database["public"]["Enums"]["court_location_type"]
            | null
          offers_open_play?: boolean | null
          open_play_notes?: string | null
          programs_notes?: string | null
          surface_type?:
            | Database["public"]["Enums"]["court_surface_type"]
            | null
          updated_at?: string | null
          venue_id: string
        }
        Update: {
          amenity_food_nearby?: boolean | null
          amenity_parking?: boolean | null
          amenity_pro_shop?: boolean | null
          amenity_restrooms?: boolean | null
          amenity_seating?: boolean | null
          amenity_water?: boolean | null
          beginner_friendly?: boolean | null
          climate_controlled?: boolean | null
          court_count?: number | null
          has_lighting?: boolean | null
          location_type?:
            | Database["public"]["Enums"]["court_location_type"]
            | null
          offers_open_play?: boolean | null
          open_play_notes?: string | null
          programs_notes?: string | null
          surface_type?:
            | Database["public"]["Enums"]["court_surface_type"]
            | null
          updated_at?: string | null
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venue_facility_details_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: true
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_followers: {
        Row: {
          followed_at: string | null
          id: string
          notify_announcements: boolean | null
          notify_new_events: boolean | null
          notify_schedule_changes: boolean | null
          user_id: string
          venue_id: string
        }
        Insert: {
          followed_at?: string | null
          id?: string
          notify_announcements?: boolean | null
          notify_new_events?: boolean | null
          notify_schedule_changes?: boolean | null
          user_id: string
          venue_id: string
        }
        Update: {
          followed_at?: string | null
          id?: string
          notify_announcements?: boolean | null
          notify_new_events?: boolean | null
          notify_schedule_changes?: boolean | null
          user_id?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venue_followers_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_inquiries: {
        Row: {
          city: string | null
          contact_name: string
          converted_venue_id: string | null
          court_count: string | null
          created_at: string
          current_booking_method: string | null
          current_setup: string | null
          email: string
          event_volume: string | null
          facility_type: string | null
          id: string
          intent: string | null
          message: string | null
          phone: string | null
          primary_goals: string[] | null
          referral_source: string | null
          state: string | null
          status: string
          timeline: string | null
          updated_at: string
          venue_name: string
          venue_type: string | null
        }
        Insert: {
          city?: string | null
          contact_name: string
          converted_venue_id?: string | null
          court_count?: string | null
          created_at?: string
          current_booking_method?: string | null
          current_setup?: string | null
          email: string
          event_volume?: string | null
          facility_type?: string | null
          id?: string
          intent?: string | null
          message?: string | null
          phone?: string | null
          primary_goals?: string[] | null
          referral_source?: string | null
          state?: string | null
          status?: string
          timeline?: string | null
          updated_at?: string
          venue_name: string
          venue_type?: string | null
        }
        Update: {
          city?: string | null
          contact_name?: string
          converted_venue_id?: string | null
          court_count?: string | null
          created_at?: string
          current_booking_method?: string | null
          current_setup?: string | null
          email?: string
          event_volume?: string | null
          facility_type?: string | null
          id?: string
          intent?: string | null
          message?: string | null
          phone?: string | null
          primary_goals?: string[] | null
          referral_source?: string | null
          state?: string | null
          status?: string
          timeline?: string | null
          updated_at?: string
          venue_name?: string
          venue_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "venue_inquiries_converted_venue_id_fkey"
            columns: ["converted_venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_lessons: {
        Row: {
          coach_id: string
          court_id: string | null
          created_at: string
          current_students: number | null
          description: string | null
          end_time: string
          id: string
          lesson_type: string
          max_students: number | null
          price: number | null
          start_time: string
          status: string
          title: string
          updated_at: string
          venue_id: string
        }
        Insert: {
          coach_id: string
          court_id?: string | null
          created_at?: string
          current_students?: number | null
          description?: string | null
          end_time: string
          id?: string
          lesson_type?: string
          max_students?: number | null
          price?: number | null
          start_time: string
          status?: string
          title: string
          updated_at?: string
          venue_id: string
        }
        Update: {
          coach_id?: string
          court_id?: string | null
          created_at?: string
          current_students?: number | null
          description?: string | null
          end_time?: string
          id?: string
          lesson_type?: string
          max_students?: number | null
          price?: number | null
          start_time?: string
          status?: string
          title?: string
          updated_at?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venue_lessons_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "venue_coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venue_lessons_court_id_fkey"
            columns: ["court_id"]
            isOneToOne: false
            referencedRelation: "venue_courts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venue_lessons_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_media: {
        Row: {
          caption: string | null
          created_at: string | null
          id: string
          media_type: string | null
          media_url: string
          sort_order: number | null
          venue_id: string
        }
        Insert: {
          caption?: string | null
          created_at?: string | null
          id?: string
          media_type?: string | null
          media_url: string
          sort_order?: number | null
          venue_id: string
        }
        Update: {
          caption?: string | null
          created_at?: string | null
          id?: string
          media_type?: string | null
          media_url?: string
          sort_order?: number | null
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venue_media_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_payments: {
        Row: {
          amount_platform_fee: number
          amount_total: number
          amount_venue: number
          booking_id: string | null
          created_at: string
          currency: string
          customer_email: string | null
          customer_name: string | null
          id: string
          metadata: Json | null
          status: string
          stripe_payment_intent_id: string
          stripe_transfer_id: string | null
          updated_at: string
          venue_id: string
        }
        Insert: {
          amount_platform_fee?: number
          amount_total: number
          amount_venue: number
          booking_id?: string | null
          created_at?: string
          currency?: string
          customer_email?: string | null
          customer_name?: string | null
          id?: string
          metadata?: Json | null
          status?: string
          stripe_payment_intent_id: string
          stripe_transfer_id?: string | null
          updated_at?: string
          venue_id: string
        }
        Update: {
          amount_platform_fee?: number
          amount_total?: number
          amount_venue?: number
          booking_id?: string | null
          created_at?: string
          currency?: string
          customer_email?: string | null
          customer_name?: string | null
          id?: string
          metadata?: Json | null
          status?: string
          stripe_payment_intent_id?: string
          stripe_transfer_id?: string | null
          updated_at?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venue_payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "venue_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venue_payments_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_settings: {
        Row: {
          allow_player_posts: boolean | null
          event_sort_mode: string | null
          featured_event_id: string | null
          show_amenities: boolean | null
          show_facility_details: boolean | null
          show_gallery: boolean | null
          updated_at: string | null
          venue_id: string
        }
        Insert: {
          allow_player_posts?: boolean | null
          event_sort_mode?: string | null
          featured_event_id?: string | null
          show_amenities?: boolean | null
          show_facility_details?: boolean | null
          show_gallery?: boolean | null
          updated_at?: string | null
          venue_id: string
        }
        Update: {
          allow_player_posts?: boolean | null
          event_sort_mode?: string | null
          featured_event_id?: string | null
          show_amenities?: boolean | null
          show_facility_details?: boolean | null
          show_gallery?: boolean | null
          updated_at?: string | null
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venue_settings_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: true
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_staff: {
        Row: {
          accepted_at: string | null
          created_at: string
          id: string
          invited_at: string | null
          invited_by: string | null
          is_active: boolean | null
          role: Database["public"]["Enums"]["venue_role"]
          status: Database["public"]["Enums"]["membership_status"] | null
          updated_at: string
          user_id: string
          venue_id: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          is_active?: boolean | null
          role?: Database["public"]["Enums"]["venue_role"]
          status?: Database["public"]["Enums"]["membership_status"] | null
          updated_at?: string
          user_id: string
          venue_id: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          is_active?: boolean | null
          role?: Database["public"]["Enums"]["venue_role"]
          status?: Database["public"]["Enums"]["membership_status"] | null
          updated_at?: string
          user_id?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venue_staff_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          tier: Database["public"]["Enums"]["subscription_tier"]
          updated_at: string
          venue_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tier?: Database["public"]["Enums"]["subscription_tier"]
          updated_at?: string
          venue_id: string
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tier?: Database["public"]["Enums"]["subscription_tier"]
          updated_at?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venue_subscriptions_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: true
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      venues: {
        Row: {
          activation_state:
            | Database["public"]["Enums"]["venue_activation_state"]
            | null
          address: string | null
          address_line1: string | null
          address_line2: string | null
          allow_follow: boolean | null
          amenities: string[] | null
          banner_url: string | null
          city: string | null
          country: string | null
          cover_focal_point:
            | Database["public"]["Enums"]["cover_focal_point"]
            | null
          cover_image_url: string | null
          created_at: string
          cta_primary_label: string | null
          cta_secondary_label: string | null
          description: string | null
          email: string | null
          facebook_url: string | null
          has_player_profile: boolean | null
          hours_of_operation: Json | null
          id: string
          instagram_url: string | null
          is_active: boolean | null
          is_published: boolean | null
          is_searchable: boolean | null
          logo_shape: Database["public"]["Enums"]["venue_logo_shape"] | null
          logo_url: string | null
          name: string
          onboarding_completed: boolean | null
          onboarding_step: string | null
          owner_id: string | null
          phone: string | null
          platform_fee_percent: number | null
          primary_color: string | null
          secondary_color: string | null
          show_pulse_branding: boolean | null
          slug: string | null
          social_facebook: string | null
          social_instagram: string | null
          state: string | null
          status: Database["public"]["Enums"]["venue_status"] | null
          stripe_account_id: string | null
          stripe_charges_enabled: boolean | null
          stripe_onboarding_complete: boolean | null
          stripe_payouts_enabled: boolean | null
          tagline: string | null
          tiktok_url: string | null
          timezone: string | null
          updated_at: string
          venue_type: Database["public"]["Enums"]["venue_type"] | null
          verification_approved_at: string | null
          verification_approved_by: string | null
          verification_notes: string | null
          verification_requested_at: string | null
          visibility: Database["public"]["Enums"]["venue_visibility"] | null
          website: string | null
          website_url: string | null
          welcome_headline: string | null
          welcome_message: string | null
          x_url: string | null
          zip_code: string | null
        }
        Insert: {
          activation_state?:
            | Database["public"]["Enums"]["venue_activation_state"]
            | null
          address?: string | null
          address_line1?: string | null
          address_line2?: string | null
          allow_follow?: boolean | null
          amenities?: string[] | null
          banner_url?: string | null
          city?: string | null
          country?: string | null
          cover_focal_point?:
            | Database["public"]["Enums"]["cover_focal_point"]
            | null
          cover_image_url?: string | null
          created_at?: string
          cta_primary_label?: string | null
          cta_secondary_label?: string | null
          description?: string | null
          email?: string | null
          facebook_url?: string | null
          has_player_profile?: boolean | null
          hours_of_operation?: Json | null
          id?: string
          instagram_url?: string | null
          is_active?: boolean | null
          is_published?: boolean | null
          is_searchable?: boolean | null
          logo_shape?: Database["public"]["Enums"]["venue_logo_shape"] | null
          logo_url?: string | null
          name: string
          onboarding_completed?: boolean | null
          onboarding_step?: string | null
          owner_id?: string | null
          phone?: string | null
          platform_fee_percent?: number | null
          primary_color?: string | null
          secondary_color?: string | null
          show_pulse_branding?: boolean | null
          slug?: string | null
          social_facebook?: string | null
          social_instagram?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["venue_status"] | null
          stripe_account_id?: string | null
          stripe_charges_enabled?: boolean | null
          stripe_onboarding_complete?: boolean | null
          stripe_payouts_enabled?: boolean | null
          tagline?: string | null
          tiktok_url?: string | null
          timezone?: string | null
          updated_at?: string
          venue_type?: Database["public"]["Enums"]["venue_type"] | null
          verification_approved_at?: string | null
          verification_approved_by?: string | null
          verification_notes?: string | null
          verification_requested_at?: string | null
          visibility?: Database["public"]["Enums"]["venue_visibility"] | null
          website?: string | null
          website_url?: string | null
          welcome_headline?: string | null
          welcome_message?: string | null
          x_url?: string | null
          zip_code?: string | null
        }
        Update: {
          activation_state?:
            | Database["public"]["Enums"]["venue_activation_state"]
            | null
          address?: string | null
          address_line1?: string | null
          address_line2?: string | null
          allow_follow?: boolean | null
          amenities?: string[] | null
          banner_url?: string | null
          city?: string | null
          country?: string | null
          cover_focal_point?:
            | Database["public"]["Enums"]["cover_focal_point"]
            | null
          cover_image_url?: string | null
          created_at?: string
          cta_primary_label?: string | null
          cta_secondary_label?: string | null
          description?: string | null
          email?: string | null
          facebook_url?: string | null
          has_player_profile?: boolean | null
          hours_of_operation?: Json | null
          id?: string
          instagram_url?: string | null
          is_active?: boolean | null
          is_published?: boolean | null
          is_searchable?: boolean | null
          logo_shape?: Database["public"]["Enums"]["venue_logo_shape"] | null
          logo_url?: string | null
          name?: string
          onboarding_completed?: boolean | null
          onboarding_step?: string | null
          owner_id?: string | null
          phone?: string | null
          platform_fee_percent?: number | null
          primary_color?: string | null
          secondary_color?: string | null
          show_pulse_branding?: boolean | null
          slug?: string | null
          social_facebook?: string | null
          social_instagram?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["venue_status"] | null
          stripe_account_id?: string | null
          stripe_charges_enabled?: boolean | null
          stripe_onboarding_complete?: boolean | null
          stripe_payouts_enabled?: boolean | null
          tagline?: string | null
          tiktok_url?: string | null
          timezone?: string | null
          updated_at?: string
          venue_type?: Database["public"]["Enums"]["venue_type"] | null
          verification_approved_at?: string | null
          verification_approved_by?: string | null
          verification_notes?: string | null
          verification_requested_at?: string | null
          visibility?: Database["public"]["Enums"]["venue_visibility"] | null
          website?: string | null
          website_url?: string | null
          welcome_headline?: string | null
          welcome_message?: string | null
          x_url?: string | null
          zip_code?: string | null
        }
        Relationships: []
      }
      waitlist_settings: {
        Row: {
          auto_promote: boolean | null
          charge_on_promotion: boolean | null
          created_at: string | null
          event_id: string
          id: string
          notify_on_promotion: boolean | null
          promotion_window_hours: number | null
          updated_at: string | null
        }
        Insert: {
          auto_promote?: boolean | null
          charge_on_promotion?: boolean | null
          created_at?: string | null
          event_id: string
          id?: string
          notify_on_promotion?: boolean | null
          promotion_window_hours?: number | null
          updated_at?: string | null
        }
        Update: {
          auto_promote?: boolean | null
          charge_on_promotion?: boolean | null
          created_at?: string | null
          event_id?: string
          id?: string
          notify_on_promotion?: boolean | null
          promotion_window_hours?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "waitlist_settings_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "unified_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_settings_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "v_browse_events"
            referencedColumns: ["id"]
          },
        ]
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
      v_browse_events: {
        Row: {
          confirmed_count: number | null
          court_id: string | null
          created_at: string | null
          current_participants: number | null
          description: string | null
          display_location: string | null
          end_time: string | null
          event_type: string | null
          host_court_id: string | null
          host_group_id: string | null
          host_name: string | null
          host_type: string | null
          host_user_id: string | null
          host_venue_id: string | null
          id: string | null
          is_published: boolean | null
          location_address: string | null
          location_name: string | null
          location_type: string | null
          max_participants: number | null
          price: number | null
          price_label: string | null
          rating_eligible: boolean | null
          skill_level: string | null
          start_time: string | null
          status: string | null
          timezone: string | null
          title: string | null
          venue_id: string | null
          visibility: string | null
          waitlist_count: number | null
          waitlist_enabled: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "unified_events_court_id_fkey"
            columns: ["court_id"]
            isOneToOne: false
            referencedRelation: "courts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unified_events_host_court_id_fkey"
            columns: ["host_court_id"]
            isOneToOne: false
            referencedRelation: "courts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unified_events_host_group_id_fkey"
            columns: ["host_group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unified_events_host_venue_id_fkey"
            columns: ["host_venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unified_events_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      assign_players_to_courts: {
        Args: { p_session_id: string }
        Returns: undefined
      }
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
      create_notification: {
        Args: {
          p_actor_id?: string
          p_category: string
          p_expires_at?: string
          p_link?: string
          p_message: string
          p_metadata?: Json
          p_notification_type: string
          p_priority?: string
          p_title: string
          p_user_id: string
        }
        Returns: string
      }
      delete_old_court_posts: { Args: never; Returns: undefined }
      delete_round_robin_event: {
        Args: { p_event_id: string }
        Returns: undefined
      }
      export_user_data: { Args: never; Returns: Json }
      freeze_week_ratings: {
        Args: { target_week_start: string }
        Returns: undefined
      }
      generate_group_invite_code: { Args: never; Returns: string }
      get_emergency_contact: {
        Args: { profile_id: string }
        Returns: {
          contact_name: string
          contact_phone: string
        }[]
      }
      get_or_create_dm_conversation: {
        Args: { other_user_id: string }
        Returns: string
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
      get_user_venues: {
        Args: { _user_id: string }
        Returns: {
          role: Database["public"]["Enums"]["venue_role"]
          venue_id: string
          venue_name: string
        }[]
      }
      get_venue_follower_count: {
        Args: { p_venue_id: string }
        Returns: number
      }
      get_week_start: { Args: { match_date: string }; Returns: string }
      has_group_role: {
        Args: {
          _group_id: string
          _role: Database["public"]["Enums"]["group_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_venue_access: {
        Args: { _user_id: string; _venue_id: string }
        Returns: boolean
      }
      has_venue_role: {
        Args: {
          _role: Database["public"]["Enums"]["venue_role"]
          _user_id: string
          _venue_id: string
        }
        Returns: boolean
      }
      has_venue_tournament_role: {
        Args: { _user_id: string; _venue_id: string }
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
      is_group_admin: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      is_group_member: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      log_admin_action: {
        Args: {
          p_action: string
          p_details?: Json
          p_resource_id?: string
          p_resource_type: string
        }
        Returns: string
      }
      promote_from_waitlist: { Args: { p_event_id: string }; Returns: string }
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
          match_format: string | null
          match_type: string | null
          other_location: string | null
          rating_eligible: boolean | null
          round_no: number | null
          round_number: string | null
          source: string | null
          status: string | null
          team1_score: number
          team2_score: number
          updated_at: string | null
          verification_status: string | null
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
      court_location_type: "indoor" | "outdoor" | "mixed"
      court_surface_type: "hard" | "wood" | "sport_court" | "clay" | "other"
      cover_focal_point: "top" | "center"
      division_status: "draft" | "active" | "completed"
      group_join_method: "open" | "request_to_join" | "invite_only"
      group_role: "owner" | "moderator" | "member"
      group_type:
        | "crew"
        | "league"
        | "open_play"
        | "venue_official"
        | "tournament"
      group_visibility: "public" | "unlisted" | "private"
      match_source:
        | "manual"
        | "round_robin"
        | "tournament"
        | "league"
        | "import"
      membership_status: "active" | "invited" | "pending"
      payment_status: "unpaid" | "paid" | "refunded"
      player_state: "onboarding" | "active" | "inactive"
      rating_type: "ladder" | "league" | "playoffs" | "casual"
      registration_status: "pending" | "confirmed" | "waitlisted" | "cancelled"
      round_robin_status: "draft" | "live" | "completed"
      subscription_tier: "free" | "plus" | "pro" | "enterprise"
      tournament_status:
        | "draft"
        | "upcoming"
        | "live"
        | "completed"
        | "cancelled"
      tournament_visibility: "public" | "unlisted" | "private"
      venue_activation_state:
        | "claimed"
        | "pending_verification"
        | "pending"
        | "active"
        | "suspended"
      venue_logo_shape: "circle" | "square"
      venue_role: "owner" | "manager" | "staff" | "organizer"
      venue_status: "draft" | "published"
      venue_type:
        | "recreation_center"
        | "private_club"
        | "public_courts"
        | "tournament_organizer"
        | "other"
      venue_visibility: "public" | "unlisted"
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
      court_location_type: ["indoor", "outdoor", "mixed"],
      court_surface_type: ["hard", "wood", "sport_court", "clay", "other"],
      cover_focal_point: ["top", "center"],
      division_status: ["draft", "active", "completed"],
      group_join_method: ["open", "request_to_join", "invite_only"],
      group_role: ["owner", "moderator", "member"],
      group_type: [
        "crew",
        "league",
        "open_play",
        "venue_official",
        "tournament",
      ],
      group_visibility: ["public", "unlisted", "private"],
      match_source: ["manual", "round_robin", "tournament", "league", "import"],
      membership_status: ["active", "invited", "pending"],
      payment_status: ["unpaid", "paid", "refunded"],
      player_state: ["onboarding", "active", "inactive"],
      rating_type: ["ladder", "league", "playoffs", "casual"],
      registration_status: ["pending", "confirmed", "waitlisted", "cancelled"],
      round_robin_status: ["draft", "live", "completed"],
      subscription_tier: ["free", "plus", "pro", "enterprise"],
      tournament_status: [
        "draft",
        "upcoming",
        "live",
        "completed",
        "cancelled",
      ],
      tournament_visibility: ["public", "unlisted", "private"],
      venue_activation_state: [
        "claimed",
        "pending_verification",
        "pending",
        "active",
        "suspended",
      ],
      venue_logo_shape: ["circle", "square"],
      venue_role: ["owner", "manager", "staff", "organizer"],
      venue_status: ["draft", "published"],
      venue_type: [
        "recreation_center",
        "private_club",
        "public_courts",
        "tournament_organizer",
        "other",
      ],
      venue_visibility: ["public", "unlisted"],
    },
  },
} as const
