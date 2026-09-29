import api from '../../services/apiClient';

export interface VerifyStudentData {
    valid: boolean;
    student_id: string;
    full_name: string;
    student_code: string;
    status: string;
    is_active: boolean;
    branch_name: string;
    branch_address?: string;
    courses: string[];
    cycle: string;
    issued_at?: string;
    verified_at: string;
    message?: string;
}

export const verifyStudentPublic = async (identifier: string): Promise<VerifyStudentData> => {
    const response = await api.get<VerifyStudentData>(`/api/students/verify/${encodeURIComponent(identifier)}`);
    return response.data;
};
