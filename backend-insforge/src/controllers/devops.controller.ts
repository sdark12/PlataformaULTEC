import { Request, Response } from 'express';
import { getSystemTelemetry } from '../services/devops.service';

/**
 * GET /api/devops/telemetry
 * Returns real-time system metrics: VPS host CPU, RAM, Disk, PostgreSQL stats, Node runtime.
 * Strictly restricted to Superadministrators.
 */
export const getTelemetry = async (req: Request, res: Response) => {
    const role = req.currentUser?.role;
    if (role !== 'superadmin') {
        return res.status(403).json({
            message: 'Acceso denegado: El panel de telemetría y salud de infraestructura está reservado exclusivamente para Superadministradores.'
        });
    }

    try {
        const telemetry = await getSystemTelemetry();
        res.json(telemetry);
    } catch (err: any) {
        console.error('Error gathering system telemetry:', err);
        res.status(500).json({
            message: 'Error al compilar la telemetría del sistema',
            error: err?.message || 'Unknown error'
        });
    }
};
