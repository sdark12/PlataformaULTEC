import { Request, Response } from 'express';
import client from '../config/insforge';

export const login = async (req: Request, res: Response) => {
    const { email, password } = req.body;

    try {
        const { data, error } = await client.auth.signInWithPassword({
            email,
            password,
        });

        if (error || !data) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Get Profile
        const { data: profileList, error: profileError } = await client.database
            .from('profiles')
            .select('*')
            .eq('id', data.user.id);

        const profile = (profileList && profileList.length > 0) ? profileList[0] : null;

        if (profileError) {
            console.error('Profile fetch error:', profileError);
        }

        // Map profile data to expected format if needed
        // Assuming profiles has branch_id and role_id from our schema update
        // But role is ENUM in original profiles?
        // Let's check profile structure from previous step.
        // It had `role` as user_role type. 
        // I added `role_id` and `branch_id`.

        res.json({
            token: data.accessToken,
            user: {
                id: data.user.id,
                email: data.user.email,
                role: profile?.role || 'student',
                branch_id: profile?.branch_id || null,
                full_name: profile?.full_name || ''
            },
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const adminResetPassword = async (req: Request, res: Response) => {
    const { userId, newPassword } = req.body;

    if (!userId || !newPassword) {
        return res.status(400).json({ message: 'Se requiere el ID del usuario y la nueva contraseña.' });
    }

    try {
        // We need the SERVICE ROLE KEY to update another user's password
        const { createClient } = require('@insforge/sdk');
        const adminClient = createClient({
            baseUrl: process.env.INSFORGE_URL || 'https://w6x267sp.us-east.insforge.app',
            // WARNING: Must use service_role key here, but fallback to anon if we don't have it for this scope
            anonKey: process.env.INSFORGE_SERVICE_ROLE_KEY || process.env.INSFORGE_API_KEY || 'ik_065cc96706290cd59a1103c714006c96'
        });

        // Given that Insforge SDK doesn't expose auth.admin, we call a trusted Postgres RPC 
        // to update the password securely via the database.
        const { data, error } = await adminClient.database.rpc('admin_change_user_password', {
            target_user_id: userId,
            new_password: newPassword
        });

        if (error) {
            console.error('Admin reset password error:', error);
            return res.status(400).json({ message: 'Error al actualizar contraseña. (Asegúrese de ejecutar el script SQL).', details: error.message });
        }

        res.json({ message: 'Contraseña actualizada correctamente.' });
    } catch (error: any) {
        console.error('Admin reset password generic error:', error);
        res.status(500).json({ message: 'Error interno del servidor.', details: error.message });
    }
};
