import api from '../../services/apiClient';

export interface DashboardStats {
    active_students: number;
    active_courses: number;
    monthly_income: number;
    pending_payments: number;
}

export interface StudentDashboardStats {
    pending_assignments: number;
    attendance_percentage: number;
    average_grade: number;
    total_courses: number;
    recent_resources: Array<{ id: string; title: string; resource_type: string; created_at: string; courses: { name: string } }>;
    latest_announcement: { id: string; title: string; content: string; created_at: string } | null;
}

export interface AdminDashboardExtended {
    enrollments_this_month: number;
    delinquent_students: Array<{ name: string; total: number; oldest_due: string }>;
    recent_enrollments: Array<{ created_at: string; students: { full_name: string }; courses: { name: string } }>;
}

export const getDashboardStats = async () => {
    const response = await api.get<DashboardStats>('/api/reports/dashboard');
    return response.data;
};

export const getStudentDashboardStats = async () => {
    const response = await api.get<StudentDashboardStats>('/api/reports/student-dashboard');
    return response.data;
};

export const getAdminDashboardExtended = async () => {
    const response = await api.get<AdminDashboardExtended>('/api/reports/admin-dashboard-extended');
    return response.data;
};

export const getFinancialReport = async (startDate?: string, endDate?: string) => {
    const params: any = {};
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;

    const response = await api.get<any[]>('/api/reports/financial', { params });
    return response.data;
};

export const getPendingPaymentsReport = async () => {
    const response = await api.get<any[]>('/api/reports/pending-payments');
    return response.data;
};

export const getStudentReports = async () => {
    const response = await api.get<any[]>('/api/reports/students');
    return response.data;
};

