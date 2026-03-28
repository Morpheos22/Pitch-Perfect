-- PitchCoach AI Database Schema
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- USERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clerk_id TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    first_name TEXT,
    last_name TEXT,
    avatar_url TEXT,
    linkedin_url TEXT,
    
    -- Zoho Integration
    zoho_contact_id TEXT,
    zoho_account_id TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_active_at TIMESTAMPTZ
);

-- ============================================
-- SUBSCRIPTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    
    -- Plan Details
    plan TEXT DEFAULT 'FREE' CHECK (plan IN ('FREE', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE')),
    status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'PAST_DUE', 'CANCELLED', 'INCOMPLETE', 'TRIALING')),
    
    -- Stripe Integration
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    stripe_price_id TEXT,
    
    -- Billing Cycle
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    
    -- Credits
    credits_remaining INTEGER DEFAULT 0,
    credits_used INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- USAGE TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    
    -- Monthly Usage Tracking
    month TIMESTAMPTZ DEFAULT NOW(),
    
    -- Module Usage Counts
    e1_deck_analyses INTEGER DEFAULT 0,
    e2_script_coach_sessions INTEGER DEFAULT 0,
    e3_live_pitch_sessions INTEGER DEFAULT 0,
    e4_full_pitch_sessions INTEGER DEFAULT 0,
    
    -- AI Token Usage
    claude_tokens_used INTEGER DEFAULT 0,
    gemini_tokens_used INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PITCH DECKS (E1)
-- ============================================
CREATE TABLE IF NOT EXISTS pitch_decks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    -- File Info
    file_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_size INTEGER,
    file_type TEXT,
    slide_count INTEGER,
    
    -- Analysis Status
    status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')),
    
    -- Content Scores (0-100)
    problem_clarity_score INTEGER,
    solution_clarity_score INTEGER,
    market_opportunity_score INTEGER,
    business_model_score INTEGER,
    team_credibility_score INTEGER,
    traction_score INTEGER,
    financials_score INTEGER,
    ask_clarity_score INTEGER,
    overall_score INTEGER,
    
    -- Visual Audit Scores
    design_consistency_score INTEGER,
    readability_score INTEGER,
    visual_hierarchy_score INTEGER,
    color_scheme_score INTEGER,
    typography_score INTEGER,
    
    -- AI Feedback
    strengths TEXT[],
    weaknesses TEXT[],
    recommendations TEXT[],
    
    -- Raw Analysis
    raw_analysis JSONB,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    analyzed_at TIMESTAMPTZ
);

-- ============================================
-- PITCH SCRIPTS (E2)
-- ============================================
CREATE TABLE IF NOT EXISTS pitch_scripts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    -- Input
    input_type TEXT CHECK (input_type IN ('TEXT', 'PDF', 'DOCX')),
    input_text TEXT,
    input_file_url TEXT,
    file_name TEXT,
    
    -- Target
    target_audience TEXT,
    pitch_duration INTEGER,
    
    -- Status
    status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')),
    
    -- 5-Element Scores
    hook_score INTEGER,
    problem_score INTEGER,
    solution_score INTEGER,
    credibility_score INTEGER,
    cta_score INTEGER,
    overall_score INTEGER,
    
    -- Metrics
    word_count INTEGER,
    estimated_duration INTEGER,
    
    -- AI Feedback
    improvements JSONB,
    rewritten_script TEXT,
    alternative_hooks TEXT[],
    
    -- Version
    version INTEGER DEFAULT 1,
    parent_script_id UUID,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    analyzed_at TIMESTAMPTZ
);

-- ============================================
-- PITCH VIDEOS (E3)
-- ============================================
CREATE TABLE IF NOT EXISTS pitch_videos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    -- Video Info
    video_url TEXT NOT NULL,
    video_id TEXT,
    thumbnail_url TEXT,
    duration INTEGER,
    file_size INTEGER,
    
    -- Status
    status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')),
    
    -- Delivery Scores
    pace_score INTEGER,
    clarity_score INTEGER,
    filler_word_score INTEGER,
    energy_score INTEGER,
    confidence_score INTEGER,
    overall_delivery_score INTEGER,
    
    -- Body Language Scores
    eye_contact_score INTEGER,
    facial_expression_score INTEGER,
    gesture_score INTEGER,
    posture_score INTEGER,
    overall_body_language_score INTEGER,
    
    -- Metrics
    words_per_minute INTEGER,
    filler_word_count INTEGER,
    filler_words JSONB,
    
    -- AI Feedback
    delivery_feedback TEXT,
    body_language_feedback TEXT,
    key_moments JSONB,
    
    -- Transcript
    transcript TEXT,
    transcript_with_timestamps JSONB,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    analyzed_at TIMESTAMPTZ
);

