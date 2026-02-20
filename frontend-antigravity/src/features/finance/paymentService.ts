import api from '../../services/apiClient';

export interface Payment {
    id: string;
    student_name: string;
    course_name: string;
    amount: number;
    payment_date: string;
    method: string;
    reference_number: string;
    description?: string;
    tuition_month?: string;
}

export const getPayments = async () => {
    const response = await api.get<Payment[]>('/api/payments');
    return response.data;
};

export const createPayment = async (data: { enrollment_id: string; amount: number; method: string; reference_number: string; description?: string; tuition_month?: string }) => {
    const response = await api.post('/api/payments', data);
    return response.data;
};

export const updatePayment = async (id: string, data: Partial<Payment>) => {
    const response = await api.put(`/api/payments/${id}`, data);
    return response.data;
};

export const deletePayment = async (id: string) => {
    const response = await api.delete(`/api/payments/${id}`);
    return response.data;
};
