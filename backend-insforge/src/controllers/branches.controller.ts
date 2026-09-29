import { Request, Response } from 'express';
import client, { adminClient } from '../config/insforge';

export const getBranches = async (req: Request, res: Response) => {
    const db = (req as any).dbUserClient || adminClient || client;

    try {
        const { data, error } = await db
            .from('branches')
            .select(`
                *,
                students(count),
                courses(count)
            `)
            .order('name');

        if (error) throw error;

        const formatted = (data || []).map((b: any) => ({
            id: b.id,
            name: b.name,
            address: b.address || '',
            phone: b.phone || '',
            email: b.email || '',
            created_at: b.created_at,
            students_count: b.students?.[0]?.count || 0,
            courses_count: b.courses?.[0]?.count || 0
        }));

        res.json(formatted);
    } catch (error: any) {
        console.error('CRITICAL ERROR in getBranches:', error);
        res.status(500).json({
            message: 'Error retrieving branches',
            error: error?.message || 'Unknown error'
        });
    }
};

export const createBranch = async (req: Request, res: Response) => {
    if (req.currentUser?.role !== 'superadmin') {
        return res.status(403).json({
            message: 'Acceso restringido: Solo el Superadministrador puede crear nuevas sedes institucionales.',
            code: 'FORBIDDEN_SUPERADMIN_ONLY'
        });
    }

    const { name, address, phone, email } = req.body;
    const db = (req as any).dbUserClient || adminClient || client;

    if (!name || name.trim() === '') {
        return res.status(400).json({ message: 'El nombre de la sede es obligatorio.' });
    }

    try {
        const { data, error } = await db
            .from('branches')
            .insert([{ name: name.trim(), address: address?.trim() || null, phone: phone?.trim() || null, email: email?.trim() || null }])
            .select()
            .single();

        if (error) throw error;

        res.status(201).json(data);
    } catch (error: any) {
        console.error("Error creating branch:", error);
        res.status(500).json({ message: 'Error creating branch', error: error.message });
    }
};

export const updateBranch = async (req: Request, res: Response) => {
    if (req.currentUser?.role !== 'superadmin') {
        return res.status(403).json({
            message: 'Acceso restringido: Solo el Superadministrador puede modificar la información de las sedes.',
            code: 'FORBIDDEN_SUPERADMIN_ONLY'
        });
    }

    const { id } = req.params;
    const { name, address, phone, email } = req.body;
    const db = (req as any).dbUserClient || adminClient || client;

    try {
        const { data, error } = await db
            .from('branches')
            .update({ 
                name: name ? name.trim() : undefined, 
                address: address !== undefined ? (address?.trim() || null) : undefined, 
                phone: phone !== undefined ? (phone?.trim() || null) : undefined, 
                email: email !== undefined ? (email?.trim() || null) : undefined 
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        res.json(data);
    } catch (error: any) {
        console.error("Error updating branch:", error);
        res.status(500).json({ message: 'Error updating branch', error: error.message });
    }
};

export const deleteBranch = async (req: Request, res: Response) => {
    if (req.currentUser?.role !== 'superadmin') {
        return res.status(403).json({
            message: 'Acceso restringido: Solo el Superadministrador puede eliminar sedes.',
            code: 'FORBIDDEN_SUPERADMIN_ONLY'
        });
    }

    const { id } = req.params;
    const db = (req as any).dbUserClient || adminClient || client;

    try {
        // Verificar si la sede tiene estudiantes antes de eliminar
        const { count: studentCount } = await db
            .from('students')
            .select('*', { count: 'exact', head: true })
            .eq('branch_id', id);

        if (studentCount && studentCount > 0) {
            return res.status(400).json({
                message: `No se puede eliminar la sede: tiene ${studentCount} estudiante(s) activo(s) matriculado(s). Reasigne los estudiantes antes de eliminarla.`,
                code: 'BRANCH_HAS_ACTIVE_STUDENTS'
            });
        }

        const { error } = await db
            .from('branches')
            .delete()
            .eq('id', id);

        if (error) throw error;

        res.json({ message: 'Sede eliminada exitosamente' });
    } catch (error: any) {
        console.error("Error deleting branch:", error);
        res.status(500).json({ message: 'Error deleting branch', error: error.message });
    }
};
