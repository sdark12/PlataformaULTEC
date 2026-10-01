-- Migration: create_student_interventions.sql
-- Fase 7: Inteligencia Institucional y Alerta Temprana de Deserción

CREATE TABLE IF NOT EXISTS public.student_interventions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    intervention_type VARCHAR(50) NOT NULL, -- 'PHONE_CALL', 'WHATSAPP', 'IN_PERSON_MEETING', 'PAYMENT_AGREEMENT', 'ACADEMIC_TUTORING'
    notes TEXT NOT NULL,
    commitment TEXT,
    follow_up_date DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN', -- 'OPEN', 'IN_PROGRESS', 'RESOLVED', 'DROPPED'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_student_interventions_student ON public.student_interventions(student_id);
CREATE INDEX IF NOT EXISTS idx_student_interventions_branch ON public.student_interventions(branch_id);
CREATE INDEX IF NOT EXISTS idx_student_interventions_status ON public.student_interventions(status);

ALTER TABLE public.student_interventions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'student_interventions' 
        AND policyname = 'Authenticated users can manage student_interventions'
    ) THEN
        CREATE POLICY "Authenticated users can manage student_interventions"
            ON public.student_interventions
            FOR ALL
            TO authenticated
            USING (true)
            WITH CHECK (true);
    END IF;
END $$;
