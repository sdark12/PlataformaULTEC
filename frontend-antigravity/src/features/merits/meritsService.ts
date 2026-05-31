import api from '../../services/apiClient';

export interface MeritTransaction {
    id: string;
    student_id: string;
    points: number;
    transaction_type: 'attendance' | 'grade' | 'manual' | 'claim' | 'refund';
    description: string;
    reference_id?: string;
    created_by?: string;
    created_at: string;
}

export interface StudentBalanceResponse {
    student: {
        id: string;
        full_name: string;
        personal_code?: string;
    };
    balance: number;
    transactions: MeritTransaction[];
}

export interface LeaderboardEntry {
    id: string;
    full_name: string;
    personal_code?: string;
    branch_id?: string;
    balance: number;
}

export interface Reward {
    id: string;
    branch_id?: string;
    title: string;
    description?: string;
    points_required: number;
    stock: number | null; // null means unlimited
    is_active: boolean;
    image_url?: string;
    created_at?: string;
    updated_at?: string;
}

export const getStudentBalance = async (studentId: string): Promise<StudentBalanceResponse> => {
    const response = await api.get(`/api/merits/student/${studentId}/balance`);
    return response.data;
};

export const getLeaderboard = async (): Promise<LeaderboardEntry[]> => {
    const response = await api.get('/api/merits/leaderboard');
    return response.data;
};

export const awardPoints = async (payload: { student_id: string; points: number; description: string }): Promise<MeritTransaction> => {
    const response = await api.post('/api/merits/award', payload);
    return response.data;
};

export const getRewards = async (): Promise<Reward[]> => {
    const response = await api.get('/api/merits/rewards');
    return response.data;
};

export const createReward = async (reward: Omit<Reward, 'id'>): Promise<Reward> => {
    const response = await api.post('/api/merits/rewards', reward);
    return response.data;
};

export const updateReward = async (id: string, reward: Partial<Reward>): Promise<Reward> => {
    const response = await api.put(`/api/merits/rewards/${id}`, reward);
    return response.data;
};

export const deleteReward = async (id: string): Promise<{ message: string }> => {
    const response = await api.delete(`/api/merits/rewards/${id}`);
    return response.data;
};

export const claimReward = async (id: string): Promise<{ message: string }> => {
    const response = await api.post(`/api/merits/rewards/${id}/claim`);
    return response.data;
};
