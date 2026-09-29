import React, { useState, useEffect } from 'react';
import { 
    Sparkles, 
    CheckCircle2, 
    AlertCircle, 
    X, 
    Loader2, 
    ShieldCheck, 
    Settings, 
    ArrowRight,
    Smartphone,
    Globe,
    RefreshCw
} from 'lucide-react';
import { 
    type AppVersionInfo, 
    type DownloadProgressData,
    startNativeUpdate, 
    canInstallUnknownApps, 
    openInstallSettings,
    retryLaunchInstaller
} from '../../services/updaterService';

interface AppUpdateModalProps {
    isOpen: boolean;
    onClose: () => void;
    versionInfo: AppVersionInfo | null;
    currentVersion: string;
    isNativeAndroid: boolean;
    hasUpdate: boolean;
    onCheckAgain?: () => Promise<boolean>;
    isChecking?: boolean;
}

export const AppUpdateModal: React.FC<AppUpdateModalProps> = ({
    isOpen,
    onClose,
    versionInfo,
    currentVersion,
    isNativeAndroid,
    hasUpdate,
    onCheckAgain,
    isChecking = false
}) => {
    const [downloading, setDownloading] = useState(false);
    const [progress, setProgress] = useState<DownloadProgressData>({ progress: 0, bytesDownloaded: 0, totalBytes: 0 });
    const [downloadComplete, setDownloadComplete] = useState(false);
    const [needsPermission, setNeedsPermission] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            setError(null);
            setDownloading(false);
            setDownloadComplete(false);
            setProgress({ progress: 0, bytesDownloaded: 0, totalBytes: 0 });
            checkPermissionState();
        }
    }, [isOpen]);

    const checkPermissionState = async () => {
        if (isNativeAndroid) {
            const canInstall = await canInstallUnknownApps();
            setNeedsPermission(!canInstall);
        }
    };

    if (!isOpen) return null;

    const formatBytes = (bytes: number) => {
        if (!bytes || bytes === 0) return '0 MB';
        const mb = bytes / (1024 * 1024);
        return `${mb.toFixed(1)} MB`;
    };

    const handleStartUpdate = async () => {
        if (!versionInfo) return;
        setError(null);

        // Si es entorno Web, descargar directamente
        if (!isNativeAndroid) {
            const link = document.createElement('a');
            link.href = versionInfo.downloadUrl;
            link.download = versionInfo.fileName || 'PlataformaULTEC.apk';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            return;
        }

        // Si es Android, iniciar descarga con reporte de progreso
        setDownloading(true);
        try {
            await startNativeUpdate(versionInfo.downloadUrl, (p) => {
                setProgress(p);
            });
            setDownloadComplete(true);
            setDownloading(false);
        } catch (err: any) {
            console.error('Error durante actualización:', err);
            setError(err?.message || 'Error al descargar la actualización.');
            setDownloading(false);
        }
    };

    const handleGrantPermission = async () => {
        await openInstallSettings();
    };

    const handleRetryInstall = async () => {
        try {
            const res = await retryLaunchInstaller();
            if (res.needsPermission) {
                setNeedsPermission(true);
            } else {
                setNeedsPermission(false);
            }
        } catch (err: any) {
            setError(err?.message || 'Error al ejecutar instalador.');
        }
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-200">
                
                {/* Header dinámico según estado (Actualizada vs Actualización disponible) */}
                {hasUpdate && versionInfo ? (
                    <div className="relative p-6 bg-gradient-to-r from-brand-blue via-indigo-600 to-brand-purple text-white overflow-hidden">
                        <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-3xl -translate-y-12 translate-x-12 pointer-events-none" />
                        
                        <div className="relative z-10 flex items-start justify-between">
                            <div className="flex items-center gap-3.5">
                                <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-lg">
                                    <Sparkles className="w-6 h-6 text-amber-300 animate-pulse" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold uppercase tracking-wider text-blue-100 bg-white/20 px-2.5 py-0.5 rounded-full backdrop-blur-sm">
                                            Nueva Versión Oficial
                                        </span>
                                        <span className="text-xs font-bold text-emerald-300 bg-emerald-950/40 border border-emerald-400/30 px-2 py-0.5 rounded-full">
                                            v{versionInfo.version}
                                        </span>
                                    </div>
                                    <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white mt-1">
                                        {versionInfo.title || 'Actualización de Plataforma'}
                                    </h2>
                                </div>
                            </div>

                            {!versionInfo.isCritical && !downloading && (
                                <button 
                                    onClick={onClose}
                                    className="p-1.5 rounded-xl text-white/70 hover:text-white hover:bg-white/15 transition-all"
                                    aria-label="Cerrar"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="relative p-6 bg-gradient-to-r from-emerald-600 via-teal-600 to-slate-900 text-white overflow-hidden">
                        <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-3xl -translate-y-12 translate-x-12 pointer-events-none" />
                        
                        <div className="relative z-10 flex items-start justify-between">
                            <div className="flex items-center gap-3.5">
                                <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-lg">
                                    <CheckCircle2 className="w-7 h-7 text-emerald-300" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold uppercase tracking-wider text-emerald-100 bg-white/20 px-2.5 py-0.5 rounded-full backdrop-blur-sm">
                                            ✓ Sistema al Día
                                        </span>
                                        <span className="text-xs font-bold text-emerald-200 bg-emerald-950/40 border border-emerald-400/30 px-2 py-0.5 rounded-full">
                                            v{currentVersion}
                                        </span>
                                    </div>
                                    <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white mt-1">
                                        Tu aplicación está al día
                                    </h2>
                                </div>
                            </div>

                            <button 
                                onClick={onClose}
                                className="p-1.5 rounded-xl text-white/70 hover:text-white hover:bg-white/15 transition-all"
                                aria-label="Cerrar"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                )}

                {/* Contenido */}
                <div className="p-6 space-y-5">
                    
                    {/* Tarjeta de información de versiones */}
                    <div className="grid grid-cols-2 gap-3 p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 text-xs">
                        <div>
                            <span className="text-slate-400 dark:text-slate-500 font-semibold block uppercase tracking-wider text-[10px]">
                                Versión Instalada
                            </span>
                            <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                                v{currentVersion}
                            </span>
                            <span className="text-[10px] text-slate-400 block mt-0.5">
                                {isNativeAndroid ? 'Android Nativo' : 'Plataforma Web'}
                            </span>
                        </div>
                        <div>
                            <span className="text-slate-400 dark:text-slate-500 font-semibold block uppercase tracking-wider text-[10px]">
                                {hasUpdate ? 'Nueva en Servidor' : 'Estado'}
                            </span>
                            {hasUpdate && versionInfo ? (
                                <>
                                    <span className="font-bold text-brand-blue dark:text-brand-teal text-sm">
                                        v{versionInfo.version} ({formatBytes(versionInfo.fileSize)})
                                    </span>
                                    <span className="text-[10px] text-emerald-500 font-semibold block mt-0.5">
                                        Lista para instalar
                                    </span>
                                </>
                            ) : (
                                <>
                                    <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm flex items-center gap-1">
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                        Actualizado
                                    </span>
                                    <span className="text-[10px] text-slate-400 block mt-0.5">
                                        Última versión oficial
                                    </span>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Lista de Novedades */}
                    <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2.5 flex items-center gap-1.5">
                            <ShieldCheck className="w-4 h-4 text-emerald-500" />
                            {hasUpdate ? 'Novedades y Mejoras Incluidas:' : 'Mejoras Activas en esta Versión:'}
                        </h4>
                        <div className="bg-slate-50/80 dark:bg-slate-800/40 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 max-h-48 overflow-y-auto space-y-2">
                            {versionInfo?.releaseNotes && versionInfo.releaseNotes.length > 0 ? (
                                versionInfo.releaseNotes.map((note, idx) => (
                                    <div key={idx} className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                                        <CheckCircle2 className="w-4 h-4 text-brand-blue dark:text-brand-teal shrink-0 mt-0.5" />
                                        <span>{note}</span>
                                    </div>
                                ))
                            ) : (
                                <p className="text-xs text-slate-400 italic">Mejoras de rendimiento, estabilidad y corrección de errores generales.</p>
                            )}
                        </div>
                    </div>

                    {/* Estado: Si hay actualización disponible */}
                    {hasUpdate && versionInfo && (
                        <>
                            {/* Mensaje si Android requiere permisos de instalación */}
                            {isNativeAndroid && needsPermission && (
                                <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-200 space-y-2">
                                    <div className="flex items-center gap-2 font-bold text-xs">
                                        <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                                        <span>Permiso requerido para actualizar</span>
                                    </div>
                                    <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
                                        Android requiere que autorices la opción <strong>"Permitir desde esta fuente"</strong> para poder instalar actualizaciones automáticas sin salir de la app.
                                    </p>
                                    <button
                                        onClick={handleGrantPermission}
                                        className="mt-1 w-full flex items-center justify-center gap-2 py-2 px-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-amber-500/20"
                                    >
                                        <Settings className="w-3.5 h-3.5" />
                                        <span>Abrir Ajustes de Android</span>
                                    </button>
                                </div>
                            )}

                            {/* Barra de Progreso durante la descarga */}
                            {downloading && (
                                <div className="space-y-2 bg-blue-50/60 dark:bg-blue-950/30 p-4 rounded-2xl border border-blue-100 dark:border-blue-900/40">
                                    <div className="flex justify-between items-center text-xs font-bold text-slate-700 dark:text-slate-200">
                                        <span className="flex items-center gap-1.5 text-brand-blue dark:text-brand-teal">
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Descargando actualización...
                                        </span>
                                        <span>{progress.progress}%</span>
                                    </div>

                                    {/* Barra animada */}
                                    <div className="w-full h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden p-0.5">
                                        <div 
                                            className="h-full bg-gradient-to-r from-brand-blue to-brand-teal rounded-full transition-all duration-200"
                                            style={{ width: `${Math.max(5, progress.progress)}%` }}
                                        />
                                    </div>

                                    <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                                        <span>{formatBytes(progress.bytesDownloaded)} de {formatBytes(progress.totalBytes || versionInfo.fileSize)}</span>
                                        <span>No cierre la aplicación</span>
                                    </div>
                                </div>
                            )}

                            {/* Mensaje de finalización de descarga en Android */}
                            {downloadComplete && (
                                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl text-emerald-800 dark:text-emerald-200 space-y-2">
                                    <div className="flex items-center gap-2 font-bold text-xs">
                                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                        <span>Descarga completada</span>
                                    </div>
                                    <p className="text-xs leading-relaxed">
                                        El paquete oficial se ha descargado exitosamente. Si la ventana de instalación no se abrió automáticamente, presiona el botón a continuación:
                                    </p>
                                    <button
                                        onClick={handleRetryInstall}
                                        className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-600/20"
                                    >
                                        <ArrowRight className="w-4 h-4" />
                                        <span>Abrir Instalador de Android</span>
                                    </button>
                                </div>
                            )}

                            {/* Mensaje de error */}
                            {error && (
                                <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-2xl text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2 font-medium">
                                    <AlertCircle className="w-4 h-4 shrink-0" />
                                    <span>{error}</span>
                                </div>
                            )}

                            {/* Botones de acción principales cuando HAY actualización */}
                            <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
                                {!versionInfo.isCritical && (
                                    <button
                                        onClick={onClose}
                                        disabled={downloading}
                                        className="py-3 px-4 rounded-2xl text-xs sm:text-sm font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex-1 order-2 sm:order-1 disabled:opacity-50"
                                    >
                                        Más Tarde
                                    </button>
                                )}

                                <button
                                    onClick={handleStartUpdate}
                                    disabled={downloading}
                                    className="py-3 px-5 rounded-2xl text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-brand-blue to-brand-teal hover:from-blue-600 hover:to-teal-500 shadow-lg shadow-brand-blue/25 active:scale-95 transition-all flex items-center justify-center gap-2 flex-1 order-1 sm:order-2 disabled:opacity-50"
                                >
                                    {downloading ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            <span>Descargando ({progress.progress}%)...</span>
                                        </>
                                    ) : (
                                        <>
                                            {isNativeAndroid ? (
                                                <>
                                                    <Smartphone className="w-4 h-4" />
                                                    <span>Descargar e Instalar Ahora</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Globe className="w-4 h-4" />
                                                    <span>Descargar APK Oficial</span>
                                                </>
                                            )}
                                        </>
                                    )}
                                </button>
                            </div>
                        </>
                    )}

                    {/* Estado: Si la aplicación YA ESTÁ AL DÍA */}
                    {!hasUpdate && (
                        <div className="space-y-4">
                            <div className="p-4 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/40 text-emerald-900 dark:text-emerald-200 text-xs sm:text-sm leading-relaxed flex items-center gap-3">
                                <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                <div>
                                    <p className="font-bold">¡Tienes instalada la versión más reciente!</p>
                                    <p className="text-slate-600 dark:text-slate-400 text-xs mt-0.5">
                                        Tu dispositivo cuenta con todas las funciones académicas, reportes multianuales y parches de seguridad activos.
                                    </p>
                                </div>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
                                {onCheckAgain && (
                                    <button
                                        onClick={onCheckAgain}
                                        disabled={isChecking}
                                        className="py-3 px-4 rounded-2xl text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center justify-center gap-2 flex-1 disabled:opacity-50 active:scale-95"
                                    >
                                        <RefreshCw className={`w-4 h-4 ${isChecking ? 'animate-spin text-brand-blue' : ''}`} />
                                        <span>{isChecking ? 'Comprobando...' : 'Comprobar de Nuevo'}</span>
                                    </button>
                                )}

                                <button
                                    onClick={onClose}
                                    className="py-3 px-6 rounded-2xl text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-lg shadow-emerald-600/25 active:scale-95 transition-all flex items-center justify-center flex-1"
                                >
                                    <span>Entendido</span>
                                </button>
                            </div>
                        </div>
                    )}

                    <p className="text-center text-[11px] text-slate-400 dark:text-slate-500">
                        {isNativeAndroid 
                            ? 'Instalación nativa segura: tus datos de sesión y calificaciones se conservan intactos.'
                            : 'Plataforma oficial ULTEC sincronizada con el servidor.'}
                    </p>
                </div>

            </div>
        </div>
    );
};
