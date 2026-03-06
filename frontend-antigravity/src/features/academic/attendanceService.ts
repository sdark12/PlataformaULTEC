import api from '../../services/apiClient';

export interface AttendanceRecord {
    id?: number;
    student_id: string;
    student_name?: string;
    date: string;
    status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
    remarks?: string;
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
