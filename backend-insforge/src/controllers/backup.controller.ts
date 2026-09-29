import { Request, Response } from 'express';
import { 
    createBackup, 
    listBackups, 
    getBackupStats, 
    getBackupFilePath, 
    deleteBackup 
} from '../services/backup.service';

/**
 * Lists all database backups. Restricted to SuperAdmin.
 */
export const getBackups = async (req: Request, res: Response) => {
    if (req.currentUser?.role !== 'superadmin') {
        return res.status(403).json({
            message: 'Acceso denegado: Solo el Superadministrador puede acceder a la gestión de respaldos.',
            code: 'FORBIDDEN_SUPERADMIN_ONLY'
        });
    }

    try {
        const backups = listBackups();
        res.json(backups);
    } catch (err: any) {
        console.error('Error in getBackups controller:', err);
        res.status(500).json({
            message: 'Error al listar las copias de seguridad.',
            error: err.message
        });
    }
};

/**
 * Returns summary backup statistics. Restricted to SuperAdmin.
 */
export const getStats = async (req: Request, res: Response) => {
    if (req.currentUser?.role !== 'superadmin') {
        return res.status(403).json({
            message: 'Acceso denegado: Solo el Superadministrador puede consultar estadísticas de respaldo.',
            code: 'FORBIDDEN_SUPERADMIN_ONLY'
        });
    }

    try {
        const stats = getBackupStats();
        res.json(stats);
    } catch (err: any) {
        console.error('Error in getStats controller:', err);
        res.status(500).json({
            message: 'Error al obtener estadísticas de respaldo.',
            error: err.message
        });
    }
};

/**
 * Creates a new manual database backup. Restricted to SuperAdmin.
 */
export const triggerBackup = async (req: Request, res: Response) => {
    if (req.currentUser?.role !== 'superadmin') {
        return res.status(403).json({
            message: 'Acceso denegado: Solo el Superadministrador puede crear copias de seguridad.',
            code: 'FORBIDDEN_SUPERADMIN_ONLY'
        });
    }

    try {
        const triggeredBy = req.currentUser.email || 'superadmin';
        const backup = await createBackup(triggeredBy, 'manual');
        res.status(201).json({
            message: 'Copia de seguridad generada con éxito.',
            backup
        });
    } catch (err: any) {
        console.error('Error triggering backup:', err);
        res.status(500).json({
            message: 'Error al generar la copia de seguridad.',
            error: err.message
        });
    }
};

/**
 * Downloads a specific backup .sql.gz file. Restricted to SuperAdmin.
 */
export const downloadBackup = async (req: Request, res: Response) => {
    if (req.currentUser?.role !== 'superadmin') {
        return res.status(403).json({
            message: 'Acceso denegado: Solo el Superadministrador puede descargar respaldos.',
            code: 'FORBIDDEN_SUPERADMIN_ONLY'
        });
    }

    const filename = String(req.params.filename || '');
    if (!filename) {
        return res.status(400).json({ message: 'Nombre de archivo requerido.' });
    }

    try {
        const filePath = getBackupFilePath(filename);

        res.setHeader('Content-Type', 'application/gzip');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.download(filePath, filename, (err) => {
            if (err) {
                console.error('Error during backup download streaming:', err);
            }
        });
    } catch (err: any) {
        console.error('Error in downloadBackup controller:', err);
        res.status(404).json({
            message: err.message || 'Archivo de respaldo no encontrado.'
        });
    }
};

/**
 * Deletes a backup from disk. Restricted to SuperAdmin.
 */
export const removeBackup = async (req: Request, res: Response) => {
    if (req.currentUser?.role !== 'superadmin') {
        return res.status(403).json({
            message: 'Acceso denegado: Solo el Superadministrador puede eliminar respaldos.',
            code: 'FORBIDDEN_SUPERADMIN_ONLY'
        });
    }

    const filename = String(req.params.filename || '');
    if (!filename) {
        return res.status(400).json({ message: 'Nombre de archivo requerido.' });
    }

    try {
        deleteBackup(filename);
        res.json({
            message: `Copia de seguridad ${filename} eliminada correctamente.`
        });
    } catch (err: any) {
        console.error('Error in removeBackup controller:', err);
        res.status(400).json({
            message: err.message || 'Error al eliminar el respaldo.'
        });
    }
};
