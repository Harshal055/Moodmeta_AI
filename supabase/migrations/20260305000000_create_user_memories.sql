-- Create user_memories table for AI memory service
CREATE TABLE IF NOT EXISTS user_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT,
  age INTEGER,
  interests TEXT[] DEFAULT '{}',
  preferred_tone TEXT DEFAULT 'friendly',
  sensitivity_level TEXT DEFAULT 'medium',
  recent_events TEXT[] DEFAULT '{}',
  favorite_topics TEXT[] DEFAULT '{}',
  current_mood TEXT,
  relationship_length_days INTEGER DEFAULT 0,
  conversation_history JSONB DEFAULT '[]',
  last_updated TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Create index on user_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_memories_user_id ON user_memories(user_id);

-- Create index on last_updated for sorting
CREATE INDEX IF NOT EXISTS idx_user_memories_last_updated ON user_memories(last_updated DESC);

-- Enable Row Level Security
ALTER TABLE user_memories ENABLE ROW LEVEL SECURITY;

-- Create policy for users to read their own memories
CREATE POLICY "Users can read own memories" ON user_memories
  FOR SELECT USING (auth.uid() = user_id);

-- Create policy for users to insert their own memories
CREATE POLICY "Users can insert own memories" ON user_memories
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create policy for users to update their own memories
CREATE POLICY "Users can update own memories" ON user_memories
  FOR UPDATE USING (auth.uid() = user_id);

-- Create policy for users to delete their own memories
CREATE POLICY "Users can delete own memories" ON user_memories
  FOR DELETE USING (auth.uid() = user_id);
