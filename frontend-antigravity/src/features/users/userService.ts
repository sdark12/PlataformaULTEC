import api from '../../services/apiClient';

export const getUsers = async (page?: number, limit?: number, search?: string, role?: string) => {
    const params = new URLSearchParams();
    if (page) params.append('page', page.toString());
    if (limit) params.append('limit', limit.toString());
    if (search) params.append('search', search);
    if (role && role !== 'all') params.append('role', role);

    const query = params.toString() ? `?${params.toString()}` : '';
    const response = await api.get(`/api/users${query}`);
    
    if (page) return response.data;
    return response.data.data || response.data;
};

export const getUserById = async (id: string) => {
    const response = await api.get(`/api/users/${id}`);
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
