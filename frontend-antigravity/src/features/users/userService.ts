import axios from 'axios';

const api = axios.create({
    baseURL: 'http://localhost:3000/api/users',
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export const getUsers = async () => {
    const response = await api.get('/');
    return response.data;
};

export const getUserById = async (id: string) => {
    const response = await api.get(`/${id}`);
    return response.data;
};

export const createUser = async (data: any) => {
    const response = await api.post('/', data);
    return response.data;
};

export const updateUser = async (id: string, data: any) => {
    const response = await api.put(`/${id}`, data);
    return response.data;
};

export const deleteUser = async (id: string) => {
    const response = await api.delete(`/${id}`);
    return response.data;
};

export const resetUserPassword = async (data: { userId: string, newPassword: string }) => {
    const response = await api.post('http://localhost:3000/auth/admin-reset-password', data);
    return response.data;
};
