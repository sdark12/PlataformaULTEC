import { Request, Response } from 'express';
import { PUSH_CONFIG } from '../config/push.config';
import client, { adminClient } from '../config/insforge';
import { sendPushToUser, sendPushToAll, PushPayload } from '../services/push.service';

const getDb = (req: Request) => (req as any).dbUserClient || adminClient || client;

/**
 * 1. Obtener Llave Pública VAPID
 * GET /api/notifications/vapid-public-key
 */
export const getVapidPublicKey = async (_req: Request, res: Response) => {
    return res.json({
        publicKey: PUSH_CONFIG.vapidPublicKey
    });
};

/**
 * 2. Suscribir Dispositivo a Notificaciones Push
 * POST /api/notifications/subscribe
 */
export const subscribePushDevice = async (req: Request, res: Response) => {
    try {
        const user = req.currentUser;
        if (!user) {
            return res.status(401).json({ message: 'Usuario no autenticado.' });
        }

        const { endpoint, keys, userAgent } = req.body;

        if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
            return res.status(400).json({ message: 'Payload de suscripción inválido. Se requieren endpoint, p256dh y auth.' });
        }

        const db = adminClient || client;

        // Upsert suscripción por endpoint único
        const { data, error } = await db
            .from('push_subscriptions')
            .upsert({
                user_id: user.id,
                endpoint,
                p256dh: keys.p256dh,
                auth: keys.auth,
                user_agent: userAgent || req.headers['user-agent'] || null,
                updated_at: new Date().toISOString()
            }, { onConflict: 'endpoint' })
            .select()
            .single();

        if (error) throw error;

        console.log(`[PUSH] Dispositivo registrado para usuario ${user.email} (${data.id})`);
        return res.status(201).json({
            message: 'Dispositivo registrado exitosamente para notificaciones push.',
            subscriptionId: data.id
        });

    } catch (error) {
        console.error('Error al registrar suscripción push:', error);
        return res.status(500).json({ message: 'Error interno al registrar suscripción push.' });
    }
};

/**
 * 3. Cancelar Suscripción de Dispositivo
 * POST /api/notifications/unsubscribe
 */
export const unsubscribePushDevice = async (req: Request, res: Response) => {
    try {
        const user = req.currentUser;
        if (!user) {
            return res.status(401).json({ message: 'Usuario no autenticado.' });
        }

        const { endpoint } = req.body;
        if (!endpoint) {
            return res.status(400).json({ message: 'Se requiere el endpoint de suscripción.' });
        }

        const db = adminClient || client;

        const { error } = await db
            .from('push_subscriptions')
            .delete()
            .eq('endpoint', endpoint)
            .eq('user_id', user.id);

        if (error) throw error;

        console.log(`[PUSH] Dispositivo desuscrito para usuario ${user.email}`);
        return res.json({ message: 'Suscripción push eliminada correctamente.' });

    } catch (error) {
        console.error('Error al desuscribir dispositivo:', error);
        return res.status(500).json({ message: 'Error al cancelar la suscripción push.' });
    }
};

/**
 * 4. Enviar Notificación Push de Prueba al Usuario Actual
 * POST /api/notifications/test-push
 */
export const sendTestPush = async (req: Request, res: Response) => {
    try {
        const user = req.currentUser;
        if (!user) {
            return res.status(401).json({ message: 'Usuario no autenticado.' });
        }

        const payload: PushPayload = {
            title: '🔔 Plataforma ULTEC - Notificación de Prueba',
            body: '¡Excelente! Tu dispositivo ha sido configurado y está recibiendo alertas en tiempo real correctamente.',
            url: '/',
            type: 'SYSTEM'
        };

        const deliveredCount = await sendPushToUser(user.id, payload);

        if (deliveredCount === 0) {
            return res.status(400).json({
                message: 'No se encontraron dispositivos activos registrados para tu usuario o los permisos están bloqueados en tu navegador/dispositivo.',
                deliveredCount: 0
            });
        }

        return res.json({
            message: `Notificación enviada exitosamente a ${deliveredCount} dispositivo(s).`,
            deliveredCount
        });

    } catch (error) {
        console.error('Error al enviar push de prueba:', error);
        return res.status(500).json({ message: 'Error interno al enviar la notificación de prueba.' });
    }
};

/**
 * 5. Emisión de Alerta Push Institucional Masiva (Directores / SuperAdmin)
 * POST /api/notifications/broadcast-push
 */
export const broadcastPushAlert = async (req: Request, res: Response) => {
    try {
        const user = req.currentUser;
        if (!user || !['admin', 'superadmin'].includes(user.role)) {
            return res.status(403).json({ message: 'Solo personal administrativo puede enviar alertas push masivas.' });
        }

        const { title, body, url, branch_id } = req.body;

        if (!title || !body) {
            return res.status(400).json({ message: 'Se requieren título y cuerpo del mensaje para la alerta.' });
        }

        const targetBranch = user.role === 'superadmin' ? branch_id : user.branch_id;

        const payload: PushPayload = {
            title: `📢 ${title}`,
            body,
            url: url || '/',
            type: 'SYSTEM'
        };

        const deliveredCount = await sendPushToAll(payload, targetBranch);

        return res.json({
            message: `Alerta push institucional despachada a ${deliveredCount} dispositivo(s).`,
            deliveredCount
        });

    } catch (error) {
        console.error('Error al emitir alerta push masiva:', error);
        return res.status(500).json({ message: 'Error interno al emitir alerta push masiva.' });
    }
};
