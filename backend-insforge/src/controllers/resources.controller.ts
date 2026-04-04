import { Request, Response } from 'express';
import client, { adminClient } from '../config/insforge';

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
            const { data: parentLinks, error: linksError } = await adminClient.database
                .from('parent_student_links')
                .select('student_id')
                .eq('parent_user_id', userId);
            
            if (linksError) throw linksError;
            if (parentLinks && parentLinks.length > 0) {
                studentIds = parentLinks.map((link: any) => link.student_id);
            }
        } else {
            // Map profile user_id to student record
            const { data: studentRecord, error: findError } = await adminClient.database
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
        const { data: enrollments, error: enrollError } = await adminClient.database
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

export const getCourseResources = async (req: Request, res: Response) => {
    const { courseId } = req.params;

    try {
        const { data, error } = await adminClient.database
            .from('course_resources')
            .select(`
                id,
                title,
                description,
                file_url,
                resource_type,
                created_at,
                created_by,
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

export const createCourseResource = async (req: Request, res: Response) => {
    const { courseId } = req.params;
    const { title, description, file_url, resource_type } = req.body;
    const userId = req.currentUser?.id;

    if (!title || !file_url) {
        return res.status(400).json({ message: 'Title and file_url are required' });
    }

    try {
        const { data, error } = await client.database
            .from('course_resources')
            .insert([{
                course_id: courseId,
                title,
                description,
                file_url,
                resource_type: resource_type || 'link',
                created_by: userId
            }])
            .select()
            .single();

        if (error) throw error;
        res.status(201).json(data);
    } catch (error) {
        console.error('Error creating resource:', error);
        res.status(500).json({ message: 'Error creating resource' });
    }
};

export const deleteCourseResource = async (req: Request, res: Response) => {
    const { resourceId } = req.params;

    try {
        const { error } = await client.database
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
        const { data: studentRecord } = await adminClient.database
            .from('students')
            .select('id')
            .or(`id.eq.${userId},user_id.eq.${userId}`)
            .maybeSingle();

        if (!studentRecord) {
            return res.json([]);
        }

        // Get enrollments with course + schedule info
        const { data: enrollments, error } = await adminClient.database
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
