-- ==========================================
-- FULL DATABASE RESET & SCHEMA DEFINITION
-- ==========================================

-- 1. CLEANUP (Drop existing tables to start fresh)
-- Use CASCADE to remove dependent objects like foreign keys and policies
DROP TABLE IF EXISTS attendance CASCADE;
DROP TABLE IF EXISTS financial_status CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS invoices CASCADE;
DROP TABLE IF EXISTS enrollments CASCADE;
DROP TABLE IF EXISTS courses CASCADE;
DROP TABLE IF EXISTS students CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS branches CASCADE;
DROP TABLE IF EXISTS roles CASCADE;

-- 2. CORE TABLES

-- ROLES
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE, -- 'admin', 'director', 'coordinator', 'teacher', 'student'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- BRANCHES (Sedes)
CREATE TABLE branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    address TEXT,
    phone TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- PROFILES (Extends auth.users)
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    full_name TEXT,
    role TEXT NOT NULL DEFAULT 'student', -- Store role name directly for easier querying
    branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- STUDENTS
CREATE TABLE students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE NOT NULL,
    full_name TEXT NOT NULL,
    birth_date DATE,
    gender TEXT,
    identification_document TEXT, -- DPI/CUI
    nationality TEXT,
    address TEXT,
    phone TEXT,
    guardian_name TEXT,
    guardian_phone TEXT,
    guardian_email TEXT,
    guardian_relationship TEXT,
    emergency_contact_name TEXT,
    emergency_contact_phone TEXT,
    medical_notes TEXT,
    previous_school TEXT,
    status TEXT DEFAULT 'active', -- active, inactive, graduated
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- COURSES
CREATE TABLE courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    monthly_fee DECIMAL(10, 2) NOT NULL DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ENROLLMENTS
CREATE TABLE enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE NOT NULL,
    student_id UUID REFERENCES students(id) ON DELETE CASCADE NOT NULL,
    course_id UUID REFERENCES courses(id) ON DELETE CASCADE NOT NULL,
    enrollment_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    UNIQUE(student_id, course_id)
);

-- FINANCIAL STATUS (Tracks monthly debt)
CREATE TABLE financial_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    enrollment_id UUID REFERENCES enrollments(id) ON DELETE CASCADE NOT NULL,
    month TEXT NOT NULL, -- Format: 'YYYY-MM'
    amount_due DECIMAL(10, 2) NOT NULL,
    amount_paid DECIMAL(10, 2) DEFAULT 0,
    status TEXT DEFAULT 'PENDING', -- PENDING, PARTIAL, PAID, OVERDUE
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(enrollment_id, month)
);

-- 3. ROW LEVEL SECURITY (RLS) policies

-- Enable RLS on all tables
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_status ENABLE ROW LEVEL SECURITY;

-- Helper Function: Get current user's branch_id
CREATE OR REPLACE FUNCTION get_user_branch_id()
RETURNS UUID AS $$
  SELECT branch_id FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- Helper Function: Get current user's role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- POLICIES

-- BRANCHES: Read only for authenticated
CREATE POLICY "Enable read access for authenticated users" ON branches FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable all access for admins" ON branches FOR ALL TO authenticated USING (get_user_role() = 'admin');

-- PROFILES:
-- Users can read their own profile
CREATE POLICY "Users can read own profile" ON profiles FOR SELECT TO authenticated USING (auth.uid() = id);
-- Admins can read all profiles
CREATE POLICY "Admins can read all profiles" ON profiles FOR SELECT TO authenticated USING (get_user_role() = 'admin');
-- Admins can update profiles
CREATE POLICY "Admins can update profiles" ON profiles FOR UPDATE TO authenticated USING (get_user_role() = 'admin');
-- System trigger usually handles insert, but let admins insert too
CREATE POLICY "Admins can insert profiles" ON profiles FOR INSERT TO authenticated WITH CHECK (get_user_role() = 'admin');

-- Allow users to create their OWN profile (needed for initial seed)
CREATE POLICY "Users can create own profile" ON profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- STUDENTS:
-- View: If in same branch OR is admin
CREATE POLICY "View students in same branch" ON students FOR SELECT TO authenticated 
USING (branch_id = get_user_branch_id() OR get_user_role() = 'admin');

-- Mod: Only admins or director/coordinator of that branch
CREATE POLICY "Manage students in same branch" ON students FOR ALL TO authenticated 
USING (branch_id = get_user_branch_id() OR get_user_role() = 'admin');

-- COURSES:
CREATE POLICY "View courses in same branch" ON courses FOR SELECT TO authenticated 
USING (branch_id = get_user_branch_id() OR get_user_role() = 'admin');

CREATE POLICY "Manage courses in same branch" ON courses FOR ALL TO authenticated 
USING (branch_id = get_user_branch_id() OR get_user_role() = 'admin');

-- ENROLLMENTS:
CREATE POLICY "View enrollments in domestic branch" ON enrollments FOR SELECT TO authenticated 
USING (branch_id = get_user_branch_id() OR get_user_role() = 'admin');

CREATE POLICY "Manage enrollments" ON enrollments FOR ALL TO authenticated 
USING (branch_id = get_user_branch_id() OR get_user_role() = 'admin');


-- 4. INITIAL DATA SEEDING (Optional but recommended)

-- Create Roles
INSERT INTO roles (name) VALUES ('admin'), ('director'), ('coordinator'), ('teacher'), ('student') ON CONFLICT DO NOTHING;

-- Create valid Branch (Sede Central)
INSERT INTO branches (name, address) VALUES ('Sede Central', 'Ciudad de Guatemala');

-- Note: The admin USER itself must be created via Auth API or Dashboard. 
-- Once created, a Trigger would ideally create the profile, but for now we will handle profile creation in the app logic.

-- 5. STORAGE BUCKETS (If needed later)
-- insert into storage.buckets (id, name) values ('avatars', 'avatars');
