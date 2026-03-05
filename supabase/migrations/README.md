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
