import os from 'os';
import fs from 'fs';
import path from 'path';
import { adminClient } from '../config/insforge';
import { verifySmtpConnection } from './email.service';

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
            loadAvg: number[]; // 1m, 5m, 15m
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

const formatSeconds = (seconds: number): string => {
    const days = Math.floor(seconds / (24 * 3600));
    seconds %= 24 * 3600;
    const hours = Math.floor(seconds / 3600);
    seconds %= 3600;
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);

    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    parts.push(`${secs}s`);
    return parts.join(' ');
};

const sampleCpuUsage = async (sampleMs = 120): Promise<number> => {
    const getTicks = () => {
        const cpus = os.cpus() || [];
        let idle = 0;
        let total = 0;
        for (const cpu of cpus) {
            for (const type in cpu.times) {
                total += cpu.times[type as keyof typeof cpu.times];
            }
            idle += cpu.times.idle;
        }
        return { idle, total };
    };

    const first = getTicks();
    await new Promise((resolve) => setTimeout(resolve, sampleMs));
    const second = getTicks();

    const idleDiff = second.idle - first.idle;
    const totalDiff = second.total - first.total;

    if (totalDiff <= 0) return 0;
    const usage = Math.round(((totalDiff - idleDiff) / totalDiff) * 100);
    return Math.min(100, Math.max(0, usage));
};

