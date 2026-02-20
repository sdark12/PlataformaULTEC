-- =================================================================
-- SCRIPT COMPLETO DE CREACIÓN DE TABLAS FINANCIERAS Y POLÍTICAS
-- =================================================================
-- Copie y ejecute este script en: InsForge Dashboard > Database > SQL Editor

-- 1. Crear tabla PAYMENTS (Pagos)
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

-- 2. Crear tabla INVOICES (Facturas)
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

-- 3. Crear tabla INVOICE_ITEMS (Items de Factura)
CREATE TABLE IF NOT EXISTS invoice_items (
    id SERIAL PRIMARY KEY,
    invoice_id INTEGER REFERENCES invoices(id),
    description TEXT NOT NULL,
    quantity DECIMAL(10,2) NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL
);

-- 4. Crear tabla ATTENDANCE (Asistencia) - Por si acaso falta
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

-- 5. Habilitar RLS en todas las tablas financieras
ALTER TABLE financial_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;

-- 6. Crear políticas permisivas para usuarios autenticados
-- Elimina políticas anteriores para evitar duplicados
DROP POLICY IF EXISTS "Authenticated users can manage financial_status" ON financial_status;
DROP POLICY IF EXISTS "Authenticated users can manage payments" ON payments;
DROP POLICY IF EXISTS "Authenticated users can manage invoices" ON invoices;
DROP POLICY IF EXISTS "Authenticated users can manage invoice_items" ON invoice_items;
DROP POLICY IF EXISTS "Authenticated users can manage attendance" ON attendance;
DROP POLICY IF EXISTS "Authenticated users can manage enrollments" ON enrollments;

-- Crear nuevas políticas
CREATE POLICY "Authenticated users can manage financial_status" ON financial_status FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage payments" ON payments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage invoices" ON invoices FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage invoice_items" ON invoice_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage attendance" ON attendance FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage enrollments" ON enrollments FOR ALL TO authenticated USING (true) WITH CHECK (true);
