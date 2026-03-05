# Database Migrations

## Applying Migrations

### Option 1: Via Supabase CLI

```bash
# Link to your project (one-time setup)
supabase link --project-ref your-project-ref

# Apply all pending migrations
supabase db push
```

### Option 2: Via Supabase Dashboard

1. Go to your project in Supabase Dashboard
2. Navigate to SQL Editor
3. Copy the contents of the migration file
4. Execute the SQL

### Option 3: Programmatically

You can also run the migration SQL directly from your application using the Supabase client with admin privileges.

## Migration History

- **20260303000000_add_performance_indexes.sql**: Adds indexes on `chats`, `profiles`, and `mood_logs` tables to optimize common query patterns (user lookup, date-based sorting)
- **20260303000001_add_push_token_tracking.sql**: Adds push token tracking functionality to profiles table
- **20260303000002_add_avatar_url_to_profiles.sql**: Adds avatar_url column to profiles table for user profile pictures
- **20260305000000_create_user_memories.sql**: Creates `user_memories` table for AI memory service (Pro feature) with user preferences, interests, and conversation context
- **20260305000001_create_custom_companions.sql**: Creates `custom_companions` table for custom AI companion service (Pro feature) with personality customization
