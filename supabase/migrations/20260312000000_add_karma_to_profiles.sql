-- Migration: Add karma column to profiles
-- Created: 2026-03-12

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS karma INTEGER DEFAULT 0;

-- Function to atomically increment karma
CREATE OR REPLACE FUNCTION public.increment_karma(p_user_id UUID, p_amount INTEGER)
RETURNS void AS $$
BEGIN
    UPDATE public.profiles
    SET karma = COALESCE(karma, 0) + p_amount
    WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
