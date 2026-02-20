-- =================================================================
-- SCRIPT CORREGIDO: TABLAS FINANCIERAS CON UUID
-- =================================================================
-- El error anterior se debía a diferencias de tipo de datos (Integer vs UUID).
-- Este script usa UUID para compatibilidad con su esquema actual.

-- 1. Crear tabla PAYMENTS (Pagos)
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    enrollment_id UUID REFERENCES enrollments(id), -- Cambiado a UUID
    amount DECIMAL(10,2) NOT NULL,
    payment_date TIMESTAMP DEFAULT NOW(),
    method VARCHAR(50), -- CASH, TRANSFER, CARD
    reference_number VARCHAR(100),
    created_by UUID,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 2. Crear tabla INVOICES (Facturas)
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id UUID REFERENCES branches(id), -- Cambiado a UUID
    enrollment_id UUID REFERENCES enrollments(id), -- Cambiado a UUID
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    issue_date TIMESTAMP DEFAULT NOW(),
    total_amount DECIMAL(10,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'ISSUED',
    created_by UUID,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 3. Crear tabla INVOICE_ITEMS
CREATE TABLE IF NOT EXISTS invoice_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID REFERENCES invoices(id), -- Cambiado a UUID
    description TEXT NOT NULL,
    quantity DECIMAL(10,2) NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL
);

-- 4. Crear tabla ATTENDANCE (Asistencia)
CREATE TABLE IF NOT EXISTS attendance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_id UUID REFERENCES courses(id), -- Cambiado a UUID
    student_id UUID REFERENCES students(id), -- Cambiado a UUID
    date DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'PRESENT',
    remarks TEXT,
    created_by UUID,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(course_id, student_id, date)
);

-- 5. Habilitar RLS
ALTER TABLE financial_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;

-- 6. Crear políticas
-- Limpiar previas
DROP POLICY IF EXISTS "Authenticated users can manage financial_status" ON financial_status;
DROP POLICY IF EXISTS "Authenticated users can manage payments" ON payments;
DROP POLICY IF EXISTS "Authenticated users can manage invoices" ON invoices;
DROP POLICY IF EXISTS "Authenticated users can manage invoice_items" ON invoice_items;
DROP POLICY IF EXISTS "Authenticated users can manage attendance" ON attendance;
DROP POLICY IF EXISTS "Authenticated users can manage enrollments" ON enrollments;

-- Nuevas políticas
CREATE POLICY "Authenticated users can manage financial_status" ON financial_status FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage payments" ON payments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage invoices" ON invoices FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage invoice_items" ON invoice_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage attendance" ON attendance FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage enrollments" ON enrollments FOR ALL TO authenticated USING (true) WITH CHECK (true);
