import api from '../../services/apiClient';

export interface AttendanceRecord {
    id?: number;
    student_id: number;
    student_name?: string;
    date: string;
    status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
    remarks?: string;
}

export const getAttendance = async (courseId: number, date: string) => {
    const response = await api.get<AttendanceRecord[]>('/api/attendance', { params: { course_id: courseId, date } });
    return response.data;
};

export const markAttendance = async (data: { course_id: number; date: string; students: { student_id: number; status: string; remarks?: string }[] }) => {
    const response = await api.post('/api/attendance', data);
    return response.data;
};
