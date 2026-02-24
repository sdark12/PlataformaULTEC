-- Añadir la columna de duración en meses a la tabla cursos para cursos flexibles/intensivos
ALTER TABLE courses ADD COLUMN IF NOT EXISTS duration_months INTEGER DEFAULT 11;
