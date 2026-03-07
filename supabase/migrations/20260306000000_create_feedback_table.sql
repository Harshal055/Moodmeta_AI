-- Create feedback table
CREATE TABLE IF NOT EXISTS public.feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert feedback (even anonymous users)
CREATE POLICY "Anyone can insert feedback" ON public.feedback
  FOR INSERT WITH CHECK (TRUE);

-- Allow admins (service role) to read all feedback
-- Note: Clients shouldn't read all feedback directly, only through the Edge Function
CREATE POLICY "Admins can view feedback" ON public.feedback
  FOR SELECT USING (auth.role() = 'service_role');
