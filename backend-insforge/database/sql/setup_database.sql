
-- ==========================================
-- SCRIPT DE CONFIGURACIÓN DE BASE DE DATOS
-- Copia y pega TODO este contenido en:
-- InsForge Dashboard > Database > SQL Editor
-- ==========================================

-- 1. Habilitar extensiones
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Crear tabla de ROLES
CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT
);

INSERT INTO roles (name, description) VALUES 
('admin', 'Administrador del Sistema'),
('instructor', 'Instructor'),
('student', 'Estudiante')
ON CONFLICT (name) DO NOTHING;

-- 3. Crear tabla de SEDES (Branches)
CREATE TABLE IF NOT EXISTS branches (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    address TEXT,
    phone VARCHAR(50),
    email VARCHAR(150),
    created_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO branches (name, address, email) VALUES 
('Sede Principal', 'Ciudad', 'admin@ultec.edu')
ON CONFLICT DO NOTHING;

-- 4. Crear tabla de PERFILES (Profiles)
-- Esta es la tabla crítica que faltaba
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY, -- Relacionado con auth.users
    email TEXT,
    full_name TEXT,
    role TEXT DEFAULT 'student',
    role_id INTEGER REFERENCES roles(id),
    branch_id INTEGER REFERENCES branches(id),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Habilitar Seguridad (RLS) en Profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Políticas permisivas para desarrollo (ajustar en producción)
CREATE POLICY "Public profiles" ON profiles FOR SELECT USING (true);
CREATE POLICY "User update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "User insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- 6. Crear otras tablas del sistema (Cursos, Inscripciones, etc.)

CREATE TABLE IF NOT EXISTS courses (
    id SERIAL PRIMARY KEY,
    branch_id INTEGER REFERENCES branches(id),
    name VARCHAR(150) NOT NULL,
    description TEXT,
    monthly_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS students (
    id SERIAL PRIMARY KEY,
    branch_id INTEGER REFERENCES branches(id),
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(150) UNIQUE,
    phone VARCHAR(50),
    address TEXT,
    birth_date DATE,
    status VARCHAR(20) DEFAULT 'ACTIVE', -- ACTIVE, INACTIVE, SUSPENDED
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS enrollments (
    id SERIAL PRIMARY KEY,
    branch_id INTEGER REFERENCES branches(id),
    student_id INTEGER REFERENCES students(id),
    course_id INTEGER REFERENCES courses(id),
    enrollment_date TIMESTAMP DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE,
    UNIQUE(student_id, course_id)
);

CREATE TABLE IF NOT EXISTS financial_status (
    id SERIAL PRIMARY KEY,
    enrollment_id INTEGER REFERENCES enrollments(id),
    month VARCHAR(7), -- YYYY-MM
    amount_due DECIMAL(10,2) NOT NULL,
    amount_paid DECIMAL(10,2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, PAID, OVERDUE
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    enrollment_id INTEGER REFERENCES enrollments(id),
    amount DECIMAL(10,2) NOT NULL,
    payment_date TIMESTAMP DEFAULT NOW(),
    method VARCHAR(50), -- CASH, TRANSFER, CARD
    reference_number VARCHAR(100),
    created_by UUID, -- Referencia a auth.users o profiles
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS invoices (
    id SERIAL PRIMARY KEY,
    branch_id INTEGER REFERENCES branches(id),
    enrollment_id INTEGER REFERENCES enrollments(id),
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    issue_date TIMESTAMP DEFAULT NOW(),
    total_amount DECIMAL(10,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'ISSUED', -- ISSUED, CANCELLED
    created_by UUID,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS invoice_items (
    id SERIAL PRIMARY KEY,
    invoice_id INTEGER REFERENCES invoices(id),
    description TEXT NOT NULL,
    quantity DECIMAL(10,2) NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS invoice_sequences (
    id SERIAL PRIMARY KEY,
    branch_id INTEGER REFERENCES branches(id),
    series VARCHAR(10) DEFAULT 'A',
    current_number INTEGER DEFAULT 0,
    UNIQUE(branch_id, series)
);

INSERT INTO invoice_sequences (branch_id, series, current_number) 
SELECT id, 'A', 0 FROM branches ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS attendance (
    id SERIAL PRIMARY KEY,
    course_id INTEGER REFERENCES courses(id),
    student_id INTEGER REFERENCES students(id),
    date DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'PRESENT', -- PRESENT, ABSENT, LATE, EXCUSED
    remarks TEXT,
    created_by UUID,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(course_id, student_id, date)
);
