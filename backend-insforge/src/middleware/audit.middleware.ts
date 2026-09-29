import { Request, Response, NextFunction } from 'express';
import client, { adminClient } from '../config/insforge';

export const auditLogger = async (req: Request, res: Response, next: NextFunction) => {
    const originalSend = res.send;

    res.send = function (data: any) {
        res.locals.responseBody = data;
        return originalSend.call(this, data);
    };

    res.on('finish', async () => {
        // Solo auditar métodos que modifican estado (POST, PUT, DELETE, PATCH)
        if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method) && res.statusCode >= 200 && res.statusCode < 300) {
            const rawUrl = req.originalUrl || req.url || '';
            const cleanPath = rawUrl.split('?')[0];

            // Evitar auditar el visor de logs y settings (settings tiene su propio logger con diffs)
            if (cleanPath.includes('/audit-logs') || cleanPath.includes('/settings')) {
                return;
            }

            const userId = req.currentUser?.id;
            const branchId = req.currentUser?.branch_id;
            const action = req.method;

            // Extraer módulo/entidad e identificador del path
            const segments = cleanPath.split('/').filter(Boolean);
            let entity = 'unknown';
            let urlEntityId: string | null = null;

            if (segments.length > 0) {
                if (segments[0] === 'api') {
                    entity = segments[1] || 'api';
                    if (segments.length > 2 && segments[2] !== 'bulk' && segments[2] !== 'verify') {
                        urlEntityId = segments[2];
                    }
                } else {
                    entity = segments[0];
                    if (segments.length > 1) {
                        urlEntityId = segments[1];
                    }
                }
            }

            const rawIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || req.socket.remoteAddress || 'unknown';
            const ipAddress = rawIp.replace(/^::ffff:/, '');

            let responseData: any = null;
            try {
                if (res.locals.responseBody) {
                    responseData = typeof res.locals.responseBody === 'string'
                        ? JSON.parse(res.locals.responseBody)
                        : res.locals.responseBody;
                }
            } catch {
                // Ignore parse errors for non-JSON responses
            }

            const entityId = req.params?.id 
                || (responseData?.data?.id ? String(responseData.data.id) : null)
                || (responseData?.id ? String(responseData.id) : null)
                || (urlEntityId ? String(urlEntityId) : null);

            // Sanitizar datos sensibles para que no se almacenen contraseñas
            let sanitizedBody = null;
            if (req.method !== 'DELETE' && req.body) {
                try {
                    sanitizedBody = JSON.parse(JSON.stringify(req.body));
                    if (typeof sanitizedBody === 'object' && sanitizedBody !== null) {
                        if (sanitizedBody.password) sanitizedBody.password = '********';
                        if (sanitizedBody.confirmPassword) sanitizedBody.confirmPassword = '********';
                        if (sanitizedBody.token) sanitizedBody.token = '[REDACTED]';
                    }
                } catch {
                    sanitizedBody = null;
                }
            }

            const db = adminClient || client;

            try {
                await db.from('audit_logs').insert([{
                    user_id: userId || null,
                    branch_id: branchId || null,
                    action: action,
                    entity: entity,
                    entity_id: entityId ? String(entityId) : null,
                    new_data: sanitizedBody,
                    old_data: res.locals.oldData || null,
                    ip_address: ipAddress,
                    metadata: {
                        url: rawUrl,
                        method: req.method,
                        status: res.statusCode,
                        user_agent: req.headers['user-agent'] || 'unknown'
                    }
                }]);
                console.log(`[AUDIT] Logged ${action} on ${entity} (id: ${entityId}) by user ${userId || 'anonymous'}`);
            } catch (error) {
                console.error('[AUDIT] Failed to save audit log:', error);
            }
        }
    });

    next();
};
