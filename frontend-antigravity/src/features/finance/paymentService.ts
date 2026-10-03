import api from '../../services/apiClient';

export interface Payment {
    id: string;
    student_id?: string;
    enrollment_id?: string;
    student_name: string;
    course_name: string;
    academic_year?: number;
    amount: number;
    payment_date: string;
    method: string;
    reference_number: string;
    description?: string;
    tuition_month?: string;
    payment_type?: string;
    discount?: number;
}

export interface StudentStatementCourse {
    enrollment_id: string;
    course_id: string;
    course_name: string;
    academic_year?: number;
    monthly_fee: number;
    effective_monthly_fee?: number;
    scholarship_type?: string;
    scholarship_amount?: number;
    scholarship_reason?: string | null;
    duration_months: number;
    start_date?: string;
    enrollment_date: string;
    is_active: boolean;
    academic_status?: string;
    schedule_label?: string | null;
    months_elapsed: number;
    months_paid: number;
    months_pending: number;
    total_due: number;
    total_paid: number;
    pending_amount: number;
    is_solvent: boolean;
}

export interface StudentStatementPayment {
    id: string;
    amount: number;
    discount: number;
    payment_date: string;
    method: string;
    reference_number?: string;
    description?: string;
    tuition_month?: string;
    payment_type: string;
    enrollment_id?: string;
    course_name: string;
    academic_year?: number;
}

export interface StudentStatement {
    student: {
        id: string;
        full_name: string;
        personal_code?: string;
        identification_document?: string;
        phone?: string;
        guardian_name?: string;
        guardian_phone?: string;
        guardian_email?: string;
        branch_id: string;
        branch_name: string;
    };
    summary: {
        total_paid: number;
        total_discount: number;
        total_pending: number;
        is_solvent: boolean;
        active_courses_count: number;
        total_payments_count: number;
    };
    courses: StudentStatementCourse[];
    payments: StudentStatementPayment[];
    invoices: {
        id: number;
        invoice_number: string;
        total_amount: number;
        created_at: string;
    }[];
}

export interface BulkPaymentStudentItem {
    student_id: string;
    enrollment_id: string;
    amount: number;
    discount?: number;
    method?: string;
    reference_number?: string;
    notes?: string;
}

export interface BulkPaymentPayload {
    course_id: string;
    tuition_month: string;
    payment_date?: string;
    method: string;
    reference_prefix?: string;
    branch_id?: string;
    payments: BulkPaymentStudentItem[];
}

export interface BulkPaymentResponse {
    success: boolean;
    count: number;
    total_amount: number;
    course_name: string;
    tuition_month: string;
    results: {
        student_id: string;
        payment_id?: string;
        invoice_id?: number;
        invoice_number?: string;
        amount: number;
    }[];
}

export const getPayments = async (params?: { academic_year?: number | string }) => {
    const response = await api.get<Payment[]>('/api/payments', { params });
    return response.data;
};

export const createPayment = async (data: { 
    student_id: string; 
    courses: { enrollment_id: string, amount: number, discount: number }[]; 
    method: string; 
    reference_number: string; 
    description?: string; 
    tuition_month?: string; 
    payment_type?: string; 
    branch_id?: string 
}) => {
    const response = await api.post('/api/payments', data);
    return response.data;
};

export const updatePayment = async (id: string, data: Partial<Payment>) => {
    const response = await api.put(`/api/payments/${id}`, data);
    return response.data;
};

export const deletePayment = async (id: string) => {
    const response = await api.delete(`/api/payments/${id}`);
    return response.data;
};

export const getStudentStatement = async (studentId: string): Promise<StudentStatement> => {
    const response = await api.get<StudentStatement>(`/api/payments/statement/${studentId}`);
    return response.data;
};

export const createBulkGroupPayment = async (data: BulkPaymentPayload): Promise<BulkPaymentResponse> => {
    const response = await api.post<BulkPaymentResponse>('/api/payments/bulk-group', data);
    return response.data;
};

export interface SyncMonthlyFeesResponse {
    success: boolean;
    message: string;
    target_month: string;
    total_reconciled: number;
    total_paid: number;
    total_pending: number;
    total_partial: number;
    active_enrollments_processed: number;
}

export const syncMonthlyFees = async (payload?: { target_month?: string; filter_branch_id?: string }): Promise<SyncMonthlyFeesResponse> => {
    const response = await api.post<SyncMonthlyFeesResponse>('/api/payments/sync-monthly-fees', payload || {});
    return response.data;
};

export interface TuitionMonthStatus {
    month_num: number;
    month_name: string;
    label: string;
    is_paid: boolean;
    payment_date: string | null;
    is_current_invoice?: boolean;
}

export interface StudentSolvencySummary {
    has_inscription: boolean;
    inscription_date: string | null;
    total_tuitions_paid: number;
    last_month_name: string | null;
    last_payment_label: string;
    is_solvent: boolean;
    solvency_label: string;
    payment_history: TuitionMonthStatus[];
}

export interface VerifyInvoiceData {
    valid: boolean;
    invoice_number: string;
    issue_date: string;
    student_name: string;
    student_code: string;
    course_name: string;
    branch_name: string;
    branch_address?: string;
    branch_phone?: string;
    total_amount: number;
    status: string;
    items: {
        description: string;
        quantity: number;
        unit_price: number;
        total_price: number;
    }[];
    student_summary?: StudentSolvencySummary;
    message?: string;
}

export const verifyInvoicePublic = async (invoiceNumber: string): Promise<VerifyInvoiceData> => {
    const response = await api.get<VerifyInvoiceData>(`/api/invoices/verify/${encodeURIComponent(invoiceNumber)}`);
    return response.data;
};

