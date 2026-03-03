import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const sql = `
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
    created_by UUID REFERENCES profiles(id),
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

-- GRANTS FOR REST API
GRANT ALL ON TABLE assignments TO authenticated;
GRANT ALL ON TABLE assignments TO anon;
GRANT ALL ON TABLE assignments TO postgres;

GRANT ALL ON TABLE assignment_submissions TO authenticated;
GRANT ALL ON TABLE assignment_submissions TO anon;
GRANT ALL ON TABLE assignment_submissions TO postgres;

-- RELOAD SCHEMA CACHE
NOTIFY pgrst, 'reload schema';
`;

async function runSQL() {
    const client = new Client({
        user: process.env.DB_USER,
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        password: process.env.DB_PASSWORD,
        port: parseInt(process.env.DB_PORT || '5432'),
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('Connected to Insforge Database!');

        console.log('Running SQL...');
        await client.query(sql);
        console.log('SQL Executed Successfully! Tables are ready y schema cache recargado.');
    } catch (error) {
        console.error('Error executing SQL:', error);
    } finally {
        await client.end();
        console.log('Database connection closed.');
    }
}

runSQL();
