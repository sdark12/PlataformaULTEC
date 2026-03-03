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
            dbUserClient?: any; // The authenticated InsForge client
        }
    }
}

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
        console.log('Auth Middleware: No Bearer token found');
        return res.status(401).json({ message: 'Not authorized' });
    }

    const token = authHeader.split(' ')[1];

    try {
        // Create a stateless client for this request to verify the token
        const verifyClient = createClient({
            baseUrl: process.env.INSFORGE_URL || 'https://w6x267sp.us-east.insforge.app',
            anonKey: process.env.INSFORGE_API_KEY || 'ik_065cc96706290cd59a1103c714006c96',
            edgeFunctionToken: token
        });

        // Decode JWT manually to get the user's ID
        const payloadBase64 = token.split('.')[1];
        const payloadStr = Buffer.from(payloadBase64, 'base64').toString('utf-8');
        const payload = JSON.parse(payloadStr);
        const authUserId = payload.sub;

        if (!authUserId) {
            console.error('Auth Middleware: No valid sub in token payload');
            return res.status(401).json({ message: 'Invalid token payload' });
        }

        // Validate token by trying to fetch the user's explicit profile
        const { data: profile, error: profileError } = await verifyClient.database
            .from('profiles')
            .select('*')
            .eq('id', authUserId)
            .single();

        if (profileError || !profile) {
            console.error('Auth Middleware: Invalid token or profile not found for user', authUserId, profileError);
            return res.status(401).json({ message: 'Invalid token' });
        }

        // We can trust this ID because it came from the token payload
        const userId = profile.id;

        req.currentUser = {
            id: userId,
            email: profile.email || '', // We added email to profile in schema reset
            role: profile.role || 'student',
            branch_id: profile.branch_id || null
        };

        console.log('Auth Middleware Success:', {
            userId: userId,
            role: req.currentUser.role,
            branchId: req.currentUser.branch_id
        });

        // Attach the authenticated client to the request
        req.dbUserClient = verifyClient;

        next();
    } catch (err) {
        console.error('Auth middleware critical error:', err);
        return res.status(401).json({ message: 'Invalid token' });
    }
};
