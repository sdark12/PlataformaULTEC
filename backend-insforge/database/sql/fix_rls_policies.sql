-- =================================================================
-- SCRIPT DE CORRECCIÓN DE POLÍTICAS DE SEGURIDAD (RLS)
-- =================================================================
-- Copie y ejecute este script en: InsForge Dashboard > Database > SQL Editor

-- 1. Habilitar RLS en tablas críticas (si no lo están ya)
ALTER TABLE IF EXISTS financial_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS attendance ENABLE ROW LEVEL SECURITY;

-- 2. Crear políticas permisivas para usuarios autenticados (Admin/Instructor)
-- Nota: En producción, estas políticas deberían ser más restrictivas (ej. solo role='admin')
-- Por ahora, permitimos que cualquier usuario autenticado gestione estos registros.

-- POLICY: financial_status
DROP POLICY IF EXISTS "Authenticated users can manage financial_status" ON financial_status;
CREATE POLICY "Authenticated users can manage financial_status"
ON financial_status
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- POLICY: payments
DROP POLICY IF EXISTS "Authenticated users can manage payments" ON payments;
CREATE POLICY "Authenticated users can manage payments"
ON payments
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- POLICY: invoices
DROP POLICY IF EXISTS "Authenticated users can manage invoices" ON invoices;
CREATE POLICY "Authenticated users can manage invoices"
ON invoices
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- POLICY: invoice_items
DROP POLICY IF EXISTS "Authenticated users can manage invoice_items" ON invoice_items;
CREATE POLICY "Authenticated users can manage invoice_items"
ON invoice_items
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- POLICY: attendance
DROP POLICY IF EXISTS "Authenticated users can manage attendance" ON attendance;
CREATE POLICY "Authenticated users can manage attendance"
ON attendance
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- 3. Asegurar que Enrollments también tenga políticas
ALTER TABLE IF EXISTS enrollments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can manage enrollments" ON enrollments;
CREATE POLICY "Authenticated users can manage enrollments"
ON enrollments
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);
