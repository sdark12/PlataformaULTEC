-- 1. Crear tabla para los Vínculos Familiares (si no existe)
CREATE TABLE IF NOT EXISTS public.parent_student_links (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    parent_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    relationship VARCHAR(50) DEFAULT 'parent', 
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(parent_user_id, student_id)
);

-- 2. Habilitar RLS (Row Level Security) para la tabla de vínculos
ALTER TABLE public.parent_student_links ENABLE ROW LEVEL SECURITY;

-- 3. Políticas de seguridad (ajustables según necesidad, actualmente permite a usuarios autenticados)
DROP POLICY IF EXISTS "Allow authenticated to read parentlinks" ON public.parent_student_links;
CREATE POLICY "Allow authenticated to read parentlinks" ON public.parent_student_links FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow authenticated to insert parentlinks" ON public.parent_student_links;
CREATE POLICY "Allow authenticated to insert parentlinks" ON public.parent_student_links FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow authenticated to delete parentlinks" ON public.parent_student_links;
CREATE POLICY "Allow authenticated to delete parentlinks" ON public.parent_student_links FOR DELETE USING (auth.role() = 'authenticated');

-- 4. Actualizar restricciones en la tabla 'profiles' para aceptar el rol 'parent'
-- Si la columna 'role' es de tipo TEXT con un CHECK constraint:
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('superadmin', 'admin', 'secretary', 'instructor', 'student', 'parent'));

-- Alternativa si 'role' usa un tipo ENUM personalizado llamado 'user_role' u otro nombre
-- (Si el script falla arriba, comenta las dos líneas de arriba y descomenta esta línea de abajo:)
-- ALTER TYPE custom_role_type ADD VALUE IF NOT EXISTS 'parent';

-- 5. Asegurar que las columnas opcionales existan en profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;
