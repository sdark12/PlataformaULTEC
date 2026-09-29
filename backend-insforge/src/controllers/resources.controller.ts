import { Request, Response } from 'express';
import client, { adminClient } from '../config/insforge';

// Helper to get active enrolled course IDs for a student or parent
const getEnrolledCourseIds = async (userId: string, userRole: string): Promise<string[]> => {
    let studentIds: string[] = [];

    if (userRole === 'parent') {
        const { data: parentLinks, error: linksError } = await adminClient
            .from('parent_student_links')
            .select('student_id')
            .eq('parent_user_id', userId);
        
        if (linksError) throw linksError;
        if (parentLinks && parentLinks.length > 0) {
            studentIds = parentLinks.map((link: any) => link.student_id);
        }
    } else {
        const { data: studentRecord, error: findError } = await adminClient
            .from('students')
            .select('id')
            .or(`id.eq.${userId},user_id.eq.${userId}`)
            .maybeSingle();

        if (findError) throw findError;
        if (studentRecord) {
            studentIds.push(studentRecord.id);
        }
    }

    if (studentIds.length === 0) {
        return [];
    }

    const { data: enrollments, error: enrollError } = await adminClient
        .from('enrollments')
        .select('course_id')
        .in('student_id', studentIds)
        .eq('is_active', true);

    if (enrollError) throw enrollError;

    const courseIds = new Set<string>();
    enrollments?.forEach((e: any) => {
        if (e.course_id) courseIds.add(e.course_id);
    });

    return Array.from(courseIds);
};

// Get courses the logged-in student (or parent's children) is enrolled in
export const getStudentEnrolledCourses = async (req: Request, res: Response) => {
    const userId = req.currentUser?.id;
    const userRole = req.currentUser?.role;

    if (!userId) {
        return res.status(400).json({ message: 'User ID is required' });
    }

    try {
        let studentIds: string[] = [];

        if (userRole === 'parent') {
            const { data: parentLinks, error: linksError } = await adminClient
                .from('parent_student_links')
                .select('student_id')
                .eq('parent_user_id', userId);
            
            if (linksError) throw linksError;
            if (parentLinks && parentLinks.length > 0) {
                studentIds = parentLinks.map((link: any) => link.student_id);
            }
        } else {
            // Map profile user_id to student record
            const { data: studentRecord, error: findError } = await adminClient
                .from('students')
                .select('id')
                .or(`id.eq.${userId},user_id.eq.${userId}`)
                .maybeSingle();

            if (findError) throw findError;

            if (studentRecord) {
                studentIds.push(studentRecord.id);
            }
        }

        if (studentIds.length === 0) {
            return res.json([]);
        }

        // Get enrollments with course details
        const { data: enrollments, error: enrollError } = await adminClient
            .from('enrollments')
            .select(`
                course_id,
                courses (id, name, description)
            `)
            .in('student_id', studentIds)
            .eq('is_active', true);

        if (enrollError) throw enrollError;

        // Extract unique courses
        const coursesMap = new Map();
        enrollments?.forEach((e: any) => {
            if (e.courses && !coursesMap.has(e.courses.id)) {
                coursesMap.set(e.courses.id, e.courses);
            }
        });
        
        res.json(Array.from(coursesMap.values()));
    } catch (error) {
        console.error('Error fetching student enrolled courses:', error);
        res.status(500).json({ message: 'Error retrieving enrolled courses' });
    }
};

// Get all resources with optional filters (courseId, type, search)
// For students & parents: strictly filtered to courses they are enrolled in
export const getAllResources = async (req: Request, res: Response) => {
    const { courseId, type, search } = req.query;
    const userId = req.currentUser?.id;
    const userRole = req.currentUser?.role;

    try {
        let allowedCourseIds: string[] | null = null;
        if (userRole === 'student' || userRole === 'parent') {
            if (!userId) return res.json([]);
            allowedCourseIds = await getEnrolledCourseIds(userId, userRole);
            if (allowedCourseIds.length === 0) {
                return res.json([]);
            }
        }

        let query = adminClient
            .from('course_resources')
            .select(`
                id,
                course_id,
                title,
                description,
                file_url,
                resource_type,
                created_at,
                created_by,
                courses:course_id (id, name),
                author:profiles!created_by(full_name)
            `);

        if (allowedCourseIds !== null) {
            if (courseId && courseId !== 'all') {
                if (!allowedCourseIds.includes(courseId as string)) {
                    return res.status(403).json({ message: 'No estás inscrito en este curso.' });
                }
                query = query.eq('course_id', courseId as string);
            } else {
                query = query.in('course_id', allowedCourseIds);
            }
        } else if (courseId && courseId !== 'all') {
            query = query.eq('course_id', courseId as string);
        }

        if (type && type !== 'all') {
            query = query.eq('resource_type', type as string);
        }

        if (search && typeof search === 'string' && search.trim() !== '') {
            query = query.or(`title.ilike.%${search.trim()}%,description.ilike.%${search.trim()}%`);
        }

        const { data, error } = await query.order('created_at', { ascending: false });

        if (error) throw error;
        res.json(data || []);
    } catch (error) {
        console.error('Error fetching all resources:', error);
        res.status(500).json({ message: 'Error retrieving resources' });
    }
};

