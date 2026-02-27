export interface Notification {
    id: number;
    user_id: string;
    title: string;
    message: string;
    type: 'PAYMENT' | 'ENROLLMENT' | 'DELETE' | 'SYSTEM';
    is_read: boolean;
    created_at: Date;
}
