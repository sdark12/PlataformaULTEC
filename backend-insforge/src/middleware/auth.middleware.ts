import { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';

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
        return res.status(401).json({ message: 'No autorizado. Se requiere token de sesión.', code: 'UNAUTHORIZED' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const verifyClient = createClient(process.env.INSFORGE_URL!, process.env.INSFORGE_API_KEY!, {
            global: { headers: { Authorization: `Bearer ${token}` } }
        });

        // Decode JWT to get user ID and expiration
        const payloadBase64 = token.split('.')[1];
        if (!payloadBase64) {
            return res.status(401).json({ message: 'Token con formato inválido.', code: 'INVALID_TOKEN' });
        }

        const payloadStr = Buffer.from(payloadBase64, 'base64').toString('utf-8');
        const payload = JSON.parse(payloadStr);
        const authUserId = payload.sub;

        if (!authUserId) {
            return res.status(401).json({ message: 'Identificador de usuario inválido en token.', code: 'INVALID_TOKEN' });
        }

        // Verificar expiración explícita del JWT
        if (payload.exp && Date.now() >= payload.exp * 1000) {
            return res.status(401).json({ 
                message: 'Tu sesión ha expirado por límite de tiempo. Por favor inicia sesión nuevamente.', 
                code: 'TOKEN_EXPIRED' 
            });
        }

        // Validate token and profile status in database
        const { data: profile, error: profileError } = await verifyClient
            .from('profiles')
            .select('*')
            .eq('id', authUserId)
            .single();

        if (profileError || !profile) {
            console.error('Auth: Invalid token or profile not found for user', authUserId);
            return res.status(401).json({ message: 'Sesión no válida o perfil no encontrado.', code: 'INVALID_SESSION' });
        }

        // Revocación inmediata: Si la cuenta fue desactivada por administración, bloquear de inmediato
        if (profile.active === false) {
            console.warn(`[AUTH] Blocked active request from deactivated user ${profile.id} (${profile.email})`);
            return res.status(403).json({ 
                message: 'Tu cuenta ha sido desactivada o suspendida por la administración. Comunícate con la dirección del centro educativo.',
                code: 'ACCOUNT_DEACTIVATED'
            });
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
        return res.status(401).json({ message: 'Token de autenticación inválido o expirado.', code: 'INVALID_TOKEN' });
    }
};
