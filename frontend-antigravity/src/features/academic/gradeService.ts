import api from '../../services/apiClient';

export interface GradeRecord {
    student_id: string;
    student_name: string;
    unit_name: string;
    score: number | string;
    remarks?: string;
}

export const getGrades = async (courseId: string, unitName: string) => {
    const response = await api.get<GradeRecord[]>('/api/grades', { params: { course_id: courseId, unit_name: unitName } });
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

export const getCourseGradebook = async (courseId: string) => {
    const response = await api.get(`/api/grades/course/${courseId}`);
    return response.data;
};
