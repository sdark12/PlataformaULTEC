/**
 * Motor de Almacenamiento Local Offline (IndexedDB) para Plataforma ULTEC
 * Proporciona persistencia sin conexión para nóminas de estudiantes,
 * registros de asistencia, calificaciones y cola de salida (Outbox).
 */

const DB_NAME = 'UltecOfflineDB';
const DB_VERSION = 1;

export interface OutboxMutation {
    id: string;
    type: 'ATTENDANCE' | 'GRADES' | 'SUBGRADES';
    title: string;
    course_id: string;
    course_name?: string;
    endpoint: string;
    method: 'POST' | 'PUT' | 'PATCH';
    payload: any;
    createdAt: string;
    status: 'PENDING' | 'SYNCING' | 'FAILED';
    retryCount: number;
    lastError?: string;
}

export interface CachedRoster {
    course_id: string;
    course_name: string;
    students: any[];
    cached_at: string;
}

export interface CachedAttendance {
    key: string; // `${course_id}_${date}`
    course_id: string;
    date: string;
    students: any[];
    saved_at: string;
}

export interface CachedGrades {
    key: string; // `${course_id}_${unit_name}`
    course_id: string;
    unit_name: string;
    students: any[];
    saved_at: string;
}

let dbPromise: Promise<IDBDatabase> | null = null;

export const getOfflineDb = (): Promise<IDBDatabase> => {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
        return Promise.reject(new Error('IndexedDB no es soportado en este entorno'));
    }

    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
        const request = window.indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
            const db = (event.target as IDBOpenDBRequest).result;

            // 1. Nóminas de alumnos por curso
            if (!db.objectStoreNames.contains('cached_rosters')) {
                db.createObjectStore('cached_rosters', { keyPath: 'course_id' });
            }

            // 2. Registros de asistencia local
            if (!db.objectStoreNames.contains('cached_attendance')) {
                db.createObjectStore('cached_attendance', { keyPath: 'key' });
            }

            // 3. Registros de calificaciones local
            if (!db.objectStoreNames.contains('cached_grades')) {
                db.createObjectStore('cached_grades', { keyPath: 'key' });
            }

            // 4. Cola de transacciones pendientes (Outbox)
            if (!db.objectStoreNames.contains('sync_outbox')) {
                const outboxStore = db.createObjectStore('sync_outbox', { keyPath: 'id' });
                outboxStore.createIndex('status', 'status', { unique: false });
                outboxStore.createIndex('createdAt', 'createdAt', { unique: false });
            }
        };

        request.onsuccess = () => {
            resolve(request.result);
        };

        request.onerror = () => {
            reject(request.error);
        };
    });

    return dbPromise;
};

// ==========================================
// MÉTODOS CRUD GENÉRICOS EN INDEXEDDB
// ==========================================

export const offlineStorage = {
    // --- Nóminas de Alumnos ---
    saveRoster: async (courseId: string, courseName: string, students: any[]): Promise<void> => {
        const db = await getOfflineDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('cached_rosters', 'readwrite');
            const store = tx.objectStore('cached_rosters');
            const data: CachedRoster = {
                course_id: courseId,
                course_name: courseName,
                students,
                cached_at: new Date().toISOString()
            };
            const req = store.put(data);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    },

    getRoster: async (courseId: string): Promise<CachedRoster | null> => {
        const db = await getOfflineDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('cached_rosters', 'readonly');
            const store = tx.objectStore('cached_rosters');
            const req = store.get(courseId);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => reject(req.error);
        });
    },

    // --- Asistencias en Local ---
    saveLocalAttendance: async (courseId: string, date: string, students: any[]): Promise<void> => {
        const db = await getOfflineDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('cached_attendance', 'readwrite');
            const store = tx.objectStore('cached_attendance');
            const data: CachedAttendance = {
                key: `${courseId}_${date}`,
                course_id: courseId,
                date,
                students,
                saved_at: new Date().toISOString()
            };
            const req = store.put(data);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    },

    getLocalAttendance: async (courseId: string, date: string): Promise<CachedAttendance | null> => {
        const db = await getOfflineDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('cached_attendance', 'readonly');
            const store = tx.objectStore('cached_attendance');
            const req = store.get(`${courseId}_${date}`);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => reject(req.error);
        });
    },

    // --- Calificaciones en Local ---
    saveLocalGrades: async (courseId: string, unitName: string, students: any[]): Promise<void> => {
        const db = await getOfflineDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('cached_grades', 'readwrite');
            const store = tx.objectStore('cached_grades');
            const data: CachedGrades = {
                key: `${courseId}_${unitName}`,
                course_id: courseId,
                unit_name: unitName,
                students,
                saved_at: new Date().toISOString()
            };
            const req = store.put(data);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    },

    getLocalGrades: async (courseId: string, unitName: string): Promise<CachedGrades | null> => {
        const db = await getOfflineDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('cached_grades', 'readonly');
            const store = tx.objectStore('cached_grades');
            const req = store.get(`${courseId}_${unitName}`);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => reject(req.error);
        });
    },

    // --- Cola de Salida (Outbox) ---
    addOutboxMutation: async (mutation: OutboxMutation): Promise<void> => {
        const db = await getOfflineDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('sync_outbox', 'readwrite');
            const store = tx.objectStore('sync_outbox');
            const req = store.put(mutation);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    },

    getPendingOutboxMutations: async (): Promise<OutboxMutation[]> => {
        const db = await getOfflineDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('sync_outbox', 'readonly');
            const store = tx.objectStore('sync_outbox');
            const req = store.getAll();
            req.onsuccess = () => {
                const list = (req.result as OutboxMutation[]) || [];
                // Ordenar por fecha de creación (FIFO)
                list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
                resolve(list);
            };
            req.onerror = () => reject(req.error);
        });
    },

    updateOutboxMutation: async (mutation: OutboxMutation): Promise<void> => {
        const db = await getOfflineDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('sync_outbox', 'readwrite');
            const store = tx.objectStore('sync_outbox');
            const req = store.put(mutation);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    },

    removeOutboxMutation: async (id: string): Promise<void> => {
        const db = await getOfflineDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('sync_outbox', 'readwrite');
            const store = tx.objectStore('sync_outbox');
            const req = store.delete(id);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    },

    clearAllOutbox: async (): Promise<void> => {
        const db = await getOfflineDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('sync_outbox', 'readwrite');
            const store = tx.objectStore('sync_outbox');
            const req = store.clear();
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    }
};
