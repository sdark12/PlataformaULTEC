import api from '../../services/apiClient';

export interface PromotionGradeUnit {
    unit_name: string;
    score: number;
}

export interface PromotionCandidate {
    student_id: string;
    enrollment_id: string;
    full_name: string;
    personal_code: string;
    identification_document: string;
    grades: PromotionGradeUnit[];
    average: number;
    units_evaluated: number;
    suggested_status: 'APPROVED' | 'CONDITIONAL' | 'RETAINED';
    is_eligible: boolean;
    already_enrolled_in_target: boolean;
}

export interface CandidatesResponse {
    source_course: {
        id: string;
        name: string;
        branch_id: string;
    };
    minimum_passing_grade: number;
    candidates: PromotionCandidate[];
}

export interface PromotionHistoryItem {
    id: string;
    student_id: string;
    from_course_id: string;
    to_course_id: string;
    from_enrollment_id: string;
    to_enrollment_id: string;
    final_grade: number;
    status: 'APPROVED' | 'CONDITIONAL' | 'RETAINED';
    school_cycle: string;
    notes: string;
    promoted_at: string;
    students?: {
        id: string;
        full_name: string;
        personal_code: string;
        identification_document: string;
    };
    from_course?: {
        id: string;
        name: string;
    };
    to_course?: {
        id: string;
        name: string;
    };
}

export const getCandidatesForPromotion = async (sourceCourseId: string, targetCourseId?: string): Promise<CandidatesResponse> => {
    const params: any = { source_course_id: sourceCourseId };
    if (targetCourseId) params.target_course_id = targetCourseId;
    const response = await api.get<CandidatesResponse>('/api/promotions/candidates', { params });
    return response.data;
};

export const executePromotion = async (data: {
    source_course_id: string;
    target_course_id: string;
    target_schedule_id?: string;
    school_cycle?: string;
    promotions: Array<{
        student_id: string;
        status: 'APPROVED' | 'CONDITIONAL' | 'RETAINED';
        final_grade: number;
        notes?: string;
    }>;
}) => {
    const response = await api.post('/api/promotions/execute', data);
    return response.data;
};

export const getPromotionHistory = async (params?: {
    student_id?: string;
    from_course_id?: string;
    to_course_id?: string;
}): Promise<PromotionHistoryItem[]> => {
    const response = await api.get<{ promotions: PromotionHistoryItem[] }>('/api/promotions/history', { params });
    return response.data.promotions;
};
