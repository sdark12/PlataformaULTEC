-- Agregar un campo opcional genérico dentro de la tabla de estudiantes
-- Enlaza un Estudiante (perfil académico) a Autenticaciones UUID 
-- En Cascada (Delete SET NULL) para proteger los datos si un usuario se borra accidentalmente.

ALTER TABLE public.students 
ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
