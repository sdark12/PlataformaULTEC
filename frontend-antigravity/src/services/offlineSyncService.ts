/**
 * Servicio de Sincronización Offline en Segundo Plano (Outbox Pattern)
 * Gestiona la cola de transacciones locales y su sincronización hacia el servidor
 * en cuanto el dispositivo recupera conectividad a internet.
 */

import api from './apiClient';
import { offlineStorage, type OutboxMutation } from './offlineStorage';

export const OFFLINE_SYNC_EVENT = 'ultec-offline-sync-updated';

const notifySyncUpdate = () => {
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(OFFLINE_SYNC_EVENT));
    }
};

let isSyncInProgress = false;

export const offlineSyncService = {
    // --- Guardado en cola de Asistencia ---
    queueAttendance: async (
        courseId: string,
        courseName: string,
        date: string,
        students: any[]
    ): Promise<OutboxMutation> => {
        const id = `att_${courseId}_${date}_${Date.now()}`;
        const mutation: OutboxMutation = {
            id,
            type: 'ATTENDANCE',
            title: `Asistencia: ${courseName} (${date})`,
            course_id: courseId,
            course_name: courseName,
            endpoint: '/api/attendance',
            method: 'POST',
            payload: {
                course_id: courseId,
                date,
                students
            },
            createdAt: new Date().toISOString(),
            status: 'PENDING',
            retryCount: 0
        };

        // Guardar tanto en el visor de datos local como en la cola de salida
        await offlineStorage.saveLocalAttendance(courseId, date, students);
        await offlineStorage.addOutboxMutation(mutation);
        notifySyncUpdate();

        return mutation;
    },

    // --- Guardado en cola de Calificaciones ---
    queueGrades: async (
        courseId: string,
        courseName: string,
        unitName: string,
        students: any[]
    ): Promise<OutboxMutation> => {
        const id = `grd_${courseId}_${unitName}_${Date.now()}`;
        const mutation: OutboxMutation = {
            id,
            type: 'GRADES',
            title: `Calificaciones: ${courseName} - ${unitName}`,
            course_id: courseId,
            course_name: courseName,
            endpoint: '/api/grades',
            method: 'POST',
            payload: {
                course_id: courseId,
                unit_name: unitName,
                students
            },
            createdAt: new Date().toISOString(),
            status: 'PENDING',
            retryCount: 0
        };

        await offlineStorage.saveLocalGrades(courseId, unitName, students);
        await offlineStorage.addOutboxMutation(mutation);
        notifySyncUpdate();

        return mutation;
    },

    // --- Consultas de Estado de la Cola ---
    getPendingCount: async (): Promise<number> => {
        try {
            const list = await offlineStorage.getPendingOutboxMutations();
            return list.filter(item => item.status === 'PENDING' || item.status === 'FAILED').length;
        } catch (e) {
            console.error('Error al obtener conteo de pendientes offline:', e);
            return 0;
        }
    },

    getAllPendingMutations: async (): Promise<OutboxMutation[]> => {
        try {
            return await offlineStorage.getPendingOutboxMutations();
        } catch (e) {
            console.error('Error al listar transacciones pendientes:', e);
            return [];
        }
    },

    // --- Procesamiento de la Cola (Sincronización) ---
    processSyncQueue: async (): Promise<{ total: number; successful: number; failed: number }> => {
        if (isSyncInProgress) {
            return { total: 0, successful: 0, failed: 0 };
        }

        if (typeof navigator !== 'undefined' && !navigator.onLine) {
            return { total: 0, successful: 0, failed: 0 };
        }

        isSyncInProgress = true;
        let successful = 0;
        let failed = 0;

        try {
            const mutations = await offlineStorage.getPendingOutboxMutations();
            const pendingList = mutations.filter(m => m.status !== 'SYNCING');

            for (const item of pendingList) {
                try {
                    item.status = 'SYNCING';
                    await offlineStorage.updateOutboxMutation(item);
                    notifySyncUpdate();

                    // Despachar mutación hacia el servidor
                    if (item.method === 'POST') {
                        await api.post(item.endpoint, item.payload);
                    } else if (item.method === 'PUT') {
                        await api.put(item.endpoint, item.payload);
                    } else if (item.method === 'PATCH') {
                        await api.patch(item.endpoint, item.payload);
                    }

                    // Sincronización exitosa: eliminar de la cola
                    await offlineStorage.removeOutboxMutation(item.id);
                    successful++;
                } catch (err: any) {
                    console.error(`Error al sincronizar mutación ${item.id}:`, err);
                    item.status = 'FAILED';
                    item.retryCount = (item.retryCount || 0) + 1;
                    item.lastError = err?.response?.data?.message || err?.message || 'Error de conexión con el servidor';
                    await offlineStorage.updateOutboxMutation(item);
                    failed++;
                }
            }
        } finally {
            isSyncInProgress = false;
            notifySyncUpdate();
        }

        return {
            total: successful + failed,
            successful,
            failed
        };
    },

    // Descartar o eliminar una mutación específica
    deleteMutation: async (id: string): Promise<void> => {
        await offlineStorage.removeOutboxMutation(id);
        notifySyncUpdate();
    }
};
