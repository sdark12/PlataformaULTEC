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
