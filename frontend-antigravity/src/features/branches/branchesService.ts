import api from '../../services/apiClient';

export interface Branch {
    id: string;
    name: string;
    address: string;
    phone: string;
    email: string;
    created_at?: string;
}

export const getBranches = async () => {
    const response = await api.get<Branch[]>('/api/branches');
    return response.data;
};

export const createBranch = async (branch: Omit<Branch, 'id' | 'created_at'>) => {
    const response = await api.post<Branch>('/api/branches', branch);
    return response.data;
};

export const updateBranch = async (id: string, branch: Partial<Branch>) => {
    const response = await api.put<Branch>(`/api/branches/${id}`, branch);
    return response.data;
};

export const deleteBranch = async (id: string) => {
    const response = await api.delete(`/api/branches/${id}`);
    return response.data;
};
