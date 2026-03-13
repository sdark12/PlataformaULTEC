import { Request, Response } from 'express';
import client from '../config/insforge';
import { createClient } from '@insforge/sdk';
import { sendWelcomeEmail } from '../services/email.service';

export const getUsers = async (req: Request, res: Response) => {
    try {
        let query = client.database
            .from('profiles')
            .select('*', { count: 'exact' })
            .order('full_name', { ascending: true });

        const { page, limit, search } = req.query;

        if (search) {
            query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`);
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
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ message: 'Error fetching users' });
    }
};

export const createUser = async (req: Request, res: Response) => {
    try {
        const { email, password, full_name, role, phone, student_id, branch_id } = req.body;

        // Use a temporary client for signup to avoid overriding the backend's global session
        const tempClient = createClient({
            baseUrl: process.env.INSFORGE_URL || 'https://w6x267sp.us-east.insforge.app',
            anonKey: process.env.INSFORGE_API_KEY || 'ik_065cc96706290cd59a1103c714006c96'
        });

        // Create auth user
        const { data: authData, error: authError } = await tempClient.auth.signUp({
            email,
            password
        });

        if (authError) throw authError;
        if (!authData || !authData.user) return res.status(400).json({ message: 'Error al registrar credenciales de acceso.' });

        // Update or Insert Profile
        // Sometimes Supabase triggers create the profile automatically on auth.users insert. We check first.
        const { data: existingProfile } = await client.database
            .from('profiles')
            .select('id')
            .eq('id', authData.user.id)
            .single();

        const profilePayload: any = {
            id: authData.user.id,
            email,
            full_name,
            role
        };

        // Only add these to payload if they exist in DB (prevent crashes if not)
        // We assume they will be added with the SQL script.
        if (phone !== undefined) profilePayload.phone = phone;
        if (branch_id !== undefined) profilePayload.branch_id = branch_id === '' ? null : branch_id;
        profilePayload.active = true;

        let profileResult;
        if (existingProfile) {
            profileResult = await client.database
                .from('profiles')
                .update(profilePayload)
                .eq('id', authData.user.id)
                .select()
                .single();
        } else {
            profileResult = await client.database
                .from('profiles')
                .insert([profilePayload])
                .select()
                .single();
        }

        if (profileResult.error) {
            console.error('Profile creation error:', profileResult.error);
            // Si el perfil falla, debemos comunicárselo al frontend en vez de ocultarlo
            return res.status(400).json({ message: 'Error al registrar el perfil (Revise si las columnas active/phone existen).', details: profileResult.error });
        }

        // Link to student if provided
        if (role === 'student' && student_id) {
            const { error: studentLinkError } = await client.database
                .from('students')
                .update({ user_id: authData.user.id })
                .eq('id', student_id);

            if (studentLinkError) {
                console.error('Student linking error:', studentLinkError);
                // We don't fail the whole request but we could log it
            }
        }

        // Send Welcome Email asynchronously
        sendWelcomeEmail(email, full_name, role, password);

        res.status(201).json(profileResult.data || authData.user);
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({ message: 'Error interno al crear usuario.' });
    }
};

export const getUserById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { data, error } = await client.database
            .from('profiles')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;
        if (!data) return res.status(404).json({ message: 'User not found' });

        res.json(data);
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({ message: 'Error fetching user' });
    }
};

export const updateUser = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { full_name, email, role, phone, active, branch_id } = req.body;

        const updatePayload: any = {
            full_name,
            email,
            role
        };

        if (phone !== undefined) updatePayload.phone = phone;
        if (active !== undefined) updatePayload.active = active;
        if (branch_id !== undefined) updatePayload.branch_id = branch_id === '' ? null : branch_id;

        const { data, error } = await client.database
            .from('profiles')
            .update(updatePayload)
            .eq('id', id)
            .select('*')
            .single();

        if (error) throw error;
        if (!data) return res.status(404).json({ message: 'User not found' });

        // Handle student linking if role is student and student_id is provided
        const { student_id } = req.body;
        if (role === 'student' && student_id) {
            // Unlink any existing student for this user first
            await client.database
                .from('students')
                .update({ user_id: null })
                .eq('user_id', id);

            // Link the new student
            const { error: studentLinkError } = await client.database
                .from('students')
                .update({ user_id: id })
                .eq('id', student_id);

            if (studentLinkError) {
                console.error('Student linking error during update:', studentLinkError);
            }
        } else if (role !== 'student') {
            // If role is changed from student to something else, optionally unlink
            await client.database
                .from('students')
                .update({ user_id: null })
                .eq('user_id', id);
        }

        res.json(data);
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({ message: 'Error updating user' });
    }
};

// Deleting a user might require auth admin access. For now we will allow deactivating (active boolean)
export const deleteUser = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        // Let's assume we do a soft delete or just delete the profile record
        const { data, error } = await client.database
            .from('profiles')
            .delete()
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        if (!data) return res.status(404).json({ message: 'User not found or already deleted' });

        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ message: 'Error deleting user' });
    }
};