// Summary metrics (counts by course and counts by type)
// For students & parents: only reflects their enrolled courses
export const getResourcesSummary = async (req: Request, res: Response) => {
    const userId = req.currentUser?.id;
    const userRole = req.currentUser?.role;

    try {
        let allowedCourseIds: string[] | null = null;
        if (userRole === 'student' || userRole === 'parent') {
            if (!userId) {
                return res.json({ countsByCourse: {}, countsByType: { total: 0, link: 0, document: 0, video: 0, image: 0, other: 0 } });
            }
            allowedCourseIds = await getEnrolledCourseIds(userId, userRole);
            if (allowedCourseIds.length === 0) {
                return res.json({ countsByCourse: {}, countsByType: { total: 0, link: 0, document: 0, video: 0, image: 0, other: 0 } });
            }
        }

        let query = adminClient
            .from('course_resources')
            .select('id, course_id, resource_type');

        if (allowedCourseIds !== null) {
            query = query.in('course_id', allowedCourseIds);
        }

        const { data, error } = await query;

        if (error) throw error;

        const countsByCourse: Record<string, number> = {};
        const countsByType: Record<string, number> = {
            total: 0,
            link: 0,
            document: 0,
            video: 0,
            image: 0,
            other: 0
        };

        (data || []).forEach((r: any) => {
            if (r.course_id) {
                countsByCourse[r.course_id] = (countsByCourse[r.course_id] || 0) + 1;
            }
            countsByType.total += 1;
            const t = r.resource_type || 'link';
            countsByType[t] = (countsByType[t] || 0) + 1;
        });

        res.json({
            countsByCourse,
            countsByType
        });
    } catch (error) {
        console.error('Error fetching resources summary:', error);
        res.status(500).json({ message: 'Error retrieving summary' });
    }
};

