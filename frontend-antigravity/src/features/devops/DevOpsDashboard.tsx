import React, { useEffect, useState, useCallback } from 'react';
import { 
    Database, Activity, RefreshCw, 
    AlertTriangle, AlertCircle, ShieldCheck, Clock, 
    Terminal, Layers, Mail, Users, Award, CreditCard, 
    ShieldAlert, CheckCircle
} from 'lucide-react';
import { getSystemTelemetry, type SystemTelemetry } from './devopsService';

export const DevOpsDashboard: React.FC = () => {
    const [telemetry, setTelemetry] = useState<SystemTelemetry | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
    const [secondsAgo, setSecondsAgo] = useState(0);

    const fetchTelemetry = useCallback(async (isManual = false) => {
        if (isManual) setRefreshing(true);
        try {
            const data = await getSystemTelemetry();
            setTelemetry(data);
            setLastUpdated(new Date());
            setSecondsAgo(0);
            setError(null);
        } catch (err: any) {
            console.error('Error fetching devops telemetry:', err);
            setError(err.response?.data?.message || 'Error al conectar con el servicio de telemetría.');
        } finally {
            setLoading(false);
            if (isManual) setRefreshing(false);
        }
    }, []);

    // Initial load
    useEffect(() => {
        fetchTelemetry();
    }, [fetchTelemetry]);

    // Auto refresh timer (every 30s)
    useEffect(() => {
        if (!autoRefresh) return;
        const interval = setInterval(() => {
            fetchTelemetry();
        }, 30000);
        return () => clearInterval(interval);
    }, [autoRefresh, fetchTelemetry]);

    // Seconds counter
    useEffect(() => {
        const timer = setInterval(() => {
            setSecondsAgo(Math.floor((Date.now() - lastUpdated.getTime()) / 1000));
        }, 1000);
        return () => clearInterval(timer);
    }, [lastUpdated]);

    if (loading) {
        return (
            <div className="flex flex-col justify-center items-center h-full min-h-[420px] gap-3">
                <RefreshCw className="w-10 h-10 text-brand-blue animate-spin" />
                <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                    Recopilando telemetría del servidor en tiempo real...
                </p>
            </div>
        );
    }

    if (error || !telemetry) {
        return (
            <div className="p-6 text-center max-w-xl mx-auto">
                <div className="p-6 rounded-3xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/40 text-rose-600 dark:text-rose-400 space-y-3 shadow-md">
                    <AlertCircle className="w-10 h-10 mx-auto" />
                    <h3 className="font-bold text-base">Error al Cargar Telemetría</h3>
                    <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                        {error || 'No se pudieron consultar las métricas de infraestructura.'}
                    </p>
                    <button
                        onClick={() => fetchTelemetry(true)}
                        className="px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold shadow-md hover:bg-rose-700 transition-all inline-flex items-center gap-2"
                    >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Reintentar Conexión</span>
                    </button>
                </div>
            </div>
        );
    }

    const { vps, nodeRuntime, database, services, alerts, overallStatus } = telemetry;

    const getStatusBgLight = (val: number, warn = 75, crit = 90) => {
        if (val >= crit) return 'bg-rose-500/15 border-rose-500/30 text-rose-700 dark:text-rose-300';
        if (val >= warn) return 'bg-amber-500/15 border-amber-500/30 text-amber-700 dark:text-amber-300';
        return 'bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-300';
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* Top Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200/80 dark:border-slate-800 shadow-sm">
                <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-600 to-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/20">
                        <Activity className="w-6 h-6 animate-pulse" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2.5">
                            <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                                Monitor de Infraestructura y Servidor
                            </h2>
                            <span className="flex h-2.5 w-2.5 relative">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                            </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            Oracle Cloud VPS • {vps.platform} • Actualizado hace {secondsAgo}s
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3 self-end sm:self-auto">
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={autoRefresh}
                            onChange={(e) => setAutoRefresh(e.target.checked)}
                            className="w-4 h-4 text-brand-blue rounded border-slate-300 dark:border-slate-600 focus:ring-brand-blue"
                        />
                        <span>Auto (30s)</span>
                    </label>

                    <button
                        onClick={() => fetchTelemetry(true)}
                        disabled={refreshing}
                        className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50 border border-slate-200 dark:border-slate-700"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-brand-blue' : ''}`} />
                        <span>{refreshing ? 'Actualizando...' : 'Refrescar'}</span>
                    </button>
                </div>
            </div>

            {/* Overall Health Status Banner */}
            <div className={`p-5 rounded-3xl border flex items-start gap-4 ${
                overallStatus === 'healthy'
                    ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-950 dark:text-emerald-100'
                    : overallStatus === 'warning'
                    ? 'bg-amber-500/10 border-amber-500/25 text-amber-950 dark:text-amber-100'
                    : 'bg-rose-500/10 border-rose-500/25 text-rose-950 dark:text-rose-100'
            }`}>
                {overallStatus === 'healthy' ? (
                    <ShieldCheck className="w-8 h-8 text-emerald-500 shrink-0 mt-0.5" />
                ) : overallStatus === 'warning' ? (
                    <AlertTriangle className="w-8 h-8 text-amber-500 shrink-0 mt-0.5 animate-bounce" />
                ) : (
                    <ShieldAlert className="w-8 h-8 text-rose-500 shrink-0 mt-0.5 animate-pulse" />
                )}
                <div className="flex-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                        <h3 className="font-black text-sm sm:text-base">
                            {overallStatus === 'healthy'
                                ? 'Todos los Sistemas Operando con Rendimiento Óptimo'
                                : overallStatus === 'warning'
                                ? 'Atención Requerida: Consumo de Recursos Moderadamente Alto'
                                : 'Alerta de Infraestructura: Recursos al Límite'}
                        </h3>
                        <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider bg-black/10 dark:bg-white/10">
                            Estado: {overallStatus}
                        </span>
                    </div>
                    <div className="mt-2 space-y-1">
                        {alerts.map((alert, idx) => (
                            <p key={idx} className="text-xs leading-relaxed opacity-90 flex items-center gap-1.5">
                                <span className="font-semibold">• {alert.title}:</span> {alert.message}
                            </p>
                        ))}
                    </div>
                </div>
            </div>

            {/* Core Metrics Gauges (4 Cards) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {/* 1. RAM Usage */}
                <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                Memoria RAM VPS
                            </span>
                            <span className={`px-2 py-0.5 rounded-md text-[11px] font-black ${getStatusBgLight(vps.memory.usedPercent)}`}>
                                {vps.memory.usedPercent}%
                            </span>
                        </div>
                        <div className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                            {vps.memory.usedFormatted}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            de {vps.memory.totalFormatted} total ({vps.memory.freeFormatted} libre)
                        </div>
                    </div>

                    <div className="mt-4">
                        <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden">
                            <div 
                                className={`h-full rounded-full transition-all duration-500 ${
                                    vps.memory.usedPercent >= 90 ? 'bg-rose-500' : vps.memory.usedPercent >= 75 ? 'bg-amber-500' : 'bg-emerald-500'
                                }`}
                                style={{ width: `${vps.memory.usedPercent}%` }}
                            />
                        </div>
                    </div>
                </div>

                {/* 2. Disk Storage */}
                <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                Disco Principal (/)
                            </span>
                            <span className={`px-2 py-0.5 rounded-md text-[11px] font-black ${getStatusBgLight(vps.disk.usedPercent, 80, 90)}`}>
                                {vps.disk.usedPercent}%
                            </span>
                        </div>
                        <div className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                            {vps.disk.usedFormatted}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            de {vps.disk.totalFormatted} ({vps.disk.freeFormatted} libres)
                        </div>
                    </div>

                    <div className="mt-4">
                        <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden">
                            <div 
                                className={`h-full rounded-full transition-all duration-500 ${
                                    vps.disk.usedPercent >= 90 ? 'bg-rose-500' : vps.disk.usedPercent >= 80 ? 'bg-amber-500' : 'bg-blue-500'
                                }`}
                                style={{ width: `${vps.disk.usedPercent}%` }}
                            />
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1.5 flex justify-between">
                            <span>Adjuntos (/uploads):</span>
                            <span className="font-bold text-slate-600 dark:text-slate-300">{vps.disk.uploadsFolderSize} ({vps.disk.uploadsCount} arch.)</span>
                        </div>
                    </div>
                </div>

                {/* 3. CPU Load */}
                <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                Procesador (CPU)
                            </span>
                            <span className="px-2 py-0.5 rounded-md text-[11px] font-black bg-blue-500/10 text-brand-blue border border-brand-blue/20">
                                {vps.cpu.count} Núcleos
                            </span>
                        </div>
                        <div className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                            {vps.cpu.loadPercent1m}%
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate" title={vps.cpu.model}>
                            Carga 1 min: {vps.cpu.loadAvg[0]} • 5m: {vps.cpu.loadAvg[1]}
                        </div>
                    </div>

                    <div className="mt-4">
                        <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden">
                            <div 
                                className={`h-full rounded-full transition-all duration-500 ${
                                    vps.cpu.loadPercent1m >= 90 ? 'bg-rose-500' : vps.cpu.loadPercent1m >= 75 ? 'bg-amber-500' : 'bg-indigo-500'
                                }`}
                                style={{ width: `${Math.min(100, vps.cpu.loadPercent1m)}%` }}
                            />
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1.5">
                            VPS Uptime: <span className="font-semibold text-slate-600 dark:text-slate-300">{vps.formattedUptime}</span>
                        </div>
                    </div>
                </div>

                {/* 4. Database Engine */}
                <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                PostgreSQL DB
                            </span>
                            <span className="px-2 py-0.5 rounded-md text-[11px] font-black bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center gap-1">
                                <CheckCircle className="w-3 h-3" />
                                <span>{database.latencyMs} ms</span>
                            </span>
                        </div>
                        <div className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                            {database.databaseSize}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            {database.activeConnections} de {database.maxConnections} conexiones activas
                        </div>
                    </div>

                    <div className="mt-4">
                        <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden">
                            <div 
                                className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                                style={{ width: `${Math.min(100, (database.activeConnections / database.maxConnections) * 100)}%` }}
                            />
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1.5 truncate">
                            Uptime DB: <span className="font-semibold text-slate-600 dark:text-slate-300">{database.uptimeInterval.split('.')[0]}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Services & Containers Health (3 Cards) */}
            <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-brand-blue" />
                    <span>Estado de Microservicios y Contenedores Docker</span>
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    {/* Backend */}
                    <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <Terminal className="w-4 h-4 text-brand-blue" />
                                <span className="font-bold text-sm text-slate-900 dark:text-white">API Backend (Express)</span>
                            </div>
                            <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800/40">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                Activo
                            </span>
                        </div>
                        <div className="text-xs space-y-1.5 text-slate-600 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800">
                            <div className="flex justify-between">
                                <span>Versión Runtime:</span>
                                <span className="font-mono font-bold text-slate-900 dark:text-white">Node {nodeRuntime.version}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Memoria Heap:</span>
                                <span className="font-bold text-slate-900 dark:text-white">{nodeRuntime.heapUsedMB} MB / {nodeRuntime.heapTotalMB} MB</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Tiempo en Línea:</span>
                                <span className="font-bold text-slate-900 dark:text-white">{nodeRuntime.formattedUptime}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>PID del Proceso:</span>
                                <span className="font-mono text-slate-500">{nodeRuntime.pid}</span>
                            </div>
                        </div>
                    </div>

                    {/* Supabase DB */}
                    <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <Database className="w-4 h-4 text-emerald-500" />
                                <span className="font-bold text-sm text-slate-900 dark:text-white">Motor PostgreSQL</span>
                            </div>
                            <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800/40">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                Conectado
                            </span>
                        </div>
                        <div className="text-xs space-y-1.5 text-slate-600 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800">
                            <div className="flex justify-between">
                                <span>Contenedor Docker:</span>
                                <span className="font-mono font-bold text-slate-900 dark:text-white">supabase-db</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Latencia de Consulta:</span>
                                <span className="font-bold text-emerald-600 dark:text-emerald-400">{database.latencyMs} ms</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Conexiones Activas:</span>
                                <span className="font-bold text-slate-900 dark:text-white">{database.activeConnections} / {database.maxConnections}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Almacenamiento Físico:</span>
                                <span className="font-bold text-slate-900 dark:text-white">{database.databaseSize}</span>
                            </div>
                        </div>
                    </div>

                    {/* SMTP */}
                    <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <Mail className="w-4 h-4 text-purple-500" />
                                <span className="font-bold text-sm text-slate-900 dark:text-white">Servicio SMTP</span>
                            </div>
                            <span className={`flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                                services.smtp.status === 'healthy'
                                    ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/40'
                                    : 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/40'
                            }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${services.smtp.status === 'healthy' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                                {services.smtp.status === 'healthy' ? 'Listo' : 'Aviso'}
                            </span>
                        </div>
                        <div className="text-xs space-y-1.5 text-slate-600 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800">
                            <div className="flex justify-between truncate">
                                <span>Host SMTP:</span>
                                <span className="font-mono text-[11px] font-bold text-slate-900 dark:text-white truncate max-w-[150px]" title={services.smtp.host}>
                                    {services.smtp.host}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span>Puerto:</span>
                                <span className="font-mono font-bold text-slate-900 dark:text-white">{services.smtp.port}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Notificaciones:</span>
                                <span className="font-bold text-slate-900 dark:text-white">Operativas</span>
                            </div>
                            <div className="text-[11px] text-slate-500 truncate mt-0.5">
                                {services.smtp.message}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Live Data Inventory (5 Count Cards) */}
            <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                    <Database className="w-4 h-4 text-emerald-500" />
                    <span>Inventario de Datos Vivos en Producción</span>
                </h3>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 sm:gap-4">
                    <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-brand-blue flex items-center justify-center shrink-0">
                            <Users className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="text-lg font-black text-slate-900 dark:text-white">
                                {database.counts.students}
                            </div>
                            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                                Alumnos Activos
                            </div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
                            <CreditCard className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="text-lg font-black text-slate-900 dark:text-white">
                                {database.counts.payments}
                            </div>
                            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                                Pagos Registrados
                            </div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                            <Award className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="text-lg font-black text-slate-900 dark:text-white">
                                {database.counts.grades}
                            </div>
                            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                                Calificaciones
                            </div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0">
                            <Clock className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="text-lg font-black text-slate-900 dark:text-white">
                                {database.counts.audit_logs}
                            </div>
                            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                                Eventos Auditados
                            </div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center gap-3 col-span-2 sm:col-span-1">
                        <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center shrink-0">
                            <ShieldCheck className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="text-lg font-black text-slate-900 dark:text-white">
                                {database.counts.active_users}
                            </div>
                            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                                Cuentas de Acceso
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DevOpsDashboard;
