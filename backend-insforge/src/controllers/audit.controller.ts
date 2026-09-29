import { Request, Response } from 'express';
import client, { adminClient } from '../config/insforge';

export const getAuditLogs = async (req: Request, res: Response) => {
    const userRole = req.currentUser?.role;
    const userBranchId = req.currentUser?.branch_id;
    const db = adminClient || client;

    // RBAC: Solo administradores y superadministradores pueden auditar
    if (userRole !== 'admin' && userRole !== 'superadmin') {
        return res.status(403).json({ message: 'Acceso no autorizado. Solo administradores pueden consultar el registro de auditoría.' });
    }

    try {
        let query = db
            .from('audit_logs')
            .select(`
                *,
                user:profiles!user_id(id, full_name, email, role),
                branch:branches!branch_id(id, name)
            `, { count: 'exact' });

        // Filtrado por sede según permisos
        if (userRole === 'admin') {
            if (userBranchId) {
                query = query.eq('branch_id', userBranchId);
            }
        } else if (userRole === 'superadmin') {
            if (req.query.branchId && req.query.branchId !== 'all') {
                query = query.eq('branch_id', req.query.branchId);
            }
        }

        const { search, action, entity, startDate, endDate, page, limit, export: isExportParam } = req.query;

        // Filtro por acción
        if (action && action !== 'ALL' && action !== 'all') {
            query = query.eq('action', action);
        }

        // Filtro por módulo / entidad
        if (entity && entity !== 'ALL' && entity !== 'all') {
            query = query.eq('entity', entity);
        }

        // Filtro por rango de fechas
        if (startDate) {
            query = query.gte('created_at', `${startDate}T00:00:00.000Z`);
        }
        if (endDate) {
            query = query.lte('created_at', `${endDate}T23:59:59.999Z`);
        }

        // Búsqueda de texto (IP, entidad, acción, ID de entidad)
        if (search && typeof search === 'string' && search.trim()) {
            const term = search.trim();
            query = query.or(`ip_address.ilike.%${term}%,entity.ilike.%${term}%,action.ilike.%${term}%,entity_id.ilike.%${term}%`);
        }

        query = query.order('created_at', { ascending: false });

        // Si se solicita exportación a Excel, retornar hasta 1,000 registros sin paginar
        if (isExportParam === 'true' || req.query.all === 'true') {
            query = query.limit(1000);
            const { data, error, count } = await query;
            if (error) throw error;

            return res.json({
                data: data || [],
                meta: {
                    total: count || (data?.length || 0),
                    page: 1,
                    limit: data?.length || 0,
                    totalPages: 1
                }
            });
        }

        // Paginación estándar
        const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
        const limitNum = Math.min(100, Math.max(5, parseInt(limit as string, 10) || 25));
        const offset = (pageNum - 1) * limitNum;

        query = query.range(offset, offset + limitNum - 1);

        const { data, error, count } = await query;
        if (error) throw error;

        res.json({
            data: data || [],
            meta: {
                total: count || 0,
                page: pageNum,
                limit: limitNum,
                totalPages: Math.ceil((count || 0) / limitNum)
            }
        });
    } catch (error: any) {
        console.error('CRITICAL ERROR in getAuditLogs:', error);
        res.status(500).json({
            message: 'Error retrieving audit logs',
            error: error?.message || 'Unknown error'
        });
    }
};

export const getAuditStats = async (req: Request, res: Response) => {
    const userRole = req.currentUser?.role;
    const userBranchId = req.currentUser?.branch_id;
    const db = adminClient || client;

    if (userRole !== 'admin' && userRole !== 'superadmin') {
        return res.status(403).json({ message: 'Acceso no autorizado.' });
    }

    try {
        let baseQuery = db.from('audit_logs').select('action, created_at');
        if (userRole === 'admin' && userBranchId) {
            baseQuery = baseQuery.eq('branch_id', userBranchId);
        } else if (userRole === 'superadmin' && req.query.branchId && req.query.branchId !== 'all') {
            baseQuery = baseQuery.eq('branch_id', req.query.branchId);
        }

        const { data, error } = await baseQuery;
        if (error) throw error;

        const total = data?.length || 0;
        let logins = 0;
        let creates = 0;
        let updates = 0;
        let deletes = 0;
        let todayCount = 0;

        const todayStr = new Date().toISOString().split('T')[0];

        data?.forEach((row: any) => {
            if (row.action === 'LOGIN') logins++;
            else if (row.action === 'POST') creates++;
            else if (row.action === 'PUT' || row.action === 'PATCH') updates++;
            else if (row.action === 'DELETE') deletes++;

            if (row.created_at && row.created_at.startsWith(todayStr)) {
                todayCount++;
            }
        });

        res.json({
            total,
            logins,
            creates,
            updates,
            deletes,
            today: todayCount
        });
    } catch (error: any) {
        console.error('Error fetching audit stats:', error);
        res.status(500).json({ message: 'Error retrieving audit stats', error: error?.message });
    }
};