export const getCourseResources = async (req: Request, res: Response) => {
    const { courseId } = req.params;
    const userId = req.currentUser?.id;
    const userRole = req.currentUser?.role;

    if (userRole === 'student' || userRole === 'parent') {
        if (!userId) return res.status(403).json({ message: 'No autorizado' });
        const allowedCourseIds = await getEnrolledCourseIds(userId, userRole);
        if (!allowedCourseIds.includes(String(courseId))) {
            return res.status(403).json({ message: 'No estás inscrito en este curso.' });
        }
    }

    try {
        const { data, error } = await adminClient
            .from('course_resources')
            .select(`
                id,
                course_id,
                title,
                description,
                file_url,
                resource_type,
                created_at,
                created_by,
                courses:course_id (id, name),
                author:profiles!created_by(full_name)
            `)
            .eq('course_id', courseId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json(data);
    } catch (error) {
        console.error('Error fetching course resources:', error);
        res.status(500).json({ message: 'Error retrieving resources' });
    }
};

// Upload a local file (PDF, Office, Image, etc.) for academic resources
export const uploadResourceFile = async (req: Request, res: Response) => {
    const userRole = req.currentUser?.role;
    if (!['admin', 'superadmin', 'instructor'].includes(userRole || '')) {
        return res.status(403).json({ message: 'Solo profesores y administradores pueden subir archivos a la biblioteca.' });
    }

    if (!req.file) {
        return res.status(400).json({ message: 'No se subió ningún archivo' });
    }

    const fileUrl = `/uploads/${req.file.filename}`;
    res.status(201).json({
        file_url: fileUrl,
        filename: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype
    });
};

export const createCourseResource = async (req: Request, res: Response) => {
    const { courseId } = req.params;
    const { title, description, file_url, resource_type } = req.body;
    const userId = req.currentUser?.id;
    const userRole = req.currentUser?.role;

    if (!['admin', 'superadmin', 'instructor'].includes(userRole || '')) {
        return res.status(403).json({ message: 'Solo profesores y administradores pueden crear recursos.' });
    }

    if (!title || !file_url) {
        return res.status(400).json({ message: 'Title and file_url are required' });
    }

    try {
        const { data, error } = await adminClient
            .from('course_resources')
            .insert([{
                course_id: courseId,
                title,
                description,
                file_url,
                resource_type: resource_type || 'link',
                created_by: userId
            }])
            .select(`
                id,
                course_id,
                title,
                description,
                file_url,
                resource_type,
                created_at,
                created_by,
                courses:course_id (id, name),
                author:profiles!created_by(full_name)
            `)
            .single();

        if (error) throw error;
        res.status(201).json(data);
    } catch (error) {
        console.error('Error creating resource:', error);
        res.status(500).json({ message: 'Error creating resource' });
    }
};

export const updateCourseResource = async (req: Request, res: Response) => {
    const { resourceId } = req.params;
    const { title, description, file_url, resource_type, course_id } = req.body;
    const userRole = req.currentUser?.role;

    if (!['admin', 'superadmin', 'instructor'].includes(userRole || '')) {
        return res.status(403).json({ message: 'Solo profesores y administradores pueden editar recursos.' });
    }

    try {
        const updateData: any = {};
        if (title !== undefined) updateData.title = title;
        if (description !== undefined) updateData.description = description;
        if (file_url !== undefined) updateData.file_url = file_url;
        if (resource_type !== undefined) updateData.resource_type = resource_type;
        if (course_id !== undefined) updateData.course_id = course_id;

        const { data, error } = await adminClient
            .from('course_resources')
            .update(updateData)
            .eq('id', resourceId)
            .select(`
                id,
                course_id,
                title,
                description,
                file_url,
                resource_type,
                created_at,
                created_by,
                courses:course_id (id, name),
                author:profiles!created_by(full_name)
            `)
            .single();

        if (error) throw error;
        res.json(data);
    } catch (error) {
        console.error('Error updating resource:', error);
        res.status(500).json({ message: 'Error updating resource' });
    }
};

export const deleteCourseResource = async (req: Request, res: Response) => {
    const { resourceId } = req.params;
    const userRole = req.currentUser?.role;

    if (!['admin', 'superadmin', 'instructor'].includes(userRole || '')) {
        return res.status(403).json({ message: 'Solo profesores y administradores pueden eliminar recursos.' });
    }

    try {
        const { error } = await adminClient
            .from('course_resources')
            .delete()
            .eq('id', resourceId);

        if (error) throw error;
        res.json({ message: 'Resource deleted successfully' });
    } catch (error) {
        console.error('Error deleting resource:', error);
        res.status(500).json({ message: 'Error deleting resource' });
    }
};

// ==========================================
// STUDENT SCHEDULE
// ==========================================
export const getStudentSchedule = async (req: Request, res: Response) => {
    const userId = req.currentUser?.id;

    if (!userId) {
        return res.status(400).json({ message: 'User ID is required' });
    }

    try {
        // Find student record
        const { data: studentRecord } = await adminClient
            .from('students')
            .select('id')
            .or(`id.eq.${userId},user_id.eq.${userId}`)
            .maybeSingle();

        if (!studentRecord) {
            return res.json([]);
        }

        // Get enrollments with course + schedule info
        const { data: enrollments, error } = await adminClient
            .from('enrollments')
            .select(`
                course_id,
                courses (
                    id,
                    name,
                    course_schedules (
                        id,
                        grade,
                        day_of_week,
                        start_time,
                        end_time
                    )
                )
            `)
            .eq('student_id', studentRecord.id)
            .eq('is_active', true);

        if (error) throw error;

        // Flatten into schedule entries
        const COLORS = ['#3B82F6', '#8B5CF6', '#EC4899', '#10B981', '#F59E0B', '#EF4444', '#6366F1', '#14B8A6'];
        let colorIdx = 0;
        const scheduleEntries: any[] = [];

        enrollments?.forEach((e: any) => {
            const course = e.courses;
            if (!course || !course.course_schedules) return;
            const color = COLORS[colorIdx % COLORS.length];
            colorIdx++;

            const schedules = Array.isArray(course.course_schedules) ? course.course_schedules : [course.course_schedules];
            schedules.forEach((s: any) => {
                scheduleEntries.push({
                    course_name: course.name,
                    grade: s.grade,
                    day_of_week: s.day_of_week,
                    start_time: s.start_time,
                    end_time: s.end_time,
                    color
                });
            });
        });

        res.json(scheduleEntries);
    } catch (error) {
        console.error('Error getting student schedule:', error);
        res.status(500).json({ message: 'Error retrieving schedule' });
    }
};
