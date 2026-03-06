-- =================================================================
-- MIGRAcIóN: Horarios Flexibles y Recibos Unificados
-- =================================================================

-- 1. Crear tabla de horarios de cursos (course_schedules)
CREATE TABLE IF NOT EXISTS course_schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
    grade VARCHAR(100) NOT NULL, -- Ej. "2do Básico"
    day_of_week VARCHAR(20) NOT NULL, -- Ej. "Martes"
    start_time TIME NOT NULL, -- Ej. "14:00:00"
    end_time TIME NOT NULL, -- Ej. "16:00:00"
    created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE course_schedules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can manage course_schedules" ON course_schedules;
CREATE POLICY "Authenticated users can manage course_schedules" ON course_schedules FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 2. Modificar enrollments para incluir el horario
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS schedule_id UUID REFERENCES course_schedules(id) ON DELETE SET NULL;

-- 3. Modificar payments y invoices
-- Como la BD puede tener id's mezclados entre Integer y UUID (por migraciones previas), 
-- agregamos las columnas como UUID ya que es el estándar hacia adelante.

ALTER TABLE payments ADD COLUMN IF NOT EXISTS student_id UUID;
ALTER TABLE payments ALTER COLUMN enrollment_id DROP NOT NULL;

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS student_id UUID;
ALTER TABLE invoices ALTER COLUMN enrollment_id DROP NOT NULL;

ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS enrollment_id UUID;

-- Intentamos actualizar los datos si los IDs son casteables
DO $$
BEGIN
    BEGIN
        -- Cast enrollment_id a UUID en caso de que lo permita (o a integer si es al reves)
        -- Para evitar errores de casteo agresivo que bloqueen, usamos texto intermedio.
        UPDATE payments p
        SET student_id = e.student_id
        FROM enrollments e
        WHERE p.enrollment_id::text = e.id::text AND p.student_id IS NULL;
    EXCEPTION WHEN OTHERS THEN 
        RAISE NOTICE 'No se pudo migrar la data de payments: %', SQLERRM;
    END;

    BEGIN
        UPDATE invoices i
        SET student_id = e.student_id
        FROM enrollments e
        WHERE i.enrollment_id::text = e.id::text AND i.student_id IS NULL;
    EXCEPTION WHEN OTHERS THEN 
        RAISE NOTICE 'No se pudo migrar la data de invoices: %', SQLERRM;
    END;

    BEGIN
        UPDATE invoice_items ii
        SET enrollment_id = i.enrollment_id
        FROM invoices i
        WHERE ii.invoice_id::text = i.id::text AND ii.enrollment_id IS NULL AND i.enrollment_id IS NOT NULL;
    EXCEPTION WHEN OTHERS THEN 
        RAISE NOTICE 'No se pudo migrar la data de invoice_items: %', SQLERRM;
    END;
END $$;
