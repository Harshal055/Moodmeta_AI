-- Migration: Add leaderboard RPC and weekly karma tracking
-- Created: 2026-03-14

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS weekly_karma INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS weekly_karma_reset_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS display_name TEXT;

-- Update karma increment function to also track weekly karma.
CREATE OR REPLACE FUNCTION public.increment_karma(p_user_id UUID, p_amount INTEGER)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET
    karma = COALESCE(karma, 0) + COALESCE(p_amount, 0),
    weekly_karma = COALESCE(weekly_karma, 0) + COALESCE(p_amount, 0)
  WHERE user_id = p_user_id;
END;
$$;

-- Safe leaderboard view without exposing private columns.
CREATE OR REPLACE FUNCTION public.get_leaderboard(
  p_period TEXT,
  p_user_id UUID,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  rank BIGINT,
  display_name TEXT,
  karma INTEGER,
  is_me BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period TEXT := lower(COALESCE(p_period, 'alltime'));
  v_limit INTEGER := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);
BEGIN
  -- Monthly uses all-time karma for now. Weekly uses weekly_karma.
  RETURN QUERY
  WITH ranked AS (
    SELECT
      ROW_NUMBER() OVER (
        ORDER BY
          CASE
            WHEN v_period = 'weekly' THEN COALESCE(p.weekly_karma, 0)
            ELSE COALESCE(p.karma, 0)
          END DESC,
          p.user_id
      ) AS rank,
      COALESCE(p.display_name, 'Anonymous') AS display_name,
      CASE
        WHEN v_period = 'weekly' THEN COALESCE(p.weekly_karma, 0)
        ELSE COALESCE(p.karma, 0)
      END::INTEGER AS karma,
      (p.user_id = p_user_id) AS is_me
    FROM public.profiles p
    WHERE
      p.onboarded = true
      AND (
        CASE
          WHEN v_period = 'weekly' THEN COALESCE(p.weekly_karma, 0)
          ELSE COALESCE(p.karma, 0)
        END
      ) > 0
  )
  SELECT rank, ranked.display_name, ranked.karma, ranked.is_me
  FROM ranked
  WHERE rank <= v_limit OR is_me = true
  ORDER BY rank;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_leaderboard(TEXT, UUID, INTEGER) TO authenticated;

-- Optional helper RPC for weekly cron job (every Monday 00:00).
CREATE OR REPLACE FUNCTION public.reset_weekly_karma()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET
    weekly_karma = 0,
    weekly_karma_reset_at = now();
END;
$$;
