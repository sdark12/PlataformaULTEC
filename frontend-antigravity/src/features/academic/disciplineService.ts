import api from '../../services/apiClient';

export interface DisciplineIncident {
    id: string;
    student_id: string;
    course_id: string | null;
    branch_id: string | null;
    incident_type: string;
    severity: string;
    title: string;
    description: string | null;
    action_taken: string | null;
    incident_date: string;
    reported_by: string | null;
    parent_notified: boolean;
    resolved: boolean;
    resolved_at: string | null;
    resolved_by: string | null;
    resolution_notes: string | null;
    created_at: string;
    students?: { id: string; full_name: string; personal_code: string; academy_code?: string };
    courses?: { id: string; name: string } | null;
    reporter?: { full_name: string } | null;
    resolver?: { full_name: string } | null;
}

export interface DisciplineFilters {
    student_id?: string;
    incident_type?: string;
    severity?: string;
    course_id?: string;
    resolved?: string;
    start_date?: string;
    end_date?: string;
    search?: string;
}

export const getIncidents = async (filters?: DisciplineFilters) => {
    const params = new URLSearchParams();
    if (filters?.student_id) params.append('student_id', filters.student_id);
    if (filters?.incident_type) params.append('incident_type', filters.incident_type);
    if (filters?.severity) params.append('severity', filters.severity);
    if (filters?.course_id) params.append('course_id', filters.course_id);
    if (filters?.resolved !== undefined && filters.resolved !== '') params.append('resolved', filters.resolved);
    if (filters?.start_date) params.append('start_date', filters.start_date);
    if (filters?.end_date) params.append('end_date', filters.end_date);
    if (filters?.search) params.append('search', filters.search);
    const query = params.toString() ? `?${params.toString()}` : '';
    const response = await api.get<DisciplineIncident[]>(`/api/discipline${query}`);
    return response.data;
};

export const createIncident = async (data: Partial<DisciplineIncident>) => {
    const response = await api.post<DisciplineIncident>('/api/discipline', data);
    return response.data;
};

export const updateIncident = async (id: string, data: Partial<DisciplineIncident>) => {
    const response = await api.put<DisciplineIncident>(`/api/discipline/${id}`, data);
    return response.data;
};

export const resolveIncident = async (id: string, resolution_notes?: string) => {
    const response = await api.put<DisciplineIncident>(`/api/discipline/${id}/resolve`, { resolution_notes });
    return response.data;
};

export const deleteIncident = async (id: string) => {
    const response = await api.delete(`/api/discipline/${id}`);
    return response.data;
};
