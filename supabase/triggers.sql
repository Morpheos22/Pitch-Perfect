-- ============================================================
-- PitchCoach Ai — Supabase Database Triggers
-- ============================================================
-- This file configures:
--   1. updated_at auto-update triggers (keep timestamps fresh)
--   2. Row Level Security (RLS) policies on sensitive tables
--   3. Audit log trigger for subscription plan changes
--   4. Job status change trigger (auto-dead-letter on max attempts)
--   5. User signup device trigger (ensure device fields persist)
--
-- All triggers are idempotent (CREATE OR REPLACE / DROP IF EXISTS).
-- Safe to run multiple times.
-- ============================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. UPDATED_AT AUTO-UPDATE FUNCTION
-- ─────────────────────────────────────────────────────────────────────────────
-- Prisma's @updatedAt handles this at the application layer, but direct
-- SQL updates (e.g. from webhooks, manual fixes, triggers) bypass Prisma.
-- This function ensures updatedAt is always correct regardless of how
-- the row is modified.

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to every table that has an updatedAt column
DO $$
DECLARE
    t RECORD;
BEGIN
    FOR t IN
        SELECT DISTINCT table_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND column_name = 'updatedAt'
        AND table_name NOT IN ('_prisma_migrations')
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_updated_at ON public.%I;', t.table_name, t.table_name);
        EXECUTE format('CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();', t.table_name, t.table_name);
    END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. ROW LEVEL SECURITY (RLS)
-- ─────────────────────────────────────────────────────────────────────────────
-- Enable RLS on all tables that contain user data. The application uses
-- Prisma with the service role (postgres), which bypasses RLS — so these
-- policies are defense-in-depth for any direct Supabase API access
-- (e.g. if someone enables the Supabase Data API in the dashboard).
--
-- Policy: users can only see/modify their own rows. The user's id is
-- matched against auth.uid() — but since we use Clerk (not Supabase Auth),
-- auth.uid() returns NULL for all requests. These policies therefore
-- DENY all access via the Supabase Data API, forcing all access through
-- the Prisma backend (which is the intended architecture).

-- Enable RLS on user-data tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processed_webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pitch_decks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pitch_scripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pitch_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.full_pitch_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.founder_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.module_access ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (idempotent)
DROP POLICY IF EXISTS "users_select_own" ON public.users;
DROP POLICY IF EXISTS "users_update_own" ON public.users;
DROP POLICY IF EXISTS "subscriptions_select_own" ON public.subscriptions;
DROP POLICY IF EXISTS "jobs_select_own" ON public.jobs;
DROP POLICY IF EXISTS "processed_webhooks_select_own" ON public.processed_webhooks;

-- Since auth.uid() is always NULL (Clerk, not Supabase Auth), these
-- policies effectively block ALL access via the Data API. The Prisma
-- backend (service role) bypasses RLS, so app functionality is unaffected.
-- This is the intended architecture: all data access goes through the
-- Next.js API routes, never directly through Supabase.

-- users: no direct access (Clerk handles auth, Prisma handles data)
CREATE POLICY "users_select_own" ON public.users
    FOR SELECT USING (false);
CREATE POLICY "users_update_own" ON public.users
    FOR UPDATE USING (false);

-- subscriptions: no direct access
CREATE POLICY "subscriptions_select_own" ON public.subscriptions
    FOR SELECT USING (false);

-- jobs: no direct access (jobs are internal, only surfaced via API)
CREATE POLICY "jobs_select_own" ON public.jobs
    FOR SELECT USING (false);

-- processed_webhooks: no direct access (internal idempotency table)
CREATE POLICY "processed_webhooks_select_own" ON public.processed_webhooks
    FOR SELECT USING (false);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. SUBSCRIPTION PLAN CHANGE AUDIT LOG
-- ─────────────────────────────────────────────────────────────────────────────
-- When a subscription's plan changes, log the transition. This creates
-- an audit trail showing who changed what, when, and from/to which plan.
-- Useful for detecting unauthorized tier downgrades (e.g. if someone
-- accidentally sets morphylee22@gmail.com to FREE).

-- Create audit table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.subscription_audit_log (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "userId" TEXT NOT NULL,
    old_plan TEXT,
    new_plan TEXT NOT NULL,
    old_status TEXT,
    new_status TEXT NOT NULL,
    changed_by TEXT, -- 'system' | 'webhook' | 'admin' | 'trigger'
    changed_at TIMESTAMP(3) NOT NULL DEFAULT now(),
    metadata JSONB
);

CREATE INDEX IF NOT EXISTS "subscription_audit_userId_idx"
    ON public.subscription_audit_log("userId");
