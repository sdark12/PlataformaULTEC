-- Table para vincular padres de familia con estudiantes
CREATE TABLE IF NOT EXISTS parent_student_links (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    parent_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    relationship TEXT DEFAULT 'parent', -- parent, guardian, etc.
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES profiles(id),
    UNIQUE(parent_user_id, student_id)
);

-- Index for fast lookups
CREATE INDEX idx_parent_links_parent ON parent_student_links(parent_user_id);
CREATE INDEX idx_parent_links_student ON parent_student_links(student_id);

-- Enable RLS
ALTER TABLE parent_student_links ENABLE ROW LEVEL SECURITY;

-- Policy: allow authenticated reads
CREATE POLICY "Allow authenticated reads" ON parent_student_links
    FOR SELECT USING (true);
