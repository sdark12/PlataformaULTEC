import api from './apiClient';

function urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
        .replace(/-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

export const pushNotificationService = {
    // 1. Verifica si el navegador o WebView actual soporta Web Push
    isSupported: (): boolean => {
        return (
            typeof window !== 'undefined' &&
            'serviceWorker' in navigator &&
            'PushManager' in window &&
            'Notification' in window
        );
    },

    // 2. Obtiene el estado actual del permiso en el dispositivo ('granted' | 'denied' | 'default')
    getPermissionState: (): NotificationPermission | 'unsupported' => {
        if (!pushNotificationService.isSupported()) return 'unsupported';
        return Notification.permission;
    },

    // 3. Verifica si el dispositivo ya cuenta con una suscripción activa
    isSubscribed: async (): Promise<boolean> => {
        if (!pushNotificationService.isSupported()) return false;
        try {
            const reg = await navigator.serviceWorker.ready;
            const sub = await reg.pushManager.getSubscription();
            return !!sub;
        } catch {
            return false;
        }
    },

    // 4. Solicita permiso y registra la suscripción con la llave VAPID del servidor
    subscribe: async (): Promise<{ success: boolean; message: string }> => {
        if (!pushNotificationService.isSupported()) {
            return { success: false, message: 'Este navegador o dispositivo no soporta notificaciones push.' };
        }

        try {
            // Solicitar permiso nativo al usuario
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
                return { success: false, message: 'Permiso de notificaciones denegado en el dispositivo.' };
            }

            // Obtener la llave pública VAPID oficial desde el backend
            const { data: keyData } = await api.get('/notifications/vapid-public-key');
            if (!keyData?.publicKey) {
                throw new Error('No se pudo obtener la llave pública VAPID del servidor.');
            }

            const convertedKey = urlBase64ToUint8Array(keyData.publicKey);
            const registration = await navigator.serviceWorker.ready;

            // Obtener suscripción existente o crear una nueva
            let subscription = await registration.pushManager.getSubscription();
            if (!subscription) {
                subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: convertedKey
                });
            }

            const subJson = subscription.toJSON();

            // Enviar la suscripción al backend
            await api.post('/notifications/subscribe', {
                endpoint: subJson.endpoint,
                keys: subJson.keys,
                userAgent: navigator.userAgent
            });

            return { success: true, message: 'Dispositivo suscrito exitosamente a notificaciones en tiempo real.' };

        } catch (error: any) {
            console.error('Error al suscribir a push notifications:', error);
            return {
                success: false,
                message: error?.response?.data?.message || error.message || 'Error al configurar notificaciones push.'
            };
        }
    },

    // 5. Cancelar la suscripción de este dispositivo
    unsubscribe: async (): Promise<{ success: boolean; message: string }> => {
        if (!pushNotificationService.isSupported()) return { success: true, message: 'No soportado' };

        try {
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.getSubscription();

            if (subscription) {
                // Notificar al backend para depurar la BD
                try {
                    await api.post('/notifications/unsubscribe', { endpoint: subscription.endpoint });
                } catch (e) {
                    console.warn('Error al informar desuscripción al backend:', e);
                }
                // Desuscribir del PushManager del navegador
                await subscription.unsubscribe();
            }

            return { success: true, message: 'Notificaciones desactivadas para este dispositivo.' };
        } catch (error: any) {
            console.error('Error al desuscribir de notificaciones:', error);
            return { success: false, message: error.message || 'Error al desactivar notificaciones.' };
        }
    },

    // 6. Enviar notificación push de prueba para verificar sonido, vibración y visualización
    sendTestPush: async (): Promise<{ success: boolean; message: string; count?: number }> => {
        try {
            const response = await api.post('/notifications/test-push');
            return {
                success: true,
                message: response.data.message,
                count: response.data.deliveredCount
            };
        } catch (error: any) {
            return {
                success: false,
                message: error?.response?.data?.message || 'Error al solicitar notificación de prueba.'
            };
        }
    },

    // 7. Enviar alerta masiva (SuperAdmin / Admin)
    broadcastPush: async (payload: { title: string; body: string; url?: string; branch_id?: string }): Promise<{ success: boolean; message: string; count?: number }> => {
        try {
            const response = await api.post('/notifications/broadcast-push', payload);
            return {
                success: true,
                message: response.data.message,
                count: response.data.deliveredCount
            };
        } catch (error: any) {
            return {
                success: false,
                message: error?.response?.data?.message || 'Error al emitir alerta masiva.'
            };
        }
    }
};
