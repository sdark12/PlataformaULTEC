import { Request } from 'express';

/**
 * Obtiene el ID de la sede efectiva a consultar u operar:
 * 
 * 1. Si el usuario es SuperAdmin:
 *    - Puede ver "all" (Consolidado Global) -> devuelve null.
 *    - O puede filtrar por una sede específica enviando el header 'X-Branch-Id' o query param 'branch_id'.
 * 
 * 2. Si el usuario NO es SuperAdmin (Admin de Sede, Secretaria, Docente, etc.):
 *    - Queda estrictamente restringido a su sede asignada (req.currentUser.branch_id).
 *    - No puede saltarse la restricción aunque envíe headers manuales.
 */
export const getEffectiveBranchId = (req: Request): string | null => {
    const user = req.currentUser;
    if (!user) return null;

    if (user.role === 'superadmin') {
        const headerBranch = (req.headers['x-branch-id'] as string) || (req.query.branch_id as string);
        if (headerBranch && headerBranch !== 'all' && headerBranch !== 'undefined' && headerBranch.trim() !== '') {
            return headerBranch.trim();
        }
        return null; // Consolidado de todas las sedes
    }

    // Para cualquier otro rol, devolvemos forzosamente su sede asignada
    return user.branch_id || null;
};

/**
 * Valida si el usuario actual tiene permiso para acceder o modificar datos de una sede específica.
 */
export const isBranchAccessible = (req: Request, targetBranchId?: string | null): boolean => {
    const user = req.currentUser;
    if (!user) return false;
    if (user.role === 'superadmin') return true;
    if (!targetBranchId) return true; // Si no hay sede específica requerida
    return user.branch_id === targetBranchId;
};
