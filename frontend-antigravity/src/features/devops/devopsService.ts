import api from '../../services/apiClient';

export interface SystemTelemetry {
    timestamp: string;
    overallStatus: 'healthy' | 'warning' | 'critical';
    vps: {
        platform: string;
        arch: string;
        release: string;
        uptimeSeconds: number;
        formattedUptime: string;
        cpu: {
            count: number;
            model: string;
            loadAvg: number[];
            loadPercent1m: number;
        };
        memory: {
            totalBytes: number;
            usedBytes: number;
            freeBytes: number;
            usedPercent: number;
            totalFormatted: string;
            usedFormatted: string;
            freeFormatted: string;
        };
        disk: {
            totalBytes: number;
            usedBytes: number;
            freeBytes: number;
            usedPercent: number;
            totalFormatted: string;
            usedFormatted: string;
            freeFormatted: string;
            uploadsFolderSize: string;
            uploadsCount: number;
        };
    };
    nodeRuntime: {
        version: string;
        uptimeSeconds: number;
        formattedUptime: string;
        heapUsedMB: number;
        heapTotalMB: number;
        rssMB: number;
        pid: number;
    };
    database: {
        status: 'healthy' | 'degraded' | 'error';
        latencyMs: number;
        activeConnections: number;
        maxConnections: number;
        databaseSize: string;
        uptimeInterval: string;
        counts: {
            students: number;
            payments: number;
            grades: number;
            audit_logs: number;
            active_users: number;
        };
    };
    services: {
        backend: { status: 'healthy' | 'warning' | 'error'; name: string; latencyMs: number };
        database: { status: 'healthy' | 'warning' | 'error'; name: string; latencyMs: number };
        smtp: { status: 'healthy' | 'warning' | 'error'; name: string; host: string; port: number; message: string };
    };
    alerts: Array<{
        level: 'info' | 'warning' | 'critical';
        title: string;
        message: string;
    }>;
}

export const getSystemTelemetry = async (): Promise<SystemTelemetry> => {
    const response = await api.get('/api/devops/telemetry');
    return response.data;
};
