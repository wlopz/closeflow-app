export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          avatar_url: string | null
          role: 'sales_rep' | 'manager' | 'admin'
          subscription_tier: 'starter' | 'professional' | 'team'
          team_id: string | null
          onboarding_completed: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          avatar_url?: string | null
          role?: 'sales_rep' | 'manager' | 'admin'
          subscription_tier?: 'starter' | 'professional' | 'team'
          team_id?: string | null
          onboarding_completed?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          avatar_url?: string | null
          role?: 'sales_rep' | 'manager' | 'admin'
          subscription_tier?: 'starter' | 'professional' | 'team'
          team_id?: string | null
          onboarding_completed?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      teams: {
        Row: {
          id: string
          name: string
          description: string | null
          owner_id: string
          subscription_tier: 'team' | 'enterprise'
          max_members: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          owner_id: string
          subscription_tier?: 'team' | 'enterprise'
          max_members?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          owner_id?: string
          subscription_tier?: 'team' | 'enterprise'
          max_members?: number
          created_at?: string
          updated_at?: string
        }
      }
      sales_templates: {
        Row: {
          id: string
          user_id: string
          team_id: string | null
          name: string
          description: string | null
          style: 'heart-to-heart' | 'consultative' | 'challenging' | 'direct' | 'inspirational'
          content: Json
          is_public: boolean
          usage_count: number
          success_rate: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          team_id?: string | null
          name: string
          description?: string | null
          style: 'heart-to-heart' | 'consultative' | 'challenging' | 'direct' | 'inspirational'
          content?: Json
          is_public?: boolean
          usage_count?: number
          success_rate?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          team_id?: string | null
          name?: string
          description?: string | null
          style?: 'heart-to-heart' | 'consultative' | 'challenging' | 'direct' | 'inspirational'
          content?: Json
          is_public?: boolean
          usage_count?: number
          success_rate?: number
          created_at?: string
          updated_at?: string
        }
      }
      calls: {
        Row: {
          id: string
          user_id: string
          customer_name: string | null
          customer_company: string | null
          template_id: string | null
          status: 'active' | 'completed' | 'cancelled'
          outcome: 'closed' | 'pending' | 'lost' | 'no_show' | null
          start_time: string
          end_time: string | null
          duration_seconds: number | null
          recording_url: string | null
          transcript_url: string | null
          notes: string | null
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          customer_name?: string | null
          customer_company?: string | null
          template_id?: string | null
          status?: 'active' | 'completed' | 'cancelled'
          outcome?: 'closed' | 'pending' | 'lost' | 'no_show' | null
          start_time?: string
          end_time?: string | null
          duration_seconds?: number | null
          recording_url?: string | null
          transcript_url?: string | null
          notes?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          customer_name?: string | null
          customer_company?: string | null
          template_id?: string | null
          status?: 'active' | 'completed' | 'cancelled'
          outcome?: 'closed' | 'pending' | 'lost' | 'no_show' | null
          start_time?: string
          end_time?: string | null
          duration_seconds?: number | null
          recording_url?: string | null
          transcript_url?: string | null
          notes?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
      }
      call_transcripts: {
        Row: {
          id: string
          call_id: string
          speaker_id: number
          speaker_name: string | null
          content: string
          timestamp_offset: number
          confidence: number | null
          is_final: boolean
          created_at: string
        }
        Insert: {
          id?: string
          call_id: string
          speaker_id: number
          speaker_name?: string | null
          content: string
          timestamp_offset?: number
          confidence?: number | null
          is_final?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          call_id?: string
          speaker_id?: number
          speaker_name?: string | null
          content?: string
          timestamp_offset?: number
          confidence?: number | null
          is_final?: boolean
          created_at?: string
        }
      }
      ai_insights: {
        Row: {
          id: string
          call_id: string
          transcript_id: string | null
          type: 'objection' | 'opportunity' | 'buying-signal' | 'warning' | 'good-move' | 'next-step'
          content: string
          confidence: number | null
          was_helpful: boolean | null
          user_feedback: string | null
          timestamp_offset: number
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          call_id: string
          transcript_id?: string | null
          type: 'objection' | 'opportunity' | 'buying-signal' | 'warning' | 'good-move' | 'next-step'
          content: string
          confidence?: number | null
          was_helpful?: boolean | null
          user_feedback?: string | null
          timestamp_offset?: number
          metadata?: Json
          created_at?: string
        }
        Update: {
          id?: string
          call_id?: string
          transcript_id?: string | null
          type?: 'objection' | 'opportunity' | 'buying-signal' | 'warning' | 'good-move' | 'next-step'
          content?: string
          confidence?: number | null
          was_helpful?: boolean | null
          user_feedback?: string | null
          timestamp_offset?: number
          metadata?: Json
          created_at?: string
        }
      }
      practice_sessions: {
        Row: {
          id: string
          user_id: string
          template_id: string | null
          scenario_type: string
          scenario_description: string | null
          duration_seconds: number | null
          score: number | null
          feedback: Json
          completed_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          template_id?: string | null
          scenario_type: string
          scenario_description?: string | null
          duration_seconds?: number | null
          score?: number | null
          feedback?: Json
          completed_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          template_id?: string | null
          scenario_type?: string
          scenario_description?: string | null
          duration_seconds?: number | null
          score?: number | null
          feedback?: Json
          completed_at?: string | null
          created_at?: string
        }
      }
      user_analytics: {
        Row: {
          id: string
          user_id: string
          period_start: string
          period_end: string
          total_calls: number
          completed_calls: number
          close_rate: number
          avg_call_duration: number
          total_practice_sessions: number
          avg_practice_score: number
          insights_generated: number
          insights_helpful: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          period_start: string
          period_end: string
          total_calls?: number
          completed_calls?: number
          close_rate?: number
          avg_call_duration?: number
          total_practice_sessions?: number
          avg_practice_score?: number
          insights_generated?: number
          insights_helpful?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          period_start?: string
          period_end?: string
          total_calls?: number
          completed_calls?: number
          close_rate?: number
          avg_call_duration?: number
          total_practice_sessions?: number
          avg_practice_score?: number
          insights_generated?: number
          insights_helpful?: number
          created_at?: string
          updated_at?: string
        }
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