import api from './apiClient';

export interface Assignment {
    id: string;
    course_id: string;
    title: string;
    description: string;
    assignment_type: 'HOMEWORK' | 'EXAM' | 'LAB' | 'ACTIVITY';
    due_date: string;
    weight_points: number;
    merit_points?: number;
    unit_name?: string;
    max_score: number;
    schedule_id?: string;
    category_id?: string | null;
    category_name?: string;
    subgrade_categories?: {
        id: string;
        name: string;
        max_score: number;
    };
    created_by?: string;
    created_at?: string;
}

export interface StudentAssignment extends Assignment {
    assignment_id: string;
    course_name: string;
    category_id?: string | null;
    category_name?: string;
    submission_id?: string;
    status?: 'PENDING' | 'SUBMITTED' | 'GRADED' | 'LATE';
    submission_date?: string;
    score?: number;
    merit_points_awarded?: number;
    feedback?: string;
    attachment_url?: string;
}

export interface AssignmentSubmissionInfo {
    enrollment_id: string;
    student_id: string;
    student_name: string;
    submission_id: string | null;
    submission_date: string | null;
    status: 'PENDING' | 'SUBMITTED' | 'GRADED' | 'LATE';
    score: number | null;
    merit_points_awarded?: number;
    feedback: string;
    attachment_url: string | null;
}

export interface CourseReportGrade {
    assignment_id: string;
    score: number;
    max_score: number;
    status: 'PENDING' | 'SUBMITTED' | 'GRADED' | 'LATE';
}

export interface CourseReportNode {
    student_id: string;
    student_name: string;
    total_score: number;
    max_possible_score: number;
    percentage: number;
    grades: CourseReportGrade[];
}

export interface CourseReportData {
    assignments: {
        id: string;
        title: string;
        max_score: number;
        weight_points: number;
    }[];
    students: CourseReportNode[];
}

export const assignmentsService = {
    // Instructor/Admin Endpoints
    createAssignment: async (assignmentData: Partial<Assignment>) => {
        const response = await api.post('/api/assignments', assignmentData);
        return response.data;
    },

    updateAssignment: async (id: string, assignmentData: Partial<Assignment>) => {
        const response = await api.put(`/api/assignments/${id}`, assignmentData);
        return response.data;
    },

    deleteAssignment: async (id: string) => {
        const response = await api.delete(`/api/assignments/${id}`);
        return response.data;
    },

    getCourseAssignments: async (courseId: number | string, scheduleId?: string, unitName?: string) => {
        const params: any = {};
        if (scheduleId) params.schedule_id = scheduleId;
        if (unitName) params.unit_name = unitName;
        const response = await api.get(`/api/assignments/course/${courseId}`, { params });
        return response.data as Assignment[];
    },

    getAssignmentSubmissions: async (assignmentId: string) => {
        const response = await api.get(`/api/assignments/${assignmentId}/submissions`);
        return response.data as AssignmentSubmissionInfo[];
    },

    gradeSubmission: async (submissionId: string, score: number, feedback: string, customMeritPoints?: number) => {
        const payload: any = { score, feedback };
        if (customMeritPoints !== undefined && customMeritPoints !== null) {
            payload.custom_merit_points = customMeritPoints;
        }
        const response = await api.put(`/api/assignments/submission/${submissionId}/grade`, payload);
        return response.data;
    },

    getCourseAssignmentReport: async (courseId: string | number, scheduleId?: string) => {
        const params: any = {};
        if (scheduleId) params.schedule_id = scheduleId;
        const response = await api.get(`/api/assignments/course/${courseId}/report`, { params });
        return response.data as CourseReportData;
    },

    // Student Endpoints
    getStudentAssignments: async (studentId: string) => {
        const response = await api.get(`/api/assignments/student/${studentId}`);
        return response.data as StudentAssignment[];
    },

    uploadAssignmentFile: async (file: File) => {
        const formData = new FormData();
        formData.append('file', file);
        const response = await api.post('/api/assignments/upload', formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        });
        return response.data.fileUrl as string;
    },

    submitAssignment: async (assignmentId: string, studentId: string, attachment_url?: string) => {
        const payload: any = { assignmentId, studentId };
        if (attachment_url) payload.attachment_url = attachment_url;

        const response = await api.post('/api/assignments/submit', payload);
        return response.data;
    }
};
