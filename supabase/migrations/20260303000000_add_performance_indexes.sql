-- Migration: Add performance indexes for common queries
-- Created: 2026-03-03
-- Description: Adds indexes on frequently queried columns to improve performance

-- Index for fetching user's chats ordered by creation time
CREATE INDEX IF NOT EXISTS idx_chats_user_id_created_at 
ON chats(user_id, created_at DESC);

-- Index for looking up chats by user
CREATE INDEX IF NOT EXISTS idx_chats_user_id 
ON chats(user_id);

-- Index for profile lookups
CREATE INDEX IF NOT EXISTS idx_profiles_user_id 
ON profiles(user_id);

-- Index for mood logs by user and date
CREATE INDEX IF NOT EXISTS idx_mood_logs_user_id_created_at 
ON mood_logs(user_id, created_at DESC);

-- Index for today's mood checks
CREATE INDEX IF NOT EXISTS idx_mood_logs_user_id 
ON mood_logs(user_id);
