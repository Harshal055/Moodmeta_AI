-- Migration: Wellness and Challenges tracking
-- Created: 2026-03-09

-- Create user_challenges table
CREATE TABLE IF NOT EXISTS public.user_challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    challenge_id TEXT NOT NULL,
    completed_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    karma_earned INTEGER DEFAULT 0
);

-- Index for quick lookup of today's challenges
CREATE INDEX IF NOT EXISTS idx_user_challenges_user_date ON public.user_challenges(user_id, completed_at);

-- Create wellness_logs table
CREATE TABLE IF NOT EXISTS public.wellness_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    activity_type TEXT NOT NULL, -- 'breathing', 'meditation'
    duration_seconds INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.user_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wellness_logs ENABLE ROW LEVEL SECURITY;

-- Policies for user_challenges
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'user_challenges' AND policyname = 'Users can view their own challenges'
    ) THEN
        CREATE POLICY "Users can view their own challenges"
        ON public.user_challenges FOR SELECT
        TO authenticated
        USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'user_challenges' AND policyname = 'Users can insert their own challenges'
    ) THEN
        CREATE POLICY "Users can insert their own challenges"
        ON public.user_challenges FOR INSERT
        TO authenticated
        WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;

-- Policies for wellness_logs
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'wellness_logs' AND policyname = 'Users can view their own wellness logs'
    ) THEN
        CREATE POLICY "Users can view their own wellness logs"
        ON public.wellness_logs FOR SELECT
        TO authenticated
        USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'wellness_logs' AND policyname = 'Users can insert their own wellness logs'
    ) THEN
        CREATE POLICY "Users can insert their own wellness logs"
        ON public.wellness_logs FOR INSERT
        TO authenticated
        WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;
