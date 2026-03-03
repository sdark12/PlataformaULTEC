-- ASSIGNMENTS
CREATE TABLE IF NOT EXISTS assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    title VARCHAR(150) NOT NULL,
    description TEXT,
    assignment_type VARCHAR(50) NOT NULL DEFAULT 'HOMEWORK', -- HOMEWORK, EXAM, LAB, ACTIVITY
    due_date TIMESTAMP NOT NULL,
    weight_points NUMERIC(5,2) NOT NULL DEFAULT 1.00 CHECK (weight_points > 0),
    max_score NUMERIC(5,2) NOT NULL DEFAULT 100.00 CHECK (max_score > 0),
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_assignments_course ON assignments(course_id);

-- ASSIGNMENT SUBMISSIONS
CREATE TABLE IF NOT EXISTS assignment_submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
    enrollment_id UUID NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    submission_date TIMESTAMP,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING', -- PENDING, SUBMITTED, GRADED, LATE
    score NUMERIC(5,2) CHECK (score >= 0),
    feedback TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_assignment_submission UNIQUE (assignment_id, enrollment_id)
);
CREATE INDEX IF NOT EXISTS idx_assignment_submissions_assignment ON assignment_submissions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_assignment_submissions_student ON assignment_submissions(student_id);
