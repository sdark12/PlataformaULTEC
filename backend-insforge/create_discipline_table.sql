-- Discipline Incidents Table
-- Run this SQL in your InsForge/Supabase SQL editor

CREATE TABLE IF NOT EXISTS discipline_incidents (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    course_id UUID REFERENCES courses(id) ON DELETE SET NULL,
    branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    incident_type VARCHAR(50) NOT NULL DEFAULT 'warning',
    -- Types: 'positive', 'warning', 'minor', 'major', 'suspension'
    severity VARCHAR(20) NOT NULL DEFAULT 'low',
    -- Severity: 'low', 'medium', 'high', 'critical'
    title VARCHAR(255) NOT NULL,
    description TEXT,
    action_taken TEXT,
    -- e.g. 'Verbal warning given', 'Parent notified', 'Suspended 3 days'
    incident_date DATE NOT NULL DEFAULT CURRENT_DATE,
    reported_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    parent_notified BOOLEAN DEFAULT false,
    resolved BOOLEAN DEFAULT false,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    resolution_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_discipline_student ON discipline_incidents(student_id);
CREATE INDEX IF NOT EXISTS idx_discipline_branch ON discipline_incidents(branch_id);
CREATE INDEX IF NOT EXISTS idx_discipline_date ON discipline_incidents(incident_date DESC);
