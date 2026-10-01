import api from '../../services/apiClient';
import type { 
    EarlyWarningResponse, 
    DebtAgingResponse, 
    StudentIntervention 
} from '../../types/intelligence';

export const getEarlyWarningReport = async (params?: {
    course_id?: string;
    risk_level?: string;
    search?: string;
    force_refresh?: boolean;
}): Promise<EarlyWarningResponse> => {
    const response = await api.get<EarlyWarningResponse>('/api/intelligence/early-warning', {
        params
    });
    return response.data;
};

export const getDebtAgingReport = async (params?: {
    course_id?: string;
    force_refresh?: boolean;
}): Promise<DebtAgingResponse> => {
    const response = await api.get<DebtAgingResponse>('/api/intelligence/debt-aging', {
        params
    });
    return response.data;
};

export const getStudentInterventions = async (studentId: string): Promise<StudentIntervention[]> => {
    const response = await api.get<StudentIntervention[]>(`/api/intelligence/interventions/${studentId}`);
    return response.data;
};

export const createStudentIntervention = async (
    data: {
        student_id: string;
        intervention_type: string;
        notes: string;
        commitment?: string;
        follow_up_date?: string;
        status?: string;
    }
): Promise<StudentIntervention> => {
    const response = await api.post<StudentIntervention>('/api/intelligence/interventions', data);
    return response.data;
};

export const updateStudentIntervention = async (
    id: string,
    data: {
        status?: string;
        commitment?: string;
        follow_up_date?: string;
        notes?: string;
    }
): Promise<StudentIntervention> => {
    const response = await api.patch<StudentIntervention>(`/api/intelligence/interventions/${id}`, data);
    return response.data;
};
