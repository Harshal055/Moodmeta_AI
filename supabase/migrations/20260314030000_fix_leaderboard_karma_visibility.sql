-- Migration: Fix leaderboard karma visibility and ranking source
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
  WITH challenge_totals AS (
    SELECT
      uc.user_id,
      COALESCE(SUM(COALESCE(uc.karma_earned, 0)), 0)::INTEGER AS alltime_karma,
      COALESCE(
        SUM(
          CASE
            WHEN uc.completed_at >= date_trunc('week', now())
            THEN COALESCE(uc.karma_earned, 0)
            ELSE 0
          END
        ),
        0
      )::INTEGER AS week_karma
    FROM public.user_challenges uc
    GROUP BY uc.user_id
  ),
  ranked AS (
    SELECT
      ROW_NUMBER() OVER (
        ORDER BY
          CASE
            WHEN v_period = 'weekly'
              THEN GREATEST(COALESCE(p.weekly_karma, 0), COALESCE(ct.week_karma, 0))
            ELSE GREATEST(COALESCE(p.karma, 0), COALESCE(ct.alltime_karma, 0))
          END DESC,
          p.user_id
      ) AS computed_rank,
      COALESCE(NULLIF(BTRIM(p.display_name), ''), p.companion_name, 'Anonymous') AS computed_display_name,
      CASE
        WHEN v_period = 'weekly'
          THEN GREATEST(COALESCE(p.weekly_karma, 0), COALESCE(ct.week_karma, 0))
        ELSE GREATEST(COALESCE(p.karma, 0), COALESCE(ct.alltime_karma, 0))
      END::INTEGER AS computed_karma,
      (p.user_id = p_user_id) AS computed_is_me
    FROM public.profiles p
    LEFT JOIN challenge_totals ct ON ct.user_id = p.user_id
    WHERE
      (
        CASE
          WHEN v_period = 'weekly'
            THEN GREATEST(COALESCE(p.weekly_karma, 0), COALESCE(ct.week_karma, 0))
          ELSE GREATEST(COALESCE(p.karma, 0), COALESCE(ct.alltime_karma, 0))
        END
      ) > 0
      AND (COALESCE(p.onboarded, false) = true OR p.user_id = p_user_id)
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
