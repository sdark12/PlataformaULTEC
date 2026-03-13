import { Request, Response } from 'express';
import client from '../config/insforge';
import { broadcastNotification } from '../services/notification.service';

export const getCourses = async (req: Request, res: Response) => {
    const branchId = req.currentUser?.branch_id;
    const db = req.dbUserClient || client;

    try {
        let query = db.database
            .from('courses')
            .select('*')
            .eq('is_active', true)
            .order('name');

        if (branchId) {
            query = query.eq('branch_id', branchId);
        }

        const { data, error } = await query;

        if (error) throw error;

        res.json(data);
    } catch (error: any) {
        console.error('CRITICAL ERROR in getCourses:', error);
        if (error instanceof Error) {
            console.error('Stack:', error.stack);
            console.error('Message:', error.message);
        } else {
            console.error('Unknown error object:', JSON.stringify(error));
        }
        res.status(500).json({
            message: 'Error retrieving courses',
            error: error?.message || 'Unknown error',
            details: JSON.stringify(error)
        });
    }
};

export const createCourse = async (req: Request, res: Response) => {
    const { name, description, monthly_fee, start_date, end_date, branch_id } = req.body;
    const finalBranchId = branch_id || req.currentUser?.branch_id;
    const db = req.dbUserClient || client;

    console.log('createCourse:', { branchId: finalBranchId, bodyName: name });

    try {
        const { data, error } = await db.database
            .from('courses')
            .insert([{ branch_id: finalBranchId, name, description, monthly_fee, start_date, end_date }])
            .select()
            .single();

        if (error) throw error;

        res.status(201).json(data);
    } catch (error) {
        console.error("Error creating course:", error);
        res.status(500).json({ message: 'Error creating course', error: (error as any).message });
    }
};

export const updateCourse = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { name, description, monthly_fee, is_active, start_date, end_date } = req.body;
    const db = req.dbUserClient ? req.dbUserClient.database : client.database;

    const branchId = req.currentUser?.branch_id;

    try {
        let query = db
            .from('courses')
            .update({ name, description, monthly_fee, is_active, start_date, end_date })
            .eq('id', id);

        if (branchId) {
            query = query.eq('branch_id', branchId);
        }

        const { data, error } = await query.select().single();

        if (error) throw error;

        res.json(data);
    } catch (error) {
        console.error("Error updating course:", error);
        res.status(500).json({ message: 'Error updating course', error: (error as any).message });
    }
};

export const deleteCourse = async (req: Request, res: Response) => {
    const { id } = req.params;
    const db = req.dbUserClient ? req.dbUserClient.database : client.database;

    const branchId = req.currentUser?.branch_id;

    try {
        let query = db
            .from('courses')
            .delete()
            .eq('id', id);

        if (branchId) {
            query = query.eq('branch_id', branchId);
        }

        const { error } = await query;

        if (error) throw error;

        if (branchId) {
            await broadcastNotification(
                client,
                branchId,
                'Curso Eliminado',
                `Se ha eliminado un curso del sistema.`,
                'DELETE'
            );
        }

        res.json({ message: 'Course deleted successfully' });
    } catch (error) {
        console.error("Error deleting course:", error);
        res.status(500).json({ message: 'Error deleting course', error: (error as any).message });
    }
};

export const getCourseSchedules = async (req: Request, res: Response) => {
    const { id } = req.params;
    const db = req.dbUserClient ? req.dbUserClient.database : client.database;

    try {
        const { data, error } = await db
            .from('course_schedules')
            .select('*')
            .eq('course_id', id)
            .order('grade');

        if (error) throw error;
        res.json(data);
    } catch (error: any) {
        console.error("Error fetching course schedules:", error);
        res.status(500).json({ message: 'Error fetching schedules' });
    }
};

export const createCourseSchedule = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { grade, day_of_week, start_time, end_time } = req.body;
    const db = req.dbUserClient ? req.dbUserClient.database : client.database;

    try {
        const { data, error } = await db
            .from('course_schedules')
            .insert([{ course_id: id, grade, day_of_week, start_time, end_time }])
            .select()
            .single();

        if (error) throw error;
        res.status(201).json(data);
    } catch (error: any) {
        console.error("Error creating course schedule:", error);
        res.status(500).json({ message: 'Error creating schedule', error: error.message });
    }
};

export const deleteCourseSchedule = async (req: Request, res: Response) => {
    const { scheduleId } = req.params;
    const db = req.dbUserClient ? req.dbUserClient.database : client.database;

    try {
        const { error } = await db
            .from('course_schedules')
            .delete()
            .eq('id', scheduleId);

        if (error) throw error;
        res.json({ message: 'Schedule deleted successfully' });
    } catch (error: any) {
        console.error("Error deleting course schedule:", error);
        res.status(500).json({ message: 'Error deleting schedule', error: error.message });
    }
};