export const getSystemTelemetry = async (): Promise<SystemTelemetry> => {
    const startTime = Date.now();

    // ─── 1. VPS Memory & CPU ───
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memPercent = totalMem > 0 ? Number(((usedMem / totalMem) * 100).toFixed(1)) : 0;

    const cpus = os.cpus() || [];
    const cpuCount = cpus.length;
    const cpuModel = cpus[0]?.model || 'ARM / x86_64 Processor';
    const loadAvg = os.loadavg();
    // Real instant CPU active percentage sampled over 120ms
    const loadPercent1m = await sampleCpuUsage(120);

    // ─── 2. Disk Storage via fs.statfsSync ───
    let diskTotal = 0;
    let diskFree = 0;
    let diskUsed = 0;
    let diskPercent = 0;

    try {
        if (typeof (fs as any).statfsSync === 'function') {
            const stats = (fs as any).statfsSync('/');
            diskTotal = stats.bsize * stats.blocks;
            diskFree = stats.bsize * stats.bfree;
            diskUsed = diskTotal - diskFree;
            diskPercent = diskTotal > 0 ? Number(((diskUsed / diskTotal) * 100).toFixed(1)) : 0;
        }
    } catch (e) {
        console.error('Error fetching disk stats:', e);
    }

    // ─── 3. Uploads directory stats ───
    let uploadsSizeFormatted = '0 MB';
    let uploadsCount = 0;
    try {
        const uploadsDir = path.join(__dirname, '../../uploads');
        if (fs.existsSync(uploadsDir)) {
            const files = fs.readdirSync(uploadsDir);
            uploadsCount = files.length;
            let totalBytes = 0;
            for (const file of files) {
                try {
                    const st = fs.statSync(path.join(uploadsDir, file));
                    totalBytes += st.size;
                } catch (_) {}
            }
            uploadsSizeFormatted = `${(totalBytes / (1024 * 1024)).toFixed(2)} MB`;
        }
    } catch (e) {
        console.error('Error inspecting uploads dir:', e);
    }

    // ─── 4. Database Telemetry (PostgreSQL RPC or Fallback) ───
    let dbStatus: 'healthy' | 'degraded' | 'error' = 'healthy';
    let dbLatency = 0;
    let dbStats: any = {
        active_connections: 0,
        max_connections: 100,
        database_size: 'N/A',
        uptime_interval: 'N/A',
        counts: { students: 0, payments: 0, grades: 0, audit_logs: 0, active_users: 0 }
    };

    const dbStart = Date.now();
    try {
        const { data, error } = await adminClient.rpc('get_server_db_stats');
        dbLatency = Date.now() - dbStart;

        if (error || !data) {
            console.warn('RPC get_server_db_stats failed, falling back to count queries:', error?.message);
            dbStatus = 'degraded';
            // Simple fallback
            const { count: stCount } = await adminClient.from('students').select('*', { count: 'exact', head: true });
            const { count: payCount } = await adminClient.from('payments').select('*', { count: 'exact', head: true });
            const { count: grCount } = await adminClient.from('grades').select('*', { count: 'exact', head: true });
            const { count: logCount } = await adminClient.from('audit_logs').select('*', { count: 'exact', head: true });
            const { count: userCount } = await adminClient.from('profiles').select('*', { count: 'exact', head: true }).eq('active', true);

            dbStats.counts = {
                students: stCount || 0,
                payments: payCount || 0,
                grades: grCount || 0,
                audit_logs: logCount || 0,
                active_users: userCount || 0
            };
        } else {
            dbStats = data;
        }
    } catch (dbErr: any) {
        dbLatency = Date.now() - dbStart;
        dbStatus = 'error';
        console.error('Database connection error in telemetry:', dbErr);
    }

    // ─── 5. Node.js Runtime ───
    const memUsage = process.memoryUsage();
    const nodeUptime = Math.floor(process.uptime());

    // ─── 6. SMTP Status ───
    let smtpResult: { ok: boolean; message: string; host?: string; port?: number } = {
        ok: true,
        message: 'SMTP activo',
        host: 'smtp.ethereal.email',
        port: 587
    };
    try {
        smtpResult = await verifySmtpConnection();
    } catch (e: any) {
        smtpResult = { ok: false, message: e.message || 'Error SMTP', host: 'Desconocido', port: 587 };
    }

    // ─── 7. Evaluate Health & Threshold Alerts ───
    const alerts: Array<{ level: 'info' | 'warning' | 'critical'; title: string; message: string }> = [];
    let overallStatus: 'healthy' | 'warning' | 'critical' = 'healthy';

    if (memPercent >= 90) {
        overallStatus = 'critical';
        alerts.push({
            level: 'critical',
            title: 'Memoria RAM al límite',
            message: `El uso de memoria RAM está en ${memPercent}%. Se recomienda monitorear procesos en el VPS.`
        });
    } else if (memPercent >= 75) {
        overallStatus = 'warning';
        alerts.push({
            level: 'warning',
            title: 'Memoria RAM moderadamente alta',
            message: `Consumo de memoria en ${memPercent}%.`
        });
    }

    if (diskPercent >= 90) {
        overallStatus = 'critical';
        alerts.push({
            level: 'critical',
            title: 'Disco Casi Lleno',
            message: `Espacio en disco ocupado al ${diskPercent}%. Peligro inminente de falta de espacio.`
        });
    } else if (diskPercent >= 80) {
        if (overallStatus === 'healthy') overallStatus = 'warning';
        alerts.push({
            level: 'warning',
            title: 'Almacenamiento elevado',
            message: `El disco principal tiene un ${diskPercent}% de ocupación.`
        });
    }

    if (loadPercent1m >= 85 || loadAvg[0] >= 3.0) {
        if (overallStatus === 'healthy') overallStatus = 'warning';
        alerts.push({
            level: 'warning',
            title: 'Carga de CPU elevada',
            message: `Uso de procesador al ${loadPercent1m}% (Carga 1 min: ${loadAvg[0]}).`
        });
    }


    if (dbStatus !== 'healthy') {
        overallStatus = 'critical';
        alerts.push({
            level: 'critical',
            title: 'Problema en Base de Datos PostgreSQL',
            message: 'La base de datos presenta alta latencia o errores de consulta.'
        });
    }

    if (alerts.length === 0) {
        alerts.push({
            level: 'info',
            title: 'Sistema en óptimas condiciones',
            message: 'Todos los recursos de procesamiento, memoria, disco y base de datos operan con holgura.'
        });
    }

    return {
        timestamp: new Date().toISOString(),
        overallStatus,
        vps: {
            platform: `${os.type()} ${os.release()} (${os.arch()})`,
            arch: os.arch(),
            release: os.release(),
            uptimeSeconds: Math.floor(os.uptime()),
            formattedUptime: formatSeconds(os.uptime()),
            cpu: {
                count: cpuCount,
                model: cpuModel,
                loadAvg: [Number(loadAvg[0].toFixed(2)), Number(loadAvg[1].toFixed(2)), Number(loadAvg[2].toFixed(2))],
                loadPercent1m
            },
            memory: {
                totalBytes: totalMem,
                usedBytes: usedMem,
                freeBytes: freeMem,
                usedPercent: memPercent,
                totalFormatted: `${(totalMem / (1024 ** 3)).toFixed(2)} GB`,
                usedFormatted: `${(usedMem / (1024 ** 3)).toFixed(2)} GB`,
                freeFormatted: `${(freeMem / (1024 ** 3)).toFixed(2)} GB`
            },
            disk: {
                totalBytes: diskTotal,
                usedBytes: diskUsed,
                freeBytes: diskFree,
                usedPercent: diskPercent,
                totalFormatted: `${(diskTotal / (1024 ** 3)).toFixed(2)} GB`,
                usedFormatted: `${(diskUsed / (1024 ** 3)).toFixed(2)} GB`,
                freeFormatted: `${(diskFree / (1024 ** 3)).toFixed(2)} GB`,
                uploadsFolderSize: uploadsSizeFormatted,
                uploadsCount
            }
        },
        nodeRuntime: {
            version: process.version,
            uptimeSeconds: nodeUptime,
            formattedUptime: formatSeconds(nodeUptime),
            heapUsedMB: Number((memUsage.heapUsed / (1024 * 1024)).toFixed(2)),
            heapTotalMB: Number((memUsage.heapTotal / (1024 * 1024)).toFixed(2)),
            rssMB: Number((memUsage.rss / (1024 * 1024)).toFixed(2)),
            pid: process.pid
        },
        database: {
            status: dbStatus,
            latencyMs: dbLatency,
            activeConnections: dbStats.active_connections || 0,
            maxConnections: dbStats.max_connections || 100,
            databaseSize: dbStats.database_size || 'N/A',
            uptimeInterval: dbStats.uptime_interval || 'N/A',
            counts: dbStats.counts || { students: 0, payments: 0, grades: 0, audit_logs: 0, active_users: 0 }
        },
        services: {
            backend: {
                status: 'healthy',
                name: 'API Express (ultec-backend)',
                latencyMs: Date.now() - startTime
            },
            database: {
                status: dbStatus === 'healthy' ? 'healthy' : 'error',
                name: 'PostgreSQL Engine (supabase-db)',
                latencyMs: dbLatency
            },
            smtp: {
                status: smtpResult.ok ? 'healthy' : 'warning',
                name: 'Servicio de Correo SMTP',
                host: smtpResult.host || 'N/A',
                port: smtpResult.port || 587,
                message: smtpResult.message
            }
        },
        alerts
    };
};
