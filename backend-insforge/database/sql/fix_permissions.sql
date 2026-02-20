-- ================================================================
-- SCRIPT DE CORRECCIÓN DE PERMISOS (RLS)
-- Ejecuta esto en: InsForge Dashboard > Database > SQL Editor
-- ================================================================

-- 1. Grant generic permissions to authenticated role
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- 2. Students Table
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all for authenticated" ON students;
CREATE POLICY "Enable all for authenticated" ON students FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3. Courses Table
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all for authenticated" ON courses;
CREATE POLICY "Enable all for authenticated" ON courses FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 4. Enrollments Table
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all for authenticated" ON enrollments;
CREATE POLICY "Enable all for authenticated" ON enrollments FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 5. Branches Table (Read only usually, but let's allow all for admin simplicity for now)
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all for authenticated" ON branches;
CREATE POLICY "Enable all for authenticated" ON branches FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 6. Attendance
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all for authenticated" ON attendance;
CREATE POLICY "Enable all for authenticated" ON attendance FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 7. Payments
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all for authenticated" ON payments;
CREATE POLICY "Enable all for authenticated" ON payments FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 8. Invoices
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all for authenticated" ON invoices;
CREATE POLICY "Enable all for authenticated" ON invoices FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 9. Profiles (Ensure permissions exist)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all for authenticated" ON profiles;
CREATE POLICY "Enable all for authenticated" ON profiles FOR ALL TO authenticated USING (true) WITH CHECK (true);
