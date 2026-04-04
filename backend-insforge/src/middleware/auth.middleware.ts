import { Request, Response, NextFunction } from 'express';
import { createClient } from '@insforge/sdk';

interface UserPayload {
    id: string;
    email: string;
    role: string;
    branch_id: string;
}

declare global {
    namespace Express {
        interface Request {
            currentUser?: UserPayload;
            dbUserClient?: any;
        }
    }
}

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Not authorized' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const verifyClient = createClient({
            baseUrl: process.env.INSFORGE_URL!,
            anonKey: process.env.INSFORGE_API_KEY!,
            edgeFunctionToken: token
        });

        // Decode JWT to get the user's ID
        const payloadBase64 = token.split('.')[1];
        const payloadStr = Buffer.from(payloadBase64, 'base64').toString('utf-8');
        const payload = JSON.parse(payloadStr);
        const authUserId = payload.sub;

        if (!authUserId) {
            return res.status(401).json({ message: 'Invalid token payload' });
        }

        // Validate token by fetching user profile
        const { data: profile, error: profileError } = await verifyClient.database
            .from('profiles')
            .select('*')
            .eq('id', authUserId)
            .single();

        if (profileError || !profile) {
            console.error('Auth: Invalid token or profile not found for user', authUserId);
            return res.status(401).json({ message: 'Invalid token' });
        }

        req.currentUser = {
            id: profile.id,
            email: profile.email || '',
            role: profile.role || 'student',
            branch_id: profile.branch_id || null
        };

        req.dbUserClient = verifyClient;
        next();
    } catch (err) {
        console.error('Auth middleware error:', err);
        return res.status(401).json({ message: 'Invalid token' });
    }
};

