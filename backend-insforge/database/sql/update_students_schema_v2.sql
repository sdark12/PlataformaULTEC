-- ==========================================
-- SCRIPT DE ACTUALIZACIÓN: MEJORAS EN TABLA ESTUDIANTES
-- ==========================================

-- 1. Agregar columnas para Información Personal Adicional
ALTER TABLE students 
ADD COLUMN IF NOT EXISTS gender VARCHAR(20),
ADD COLUMN IF NOT EXISTS identification_document VARCHAR(50), -- DPI, CUI, Pasaporte
ADD COLUMN IF NOT EXISTS nationality VARCHAR(50) DEFAULT 'Guatemalteco';

-- 2. Agregar columnas para Información del Encargado (Padre/Tutor)
ALTER TABLE students
ADD COLUMN IF NOT EXISTS guardian_name VARCHAR(150),
ADD COLUMN IF NOT EXISTS guardian_phone VARCHAR(50),
ADD COLUMN IF NOT EXISTS guardian_email VARCHAR(150),
ADD COLUMN IF NOT EXISTS guardian_relationship VARCHAR(50); -- Padre, Madre, Tío, Abuelo, etc.

-- 3. Agregar columnas para Emergencias y Salud
ALTER TABLE students
ADD COLUMN IF NOT EXISTS emergency_contact_name VARCHAR(150),
ADD COLUMN IF NOT EXISTS emergency_contact_phone VARCHAR(50),
ADD COLUMN IF NOT EXISTS medical_notes TEXT; -- Alergias, condiciones especiales

-- 4. Agregar columnas Académicas/Administrativas
ALTER TABLE students
ADD COLUMN IF NOT EXISTS previous_school VARCHAR(150), -- Escuela de procedencia
ADD COLUMN IF NOT EXISTS admission_date DATE DEFAULT CURRENT_DATE;

-- Comentarios sobre las columnas para documentación
COMMENT ON COLUMN students.guardian_name IS 'Nombre del padre, madre o encargado legal';
COMMENT ON COLUMN students.guardian_relationship IS 'Relación del encargado con el estudiante (Ej: Padre, Madre)';
COMMENT ON COLUMN students.medical_notes IS 'Información médica relevante, alergias o condiciones';
