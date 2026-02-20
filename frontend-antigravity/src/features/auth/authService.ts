import api from '../../services/apiClient';

export interface LoginResponse {
    token: string;
    user: {
        id: string;
        email: string;
        role: string;
        branch_id: string;
    };
}

export const login = async (credentials: { email: string; password: string }) => {
    const response = await api.post<LoginResponse>('/auth/login', credentials);
    return response.data;
};

export const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
};

export const getCurrentUser = () => {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
};
