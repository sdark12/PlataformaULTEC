import { Request, Response } from 'express';
import client from '../config/insforge';

export const getAuditLogs = async (req: Request, res: Response) => {
    const branchId = req.currentUser?.branch_id;
    const db = req.dbUserClient || client;

    try {
        let query = db.database
            .from('audit_logs')
            .select(`
                *,
                user:profiles!user_id(id, full_name, email, role),
                branch:branches!branch_id(id, name)
            `)
            .order('created_at', { ascending: false })
            .limit(100);

        // If the user is attached to a branch, only fetch logs for that branch
        // For Superadmin (usually branch_id is null or handled globally), skip the eq check
        if (branchId) {
            query = query.eq('branch_id', branchId);
        }

        const { data, error } = await query;

        if (error) throw error;

        res.json(data);
    } catch (error: any) {
        console.error('CRITICAL ERROR in getAuditLogs:', error);
        res.status(500).json({
            message: 'Error retrieving audit logs',
            error: error?.message || 'Unknown error'
        });
    }
};
