/*
  # Desktop Sync State Management

  1. New Tables
    - `desktop_sync_state` - Persistent state for desktop-web app connection
    - `desktop_messages_queue` - Reliable message queue for bidirectional communication

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated access

  3. Features
    - Singleton pattern for desktop_sync_state
    - Message queue with sender/recipient tracking
    - Timestamp tracking for connection status
*/

-- Create desktop_sync_state table
CREATE TABLE IF NOT EXISTS desktop_sync_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  last_desktop_ping timestamptz DEFAULT now(),
  web_app_call_active boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Ensure only one row exists in desktop_sync_state (singleton pattern)
INSERT INTO desktop_sync_state (id, last_desktop_ping, web_app_call_active)
VALUES ('00000000-0000-0000-0000-000000000001', now(), false)
ON CONFLICT (id) DO NOTHING;

-- Create desktop_messages_queue table
CREATE TABLE IF NOT EXISTS desktop_messages_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_type text NOT NULL,
  sender text NOT NULL CHECK (sender IN ('desktop', 'webapp')),
  recipient text NOT NULL CHECK (recipient IN ('desktop', 'webapp')),
  content jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security for new tables
ALTER TABLE desktop_sync_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE desktop_messages_queue ENABLE ROW LEVEL SECURITY;

-- Policies for desktop_sync_state
CREATE POLICY "Allow authenticated read access to desktop_sync_state"
  ON desktop_sync_state
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated update access to desktop_sync_state"
  ON desktop_sync_state
  FOR UPDATE
  TO authenticated
  USING (true);

-- Policies for desktop_messages_queue
CREATE POLICY "Allow authenticated insert into desktop_messages_queue"
  ON desktop_messages_queue
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated read from desktop_messages_queue"
  ON desktop_messages_queue
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated delete from desktop_messages_queue"
  ON desktop_messages_queue
  FOR DELETE
  TO authenticated
  USING (true);

-- Add updated_at trigger for desktop_sync_state
CREATE TRIGGER handle_updated_at_desktop_sync BEFORE UPDATE ON desktop_sync_state
  FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();