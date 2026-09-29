-- ==========================================================
-- Migración: Módulo de Caja Chica y Arqueo Diario por Sede
-- Fase 3.2 - Versión v1.1.19
-- ==========================================================

-- 1. Tabla de Turnos / Sesiones de Caja (cash_shifts)
CREATE TABLE IF NOT EXISTS public.cash_shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    opened_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    closed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    opened_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
    closed_at TIMESTAMP WITH TIME ZONE,
    opening_balance NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    cash_inflow NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    other_inflow NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    expenses_outflow NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    expected_cash NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    actual_cash NUMERIC(10,2),
    difference NUMERIC(10,2) DEFAULT 0.00,
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED', 'AUDITED')),
    opening_notes TEXT,
    closing_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Índices de búsqueda para optimizar consultas de caja
CREATE INDEX IF NOT EXISTS idx_cash_shifts_branch_status ON public.cash_shifts (branch_id, status);
CREATE INDEX IF NOT EXISTS idx_cash_shifts_opened_at ON public.cash_shifts (opened_at DESC);

-- 2. Tabla de Gastos Menores / Egresos de Caja Chica (cash_expenses)
CREATE TABLE IF NOT EXISTS public.cash_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    shift_id UUID NOT NULL REFERENCES public.cash_shifts(id) ON DELETE CASCADE,
    category VARCHAR(50) NOT NULL DEFAULT 'supplies',
    description TEXT NOT NULL,
    amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
    receipt_number VARCHAR(100),
    receipt_url TEXT,
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_cash_expenses_shift_id ON public.cash_expenses (shift_id);
CREATE INDEX IF NOT EXISTS idx_cash_expenses_branch_id ON public.cash_expenses (branch_id);

-- 3. Vincular pagos a turnos de caja (opcional, no bloqueante)
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS cash_shift_id UUID REFERENCES public.cash_shifts(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_payments_cash_shift_id ON public.payments (cash_shift_id);

-- 4. Habilitar y Configurar Row Level Security (RLS)
ALTER TABLE public.cash_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Manage cash shifts" ON public.cash_shifts;
CREATE POLICY "Manage cash shifts" ON public.cash_shifts FOR ALL USING (
    (branch_id = get_user_branch_id()) OR (get_user_role() IN ('admin', 'superadmin'))
);

DROP POLICY IF EXISTS "Manage cash expenses" ON public.cash_expenses;
CREATE POLICY "Manage cash expenses" ON public.cash_expenses FOR ALL USING (
    (branch_id = get_user_branch_id()) OR (get_user_role() IN ('admin', 'superadmin'))
);
