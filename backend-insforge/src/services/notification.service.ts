import client, { adminClient } from '../config/insforge';
import { sendPushToUser, sendPushToUsers } from './push.service';

const getTargetUrlForType = (type: string): string => {
    switch (type) {
        case 'PAYMENT': return '/payments';
        case 'ENROLLMENT': return '/enrollments';
        case 'SYSTEM': return '/';
        case 'DELETE': return '/payments';
        default: return '/';
    }
};

/**
 * Creates an in-app notification for a specific user and dispatches a Web Push alert.
 */
export const createNotification = async (
    dbClient: any,
    userId: string,
    title: string,
    message: string,
    type: 'PAYMENT' | 'ENROLLMENT' | 'DELETE' | 'SYSTEM'
) => {
    const effectiveDb = (dbClient === client || !dbClient) ? (adminClient || client) : dbClient;
    try {
        const { error } = await effectiveDb
            .from('notifications')
            .insert([{
                user_id: userId,
                title,
                message,
                type,
                is_read: false
            }]);

        if (error) {
            console.error('Failed to insert notification into DB:', error);
        }

        // Despachar Push Notification en segundo plano sin bloquear
        sendPushToUser(userId, {
            title,
            body: message,
            url: getTargetUrlForType(type),
            type
        }).catch(pushErr => console.error('[PUSH] Error in background push delivery:', pushErr));

    } catch (err) {
        console.error('Error creating notification:', err);
    }
};

/**
 * Broadcasts a notification to all users in a specific branch with a specific role,
 * inserting in-app records and triggering push alerts.
 */
export const broadcastNotification = async (
    dbClient: any,
    branchId: any,
    title: string,
    message: string,
    type: 'PAYMENT' | 'ENROLLMENT' | 'DELETE' | 'SYSTEM',
    role: string = 'admin'
) => {
    const effectiveDb = (dbClient === client || !dbClient) ? (adminClient || client) : dbClient;
    try {
        // Find all users in the branch with specified role
        const { data: profiles, error: profileError } = await effectiveDb
            .from('profiles')
            .select('id')
            .eq('branch_id', branchId)
            .eq('role', role);

        if (profileError || !profiles || profiles.length === 0) {
            return;
        }

        // Insert notifications
        const notificationsToInsert = profiles.map((p: any) => ({
            user_id: p.id,
            title,
            message,
            type,
            is_read: false
        }));

        const { error: insertError } = await effectiveDb
            .from('notifications')
            .insert(notificationsToInsert);

        if (insertError) {
            console.error('Failed to broadcast notifications:', insertError);
        }

        // Despacho Push Masivo en segundo plano
        const userIds = profiles.map((p: any) => p.id);
        sendPushToUsers(userIds, {
            title,
            body: message,
            url: getTargetUrlForType(type),
            type
        }).catch(pushErr => console.error('[PUSH] Error in background broadcast delivery:', pushErr));

    } catch (err) {
        console.error('Error broadcasting notification:', err);
    }
};
