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
        id: number | string;
        name: string;
    };
}

export interface AuditLogFilterParams {
    page?: number;
    limit?: number;
    search?: string;
    action?: string;
    entity?: string;
    startDate?: string;
    endDate?: string;
    branchId?: string;
    export?: boolean;
}

export interface AuditLogsResponse {
    data: AuditLog[];
    meta: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    };
}

export interface AuditStats {
    total: number;
    logins: number;
    creates: number;
    updates: number;
    deletes: number;
    today: number;
}

export const getAuditLogs = async (params: AuditLogFilterParams = {}): Promise<AuditLogsResponse> => {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.append('page', params.page.toString());
    if (params.limit) queryParams.append('limit', params.limit.toString());
    if (params.search) queryParams.append('search', params.search);
    if (params.action && params.action !== 'ALL') queryParams.append('action', params.action);
    if (params.entity && params.entity !== 'ALL') queryParams.append('entity', params.entity);
    if (params.startDate) queryParams.append('startDate', params.startDate);
    if (params.endDate) queryParams.append('endDate', params.endDate);
    if (params.branchId && params.branchId !== 'all') queryParams.append('branchId', params.branchId);
    if (params.export) queryParams.append('export', 'true');

    const response = await api.get(`/api/audit-logs?${queryParams.toString()}`);
    // Support backwards-compatible arrays if needed
    if (Array.isArray(response.data)) {
        return {
            data: response.data,
            meta: {
                total: response.data.length,
                page: 1,
                limit: response.data.length,
                totalPages: 1
            }
        };
    }
    return response.data;
};

export const getAuditStats = async (branchId?: string): Promise<AuditStats> => {
    const queryParams = branchId && branchId !== 'all' ? `?branchId=${branchId}` : '';
    const response = await api.get(`/api/audit-logs/stats${queryParams}`);
    return response.data;
};
