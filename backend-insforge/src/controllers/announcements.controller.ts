import { Request, Response } from 'express';
import client from '../config/insforge';

export const getAnnouncements = async (req: Request, res: Response) => {
    const role = req.currentUser?.role;

    try {
        let query = client.database
            .from('announcements')
            .select(`
                id,
                title,
                content,
                target_role,
                target_course_id,
                created_at,
                author:profiles!created_by(full_name),
                course:courses!target_course_id(name)
            `)
            .order('created_at', { ascending: false });

        // Basic filtering
        if (role === 'student') {
            query = query.in('target_role', ['all', 'student']);
        } else if (role === 'instructor') {
            query = query.in('target_role', ['all', 'instructor']);
        }

        const { data, error } = await query;
        
        if (error) throw error;
        
        // Transform
        const formattedData = data.map((item: any) => ({
            ...item,
            author_name: item.author ? item.author.full_name : 'Administración',
            course_name: item.course ? item.course.name : null
        }));

        res.json(formattedData);
    } catch (error) {
        console.error('Error fetching announcements:', error);
        res.status(500).json({ message: 'Error retrieving announcements' });
    }
};

export const createAnnouncement = async (req: Request, res: Response) => {
    const { title, content, target_role, target_course_id } = req.body;
    const userId = req.currentUser?.id;

    if (!title || !content) {
        return res.status(400).json({ message: 'Title and content are required' });
    }

    try {
        const { data, error } = await client.database
            .from('announcements')
            .insert([{
                title,
                content,
                target_role: target_role || 'all',
                target_course_id: target_course_id || null,
                created_by: userId
            }])
            .select()
            .single();

        if (error) throw error;
        res.status(201).json(data);
    } catch (error) {
        console.error('Error creating announcement:', error);
        res.status(500).json({ message: 'Error creating announcement' });
    }
};

export const deleteAnnouncement = async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
        const { error } = await client.database
            .from('announcements')
            .delete()
            .eq('id', id);

        if (error) throw error;
        res.json({ message: 'Announcement deleted successfully' });
    } catch (error) {
        console.error('Error deleting announcement:', error);
        res.status(500).json({ message: 'Error deleting announcement' });
    }
};
