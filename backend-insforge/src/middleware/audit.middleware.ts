import { Request, Response, NextFunction } from 'express';
import client from '../config/insforge';

export const auditLogger = async (req: Request, res: Response, next: NextFunction) => {
    const originalSend = res.send;

    res.send = function (data: any) {
        res.locals.responseBody = data;
        return originalSend.call(this, data);
    };

    res.on('finish', async () => {
        // Solo auditar métodos que modifican estado
        if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method) && res.statusCode >= 200 && res.statusCode < 300) {
            const userId = req.currentUser?.id;
            const branchId = req.currentUser?.branch_id;
            const action = req.method;
            
            // Inferir entidad desde el path (ej. /api/students -> students)
            const pathSegments = req.baseUrl ? req.baseUrl.split('/') : req.path.split('/');
            const entity = pathSegments[pathSegments.length - 1] || 'unknown';
            
            const entityId = req.params.id || null;
            const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
            
            const newData = req.method === 'DELETE' ? null : req.body;
            let responseData = null;
            try {
                if (res.locals.responseBody) {
                    responseData = JSON.parse(res.locals.responseBody);
                }
            } catch (e) {
                // Ignore if response body is not JSON
            }

            const db = req.dbUserClient || client;

            try {
                await db.database.from('audit_logs').insert([{
                    user_id: userId || null,
                    branch_id: branchId || null,
                    action: action,
                    entity: entity,
                    entity_id: entityId ? parseInt(entityId as string) : (responseData?.id || null),
                    new_data: newData,
                    ip_address: ipAddress,
                    metadata: {
                        url: req.originalUrl,
                        status: res.statusCode
                    }
                }]);
                console.log(`[AUDIT] Logged ${action} on ${entity} by user ${userId}`);
            } catch (error) {
                console.error('[AUDIT] Failed to save audit log:', error);
            }
        }
    });

    next();
};