-- ============================================
-- FULL PITCH SESSIONS (E4)
-- ============================================
CREATE TABLE IF NOT EXISTS full_pitch_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    pitch_deck_id UUID REFERENCES pitch_decks(id),
    
    -- Video Info
    video_url TEXT NOT NULL,
    video_id TEXT,
    thumbnail_url TEXT,
    duration INTEGER,
    file_size INTEGER,
    
    -- Status
    status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')),
    
    -- 6-Dimension Scores
    problem_solution_fit INTEGER,
    market_opportunity INTEGER,
    business_model_viability INTEGER,
    team_credibility INTEGER,
    traction_milestones INTEGER,
    delivery_presence INTEGER,
    overall_readiness_score INTEGER,
    
    -- Investor Readiness Level
    investor_readiness_level TEXT CHECK (investor_readiness_level IN ('NOT_READY', 'NEEDS_WORK', 'INVESTOR_READY', 'HIGHLY_PREPARED')),
    
    -- Detailed Scores
    content_scores JSONB,
    delivery_scores JSONB,
    
    -- AI Feedback
    strengths TEXT[],
    weaknesses TEXT[],
    investor_concerns TEXT[],
    recommended_actions TEXT[],
    
    -- Competitive Context
    competitive_analysis JSONB,
    
    -- Q&A Preparation
    anticipated_questions JSONB,
    
    -- Transcript
    transcript TEXT,
    transcript_with_timestamps JSONB,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    analyzed_at TIMESTAMPTZ
);

-- ============================================
-- TRANSACTIONS
-- ============================================
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    -- Transaction Details
    type TEXT CHECK (type IN ('SUBSCRIPTION', 'ONE_TIME', 'CREDIT_PURCHASE', 'REFUND')),
    amount INTEGER,
    currency TEXT DEFAULT 'usd',
    
    -- Stripe
    stripe_payment_intent_id TEXT,
    stripe_invoice_id TEXT,
    
    -- Credits
    credits_added INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- MODULE ACCESS
-- ============================================
CREATE TABLE IF NOT EXISTS module_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID UNIQUE REFERENCES transactions(id),
    
    -- Module Access
    e1_access BOOLEAN DEFAULT FALSE,
    e2_access BOOLEAN DEFAULT FALSE,
    e3_access BOOLEAN DEFAULT FALSE,
    e4_access BOOLEAN DEFAULT FALSE,
    
    -- Usage Limits
    e1_limit INTEGER,
    e2_limit INTEGER,
    e3_limit INTEGER,
    e4_limit INTEGER,
    
    -- Current Usage
    e1_used INTEGER DEFAULT 0,
    e2_used INTEGER DEFAULT 0,
    e3_used INTEGER DEFAULT 0,
    e4_used INTEGER DEFAULT 0,
    
    -- Expiry
    expires_at TIMESTAMPTZ,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ZOHO SYNC LOGS
-- ============================================
CREATE TABLE IF NOT EXISTS zoho_sync_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    
    -- Sync Details
    entity_type TEXT,
    entity_id TEXT,
    action TEXT,
    status TEXT,
    
    -- Request/Response
    request_data JSONB,
    response_data JSONB,
    error_message TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_users_clerk_id ON users(clerk_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_pitch_decks_user_id ON pitch_decks(user_id);
CREATE INDEX IF NOT EXISTS idx_pitch_decks_status ON pitch_decks(status);
CREATE INDEX IF NOT EXISTS idx_pitch_scripts_user_id ON pitch_scripts(user_id);
CREATE INDEX IF NOT EXISTS idx_pitch_videos_user_id ON pitch_videos(user_id);
CREATE INDEX IF NOT EXISTS idx_full_pitch_sessions_user_id ON full_pitch_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE pitch_decks ENABLE ROW LEVEL SECURITY;
ALTER TABLE pitch_scripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE pitch_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE full_pitch_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE module_access ENABLE ROW LEVEL SECURITY;

-- Enable service role to bypass RLS (for server-side operations)
-- This is handled by using the service_role key in API calls

-- ============================================
-- SUCCESS MESSAGE
-- ============================================
SELECT 'PitchCoach AI database schema created successfully!' AS message;
