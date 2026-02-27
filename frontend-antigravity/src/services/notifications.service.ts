import api from './apiClient';

export interface Notification {
    id: number;
    user_id: string;
    title: string;
    message: string;
    type: 'PAYMENT' | 'ENROLLMENT' | 'DELETE' | 'SYSTEM';
    is_read: boolean;
    created_at: string;
}

export const notificationsService = {
    getNotifications: async (): Promise<Notification[]> => {
        const response = await api.get('/api/notifications');
        return response.data;
    },

    markAsRead: async (id: number): Promise<Notification> => {
        const response = await api.put(`/api/notifications/${id}/read`);
        return response.data;
    },

    markAllAsRead: async (): Promise<void> => {
        await api.put('/api/notifications/read-all');
    }
};
