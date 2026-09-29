import api from '../../services/apiClient';

export interface GradeRecord {
    student_id: string;
    student_name: string;
    unit_name: string;
    score: number | string;
    remarks?: string;
}

export const getGrades = async (courseId: string, unitName: string, scheduleId?: string) => {
    const params: any = { course_id: courseId, unit_name: unitName };
    if (scheduleId) params.schedule_id = scheduleId;
    const response = await api.get<GradeRecord[]>('/api/grades', { params });
    return response.data;
};

export const saveGrades = async (data: { course_id: string; unit_name: string; students: { student_id: string; score: number | string; remarks?: string }[] }) => {
    const response = await api.post('/api/grades', data);
    return response.data;
};

export const getStudentReportCard = async (studentId: string) => {
    const response = await api.get(`/api/grades/report/${studentId}`);
    return response.data;
};

export const getCourseGradebook = async (courseId: string, scheduleId?: string) => {
    const params: any = {};
    if (scheduleId) params.schedule_id = scheduleId;
    const response = await api.get(`/api/grades/course/${courseId}`, { params });
    return response.data;
};

export interface DocumentAuthorization {
    id: number;
    student_id: string;
    student_name?: string;
    personal_code?: string;
    identification_document?: string;
    course_id?: string;
    cycle_name?: string;
    course_name?: string;
    requester_name?: string;
    delivered_by_name?: string;
    document_type: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CONSUMED' | 'DELIVERED';
    reason?: string;
    requested_at: string;
    authorized_by?: string;
    authorized_at?: string;
    delivered_by?: string;
    delivered_at?: string;
    notes?: string;
    download_count?: number;
    max_downloads?: number;
}

export const requestDocumentAuthorization = async (
    studentId: string, 
    reason?: string, 
    documentType = 'REPORT_CARD',
    courseId?: string,
    cycleName?: string
) => {
    const response = await api.post('/api/grades/authorization-request', {
        student_id: studentId,
        document_type: documentType,
        reason,
        course_id: courseId,
        cycle_name: cycleName
    });
    return response.data;
};

export const getDocumentAuthorizationStatus = async (
    studentId: string, 
    documentType = 'REPORT_CARD',
    courseId?: string
) => {
    const params: any = { document_type: documentType };
    if (courseId) params.course_id = courseId;
    const response = await api.get<{ 
        status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CONSUMED' | 'DELIVERED' | 'NONE'; 
        request: DocumentAuthorization | null;
        download_count?: number;
        max_downloads?: number;
        remaining_downloads?: number;
        is_blocked?: boolean;
    }>(
        `/api/grades/authorization-status/${studentId}`,
        { params }
    );
    return response.data;
};

export const getStudentDocumentAuthorizations = async (studentId: string) => {
    const response = await api.get<{ authorizations: DocumentAuthorization[] }>(
        `/api/grades/student-authorizations/${studentId}`
    );
    return response.data.authorizations;
};

export const trackDocumentDownload = async (authorizationId: number) => {
    const response = await api.post<{
        success: boolean;
        message: string;
        request?: DocumentAuthorization;
        download_count: number;
        max_downloads: number;
        remaining_downloads: number;
        is_blocked: boolean;
    }>(`/api/grades/authorizations/${authorizationId}/track-download`);
    return response.data;
};

export const getAllDocumentAuthorizations = async () => {
    const response = await api.get<{ authorizations: DocumentAuthorization[] }>('/api/grades/authorizations');
    return response.data.authorizations;
};

export const updateDocumentAuthorization = async (id: number, status: 'APPROVED' | 'REJECTED' | 'PENDING' | 'DELIVERED', notes?: string) => {
    const response = await api.put(`/api/grades/authorizations/${id}`, { status, notes });
    return response.data;
};

export const getCourseActaAuthStatus = async (courseId: string) => {
    const response = await api.get<{ status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'NONE'; record?: any }>(
        `/api/grades/courses/${courseId}/auth-status`
    );
    return response.data;
};

export const requestCourseActaAuth = async (courseId: string, reason?: string) => {
    const response = await api.post(
        `/api/grades/courses/${courseId}/request-auth`,
        { reason }
    );
    return response.data;
};

