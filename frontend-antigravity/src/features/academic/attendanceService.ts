import api from '../../services/apiClient';

export interface AttendanceJustification {
    id: string;
    student_id: string;
    course_id: string;
    date: string;
    reason_type: string;
    description: string;
    document_url?: string | null;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    reviewed_by?: string | null;
    reviewed_at?: string | null;
    review_notes?: string | null;
    created_at?: string;
    students?: {
        id: string;
        full_name: string;
        personal_code?: string;
        phone?: string;
        guardian_phone?: string;
    };
    courses?: {
        id: string;
        name: string;
    };
    reviewer?: {
        id: string;
        full_name: string;
    };
}

export interface AttendanceRecord {
    id?: string | number;
    student_id: string;
    student_name: string;
    phone?: string | null;
    guardian_phone?: string | null;
    guardian_name?: string | null;
    personal_code?: string | null;
    academy_code?: string | null;
    student_code?: string;
    date: string;
    status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED' | 'PENDING';
    remarks?: string;
    is_recorded?: boolean;
    justification?: AttendanceJustification | null;
}

export interface AttendanceMatrixStudent {
    student_id: string;
    student_name: string;
    student_code: string;
    phone?: string | null;
    guardian_phone?: string | null;
    days: Record<string, string>;
    present_count: number;
    absent_count: number;
    late_count: number;
    excused_count: number;
    total_recorded: number;
    attendance_percentage: number;
    is_at_risk: boolean;
}

export interface AttendanceMatrixResponse {
    course_id: string;
    month: string;
    active_dates: string[];
    students: AttendanceMatrixStudent[];
    total_students: number;
    total_active_days: number;
}

export const getAttendance = async (courseId: string, date: string, scheduleId?: string) => {
    const params: any = { course_id: courseId, date };
    if (scheduleId) params.schedule_id = scheduleId;
    const response = await api.get<AttendanceRecord[]>('/api/attendance', { params });
    return response.data;
};

export const markAttendance = async (data: { course_id: string; date: string; students: { student_id: string; status: string; remarks?: string }[] }) => {
    const response = await api.post('/api/attendance', data);
    return response.data;
};

export const getAttendanceMatrix = async (courseId: string, month?: string, scheduleId?: string) => {
    const params: any = { course_id: courseId };
    if (month) params.month = month;
    if (scheduleId) params.schedule_id = scheduleId;
    const response = await api.get<AttendanceMatrixResponse>('/api/attendance/matrix', { params });
    return response.data;
};

export const getJustifications = async (params?: { course_id?: string; status?: string; student_id?: string }) => {
    const response = await api.get<AttendanceJustification[]>('/api/attendance/justifications', { params });
    return response.data;
};

export const requestJustification = async (data: { 
    course_id: string; 
    date: string; 
    reason_type: string; 
    description: string; 
    student_id?: string; 
    document_url?: string;
}) => {
    const response = await api.post<AttendanceJustification>('/api/attendance/justifications', data);
    return response.data;
};

export const reviewJustification = async (id: string, data: { status: 'APPROVED' | 'REJECTED'; review_notes?: string }) => {
    const response = await api.patch<{ message: string; justification: AttendanceJustification }>(`/api/attendance/justifications/${id}/review`, data);
    return response.data;
};
