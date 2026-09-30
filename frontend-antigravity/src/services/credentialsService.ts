import api from './apiClient';

export interface StudentCredentialCard {
    student_id: string;
    full_name: string;
    student_code: string;
    status: string;
    branch_name: string;
    branch_address: string;
    branch_phone: string;
    course_name: string;
    courses: string[];
    cycle: string;
    valid_until: string;
    emergency_contact: {
        name: string;
        phone: string;
        relationship: string;
    };
    physical_card: {
        is_delivered: boolean;
        delivered_at: string | null;
        delivered_by: string | null;
    };
    verification_url: string;
}

export interface CredentialStatusResponse {
    student: {
        id: string;
        full_name: string;
        personal_code: string;
        branch_name: string;
        courses: string[];
        status: string;
    };
    request: {
        id: number;
        student_id: string;
        document_type: string;
        status: 'PENDING' | 'READY' | 'DELIVERED' | 'REJECTED';
        reason: string;
        notes: string;
        requested_by: string | null;
        requested_at: string;
        authorized_by: string | null;
        authorized_at: string | null;
        delivered_by: string | null;
        delivered_at: string | null;
    } | null;
}

export interface CredentialRequestItem {
    id: number;
    student_id: string;
    status: 'PENDING' | 'READY' | 'DELIVERED' | 'REJECTED';
    reason: string;
    request_type: string;
    requested_at: string;
    authorized_by: string | null;
    authorized_at: string | null;
    delivered_by: string | null;
    delivered_at: string | null;
    full_name: string;
    personal_code: string;
    branch_id?: string;
    branch_name: string;
    courses: string[];
    is_active: boolean;
}

export const credentialsService = {
    /**
     * Obtener datos completos de la credencial/carnet estudiantil
     */
    getStudentCredentialCard: async (studentId: string = 'me'): Promise<StudentCredentialCard> => {
        const response = await api.get<StudentCredentialCard>(`/api/credentials/card-data/${encodeURIComponent(studentId)}`);
        return response.data;
    },

    /**
     * Consultar estado del trámite de carnet físico
     */
    getMyCredentialStatus: async (studentId?: string): Promise<CredentialStatusResponse> => {
        const endpoint = studentId 
            ? `/api/credentials/my-status/${encodeURIComponent(studentId)}` 
            : '/api/credentials/my-status';
        const response = await api.get<CredentialStatusResponse>(endpoint);
        return response.data;
    },

    /**
     * Solicitar emisión o reposición de carnet físico oficial
     */
    requestPhysicalCredential: async (data: {
        student_id?: string;
        reason?: string;
        request_type?: 'FIRST_TIME' | 'REPLACEMENT' | 'RENEWAL';
    }): Promise<{ success: boolean; message: string; request: any }> => {
        const response = await api.post('/api/credentials/request', data);
        return response.data;
    },

    /**
     * Listado administrativo de solicitudes de carnets
     */
    getCredentialRequests: async (params?: {
        status?: string;
        branch_id?: string;
        search?: string;
    }): Promise<CredentialRequestItem[]> => {
        const response = await api.get<CredentialRequestItem[]>('/api/credentials/requests', { params });
        return response.data;
    },

    /**
     * Actualizar estado de solicitud (Listo para entrega / Entregado presencial)
     */
    updateCredentialRequestStatus: async (
        id: number,
        data: { status: 'READY' | 'DELIVERED' | 'REJECTED' | 'PENDING'; notes?: string }
    ): Promise<{ success: boolean; message: string; request: any }> => {
        const response = await api.put(`/api/credentials/requests/${id}/status`, data);
        return response.data;
    }
};
