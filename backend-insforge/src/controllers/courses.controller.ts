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
    const { name, description, monthly_fee, start_date, end_date } = req.body;
    const branchId = req.currentUser?.branch_id;
    const db = req.dbUserClient || client;

    console.log('createCourse:', { branchId, bodyName: name });

    try {
        const { data, error } = await db.database
            .from('courses')
            .insert([{ branch_id: branchId, name, description, monthly_fee, start_date, end_date }])
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

    try {
        const { data, error } = await db
            .from('courses')
            .update({ name, description, monthly_fee, is_active, start_date, end_date })
            .eq('id', id)
            .select()
            .single();

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

    try {
        const { error } = await db
            .from('courses')
            .delete()
            .eq('id', id);

        if (error) throw error;

        const branchId = req.currentUser?.branch_id;
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
