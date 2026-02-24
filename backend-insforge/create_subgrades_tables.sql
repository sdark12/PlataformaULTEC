-- Tabla de Categorías de Subcalificaciones (ej. Cuaderno, Comportamiento)
CREATE TABLE IF NOT EXISTS subgrade_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
    unit_name VARCHAR(100) NOT NULL, -- Ej: 'Unidad 1'
    name VARCHAR(100) NOT NULL, -- Ej: 'Cuaderno'
    max_score DECIMAL(5,2) NOT NULL DEFAULT 100,
    created_by UUID,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(course_id, unit_name, name)
);

-- Habilitar RLS
ALTER TABLE subgrade_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can manage subgrade categories" ON subgrade_categories;
CREATE POLICY "Authenticated users can manage subgrade categories" ON subgrade_categories FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Tabla de Notas Específicas (Subcalificaciones)
CREATE TABLE IF NOT EXISTS subgrades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id UUID REFERENCES subgrade_categories(id) ON DELETE CASCADE,
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    score DECIMAL(5,2) NOT NULL,
    remarks TEXT,
    created_by UUID,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(category_id, student_id)
);

-- Habilitar RLS
ALTER TABLE subgrades ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can manage subgrades" ON subgrades;
CREATE POLICY "Authenticated users can manage subgrades" ON subgrades FOR ALL TO authenticated USING (true) WITH CHECK (true);
