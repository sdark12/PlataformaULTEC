import React, { useState, useEffect, useCallback } from 'react';
import { 
    Database, Download, Trash2, Plus, RefreshCw, 
    ShieldCheck, HardDrive, Clock, Calendar, FileArchive, 
    Check, Copy, AlertCircle, Loader2, Terminal
} from 'lucide-react';
import ConfirmModal from '../../components/ui/ConfirmModal';
import { 
    getBackups, 
    getBackupStats, 
    createDatabaseBackup, 
    deleteDatabaseBackup, 
    downloadDatabaseBackup,
    type BackupItem, 
    type BackupStats 
} from './backupService';

export const DatabaseBackupManager: React.FC = () => {
    const [backups, setBackups] = useState<BackupItem[]>([]);
    const [stats, setStats] = useState<BackupStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [downloading, setDownloading] = useState<string | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<BackupItem | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [copiedCommand, setCopiedCommand] = useState(false);
    const [copiedHash, setCopiedHash] = useState<string | null>(null);
    const [notification, setNotification] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const loadData = useCallback(async (isSilent = false) => {
        if (!isSilent) setLoading(true);
        try {
            const [backupsData, statsData] = await Promise.all([
                getBackups(),
                getBackupStats()
            ]);
            setBackups(backupsData);
            setStats(statsData);
        } catch (err: any) {
            console.error('Error fetching backups data:', err);
            setNotification({
                type: 'error',
                text: err.response?.data?.message || 'Error al conectar con el servidor de respaldos.'
            });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleCreateBackup = async () => {
        setCreating(true);
        setNotification(null);
        try {
            const result = await createDatabaseBackup();
            setNotification({
                type: 'success',
                text: `¡Copia de seguridad generada con éxito! (${result.backup.size_formatted})`
            });
            await loadData(true);
        } catch (err: any) {
            console.error('Error creating backup:', err);
            setNotification({
                type: 'error',
                text: err.response?.data?.message || 'Error al generar la copia de seguridad.'
            });
        } finally {
            setCreating(false);
        }
    };

    const handleDownload = async (item: BackupItem) => {
        setDownloading(item.filename);
        try {
            await downloadDatabaseBackup(item.filename);
        } catch (err: any) {
            console.error('Error downloading backup:', err);
            setNotification({
                type: 'error',
                text: 'Error al descargar el archivo de respaldo.'
            });
        } finally {
            setDownloading(null);
        }
    };

    const handleDelete = async () => {
        if (!deleteConfirm) return;
        setDeleting(true);
        try {
            await deleteDatabaseBackup(deleteConfirm.filename);
            setNotification({
                type: 'success',
                text: `Respaldo ${deleteConfirm.filename} eliminado del almacenamiento.`
            });
            setDeleteConfirm(null);
            await loadData(true);
        } catch (err: any) {
            console.error('Error deleting backup:', err);
            setNotification({
                type: 'error',
                text: err.response?.data?.message || 'Error al eliminar el respaldo.'
            });
        } finally {
            setDeleting(false);
        }
    };

    const copyRestoreCommand = (filename?: string) => {
        const file = filename || (backups[0]?.filename ?? 'backup_ultec_YYYYMMDD_HHMMSS.sql.gz');
        const cmd = `gunzip -c ${file} | docker exec -i supabase-db psql -U postgres -d postgres`;
        navigator.clipboard.writeText(cmd);
        setCopiedCommand(true);
        setTimeout(() => setCopiedCommand(false), 3000);
    };

    const copyHash = (hash: string) => {
        navigator.clipboard.writeText(hash);
        setCopiedHash(hash);
        setTimeout(() => setCopiedHash(null), 3000);
    };

    const formatDate = (isoString: string) => {
        try {
            const date = new Date(isoString);
            return new Intl.DateTimeFormat('es-GT', {
                year: 'numeric',
                month: 'short',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: true
            }).format(date);
        } catch {
            return isoString;
        }
    };

    const formatRelativeTime = (isoString: string) => {
        try {
            const ms = Date.now() - new Date(isoString).getTime();
            const minutes = Math.floor(ms / (1000 * 60));
            const hours = Math.floor(minutes / 60);
            const days = Math.floor(hours / 24);

            if (minutes < 2) return 'Hace un momento';
            if (minutes < 60) return `Hace ${minutes} min`;
            if (hours < 24) return `Hace ${hours} hr${hours > 1 ? 's' : ''}`;
            return `Hace ${days} día${days > 1 ? 's' : ''}`;
        } catch {
            return '';
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[350px] space-y-3">
                <Loader2 className="h-10 w-10 animate-spin text-brand-teal" />
                <p className="text-slate-400 font-medium">Consultando almacenamiento de respaldos...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* Notification alert */}
            {notification && (
                <div 
                    className={`p-4 rounded-2xl border flex items-center justify-between shadow-sm animate-in zoom-in-95 duration-200 ${
                        notification.type === 'success'
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                            : 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300'
                    }`}
                >
                    <div className="flex items-center space-x-2.5">
                        {notification.type === 'success' ? (
                            <Check className="h-5 w-5 text-emerald-500 shrink-0" />
                        ) : (
                            <AlertCircle className="h-5 w-5 text-rose-500 shrink-0" />
                        )}
                        <span className="text-sm font-medium">{notification.text}</span>
                    </div>
                    <button 
                        onClick={() => setNotification(null)}
                        className="text-xs opacity-70 hover:opacity-100 font-bold ml-4"
                    >
                        ✕
                    </button>
                </div>
            )}

            {/* KPI Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="glass-card p-4 rounded-2xl border border-slate-200 dark:border-white/10 relative overflow-hidden">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Respaldos</span>
                        <div className="p-2 rounded-xl bg-blue-500/10 text-brand-blue dark:text-brand-teal">
                            <FileArchive className="h-5 w-5" />
                        </div>
                    </div>
                    <div className="mt-2 flex items-baseline space-x-2">
                        <span className="text-2xl font-bold text-slate-900 dark:text-white">
                            {stats?.total_backups ?? backups.length}
                        </span>
                        <span className="text-xs text-slate-400">archivos .sql.gz</span>
                    </div>
                </div>

                <div className="glass-card p-4 rounded-2xl border border-slate-200 dark:border-white/10 relative overflow-hidden">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Espacio en Disco</span>
                        <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-500">
                            <HardDrive className="h-5 w-5" />
                        </div>
                    </div>
                    <div className="mt-2 flex items-baseline space-x-2">
                        <span className="text-2xl font-bold text-slate-900 dark:text-white">
                            {stats?.total_size_formatted ?? '0 B'}
                        </span>
                        <span className="text-xs text-slate-400">comprimido gzip</span>
                    </div>
                </div>

                <div className="glass-card p-4 rounded-2xl border border-slate-200 dark:border-white/10 relative overflow-hidden">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Último Respaldo</span>
                        <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
                            <Clock className="h-5 w-5" />
                        </div>
                    </div>
                    <div className="mt-2">
                        <span className="text-lg font-bold text-slate-900 dark:text-white truncate block">
                            {stats?.last_backup ? formatRelativeTime(stats.last_backup.created_at) : 'Sin respaldos'}
                        </span>
                        <span className="text-[11px] text-slate-400 truncate block">
                            {stats?.last_backup ? formatDate(stats.last_backup.created_at) : 'Genere el primero ahora'}
                        </span>
                    </div>
                </div>

                <div className="glass-card p-4 rounded-2xl border border-slate-200 dark:border-white/10 relative overflow-hidden">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Retención y Cron</span>
                        <div className="p-2 rounded-xl bg-purple-500/10 text-purple-500">
                            <ShieldCheck className="h-5 w-5" />
                        </div>
                    </div>
                    <div className="mt-2">
                        <div className="flex items-center space-x-1.5">
                            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-sm font-bold text-slate-900 dark:text-white">Auto-Cron Activo</span>
                        </div>
                        <span className="text-[11px] text-slate-400">Retención 7 días rotativos</span>
                    </div>
                </div>
            </div>

            {/* Action Bar */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-slate-100/70 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/60">
                <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                        <Database className="h-5 w-5 text-brand-teal" />
                        <span>Copias de Seguridad de la Base de Datos</span>
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Respaldos completos de los esquemas <code className="text-brand-teal font-mono">public</code> (alumnos, cursos, finanzas) y <code className="text-brand-teal font-mono">auth</code> (cuentas y credenciales).
                    </p>
                </div>

                <div className="flex items-center space-x-2.5 w-full sm:w-auto">
                    <button
                        onClick={() => loadData(false)}
                        disabled={loading}
                        className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                        title="Refrescar lista"
                    >
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>

                    <button
                        onClick={handleCreateBackup}
                        disabled={creating}
                        className="flex-1 sm:flex-initial flex items-center justify-center space-x-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-brand-teal text-white text-sm font-semibold shadow-[0_0_15px_rgba(37,192,244,0.35)] hover:shadow-[0_0_20px_rgba(37,192,244,0.5)] active:scale-95 transition-all disabled:opacity-50"
                    >
                        {creating ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span>Ejecutando pg_dump...</span>
                            </>
                        ) : (
                            <>
                                <Plus className="h-4 w-4" />
                                <span>Generar Respaldo Ahora</span>
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Backups List */}
            <div className="glass-card rounded-2xl border border-slate-200 dark:border-white/10 overflow-hidden">
                <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Historial de Respaldos ({backups.length})
                    </span>
                    <span className="text-[11px] text-slate-500">
                        Compresión Gzip Nivel 9 • Checksums SHA-256
                    </span>
                </div>

                {backups.length === 0 ? (
                    <div className="py-14 text-center flex flex-col items-center justify-center space-y-3">
                        <div className="p-3 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400">
                            <FileArchive className="h-8 w-8" />
                        </div>
                        <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                            No hay copias de seguridad registradas
                        </h4>
                        <p className="text-xs text-slate-400 max-w-sm">
                            Haga clic en "Generar Respaldo Ahora" para capturar la primera instantánea completa de la base de datos.
                        </p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
                        {backups.map((item) => {
                            const isDownloading = downloading === item.filename;
                            return (
                                <div 
                                    key={item.filename}
                                    className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                                >
                                    <div className="flex items-start space-x-3 min-w-0">
                                        <div className="p-2.5 rounded-xl bg-blue-500/10 text-brand-teal shrink-0 mt-0.5">
                                            <FileArchive className="h-5 w-5" />
                                        </div>
                                        <div className="min-w-0 space-y-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="text-sm font-mono font-bold text-slate-900 dark:text-white truncate">
                                                    {item.filename}
                                                </span>
                                                <span 
                                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                                        item.type === 'scheduled'
                                                            ? 'bg-purple-500/15 text-purple-600 dark:text-purple-400'
                                                            : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                                    }`}
                                                >
                                                    {item.type === 'scheduled' ? 'Automático (Cron)' : 'Manual (SuperAdmin)'}
                                                </span>
                                                <span className="px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-semibold">
                                                    {item.size_formatted}
                                                </span>
                                            </div>

                                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                                                <span className="flex items-center space-x-1">
                                                    <Calendar className="h-3.5 w-3.5 text-slate-400" />
                                                    <span>{formatDate(item.created_at)}</span>
                                                </span>
                                                <span>•</span>
                                                <span>{formatRelativeTime(item.created_at)}</span>
                                                <span>•</span>
                                                <span>Esquemas: {item.schemas?.join(', ') || 'public, auth'}</span>
                                            </div>

                                            {/* SHA-256 Hash */}
                                            {item.checksum_sha256 && item.checksum_sha256 !== 'n/a' && (
                                                <div className="flex items-center space-x-1.5 text-[10px] font-mono text-slate-400 pt-0.5">
                                                    <span className="text-slate-500 font-sans font-medium">SHA-256:</span>
                                                    <span className="truncate max-w-[180px] sm:max-w-[280px]">
                                                        {item.checksum_sha256}
                                                    </span>
                                                    <button
                                                        onClick={() => copyHash(item.checksum_sha256)}
                                                        className="hover:text-brand-teal p-0.5 transition-colors"
                                                        title="Copiar hash SHA-256"
                                                    >
                                                        {copiedHash === item.checksum_sha256 ? (
                                                            <Check className="h-3 w-3 text-emerald-500" />
                                                        ) : (
                                                            <Copy className="h-3 w-3" />
                                                        )}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Action buttons */}
                                    <div className="flex items-center space-x-2 shrink-0 self-end md:self-center">
                                        <button
                                            onClick={() => handleDownload(item)}
                                            disabled={isDownloading}
                                            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-200/80 dark:bg-slate-800 hover:bg-brand-blue hover:text-white dark:hover:bg-brand-teal dark:hover:text-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-all shadow-sm disabled:opacity-50"
                                            title="Descargar archivo .sql.gz a este equipo"
                                        >
                                            {isDownloading ? (
                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                            ) : (
                                                <Download className="h-3.5 w-3.5" />
                                            )}
                                            <span>Descargar</span>
                                        </button>

                                        <button
                                            onClick={() => setDeleteConfirm(item)}
                                            className="p-2 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                                            title="Eliminar este respaldo"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Emergency Disaster Recovery Guide */}
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 text-white relative overflow-hidden shadow-xl">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                        <Terminal className="h-5 w-5 text-emerald-400" />
                        <h4 className="text-sm font-bold tracking-tight">Comando de Restauración de Emergencia (Disaster Recovery)</h4>
                    </div>
                    <button
                        onClick={() => copyRestoreCommand()}
                        className="flex items-center space-x-1 px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-medium text-emerald-300 transition-colors"
                    >
                        {copiedCommand ? (
                            <>
                                <Check className="h-3.5 w-3.5 text-emerald-400" />
                                <span>Copiado</span>
                            </>
                        ) : (
                            <>
                                <Copy className="h-3.5 w-3.5" />
                                <span>Copiar Comando</span>
                            </>
                        )}
                    </button>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                    Si el servidor o la base de datos sufren una falla catastrófica, cualquier respaldo descargado puede restaurarse en segundos ejecutando este comando en la terminal SSH del VPS:
                </p>
                <div className="mt-3 p-3 rounded-xl bg-black/60 border border-white/5 font-mono text-xs text-emerald-400 overflow-x-auto select-all">
                    gunzip -c {backups[0]?.filename ?? 'backup_ultec_YYYYMMDD_HHMMSS.sql.gz'} | docker exec -i supabase-db psql -U postgres -d postgres
                </div>
                <p className="text-[11px] text-slate-500 mt-2">
                    💡 Nota: El volcado incluye sentencias <code className="text-slate-400">--clean --if-exists</code> que reemplazan limpiamente las tablas existentes sin requerir reiniciar contenedores.
                </p>
            </div>

            {/* Delete Confirmation Modal */}
            <ConfirmModal
                isOpen={!!deleteConfirm}
                title="¿Eliminar Copia de Seguridad?"
                description={
                    <div className="space-y-2">
                        <p>¿Estás seguro de eliminar el archivo de respaldo <strong className="text-rose-400 font-mono text-xs">{deleteConfirm?.filename}</strong>?</p>
                        <p className="text-[11px] text-slate-400">Esta acción liberará {deleteConfirm?.size_formatted} en el disco pero el archivo no podrá recuperarse salvo que lo hayas descargado previamente.</p>
                    </div>
                }
                confirmText="Sí, Eliminar Respaldo"
                cancelText="Cancelar"
                variant="danger"
                isLoading={deleting}
                onConfirm={handleDelete}
                onClose={() => setDeleteConfirm(null)}
            />
        </div>
    );
};

export default DatabaseBackupManager;
