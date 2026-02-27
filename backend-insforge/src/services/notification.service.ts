import client from '../config/insforge';

/**
 * Creates a notification for a specific user.
 * @param dbClient The InsForge SDK client (usually req.dbUserClient or general client)
 * @param userId The recipient's profile UUID
 * @param title The notification title
 * @param message The notification message
 * @param type The type of the notification
 */
export const createNotification = async (
    dbClient: any,
    userId: string,
    title: string,
    message: string,
    type: 'PAYMENT' | 'ENROLLMENT' | 'DELETE' | 'SYSTEM'
) => {
    try {
        const { error } = await dbClient.database
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
    } catch (err) {
        console.error('Error creating notification:', err);
    }
};

/**
 * Broadcasts a notification to all users in a specific branch with a specific role.
 * By default, broadcasts to all 'admin' users in the branch.
 */
export const broadcastNotification = async (
    dbClient: any,
    branchId: any,
    title: string,
    message: string,
    type: 'PAYMENT' | 'ENROLLMENT' | 'DELETE' | 'SYSTEM',
    role: string = 'admin'
) => {
    try {
        // Find all admins in the branch
        const { data: profiles, error: profileError } = await dbClient.database
            .from('profiles')
            .select('id')
            .eq('branch_id', branchId)
            .eq('role', role);

        if (profileError || !profiles) {
            console.error('Failed to fetch profiles for broadcast:', profileError);
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

        if (notificationsToInsert.length > 0) {
            const { error: insertError } = await dbClient.database
                .from('notifications')
                .insert(notificationsToInsert);

            if (insertError) {
                console.error('Failed to broadcast notifications:', insertError);
            }
        }
    } catch (err) {
        console.error('Error broadcasting notification:', err);
    }
};
