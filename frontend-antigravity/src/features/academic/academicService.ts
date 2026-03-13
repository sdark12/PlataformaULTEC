import api from '../../services/apiClient';

export interface Course {
    id: string;
    name: string;
    description: string;
    monthly_fee: number;
    start_date?: string;
    end_date?: string;
    is_active?: boolean;
}

export interface CourseSchedule {
    id: string;
    course_id: string;
    grade: string;
    day_of_week: string;
    start_time: string;
    end_time: string;
}

export interface Student {
    id: string;
    full_name: string;
    birth_date: string; // YYYY-MM-DD
    gender?: string;
    identification_document?: string;
    nationality?: string;
    address?: string;
    phone?: string;
    guardian_name?: string;
    guardian_phone?: string;
    guardian_email?: string;
    guardian_relationship?: string;
    emergency_contact_name?: string;
    emergency_contact_phone?: string;
    medical_notes?: string;
    previous_school?: string;
    personal_code?: string;
}

export interface Enrollment {
    id: string;
    id_student: string; // Add if needed
    id_course: string; // Add if needed
    student_name: string;
    course_name: string;
    enrollment_date: string;
}

export interface AttendanceRecord {
    student_id: string;
    student_name?: string;
    date: string;
    status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
    remarks?: string;
    course_name?: string;
}

export interface CourseResource {
    id: string;
    course_id: string;
    title: string;
    description?: string;
    file_url: string;
    resource_type?: string;
    created_at: string;
    created_by?: string;
    author?: { full_name: string };
}

export interface Announcement {
    id: string;
    title: string;
    content: string;
    target_role: string;
    target_course_id?: string | null;
    created_at: string;
    author_name: string;
    course_name?: string | null;
}

export const getCourses = async () => {
    const response = await api.get<Course[]>('/api/courses');
    return response.data;
};

export const createCourse = async (course: Omit<Course, 'id'>) => {
    const response = await api.post<Course>('/api/courses', course);
    return response.data;
};

export const updateCourse = async (id: string, course: Partial<Course>) => {
    const response = await api.put<Course>(`/api/courses/${id}`, course);
    return response.data;
};

export const getStudents = async (page?: number, limit?: number, search?: string) => {
    const params = new URLSearchParams();
    if (page) params.append('page', page.toString());
    if (limit) params.append('limit', limit.toString());
    if (search) params.append('search', search);

    const query = params.toString() ? `?${params.toString()}` : '';
    const response = await api.get(`/api/students${query}`);
    
    // Si la respuesta incluye meta (paginación activada), devolvemos el objeto completo
    // Si la idea original asumía array, devolvemos response.data.data o response.data
    // Para simplificar, la vista paginable usará esto:
    if (page) return response.data; 
    
    // Para compatibilidad hacia atrás donde esperan un array de estudiantes:
    return response.data.data || response.data;
};

export const createStudent = async (student: Omit<Student, 'id'>) => {
    const response = await api.post<Student>('/api/students', student);
    return response.data;
};

export const getAttendance = async (courseId: string, date: string, scheduleId?: string) => {
    const params = new URLSearchParams({ course_id: courseId, date });
    if (scheduleId) {
        params.append('schedule_id', scheduleId);
    }
    const response = await api.get<AttendanceRecord[]>(`/api/attendance?${params.toString()}`);
    return response.data;
};

export const markAttendance = async (courseId: string, date: string, students: Partial<AttendanceRecord>[]) => {
    const response = await api.post('/api/attendance', { course_id: courseId, date, students });
    return response.data;
};

export const getStudentAttendance = async () => {
    const response = await api.get('/api/my-attendance');
    return response.data;
};

export const updateStudent = async (id: string, student: Partial<Student>) => {
    const response = await api.put<Student>(`/api/students/${id}`, student);
    return response.data;
};

export const getEnrollments = async () => {
    const response = await api.get<Enrollment[]>('/api/enrollments');
    return response.data;
};

export const enrollStudent = async (data: { student_id: string; course_id: string }) => {
    const response = await api.post('/api/enrollments', data);
    return response.data;
};

export const updateEnrollment = async (id: string, data: { is_active?: boolean; schedule_id?: string | null }) => {
    const response = await api.put(`/api/enrollments/${id}`, data);
    return response.data;
};

export const deleteCourse = async (id: string) => {
    const response = await api.delete(`/api/courses/${id}`);
    return response.data;
};

export const deleteStudent = async (id: string) => {
    const response = await api.delete(`/api/students/${id}`);
    return response.data;
};

export const deleteEnrollment = async (id: string) => {
    const response = await api.delete(`/api/enrollments/${id}`);
    return response.data;
};

export const getCourseSchedules = async (courseId: string) => {
    const response = await api.get<CourseSchedule[]>(`/api/courses/${courseId}/schedules`);
    return response.data;
};

export const createCourseSchedule = async (courseId: string, data: Omit<CourseSchedule, 'id' | 'course_id'>) => {
    const response = await api.post<CourseSchedule>(`/api/courses/${courseId}/schedules`, data);
    return response.data;
};

export const deleteCourseSchedule = async (scheduleId: string) => {
    const response = await api.delete(`/api/courses/schedules/${scheduleId}`);
    return response.data;
};

// Course Resources
export const getMyEnrolledCourses = async () => {
    const response = await api.get<Course[]>('/api/resources/my-courses');
    return response.data;
};

export const getCourseResources = async (courseId: string) => {
    const response = await api.get<CourseResource[]>(`/api/resources/${courseId}`);
    return response.data;
};

export const createCourseResource = async (courseId: string, data: { title: string; description: string; file_url: string; resource_type?: string }) => {
    const response = await api.post<CourseResource>(`/api/resources/${courseId}`, data);
    return response.data;
};

export const deleteCourseResource = async (resourceId: string) => {
    const response = await api.delete(`/api/resources/resource/${resourceId}`);
    return response.data;
};

// Announcements
export const getAnnouncements = async () => {
    const response = await api.get<Announcement[]>('/api/announcements');
    return response.data;
};

export const createAnnouncement = async (data: { title: string; content: string; target_role: string; target_course_id?: string | null }) => {
    const response = await api.post<Announcement>('/api/announcements', data);
    return response.data;
};

export const deleteAnnouncement = async (id: string) => {
    const response = await api.delete(`/api/announcements/${id}`);
    return response.data;
};