CREATE INDEX IF NOT EXISTS "subscription_audit_changed_at_idx"
    ON public.subscription_audit_log(changed_at DESC);

-- Audit trigger function
CREATE OR REPLACE FUNCTION public.audit_subscription_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Only log if plan or status actually changed
    IF (OLD."plan" IS DISTINCT FROM NEW."plan") OR
       (OLD."status" IS DISTINCT FROM NEW."status") THEN

        INSERT INTO public.subscription_audit_log (
            "userId", old_plan, new_plan, old_status, new_status,
            changed_by, changed_at, metadata
        ) VALUES (
            NEW."userId",
            OLD."plan",
            NEW."plan",
            OLD."status",
            NEW."status",
            'trigger',
            now(),
            jsonb_build_object(
                'old_period_end', OLD."currentPeriodEnd",
                'new_period_end', NEW."currentPeriodEnd",
                'old_credits_remaining', OLD."creditsRemaining",
                'new_credits_remaining', NEW."creditsRemaining"
            )
        );
    END IF;

    -- ── GUARD: Prevent morphylee22@gmail.com from being demoted ────────
    -- This is a database-level guard that complements the application-level
    -- PERMANENT_FOUNDER_EMAILS check. Even if a bug in the app code or a
    -- direct SQL update tries to set morphylee22@gmail.com to a non-FOUNDER
    -- plan, this trigger blocks it.
    DECLARE
        user_email TEXT;
    BEGIN
        SELECT email INTO user_email FROM public.users WHERE id = NEW."userId";
        IF user_email = 'morphylee22@gmail.com' AND NEW."plan" != 'FOUNDER' THEN
            RAISE EXCEPTION 'SECURITY GUARD: morphylee22@gmail.com must always be on FOUNDER tier. Attempted to set plan to %. Transaction rolled back.', NEW."plan"
                USING ERRCODE = 'check_violation';
        END IF;
    END;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_subscriptions_audit ON public.subscriptions;
CREATE TRIGGER trg_subscriptions_audit
    AFTER UPDATE ON public.subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION public.audit_subscription_change();

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. JOB AUTO-DEAD-LETTER TRIGGER
-- ─────────────────────────────────────────────────────────────────────────────
-- When a Job's attempts reach maxAttempts and status is FAILED, automatically
-- move it to DEAD_LETTER. This is a safety net — the application code in
-- job-queue.ts already does this, but the trigger ensures it happens even
-- if a direct SQL update sets status=FAILED without going through the lib.

CREATE OR REPLACE FUNCTION public.check_job_dead_letter()
RETURNS TRIGGER AS $$
BEGIN
    -- If attempts >= maxAttempts and status is FAILED, auto-dead-letter
    IF NEW."attempts" >= NEW."maxAttempts"
       AND NEW."status" = 'FAILED'
       AND NEW."deadLetterAt" IS NULL THEN
        NEW."status" = 'DEAD_LETTER';
        NEW."deadLetterAt" = now();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_jobs_dead_letter ON public.jobs;
CREATE TRIGGER trg_jobs_dead_letter
    BEFORE UPDATE ON public.jobs
    FOR EACH ROW
    EXECUTE FUNCTION public.check_job_dead_letter();

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. DEVICE TRACKING TRIGGER — capture device on first sign-in
-- ─────────────────────────────────────────────────────────────────────────────
-- When a user row is created (via Clerk webhook), ensure signupAt is set
-- if signupDeviceId is populated. This is a minor guard — the main device
-- capture happens in /api/user/sync POST.

CREATE OR REPLACE FUNCTION public.ensure_signup_at()
RETURNS TRIGGER AS $$
BEGIN
    -- When signupDeviceId is first set, ensure signupAt is also set
    IF NEW."signupDeviceId" IS NOT NULL
       AND NEW."signupAt" IS NULL
       AND (TG_OP = 'INSERT' OR OLD."signupDeviceId" IS NULL) THEN
        NEW."signupAt" = now();
    END IF;

    -- When lastSigninDeviceId is updated, ensure lastSigninAt is set
    IF NEW."lastSigninDeviceId" IS NOT NULL
       AND NEW."lastSigninAt" IS NULL THEN
        NEW."lastSigninAt" = now();
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_device_tracking ON public.users;
CREATE TRIGGER trg_users_device_tracking
    BEFORE INSERT OR UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION public.ensure_signup_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. VERIFY EVERYTHING
-- ─────────────────────────────────────────────────────────────────────────────
SELECT 'Triggers configured successfully' AS status;
