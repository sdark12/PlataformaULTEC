import { Request, Response } from 'express';
import client, { adminClient } from '../config/insforge';
import { broadcastNotification } from '../services/notification.service';
import { getEffectiveBranchId } from '../utils/branch.utils';

export const getCourses = async (req: Request, res: Response) => {
    const branchId = getEffectiveBranchId(req);
    const { academic_year } = req.query;
    const db = req.dbUserClient || adminClient || client;

    try {
        let query = db
            .from('courses')
            .select('*')
            .eq('is_active', true)
            .order('academic_year', { ascending: false })
            .order('name');

        if (branchId) {
            query = query.eq('branch_id', branchId);
        }

        if (academic_year && academic_year !== 'ALL') {
            query = query.eq('academic_year', parseInt(academic_year as string, 10));
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
    const { name, description, monthly_fee, start_date, end_date, branch_id, academic_year } = req.body;
    
    const user = req.currentUser;
    const finalBranchId = user?.role === 'superadmin'
        ? ((branch_id === '' ? null : branch_id) || getEffectiveBranchId(req))
        : (user?.branch_id || null);
    const finalStartDate = start_date === '' ? null : start_date;
    const finalEndDate = end_date === '' ? null : end_date;
    const finalDescription = description === '' ? null : description;

    // Deduce academic_year if not specified
    let finalAcademicYear = academic_year ? parseInt(String(academic_year), 10) : undefined;
    if (!finalAcademicYear && finalStartDate) {
        finalAcademicYear = new Date(finalStartDate).getFullYear();
    }
    if (!finalAcademicYear) {
        finalAcademicYear = new Date().getFullYear();
    }

    const db = req.dbUserClient || adminClient || client;

    console.log('createCourse:', { branchId: finalBranchId, bodyName: name, academicYear: finalAcademicYear });

    try {
        const { data, error } = await db
            .from('courses')
            .insert([{ 
                branch_id: finalBranchId, 
                name, 
                description: finalDescription, 
                monthly_fee, 
                start_date: finalStartDate, 
                end_date: finalEndDate,
                academic_year: finalAcademicYear
            }])
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
    const { name, description, monthly_fee, is_active, start_date, end_date, academic_year } = req.body;
    
    // Clean up empty strings to null for database compatibility
    const finalStartDate = start_date === '' ? null : start_date;
    const finalEndDate = end_date === '' ? null : end_date;
    const finalDescription = description === '' ? null : description;
    const finalAcademicYear = academic_year !== undefined && academic_year !== null && academic_year !== ''
        ? parseInt(String(academic_year), 10)
        : undefined;

    const db = req.dbUserClient || adminClient || client;

    const branchId = req.currentUser?.branch_id;

    try {
        const updatePayload: any = { 
            name, 
            description: finalDescription, 
            monthly_fee, 
            is_active, 
            start_date: finalStartDate, 
            end_date: finalEndDate 
        };
        if (finalAcademicYear) {
            updatePayload.academic_year = finalAcademicYear;
        }

        let query = db
            .from('courses')
            .update(updatePayload)
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
    const db = req.dbUserClient || adminClient || client;

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
    const db = req.dbUserClient || adminClient || client;

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
    const db = req.dbUserClient || adminClient || client;

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
    const db = req.dbUserClient || adminClient || client;

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
