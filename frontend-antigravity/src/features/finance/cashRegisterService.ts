import api from '../../services/apiClient';

export interface CashShift {
    id: string;
    branch_id: string;
    opened_by: string;
    closed_by?: string | null;
    opened_at: string;
    closed_at?: string | null;
    opening_balance: number;
    cash_inflow: number;
    other_inflow: number;
    expenses_outflow: number;
    expected_cash: number;
    actual_cash?: number | null;
    difference?: number | null;
    status: 'OPEN' | 'CLOSED' | 'AUDITED';
    opening_notes?: string | null;
    closing_notes?: string | null;
    opened_by_name?: string;
    closed_by_name?: string;
    branch_name?: string;
    branch_address?: string;
    branch_phone?: string;
}

export interface CashExpense {
    id: string;
    branch_id: string;
    shift_id: string;
    category: string;
    description: string;
    amount: number;
    receipt_number?: string | null;
    receipt_url?: string | null;
    created_by: string;
    created_at: string;
}

export interface ShiftPayment {
    id: string;
    amount: number;
    method: string;
    description: string;
    payment_type?: string;
    tuition_month?: string;
    payment_date: string;
    reference_number?: string;
    created_by?: string;
    students?: {
        id: string;
        full_name: string;
        academy_code?: string;
    };
}

export interface CurrentShiftResponse {
    active: boolean;
    requires_branch_selection?: boolean;
    message?: string;
    shift: CashShift | null;
    payments: ShiftPayment[];
    expenses: CashExpense[];
}

export interface OpenShiftPayload {
    opening_balance: number;
    opening_notes?: string;
    branch_id?: string;
}

export interface CloseShiftPayload {
    actual_cash: number;
    closing_notes?: string;
    shift_id?: string;
}

export interface ExpensePayload {
    description: string;
    amount: number;
    category?: string;
    receipt_number?: string;
    receipt_url?: string;
    shift_id?: string;
}

export interface ShiftDetailsResponse {
    shift: CashShift;
    payments: ShiftPayment[];
    expenses: CashExpense[];
}

export const cashRegisterService = {
    // 1. Obtener estado del turno activo en la sede actual
    getCurrentShift: async (): Promise<CurrentShiftResponse> => {
        const response = await api.get('/api/cash-register/current');
        return response.data;
    },

    // 2. Abrir nuevo turno de caja
    openShift: async (payload: OpenShiftPayload): Promise<{ message: string; shift: CashShift }> => {
        const response = await api.post('/api/cash-register/open', payload);
        return response.data;
    },

    // 3. Registrar egreso menor de caja chica
    recordExpense: async (payload: ExpensePayload): Promise<{ message: string; expense: CashExpense }> => {
        const response = await api.post('/api/cash-register/expense', payload);
        return response.data;
    },

    // 4. Eliminar egreso menor
    deleteExpense: async (id: string): Promise<{ message: string }> => {
        const response = await api.delete(`/api/cash-register/expense/${id}`);
        return response.data;
    },

    // 5. Arqueo y cierre de turno
    closeShift: async (payload: CloseShiftPayload): Promise<{ message: string; shift: CashShift; summary: any }> => {
        const response = await api.post('/api/cash-register/close', payload);
        return response.data;
    },

    // 6. Consultar historial de turnos cerrados
    getShiftsHistory: async (limit: number = 30): Promise<CashShift[]> => {
        const response = await api.get('/api/cash-register/history', { params: { limit } });
        return response.data;
    },

    // 7. Detalle completo de turno para arqueo / comprobante
    getShiftDetails: async (id: string): Promise<ShiftDetailsResponse> => {
        const response = await api.get(`/api/cash-register/shifts/${id}`);
        return response.data;
    },

    // 8. Visar / auditar turno
    auditShift: async (id: string, audit_notes?: string): Promise<{ message: string; shift: CashShift }> => {
        const response = await api.patch(`/api/cash-register/shifts/${id}/audit`, { audit_notes });
        return response.data;
    }
};
