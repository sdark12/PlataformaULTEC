import webpush from 'web-push';
import { PUSH_CONFIG } from '../config/push.config';
import client, { adminClient } from '../config/insforge';

const db = adminClient || client;

// Inicializar configuración VAPID
try {
    webpush.setVapidDetails(
        PUSH_CONFIG.vapidSubject,
        PUSH_CONFIG.vapidPublicKey,
        PUSH_CONFIG.vapidPrivateKey
    );
    console.log('[PUSH] Web Push VAPID inicializado correctamente.');
} catch (err) {
    console.error('[PUSH] Error al configurar VAPID en Web Push:', err);
}

export interface PushPayload {
    title: string;
    body: string;
    url?: string;
    type?: string;
    icon?: string;
    badge?: string;
    tag?: string;
}

/**
 * Envía una notificación push a una suscripción específica y elimina la suscripción si ya expiró (410 Gone / 404)
 */
export const dispatchToSubscription = async (subRecord: any, payload: PushPayload): Promise<boolean> => {
    try {
        const pushSubscription = {
            endpoint: subRecord.endpoint,
            keys: {
                p256dh: subRecord.p256dh,
                auth: subRecord.auth
            }
        };

        const notificationData = JSON.stringify({
            title: payload.title,
            body: payload.body,
            url: payload.url || '/',
            type: payload.type || 'SYSTEM',
            icon: payload.icon || '/pwa-192x192.svg',
            badge: payload.badge || '/pwa-192x192.svg',
            tag: payload.tag || `ultec-notif-${Date.now()}`
        });

        await webpush.sendNotification(pushSubscription, notificationData);
        return true;
    } catch (error: any) {
        // Códigos 404 o 410 indican que el usuario revocó el permiso o desinstaló el navegador/app
        if (error.statusCode === 404 || error.statusCode === 410) {
            console.log(`[PUSH] Limpiando suscripción obsoleta o revocada ID ${subRecord.id} (${error.statusCode})`);
            try {
                await db.from('push_subscriptions').delete().eq('id', subRecord.id);
            } catch (delErr) {
                console.error('[PUSH] Error al eliminar suscripción obsoleta:', delErr);
            }
        } else {
            console.warn(`[PUSH] Error al despachar notificación a suscripción ${subRecord.id}:`, error.message || error);
        }
        return false;
    }
};

/**
 * Envía una notificación push a todos los dispositivos registrados de un usuario específico
 */
export const sendPushToUser = async (userId: string, payload: PushPayload): Promise<number> => {
    if (!userId) return 0;
    try {
        const { data: subscriptions, error } = await db
            .from('push_subscriptions')
            .select('*')
            .eq('user_id', userId);

        if (error || !subscriptions || subscriptions.length === 0) {
            return 0;
        }

        const results = await Promise.allSettled(
            subscriptions.map(sub => dispatchToSubscription(sub, payload))
        );

        const successful = results.filter(r => r.status === 'fulfilled' && r.value === true).length;
        return successful;
    } catch (err) {
        console.error(`[PUSH] Error al enviar push a usuario ${userId}:`, err);
        return 0;
    }
};

/**
 * Envía una notificación push a múltiples usuarios simultáneamente
 */
export const sendPushToUsers = async (userIds: string[], payload: PushPayload): Promise<number> => {
    if (!userIds || userIds.length === 0) return 0;
    try {
        const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
        const { data: subscriptions, error } = await db
            .from('push_subscriptions')
            .select('*')
            .in('user_id', uniqueIds);

        if (error || !subscriptions || subscriptions.length === 0) {
            return 0;
        }

        const results = await Promise.allSettled(
            subscriptions.map(sub => dispatchToSubscription(sub, payload))
        );

        const successful = results.filter(r => r.status === 'fulfilled' && r.value === true).length;
        return successful;
    } catch (err) {
        console.error('[PUSH] Error al enviar push masivo:', err);
        return 0;
    }
};

/**
 * Envía una alerta push general a todos los dispositivos registrados en el sistema
 */
export const sendPushToAll = async (payload: PushPayload, filterBranchId?: string | null): Promise<number> => {
    try {
        let query = db.from('push_subscriptions').select('*, profiles!push_subscriptions_user_id_fkey(branch_id)');

        const { data: subscriptions, error } = await query;
        if (error || !subscriptions) return 0;

        let targetSubs = subscriptions;
        if (filterBranchId && filterBranchId !== 'all') {
            targetSubs = subscriptions.filter((s: any) => s.profiles?.branch_id === filterBranchId);
        }

        const results = await Promise.allSettled(
            targetSubs.map((sub: any) => dispatchToSubscription(sub, payload))
        );

        return results.filter(r => r.status === 'fulfilled' && r.value === true).length;
    } catch (err) {
        console.error('[PUSH] Error al enviar broadcast general:', err);
        return 0;
    }
};
