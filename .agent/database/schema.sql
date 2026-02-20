Vamos a diseñar un schema completamente blindado, preparado para:

Multi-sede

Control académico

Control financiero

Facturación interna

Auditoría

Escalabilidad

Integridad referencial estricta

Soft delete

Índices optimizados

Control de concurrencia

Base recomendada: PostgreSQL

🔒 PRINCIPIOS DEL SCHEMA

UUID como PK

Soft delete (deleted_at)

Auditoría (created_at, updated_at)

Restricciones NOT NULL

CHECK constraints

Índices estratégicos

Claves compuestas cuando sea necesario

Secuencias controladas para facturación

Separación académica vs financiera
-- =====================================
-- EXTENSIONS
-- =====================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================
-- BRANCHES (SEDES)
-- =====================================

CREATE TABLE branches (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    address TEXT,
    phone VARCHAR(50),
    email VARCHAR(150),
    tax_id VARCHAR(50),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- =====================================
-- ROLES
-- =====================================

CREATE TABLE roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT
);

-- =====================================
-- USERS
-- =====================================

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    role_id INTEGER NOT NULL REFERENCES roles(id),
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(150) NOT NULL,
    password_hash TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT unique_user_email_per_branch UNIQUE (branch_id, email)
);

CREATE INDEX idx_users_branch ON users(branch_id);

-- =====================================
-- COURSES
-- =====================================

CREATE TABLE courses (
    id SERIAL PRIMARY KEY,
    branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    monthly_fee NUMERIC(10,2) NOT NULL DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_courses_branch ON courses(branch_id);

-- =====================================
-- STUDENTS
-- =====================================

CREATE TABLE students (
    id SERIAL PRIMARY KEY,
    branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    full_name VARCHAR(150) NOT NULL,
    birth_date DATE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_students_branch ON students(branch_id);

-- =====================================
-- ENROLLMENTS
-- =====================================

CREATE TABLE enrollments (
    id SERIAL PRIMARY KEY,
    branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    enrollment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT unique_student_course UNIQUE (student_id, course_id)
);

CREATE INDEX idx_enrollments_branch ON enrollments(branch_id);

-- =====================================
-- ATTENDANCE
-- =====================================

CREATE TABLE attendance (
    id SERIAL PRIMARY KEY,
    enrollment_id INTEGER NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
    attendance_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL, -- PRESENT, ABSENT
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT unique_attendance UNIQUE (enrollment_id, attendance_date)
);

-- =====================================
-- FINANCIAL STATUS (CONTROL MENSUAL)
-- =====================================

CREATE TABLE financial_status (
    id SERIAL PRIMARY KEY,
    enrollment_id INTEGER NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
    month VARCHAR(7) NOT NULL, -- YYYY-MM
    amount_due NUMERIC(10,2) NOT NULL,
    amount_paid NUMERIC(10,2) NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT unique_financial_month UNIQUE (enrollment_id, month)
);

-- =====================================
-- PAYMENTS
-- =====================================

CREATE TABLE payments (
    id SERIAL PRIMARY KEY,
    enrollment_id INTEGER NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
    amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
    payment_date TIMESTAMP NOT NULL DEFAULT NOW(),
    method VARCHAR(50),
    reference_number VARCHAR(100),
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payments_enrollment ON payments(enrollment_id);

-- =====================================
-- INVOICE SEQUENCES
-- =====================================

CREATE TABLE invoice_sequences (
    id SERIAL PRIMARY KEY,
    branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    series VARCHAR(10) NOT NULL,
    current_number INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT unique_series_per_branch UNIQUE (branch_id, series)
);

-- =====================================
-- INVOICES
-- =====================================

CREATE TABLE invoices (
    id SERIAL PRIMARY KEY,
    branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    enrollment_id INTEGER NOT NULL REFERENCES enrollments(id),
    invoice_number VARCHAR(50) NOT NULL,
    issue_date TIMESTAMP NOT NULL DEFAULT NOW(),
    total_amount NUMERIC(10,2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ISSUED',
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT unique_invoice_number UNIQUE (invoice_number)
);

-- =====================================
-- INVOICE ITEMS
-- =====================================

CREATE TABLE invoice_items (
    id SERIAL PRIMARY KEY,
    invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    quantity NUMERIC(10,2) NOT NULL DEFAULT 1,
    unit_price NUMERIC(10,2) NOT NULL,
    total_price NUMERIC(10,2) NOT NULL
);

-- =====================================
-- ACADEMIC YEARS
-- =====================================

CREATE TABLE academic_years (
    id SERIAL PRIMARY KEY,
    branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT unique_year_per_branch UNIQUE (branch_id, year)
);

-- =====================================
-- GRADING PERIODS (BIMESTRES)
-- =====================================

CREATE TABLE grading_periods (
    id SERIAL PRIMARY KEY,
    academic_year_id INTEGER NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    period_type VARCHAR(50) NOT NULL DEFAULT 'BIMESTER',
    order_index INTEGER NOT NULL,
    start_date DATE,
    end_date DATE,
    is_closed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT unique_period_order UNIQUE (academic_year_id, order_index)
);

-- =====================================
-- ASSESSMENTS
-- =====================================

CREATE TABLE assessments (
    id SERIAL PRIMARY KEY,
    course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    grading_period_id INTEGER NOT NULL REFERENCES grading_periods(id) ON DELETE CASCADE,
    title VARCHAR(150) NOT NULL,
    weight_points NUMERIC(5,2) NOT NULL CHECK (weight_points > 0),
    max_score NUMERIC(5,2) NOT NULL CHECK (max_score > 0),
    created_by INTEGER NOT NULL REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_assessments_course ON assessments(course_id);

-- =====================================
-- GRADES
-- =====================================

CREATE TABLE grades (
    id SERIAL PRIMARY KEY,
    enrollment_id INTEGER NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
    assessment_id INTEGER NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
    score NUMERIC(5,2) NOT NULL CHECK (score >= 0),
    comments TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP,

    CONSTRAINT unique_grade UNIQUE (assessment_id, enrollment_id)
);

CREATE INDEX idx_grades_enrollment ON grades(enrollment_id);

-- =====================================
-- AUDIT LOG
-- =====================================

CREATE TABLE audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    branch_id INTEGER REFERENCES branches(id),
    action VARCHAR(100) NOT NULL,
    entity VARCHAR(100),
    entity_id INTEGER,
    metadata JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_branch ON audit_logs(branch_id);
📌 Importante

Validaciones que deben ir en backend (no en SQL):

SUM(weight_points) = 100 por período

score ≤ max_score

No registrar nota si período cerrado

Solo un academic_year activo por branch

Incremento transaccional de invoice_sequences