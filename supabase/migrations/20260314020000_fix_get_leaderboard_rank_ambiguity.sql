-- Migration: Fix get_leaderboard rank ambiguity in PL/pgSQL
-- Created: 2026-03-14

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
      ) AS computed_rank,
      COALESCE(p.display_name, 'Anonymous') AS computed_display_name,
      CASE
        WHEN v_period = 'weekly' THEN COALESCE(p.weekly_karma, 0)
        ELSE COALESCE(p.karma, 0)
      END::INTEGER AS computed_karma,
      (p.user_id = p_user_id) AS computed_is_me
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
  SELECT
    r.computed_rank AS rank,
    r.computed_display_name AS display_name,
    r.computed_karma AS karma,
    r.computed_is_me AS is_me
  FROM ranked r
  WHERE r.computed_rank <= v_limit OR r.computed_is_me = true
  ORDER BY r.computed_rank;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_leaderboard(TEXT, UUID, INTEGER) TO authenticated;
