import { Request, Response } from 'express';
import client from '../config/insforge';

export const getStudents = async (req: Request, res: Response) => {
    const branchId = req.currentUser?.branch_id;
    const db = req.dbUserClient || client;

    try {
        let query = db.database
            .from('students')
            .select('*')
            .order('full_name');

        if (branchId) {
            query = query.eq('branch_id', branchId);
        }

        const { data, error } = await query;

        if (error) throw error;

        res.json(data);
    } catch (error: any) {
        console.error('CRITICAL ERROR in getStudents:', error);
        if (error instanceof Error) {
            console.error('Stack:', error.stack);
            console.error('Message:', error.message);
        } else {
            console.error('Unknown error object:', JSON.stringify(error));
        }
        res.status(500).json({
            message: 'Error retrieving students',
            error: error?.message || 'Unknown error',
            details: JSON.stringify(error)
        });
    }
};

export const createStudent = async (req: Request, res: Response) => {
    const {
        full_name,
        birth_date,
        gender,
        identification_document,
        nationality,
        address,
        phone,
        // additional_phone, // Check if column exists or add to schema if needed
        guardian_name,
        guardian_phone,
        guardian_email,
        guardian_relationship,
        emergency_contact_name,
        emergency_contact_phone,
        medical_notes,
        previous_school
    } = req.body;

    const branchId = req.currentUser?.branch_id;
    const db = req.dbUserClient || client;

    console.log('createStudent:', { branchId, bodyName: full_name });

    try {
        const { data, error } = await db.database
            .from('students')
            .insert([{
                branch_id: branchId,
                full_name,
                birth_date,
                gender,
                identification_document,
                nationality,
                address,
                phone,
                guardian_name,
                guardian_phone,
                guardian_email,
                guardian_relationship,
                emergency_contact_name,
                emergency_contact_phone,
                medical_notes,
                previous_school
            }])
            .select()
            .single();

        if (error) throw error;

        res.status(201).json(data);
    } catch (error) {
        console.error("Error creating student:", error);
        res.status(500).json({ message: 'Error creating student', error: (error as any).message });
    }
};

export const updateStudent = async (req: Request, res: Response) => {
    const { id } = req.params;
    const updates = req.body;
    const branchId = req.currentUser?.branch_id;
    const db = req.dbUserClient ? req.dbUserClient.database : client.database;

    try {
        const { data, error } = await db
            .from('students')
            .update(updates)
            .eq('id', id)
            .eq('branch_id', branchId) // Ensure user can only update students in their branch
            .select()
            .single();

        if (error) throw error;

        res.json(data);
    } catch (error) {
        console.error("Error updating student:", error);
        res.status(500).json({ message: 'Error updating student', error: (error as any).message });
    }
};

export const deleteStudent = async (req: Request, res: Response) => {
    const { id } = req.params;
    const branchId = req.currentUser?.branch_id;
    const db = req.dbUserClient ? req.dbUserClient.database : client.database;

    try {
        const { error } = await db
            .from('students')
            .delete()
            .eq('id', id)
            .eq('branch_id', branchId);

        if (error) throw error;

        res.json({ message: 'Student deleted successfully' });
    } catch (error) {
        console.error("Error deleting student:", error);
        res.status(500).json({ message: 'Error deleting student', error: (error as any).message });
    }
};
