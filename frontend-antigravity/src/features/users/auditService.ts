import api from '../../services/apiClient';

export interface AuditLog {
    id: number;
    action: string;
    entity: string;
    entity_id: string | null;
    user_id: string | null;
    branch_id: string | null;
    new_data: any;
    old_data: any;
    ip_address: string;
    metadata: any;
    created_at: string;
    user?: {
        id: string;
        full_name: string;
        email: string;
        role: string;
    };
    branch?: {
        id: number;
        name: string;
    };
}

export const getAuditLogs = async (): Promise<AuditLog[]> => {
    const response = await api.get('/api/audit-logs');
    return response.data;
};
