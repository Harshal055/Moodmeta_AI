-- Migration: Add push token tracking to profiles
-- Created: 2026-03-03
-- Description: Adds columns to track push token and its last update time for expiry handling

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS push_token TEXT,
ADD COLUMN IF NOT EXISTS push_token_updated_at TIMESTAMP WITH TIME ZONE;

-- Create index for finding profiles with outdated tokens
CREATE INDEX IF NOT EXISTS idx_profiles_push_token_updated
ON profiles(push_token_updated_at)
WHERE push_token IS NOT NULL;
