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

        // Validate token by trying to fetch the user's profile directly
        // (RLS policies will ensure we only get our own profile)
        const { data: profileList, error: profileError } = await verifyClient.database
            .from('profiles')
            .select('*');

        if (profileError || !profileList || profileList.length === 0) {
            console.error('Auth Middleware: Invalid token or profile not found', profileError);
            return res.status(401).json({ message: 'Invalid token' });
        }

        const profile = profileList[0];

        // We can trust this ID because RLS enforced it matches the token's auth.uid()
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
