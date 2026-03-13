import { Request, Response } from 'express';
import client, { adminClient } from '../config/insforge';

// Get courses the logged-in student is enrolled in
export const getStudentEnrolledCourses = async (req: Request, res: Response) => {
    const userId = req.currentUser?.id;

    if (!userId) {
        return res.status(400).json({ message: 'User ID is required' });
    }

    try {
        // Map profile user_id to student record
        const { data: studentRecord, error: findError } = await adminClient.database
            .from('students')
            .select('id')
            .or(`id.eq.${userId},user_id.eq.${userId}`)
            .maybeSingle();

        if (findError) throw findError;

        if (!studentRecord) {
            return res.json([]);
        }

        // Get enrollments with course details
        const { data: enrollments, error: enrollError } = await adminClient.database
            .from('enrollments')
            .select(`
                course_id,
                courses (id, name, description)
            `)
            .eq('student_id', studentRecord.id)
            .eq('is_active', true);

        if (enrollError) throw enrollError;

        // Extract unique courses
        const courses = enrollments?.map((e: any) => e.courses).filter(Boolean) || [];
        res.json(courses);
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

