import React, { useState } from 'react';
import { 
    RefreshCw, 
    WifiOff 
} from 'lucide-react';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { OfflineSyncModal } from './OfflineSyncModal';

export const NetworkStatusBar: React.FC = () => {
    const { isOnline, pendingCount, refreshPendingCount } = useNetworkStatus();
    const [isModalOpen, setIsModalOpen] = useState(false);

    return (
        <>
            {/* Banner global flotante cuando se pierde la conexión a internet */}
            {!isOnline && (
                <div className="bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 text-white px-4 py-2 text-xs font-semibold flex items-center justify-between shadow-md animate-in slide-in-from-top-2 duration-300 z-40">
                    <div className="flex items-center gap-2 max-w-2xl">
                        <WifiOff className="w-4 h-4 shrink-0 animate-pulse text-amber-200" />
                        <span>
                            <strong>Modo Sin Conexión Activo:</strong> Puedes seguir tomando asistencia y registrando notas normalmente. Los datos se guardarán de forma segura en tu equipo y se subirán al servidor en cuanto vuelva la señal.
                        </span>
                    </div>

                    {pendingCount > 0 && (
                        <button
                            onClick={() => setIsModalOpen(true)}
                            className="ml-3 px-2.5 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-white text-[11px] font-bold transition shrink-0"
                        >
                            Ver {pendingCount} pendientes
                        </button>
                    )}
                </div>
            )}

            {/* Modal de Detalle de Cola de Sincronización */}
            <OfflineSyncModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                isOnline={isOnline}
                onSyncComplete={refreshPendingCount}
            />
        </>
    );
};

export const NetworkIndicatorBadge: React.FC = () => {
    const { isOnline, pendingCount, isSyncing, refreshPendingCount } = useNetworkStatus();
    const [isModalOpen, setIsModalOpen] = useState(false);

    return (
        <>
            {/* Badge de estado en la barra superior */}
            {pendingCount > 0 ? (
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/25 transition cursor-pointer"
                    title="Registros guardados en este dispositivo pendientes de sincronizar con el servidor"
                >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-brand-blue' : 'text-amber-500'}`} />
                    <span className="hidden sm:inline">{pendingCount} {pendingCount === 1 ? 'pendiente' : 'pendientes'}</span>
                    <span className="sm:hidden">{pendingCount}</span>
                </button>
            ) : !isOnline ? (
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-400 transition cursor-pointer"
                    title="Sin conexión a internet"
                >
                    <WifiOff className="w-3.5 h-3.5 text-rose-500" />
                    <span className="hidden sm:inline">Sin conexión</span>
                </button>
            ) : null}

            {/* Modal de Detalle */}
            <OfflineSyncModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                isOnline={isOnline}
                onSyncComplete={refreshPendingCount}
            />
        </>
    );
};
