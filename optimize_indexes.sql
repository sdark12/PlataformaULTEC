-- ============================================================
-- Plataforma ULTEC - Paso 5: Optimización de Índices de Alta Concurrencia
-- ============================================================

-- 1. Habilitar extensión pg_trgm para acelerar búsquedas ILIKE con operadores GIN
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Índices B-Tree para tabla `profiles`
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles USING btree (email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles USING btree (role);
CREATE INDEX IF NOT EXISTS idx_profiles_active ON public.profiles USING btree (active);
CREATE INDEX IF NOT EXISTS idx_profiles_branch_id ON public.profiles USING btree (branch_id);
CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON public.profiles USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_last_login_at ON public.profiles USING btree (last_login_at DESC NULLS LAST);

-- 3. Índice GIN Trigram para búsquedas de texto instantáneas en `profiles`
CREATE INDEX IF NOT EXISTS idx_profiles_trgm_name ON public.profiles USING gin (full_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_profiles_trgm_email ON public.profiles USING gin (email gin_trgm_ops);

-- 4. Índices B-Tree para tabla `students`
CREATE INDEX IF NOT EXISTS idx_students_user_id ON public.students USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_students_branch_id ON public.students USING btree (branch_id);
CREATE INDEX IF NOT EXISTS idx_students_academy_code ON public.students USING btree (academy_code);
CREATE INDEX IF NOT EXISTS idx_students_personal_code ON public.students USING btree (personal_code);
CREATE INDEX IF NOT EXISTS idx_students_full_name ON public.students USING btree (full_name);

-- 5. Índices para tabla `parent_student_links`
CREATE INDEX IF NOT EXISTS idx_parent_student_links_student ON public.parent_student_links USING btree (student_id);
CREATE INDEX IF NOT EXISTS idx_parent_student_links_parent ON public.parent_student_links USING btree (parent_user_id);

-- 6. Analizar tablas para actualizar estadísticas del planificador de consultas
ANALYZE public.profiles;
ANALYZE public.students;
ANALYZE public.parent_student_links;
