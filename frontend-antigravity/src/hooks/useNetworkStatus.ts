import { useState, useEffect, useCallback } from 'react';
import { offlineSyncService, OFFLINE_SYNC_EVENT } from '../services/offlineSyncService';

export const useNetworkStatus = () => {
    const [isOnline, setIsOnline] = useState<boolean>(() => 
        typeof navigator !== 'undefined' ? navigator.onLine : true
    );
    const [pendingCount, setPendingCount] = useState<number>(0);
    const [isSyncing, setIsSyncing] = useState<boolean>(false);

    const refreshPendingCount = useCallback(async () => {
        const count = await offlineSyncService.getPendingCount();
        setPendingCount(count);
    }, []);

    const syncNow = useCallback(async () => {
        if (!navigator.onLine || isSyncing) return;
        setIsSyncing(true);
        try {
            await offlineSyncService.processSyncQueue();
        } finally {
            setIsSyncing(false);
            await refreshPendingCount();
        }
    }, [isSyncing, refreshPendingCount]);

    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true);
            // Al recuperar internet, intentar sincronizar la cola tras 1.5 segundos
            setTimeout(() => {
                syncNow();
            }, 1500);
        };

        const handleOffline = () => {
            setIsOnline(false);
        };

        const handleSyncUpdate = () => {
            refreshPendingCount();
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        window.addEventListener(OFFLINE_SYNC_EVENT, handleSyncUpdate);

        // Conteo inicial
        refreshPendingCount();

        // Chequeo periódico del conteo de la cola cada 30 segundos
        const interval = setInterval(() => {
            refreshPendingCount();
            if (navigator.onLine) {
                offlineSyncService.getPendingCount().then(c => {
                    if (c > 0) syncNow();
                });
            }
        }, 30000);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            window.removeEventListener(OFFLINE_SYNC_EVENT, handleSyncUpdate);
            clearInterval(interval);
        };
    }, [refreshPendingCount, syncNow]);

    return {
        isOnline,
        pendingCount,
        isSyncing,
        syncNow,
        refreshPendingCount
    };
};
