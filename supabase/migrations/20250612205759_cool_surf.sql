/*
  # Initial CloseFlow Database Schema

  1. New Tables
    - `profiles` - User profile information extending Supabase auth
    - `calls` - Call session records with metadata
    - `call_transcripts` - Real-time transcript segments
    - `ai_insights` - AI coaching insights generated during calls
    - `sales_templates` - Customizable sales approach templates
    - `practice_sessions` - Practice mode session records
    - `team_members` - Team management for organizations

  2. Security
    - Enable RLS on all tables
    - Add policies for user data access
    - Secure team-based access controls

  3. Features
    - Real-time subscriptions for live call data
    - Analytics aggregation support
    - Template sharing capabilities
*/

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  full_name text,
  avatar_url text,
  role text DEFAULT 'sales_rep' CHECK (role IN ('sales_rep', 'manager', 'admin')),
  subscription_tier text DEFAULT 'starter' CHECK (subscription_tier IN ('starter', 'professional', 'team')),
  team_id uuid,
  onboarding_completed boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Teams table
CREATE TABLE IF NOT EXISTS teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  owner_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  subscription_tier text DEFAULT 'team' CHECK (subscription_tier IN ('team', 'enterprise')),
  max_members integer DEFAULT 5,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Sales templates table
CREATE TABLE IF NOT EXISTS sales_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  team_id uuid REFERENCES teams(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  style text NOT NULL CHECK (style IN ('heart-to-heart', 'consultative', 'challenging', 'direct', 'inspirational')),
  content jsonb DEFAULT '{}',
  is_public boolean DEFAULT false,
  usage_count integer DEFAULT 0,
  success_rate numeric(5,2) DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Calls table
CREATE TABLE IF NOT EXISTS calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  customer_name text,
  customer_company text,
  template_id uuid REFERENCES sales_templates(id) ON DELETE SET NULL,
  status text DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  outcome text CHECK (outcome IN ('closed', 'pending', 'lost', 'no_show')),
  start_time timestamptz DEFAULT now(),
  end_time timestamptz,
  duration_seconds integer,
  recording_url text,
  transcript_url text,
  notes text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Call transcripts table (for real-time segments)
CREATE TABLE IF NOT EXISTS call_transcripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id uuid REFERENCES calls(id) ON DELETE CASCADE,
  speaker_id integer NOT NULL CHECK (speaker_id >= 0),
  speaker_name text,
  content text NOT NULL,
  timestamp_offset integer NOT NULL DEFAULT 0,
  confidence numeric(3,2),
  is_final boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- AI insights table
CREATE TABLE IF NOT EXISTS ai_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id uuid REFERENCES calls(id) ON DELETE CASCADE,
  transcript_id uuid REFERENCES call_transcripts(id) ON DELETE SET NULL,
  type text NOT NULL CHECK (type IN ('objection', 'opportunity', 'buying-signal', 'warning', 'good-move', 'next-step')),
  content text NOT NULL,
  confidence numeric(3,2),
  was_helpful boolean,
  user_feedback text,
  timestamp_offset integer NOT NULL DEFAULT 0,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Practice sessions table
CREATE TABLE IF NOT EXISTS practice_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  template_id uuid REFERENCES sales_templates(id) ON DELETE SET NULL,
  scenario_type text NOT NULL,
  scenario_description text,
  duration_seconds integer,
  score numeric(5,2),
  feedback jsonb DEFAULT '{}',
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Analytics aggregation table
CREATE TABLE IF NOT EXISTS user_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  total_calls integer DEFAULT 0,
  completed_calls integer DEFAULT 0,
  close_rate numeric(5,2) DEFAULT 0,
  avg_call_duration integer DEFAULT 0,
  total_practice_sessions integer DEFAULT 0,
  avg_practice_score numeric(5,2) DEFAULT 0,
  insights_generated integer DEFAULT 0,
  insights_helpful integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, period_start, period_end)
);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE practice_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_analytics ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can read own profile"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Teams policies
CREATE POLICY "Team members can read team data"
  ON teams
  FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT team_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Team owners can manage teams"
  ON teams
  FOR ALL
  TO authenticated
  USING (owner_id = auth.uid());

-- Sales templates policies
CREATE POLICY "Users can read own templates"
  ON sales_templates
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR is_public = true);

CREATE POLICY "Users can manage own templates"
  ON sales_templates
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid());

-- Calls policies
CREATE POLICY "Users can read own calls"
  ON calls
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can manage own calls"
  ON calls
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid());

-- Call transcripts policies
CREATE POLICY "Users can read transcripts from own calls"
  ON call_transcripts
  FOR SELECT
  TO authenticated
  USING (
    call_id IN (
      SELECT id FROM calls WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert transcripts for own calls"
  ON call_transcripts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    call_id IN (
      SELECT id FROM calls WHERE user_id = auth.uid()
    )
  );

-- AI insights policies
CREATE POLICY "Users can read insights from own calls"
  ON ai_insights
  FOR SELECT
  TO authenticated
  USING (
    call_id IN (
      SELECT id FROM calls WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage insights for own calls"
  ON ai_insights
  FOR ALL
  TO authenticated
  USING (
    call_id IN (
      SELECT id FROM calls WHERE user_id = auth.uid()
    )
  );

-- Practice sessions policies
CREATE POLICY "Users can read own practice sessions"
  ON practice_sessions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can manage own practice sessions"
  ON practice_sessions
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid());

-- User analytics policies
CREATE POLICY "Users can read own analytics"
  ON user_analytics
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can manage own analytics"
  ON user_analytics
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid());

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_team_id ON profiles(team_id);
CREATE INDEX IF NOT EXISTS idx_calls_user_id ON calls(user_id);
CREATE INDEX IF NOT EXISTS idx_calls_status ON calls(status);
CREATE INDEX IF NOT EXISTS idx_calls_created_at ON calls(created_at);
CREATE INDEX IF NOT EXISTS idx_call_transcripts_call_id ON call_transcripts(call_id);
CREATE INDEX IF NOT EXISTS idx_call_transcripts_timestamp ON call_transcripts(timestamp_offset);
CREATE INDEX IF NOT EXISTS idx_ai_insights_call_id ON ai_insights(call_id);
CREATE INDEX IF NOT EXISTS idx_ai_insights_type ON ai_insights(type);
CREATE INDEX IF NOT EXISTS idx_practice_sessions_user_id ON practice_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_analytics_user_id ON user_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_user_analytics_period ON user_analytics(period_start, period_end);

-- Create functions for automatic profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'full_name');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for automatic profile creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at triggers
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();

CREATE TRIGGER handle_updated_at BEFORE UPDATE ON teams
  FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();

CREATE TRIGGER handle_updated_at BEFORE UPDATE ON sales_templates
  FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();

CREATE TRIGGER handle_updated_at BEFORE UPDATE ON calls
  FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();

CREATE TRIGGER handle_updated_at BEFORE UPDATE ON user_analytics
  FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();