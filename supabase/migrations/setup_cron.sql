-- 1. Enable pg_cron extension (requires superuser, usually enabled in Supabase by default in newer projects)
-- Note: In Supabase, you can enable this from the dashboard if it's not already enabled.
create extension if not exists pg_cron;

-- 2. Grant permissions (if needed)
-- grant usage on schema cron to postgres;

-- 3. Schedule "Scheduled Messages" (Push Notifications)
-- Runs every morning at 9:00 AM UTC
select cron.schedule(
    'send-daily-push',
    '0 9 * * *',
    $$
    select
      net.http_post(
        url:='https://your-project-ref.supabase.co/functions/v1/scheduled-messages',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
        body:= '{}'::jsonb
      ) as request_id;
    $$
);

-- 4. Schedule "Memory Distillation"
-- Runs every night at 2:00 AM UTC to process the day's chats
-- Note: This would need to loop through active users or be triggered per session.
-- For simplicity, let's just show the pattern. Actual per-user scheduling might be better handled in-app.
/*
select cron.schedule(
    'distill-daily-memories',
    '0 2 * * *',
    $$
    -- Logic to trigger distill-memory for active users would go here
    $$
);
*/

-- IMPORTANT: Replace 'your-project-ref' and 'YOUR_SERVICE_ROLE_KEY' with actual values.
-- You can also usevault for secrets management if available.
