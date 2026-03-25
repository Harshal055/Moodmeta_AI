-- Migration: Schedule weekly reset for leaderboard weekly karma
-- Created: 2026-03-14

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

DO $$
BEGIN
  -- Remove existing job if already present (safe re-run).
  IF EXISTS (
    SELECT 1
    FROM cron.job
    WHERE jobname = 'weekly-reset-weekly-karma'
  ) THEN
    PERFORM cron.unschedule('weekly-reset-weekly-karma');
  END IF;
END;
$$;

SELECT cron.schedule(
  'weekly-reset-weekly-karma',
  '0 0 * * 1',
  $$select public.reset_weekly_karma();$$
);
