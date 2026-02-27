import api from '../../services/apiClient';

export interface Course {
    id: string;
    name: string;
    description: string;
    monthly_fee: number;
    start_date?: string;
    end_date?: string;
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
}

export interface Enrollment {
    id: string;
    id_student: string; // Add if needed
    id_course: string; // Add if needed
    student_name: string;
    course_name: string;
    enrollment_date: string;
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

export const getStudents = async () => {
    const response = await api.get<Student[]>('/api/students');
    return response.data;
};

export const createStudent = async (student: Omit<Student, 'id'>) => {
    const response = await api.post<Student>('/api/students', student);
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

export const updateEnrollment = async (id: string, data: { is_active: boolean }) => {
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
