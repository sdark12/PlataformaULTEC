import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
    Cloud, 
    CloudOff, 
    RefreshCw, 
    CheckCircle2, 
    AlertCircle, 
    Trash2, 
    X, 
    Calendar, 
    GraduationCap, 
    Loader2 
} from 'lucide-react';
import { offlineSyncService } from '../../services/offlineSyncService';
import type { OutboxMutation } from '../../services/offlineStorage';

interface OfflineSyncModalProps {
    isOpen: boolean;
    onClose: () => void;
    isOnline: boolean;
    onSyncComplete?: () => void;
}

export const OfflineSyncModal: React.FC<OfflineSyncModalProps> = ({
    isOpen,
    onClose,
    isOnline,
    onSyncComplete
}) => {
    const [mutations, setMutations] = useState<OutboxMutation[]>([]);
    const [loading, setLoading] = useState(false);
    const [syncing, setSyncing] = useState(false);

    const loadMutations = async () => {
        setLoading(true);
        try {
            const list = await offlineSyncService.getAllPendingMutations();
            setMutations(list);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            loadMutations();
        }
    }, [isOpen]);

    const handleSyncAll = async () => {
        if (!isOnline || syncing) return;
        setSyncing(true);
        try {
            await offlineSyncService.processSyncQueue();
            await loadMutations();
            if (onSyncComplete) onSyncComplete();
        } finally {
            setSyncing(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('¿Deseas descartar este registro pendiente? No se subirá al servidor.')) {
            await offlineSyncService.deleteMutation(id);
            await loadMutations();
        }
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
            <div 
                className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-800/40">
                    <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-xl ${isOnline ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
                            {isOnline ? <Cloud className="w-5 h-5" /> : <CloudOff className="w-5 h-5" />}
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-900 dark:text-white text-base">
                                Centro de Sincronización Offline
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                {isOnline ? 'Conexión activa con el servidor' : 'Sin conexión — Modo local activo'}
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto space-y-4 flex-1">
                    {loading ? (
                        <div className="py-12 text-center text-slate-400">
                            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-brand-blue" />
                            <p className="text-sm">Consultando registros guardados en tu equipo...</p>
                        </div>
                    ) : mutations.length === 0 ? (
                        <div className="py-12 text-center text-slate-400">
                            <div className="w-14 h-14 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto mb-3">
                                <CheckCircle2 className="w-7 h-7" />
                            </div>
                            <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                                Todo está al día
                            </h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs mx-auto">
                                No tienes registros pendientes en este dispositivo. Todos los datos están sincronizados en el servidor central.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between text-xs text-slate-500 pb-1">
                                <span>{mutations.length} {mutations.length === 1 ? 'registro pendiente' : 'registros pendientes'}</span>
                                <span className="font-medium text-amber-600 dark:text-amber-400">Guardados en este equipo</span>
                            </div>

                            {mutations.map((item) => (
                                <div 
                                    key={item.id}
                                    className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:border-slate-300 dark:hover:border-slate-700 transition flex items-start justify-between gap-3"
                                >
                                    <div className="flex items-start gap-3 min-w-0">
                                        <div className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                                            item.type === 'ATTENDANCE' 
                                                ? 'bg-blue-500/10 text-blue-500' 
                                                : 'bg-purple-500/10 text-purple-500'
                                        }`}>
                                            {item.type === 'ATTENDANCE' ? (
                                                <Calendar className="w-4 h-4" />
                                            ) : (
                                                <GraduationCap className="w-4 h-4" />
                                            )}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-200 truncate">
                                                {item.title}
                                            </p>
                                            <p className="text-[11px] text-slate-400 mt-0.5">
                                                Creado el {new Date(item.createdAt).toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                            {item.lastError && (
                                                <p className="text-[11px] text-rose-500 mt-1 flex items-center gap-1">
                                                    <AlertCircle className="w-3 h-3 shrink-0" />
                                                    <span className="truncate">{item.lastError}</span>
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-1.5 shrink-0">
                                        {item.status === 'SYNCING' ? (
                                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold bg-blue-500/10 text-blue-500 animate-pulse">
                                                <Loader2 className="w-3 h-3 animate-spin" />
                                                Subiendo
                                            </span>
                                        ) : item.status === 'FAILED' ? (
                                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold bg-rose-500/10 text-rose-500">
                                                Reintentar
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold bg-amber-500/10 text-amber-500">
                                                Pendiente
                                            </span>
                                        )}

                                        <button
                                            onClick={() => handleDelete(item.id)}
                                            className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                                            title="Descartar registro"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 flex items-center justify-between gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-700 rounded-xl transition"
                    >
                        Cerrar
                    </button>

                    {mutations.length > 0 && (
                        <button
                            type="button"
                            onClick={handleSyncAll}
                            disabled={!isOnline || syncing}
                            className="px-4 py-2 bg-gradient-to-r from-brand-blue to-teal-500 hover:from-blue-600 hover:to-teal-600 text-white text-xs font-bold rounded-xl shadow-lg shadow-brand-blue/20 flex items-center gap-2 transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        >
                            {syncing ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span>Sincronizando...</span>
                                </>
                            ) : (
                                <>
                                    <RefreshCw className="w-4 h-4" />
                                    <span>Sincronizar Todo Ahora</span>
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};
