-- Fix Chats RLS to allow users to save their initial greeting
DROP POLICY IF EXISTS "Users can insert their own chats" ON public.chats;
DROP POLICY IF EXISTS "Users can insert their own messages" ON public.chats;
CREATE POLICY "Users can insert their own messages" ON public.chats
  FOR INSERT TO authenticated 
  WITH CHECK (auth.uid() = user_id);

-- Ensure users can see their own chats
DROP POLICY IF EXISTS "Users can view their own chats" ON public.chats;
DROP POLICY IF EXISTS "Users can view their own messages" ON public.chats;
CREATE POLICY "Users can view their own messages" ON public.chats
  FOR SELECT TO authenticated 
  USING (auth.uid() = user_id);

-- Add Foreign Key to feedback table to allow Edge Function joins to profiles
-- This resolves the "profiles!feedback_user_id_fkey" failure in the analytics function.
-- First, ensure profiles.user_id has a unique constraint if it doesn't already
-- (Zustand store implies it does, but we'll be safe)
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_user_id_key') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_user_id_key UNIQUE (user_id);
  END IF;
END $$;

ALTER TABLE public.feedback DROP CONSTRAINT IF EXISTS feedback_user_id_profiles_fkey;
ALTER TABLE public.feedback 
  ADD CONSTRAINT feedback_user_id_profiles_fkey 
  FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;
