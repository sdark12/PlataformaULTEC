import api from './apiClient';

export interface Assignment {
    id: string;
    course_id: string;
    title: string;
    description: string;
    assignment_type: 'HOMEWORK' | 'EXAM' | 'LAB' | 'ACTIVITY';
    due_date: string;
    weight_points: number;
    max_score: number;
    created_by?: string;
    created_at?: string;
}

export interface StudentAssignment extends Assignment {
    assignment_id: string;
    course_name: string;
    submission_id?: string;
    status?: 'PENDING' | 'SUBMITTED' | 'GRADED' | 'LATE';
    submission_date?: string;
    score?: number;
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

    getCourseAssignments: async (courseId: number | string) => {
        const response = await api.get(`/api/assignments/course/${courseId}`);
        return response.data as Assignment[];
    },

    getAssignmentSubmissions: async (assignmentId: string) => {
        const response = await api.get(`/api/assignments/${assignmentId}/submissions`);
        return response.data as AssignmentSubmissionInfo[];
    },

    gradeSubmission: async (submissionId: string, score: number, feedback: string) => {
        const response = await api.put(`/api/assignments/submission/${submissionId}/grade`, { score, feedback });
        return response.data;
    },

    getCourseAssignmentReport: async (courseId: string | number) => {
        const response = await api.get(`/api/assignments/course/${courseId}/report`);
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
