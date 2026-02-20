import api from '../../services/apiClient';

export interface DashboardStats {
    active_students: number;
    active_courses: number;
    monthly_income: number;
    pending_payments: number;
}

export const getDashboardStats = async () => {
    const response = await api.get<DashboardStats>('/api/reports/dashboard');
    return response.data;
};

export const getFinancialReport = async (startDate?: string, endDate?: string) => {
    const params: any = {};
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;

    const response = await api.get<any[]>('/api/reports/financial', { params });
    return response.data;
};
