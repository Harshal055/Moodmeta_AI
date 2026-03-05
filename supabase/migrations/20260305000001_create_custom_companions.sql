-- Create custom_companions table for custom companion service
CREATE TABLE IF NOT EXISTS custom_companions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  personality_description TEXT NOT NULL,
  avatar_url TEXT,
  avatar_emoji TEXT DEFAULT '🤖',
  tone TEXT DEFAULT 'friendly',
  specialties TEXT[] DEFAULT '{}',
  conversation_style TEXT DEFAULT 'adaptive',
  background_story TEXT,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Create index on user_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_custom_companions_user_id ON custom_companions(user_id);

-- Create index on is_active for filtering active companions
CREATE INDEX IF NOT EXISTS idx_custom_companions_is_active ON custom_companions(is_active);

-- Create index on created_at for sorting
CREATE INDEX IF NOT EXISTS idx_custom_companions_created_at ON custom_companions(created_at DESC);

-- Enable Row Level Security
ALTER TABLE custom_companions ENABLE ROW LEVEL SECURITY;

-- Create policy for users to read their own companions
CREATE POLICY "Users can read own companions" ON custom_companions
  FOR SELECT USING (auth.uid() = user_id);

-- Create policy for users to insert their own companions
CREATE POLICY "Users can insert own companions" ON custom_companions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create policy for users to update their own companions
CREATE POLICY "Users can update own companions" ON custom_companions
  FOR UPDATE USING (auth.uid() = user_id);

-- Create policy for users to delete their own companions
CREATE POLICY "Users can delete own companions" ON custom_companions
  FOR DELETE USING (auth.uid() = user_id);

-- Ensure only one active companion per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_companion_per_user 
  ON custom_companions(user_id) 
  WHERE is_active = true;
