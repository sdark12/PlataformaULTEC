import { Request, Response } from 'express';
import client from '../config/insforge';

export const getNotifications = async (req: Request, res: Response) => {
    const db = req.dbUserClient ? req.dbUserClient.database : client.database;
    const userId = req.currentUser?.id;

    if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
        const { data, error } = await db
            .from('notifications')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(20);

        if (error) throw error;
        res.json(data);
    } catch (error: any) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ message: 'Error retrieving notifications', error: error.message });
    }
};

export const markAsRead = async (req: Request, res: Response) => {
    const db = req.dbUserClient ? req.dbUserClient.database : client.database;
    const { id } = req.params;
    const userId = req.currentUser?.id;

    try {
        const { data, error } = await db
            .from('notifications')
            .update({ is_read: true })
            .eq('id', id)
            .eq('user_id', userId)
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (error: any) {
        console.error('Error marking notification as read:', error);
        res.status(500).json({ message: 'Error updating notification', error: error.message });
    }
};

export const markAllAsRead = async (req: Request, res: Response) => {
    const db = req.dbUserClient ? req.dbUserClient.database : client.database;
    const userId = req.currentUser?.id;

    try {
        const { error } = await db
            .from('notifications')
            .update({ is_read: true })
            .eq('user_id', userId)
            .eq('is_read', false);

        if (error) throw error;
        res.json({ message: 'All notifications marked as read' });
    } catch (error: any) {
        console.error('Error marking all notifications as read:', error);
        res.status(500).json({ message: 'Error updating notifications', error: error.message });
    }
};
