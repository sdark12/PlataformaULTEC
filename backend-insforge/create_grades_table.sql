CREATE TABLE IF NOT EXISTS grades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_id UUID REFERENCES courses(id),
    student_id UUID REFERENCES students(id),
    unit_name VARCHAR(100) NOT NULL, -- Ej: 'Unidad 1', 'Parcial', 'Proyecto Final'
    score DECIMAL(5,2) NOT NULL,
    remarks TEXT,
    created_by UUID,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(course_id, student_id, unit_name)
);

ALTER TABLE grades ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can manage grades" ON grades;
CREATE POLICY "Authenticated users can manage grades" ON grades FOR ALL TO authenticated USING (true) WITH CHECK (true);
