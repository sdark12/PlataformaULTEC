import { Request, Response } from 'express';
import client from '../config/insforge';
import { broadcastNotification } from '../services/notification.service';
import { createClient } from '@insforge/sdk';
import { sendWelcomeEmail } from '../services/email.service';

const linkOrCreateParent = async (studentId: string, email: string, fullName: string, relationship: string, createdBy: string | undefined) => {
    try {
        const { data: existingProfile } = await client.database
            .from('profiles')
            .select('id')
            .eq('email', email)
            .single();
        
        let parentUserId: string;

        if (existingProfile) {
            parentUserId = existingProfile.id;
        } else {
             const tempClient = createClient({
                baseUrl: process.env.INSFORGE_URL || 'https://w6x267sp.us-east.insforge.app',
                anonKey: process.env.INSFORGE_API_KEY || 'ik_065cc96706290cd59a1103c714006c96'
            });
            
            const password = 'Padre' + Math.floor(1000 + Math.random() * 9000) + '!';
            const { data: authData, error: authError } = await tempClient.auth.signUp({ email, password });
            
            if (authError || !authData?.user) {
                console.error('Failed to auto-create parent user auth:', authError);
                return;
            }

            parentUserId = authData.user.id;
            
            const { error: profileError } = await client.database
                .from('profiles')
                .upsert({
                    id: parentUserId,
                    email,
                    full_name: fullName || 'Encargado',
                    role: 'parent',
                    active: true
                });
                
            if (profileError) {
                console.error('Failed to auto-create parent profile:', profileError);
                return;
            }
            sendWelcomeEmail(email, fullName || 'Encargado', 'parent', password);
        }

        const { data: existingLink } = await client.database
            .from('parent_student_links')
            .select('id')
            .eq('parent_user_id', parentUserId)
            .eq('student_id', studentId)
            .maybeSingle();

        if (!existingLink) {
            await client.database
                .from('parent_student_links')
                .insert({
                    parent_user_id: parentUserId,
                    student_id: studentId,
                    relationship: relationship || 'parent',
                    created_by: createdBy
                });
        }
    } catch (err) {
        console.error('Error linking or creating parent:', err);
    }
};

export const getStudents = async (req: Request, res: Response) => {
    const branchId = req.currentUser?.branch_id;
    const db = req.dbUserClient || client;

    try {
        let query = db.database
            .from('students')
            .select('*', { count: 'exact' })
            .order('full_name');

        if (branchId) {
            query = query.eq('branch_id', branchId);
        }

        const { page, limit, search } = req.query;

        if (search) {
            // Unir varios campos en una búsqueda general o limitar a full_name
            query = query.or(`full_name.ilike.%${search}%,personal_code.ilike.%${search}%`);
        }

        if (page && limit) {
            const pageNum = parseInt(page as string, 10);
            const limitNum = parseInt(limit as string, 10);
            const offset = (pageNum - 1) * limitNum;
            
            query = query.range(offset, offset + limitNum - 1);
            
            const { data, error, count } = await query;
            if (error) throw error;
            
            return res.json({
                data,
                meta: {
                    total: count || 0,
                    page: pageNum,
                    limit: limitNum,
                    totalPages: Math.ceil((count || 0) / limitNum)
                }
            });
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
        previous_school,
        personal_code,
        user_id, // Check for user link
        branch_id // Front-end passed branch_id
    } = req.body;

    const finalBranchId = branch_id || req.currentUser?.branch_id;
    const db = req.dbUserClient || client;

    // Convert empty string to null for UUID
    const finalUserId = user_id === '' ? null : user_id;

    console.log('createStudent:', { branchId: finalBranchId, bodyName: full_name });

    try {
        const { data, error } = await db.database
            .from('students')
            .insert([{
                branch_id: finalBranchId,
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
                previous_school,
                personal_code,
                user_id: finalUserId
            }])
            .select()
            .single();

        if (error) throw error;

        // Auto-create/link parent if email is provided
        if (guardian_email && data?.id) {
            await linkOrCreateParent(data.id, guardian_email.trim(), guardian_name, guardian_relationship, req.currentUser?.id);
        }

        res.status(201).json(data);
    } catch (error) {
        console.error("Error creating student:", error);
        res.status(500).json({ message: 'Error creating student', error: (error as any).message });
    }
};

export const updateStudent = async (req: Request, res: Response) => {
    const { id } = req.params;
    const updates = req.body;

    // Convert empty string to null for UUID columns
    if (updates.user_id === '') {
        updates.user_id = null;
    }

    const branchId = req.currentUser?.branch_id;
    const db = req.dbUserClient ? req.dbUserClient.database : client.database;

    try {
        let query = db
            .from('students')
            .update(updates)
            .eq('id', id);

        if (branchId) {
            query = query.eq('branch_id', branchId); // Ensure user can only update students in their branch
        }

        const { data, error } = await query.select().single();

        if (error) throw error;

        // Auto-create/link parent if email is provided and updated
        if (updates.guardian_email && updates.guardian_name && data?.id) {
            await linkOrCreateParent(data.id, updates.guardian_email.trim(), updates.guardian_name, updates.guardian_relationship, req.currentUser?.id);
        }

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
        let query = db
            .from('students')
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
                'Estudiante Eliminado',
                `Se ha eliminado un estudiante del sistema.`,
                'DELETE'
            );
        }

        res.json({ message: 'Student deleted successfully' });
    } catch (error) {
        console.error("Error deleting student:", error);
        res.status(500).json({ message: 'Error deleting student', error: (error as any).message });
    }
};
