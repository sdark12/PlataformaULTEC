import api from '../../services/apiClient';

export const getSubgradeCategories = async (courseId: string, unitName: string) => {
    const response = await api.get('/api/subgrades/categories', { params: { course_id: courseId, unit_name: unitName } });
    return response.data;
};

export const saveSubgradeCategories = async (data: { course_id: string; unit_name: string; categories: any[] }) => {
    const response = await api.post('/api/subgrades/categories', data);
    return response.data;
};

export const deleteSubgradeCategory = async (categoryId: string) => {
    const response = await api.delete(`/api/subgrades/categories/${categoryId}`);
    return response.data;
};

export const getSubgrades = async (courseId: string, unitName: string) => {
    const response = await api.get('/api/subgrades', { params: { course_id: courseId, unit_name: unitName } });
    return response.data;
    // returns { categories: [...], students: [...] }
};

export const saveSubgrades = async (data: { subgrades: any[] }) => {
    const response = await api.post('/api/subgrades', data);
    return response.data;
};
