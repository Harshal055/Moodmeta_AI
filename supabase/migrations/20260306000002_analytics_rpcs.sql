-- RPC for Daily Chat Counts (Last N days)
CREATE OR REPLACE FUNCTION get_daily_chat_counts(days_limit integer)
RETURNS TABLE (day date, count bigint) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    date_trunc('day', created_at)::date AS day,
    count(*) AS count
  FROM chats
  WHERE created_at > now() - (days_limit || ' days')::interval
  GROUP BY 1
  ORDER BY 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC for Peak Usage Hour
CREATE OR REPLACE FUNCTION get_peak_usage_hour()
RETURNS TABLE (hour double precision, count bigint) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    extract(hour from created_at) AS hour,
    count(*) AS count
  FROM chats
  GROUP BY 1
  ORDER BY 2 DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC for Daily Mood Averages
CREATE OR REPLACE FUNCTION get_daily_mood_avg(days_limit integer)
RETURNS TABLE (day date, avg_rating numeric) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    date_trunc('day', created_at)::date AS day,
    avg(rating)::numeric AS avg_rating
  FROM mood_logs
  WHERE created_at > now() - (days_limit || ' days')::interval
  GROUP BY 1
  ORDER BY 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC for Retention Stats (Simplified)
CREATE OR REPLACE FUNCTION get_retention_stats()
RETURNS TABLE (d1 numeric, d7 numeric, d30 numeric) AS $$
DECLARE
  total_u bigint;
BEGIN
  SELECT count(*) INTO total_u FROM profiles;
  
  IF total_u = 0 THEN
    RETURN QUERY SELECT 0::numeric, 0::numeric, 0::numeric;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 
    (SELECT count(*) FROM profiles WHERE updated_at > created_at + interval '1 day')::numeric / total_u * 100 as d1,
    (SELECT count(*) FROM profiles WHERE updated_at > created_at + interval '7 days')::numeric / total_u * 100 as d7,
    (SELECT count(*) FROM profiles WHERE updated_at > created_at + interval '30 days')::numeric / total_u * 100 as d30;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
