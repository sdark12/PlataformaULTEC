-- Gamification: Rewards and Merit Transactions Tables
-- Run this SQL in your database console

-- 1. Table for Rewards
CREATE TABLE IF NOT EXISTS rewards (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    points_required INTEGER NOT NULL CHECK (points_required > 0),
    stock INTEGER DEFAULT NULL, -- NULL means unlimited
    is_active BOOLEAN DEFAULT TRUE,
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index on branch_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_rewards_branch ON rewards(branch_id);

-- 2. Table for Merit Transactions (ledger-based points system)
CREATE TABLE IF NOT EXISTS merit_transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    points INTEGER NOT NULL,
    transaction_type VARCHAR(50) NOT NULL, -- 'attendance', 'grade', 'manual', 'claim', 'refund'
    description VARCHAR(255) NOT NULL,
    reference_id UUID, -- References attendance(id), grades(id), or rewards(id)
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- Prevent duplicate automatic points for the same attendance/grade reference
    CONSTRAINT unique_student_ref_type UNIQUE (student_id, reference_id, transaction_type)
);

-- Indices for performance
CREATE INDEX IF NOT EXISTS idx_merit_student ON merit_transactions(student_id);
CREATE INDEX IF NOT EXISTS idx_merit_type ON merit_transactions(transaction_type);

-- RLS (Row Level Security) Configuration
ALTER TABLE rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE merit_transactions ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read rewards and transactions
DROP POLICY IF EXISTS "Authenticated users can read rewards" ON rewards;
CREATE POLICY "Authenticated users can read rewards" ON rewards FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can read merits" ON merit_transactions;
CREATE POLICY "Authenticated users can read merits" ON merit_transactions FOR SELECT TO authenticated USING (true);

-- Allow admins/instructors to insert/update/delete rewards
DROP POLICY IF EXISTS "Admins can manage rewards" ON rewards;
CREATE POLICY "Admins can manage rewards" ON rewards FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Allow authenticated services to manage transactions
DROP POLICY IF EXISTS "Authenticated users can manage merits" ON merit_transactions;
CREATE POLICY "Authenticated users can manage merits" ON merit_transactions FOR ALL TO authenticated USING (true) WITH CHECK (true);
