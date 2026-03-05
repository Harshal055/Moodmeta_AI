-- Create analytics_events table for monetization and purchase tracking
CREATE TABLE IF NOT EXISTS public.analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- purchase_completed, purchase_failed, paywall_shown, paywall_dismissed, subscription_cancelled
  product_id TEXT, -- mood-buddy-pro-monthly, mood-buddy-pro-annual
  is_annual BOOLEAN,
  currency TEXT,
  amount DECIMAL(10, 2),
  revenue_cat_id TEXT,
  subscription_id TEXT,
  cancellation_reason TEXT,
  days_active INTEGER,
  error_message TEXT,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_analytics_user_id ON public.analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_event_type ON public.analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_created_at ON public.analytics_events(created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_product_id ON public.analytics_events(product_id);

-- Enable RLS
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own analytics
CREATE POLICY "Users can view own analytics" ON public.analytics_events
  FOR SELECT USING (auth.uid() = user_id);

-- Policy: Service role can insert (for server-side tracking)
CREATE POLICY "Service role can insert analytics" ON public.analytics_events
  FOR INSERT WITH CHECK (TRUE);
