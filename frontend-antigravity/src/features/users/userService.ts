import api from '../../services/apiClient';

export interface UserStats {
    total: number;
    active: number;
    inactive: number;
    byRole: {
        student: number;
        parent: number;
        instructor: number;
        secretary: number;
        admin: number;
        superadmin: number;
        [key: string]: number;
    };
}

export const getUserStats = async (branchId?: string): Promise<UserStats> => {
    const params = new URLSearchParams();
    if (branchId && branchId !== 'all') params.append('branch_id', branchId);
    const query = params.toString() ? `?${params.toString()}` : '';
    const response = await api.get(`/api/users/stats${query}`);
    return response.data;
};

export const getUsers = async (page?: number, limit?: number, search?: string, role?: string, status?: string, branchId?: string) => {
    const params = new URLSearchParams();
    if (page) params.append('page', page.toString());
    if (limit) params.append('limit', limit.toString());
    if (search) params.append('search', search);
    if (role && role !== 'all') params.append('role', role);
    if (status && status !== 'all') params.append('status', status);
    if (branchId && branchId !== 'all') params.append('branch_id', branchId);

    const query = params.toString() ? `?${params.toString()}` : '';
    const response = await api.get(`/api/users${query}`);
    
    if (page || limit) return response.data;
    return response.data.data || response.data;
};

export const exportUsers = async (search?: string, role?: string, status?: string, branchId?: string) => {
    const params = new URLSearchParams();
    params.append('export', 'true');
    if (search) params.append('search', search);
    if (role && role !== 'all') params.append('role', role);
    if (status && status !== 'all') params.append('status', status);
    if (branchId && branchId !== 'all') params.append('branch_id', branchId);

    const response = await api.get(`/api/users?${params.toString()}`);
    return response.data?.data || response.data || [];
};

export const getUserById = async (id: string) => {
    const response = await api.get(`/api/users/${id}?_t=${Date.now()}`);
    return response.data;
};

export const createUser = async (data: any) => {
    const response = await api.post('/api/users', data);
    return response.data;
};

export const updateUser = async (id: string, data: any) => {
    const response = await api.put(`/api/users/${id}`, data);
    return response.data;
};

export const deleteUser = async (id: string) => {
    const response = await api.delete(`/api/users/${id}`);
    return response.data;
};

export const resetUserPassword = async (data: { userId: string, newPassword: string }) => {
    const response = await api.post('/auth/admin-reset-password', data);
    return response.data;
};

export const changeUserPassword = async (data: { currentPassword: string; newPassword: string }) => {
    const response = await api.post('/auth/change-password', data);
    return response.data;
};

export const syncParentLinks = async (parentUserId: string, studentLinks: Array<{ student_id: string; relationship?: string }>) => {
    const response = await api.post('/api/parents/sync-links', {
        parent_user_id: parentUserId,
        student_links: studentLinks
    });
    return response.data;
};

