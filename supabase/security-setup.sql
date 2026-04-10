-- ============================================
-- PitchCoach AI - Least Privilege Database User Setup
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Create a limited application user
-- Replace 'your_secure_password_here' with a strong password
CREATE USER pitchcoach_app WITH PASSWORD 'your_secure_password_here';

-- 2. Grant CONNECT privilege on the database
GRANT CONNECT ON DATABASE postgres TO pitchcoach_app;

-- 3. Grant USAGE on the public schema
GRANT USAGE ON SCHEMA public TO pitchcoach_app;

-- 4. Grant SELECT, INSERT, UPDATE, DELETE on all existing tables
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO pitchcoach_app;

-- 5. Grant USAGE on all sequences (for auto-increment IDs)
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO pitchcoach_app;

-- 6. Set default privileges for future tables
-- This ensures new tables created by migrations are automatically accessible
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO pitchcoach_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE ON SEQUENCES TO pitchcoach_app;

-- ============================================
-- VERIFICATION
-- ============================================
-- Run this to verify the user was created:
-- SELECT usename FROM pg_user WHERE usename = 'pitchcoach_app';

-- ============================================
-- AFTER RUNNING THIS:
-- 1. Update your .env DATABASE_URL:
--    DATABASE_URL="postgresql://pitchcoach_app:your_secure_password_here@aws-1-eu-west-2.pooler.supabase.com:6543/postgres?pgbouncer=true"
--
-- 2. Keep the original postgres URL as DIRECT_URL for migrations only:
--    DIRECT_URL="postgresql://postgres:<YOUR_PROJECT_ID>:<YOUR_PASSWORD>@<YOUR_HOST>:6543/postgres?pgbouncer=true"
--    Replace placeholders with your actual Supabase credentials (never commit real credentials).
-- ============================================
