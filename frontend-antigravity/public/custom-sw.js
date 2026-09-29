/**
 * Plataforma ULTEC - Custom Service Worker Handlers
 * Gestión de eventos Web Push y clicks en notificaciones nativas
 */

self.addEventListener('push', function(event) {
    let data = {};
    if (event.data) {
        try {
            data = event.data.json();
        } catch (e) {
            data = { title: 'Plataforma ULTEC', body: event.data.text() };
        }
    }

    const title = data.title || 'Plataforma ULTEC';
    const options = {
        body: data.body || 'Tienes una nueva notificación institucional.',
        icon: data.icon || '/pwa-192x192.svg',
        badge: data.badge || '/pwa-192x192.svg',
        data: {
            url: data.url || '/'
        },
        vibrate: [200, 100, 200],
        tag: data.tag || 'ultec-notification',
        requireInteraction: false
    };

    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    const targetUrl = event.notification.data?.url || '/';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
            // Si ya hay una ventana abierta de la plataforma, enfocarla
            for (let i = 0; i < clientList.length; i++) {
                const client = clientList[i];
                if ('focus' in client) {
                    return client.focus();
                }
            }
            // Si no hay ventana abierta, abrir una nueva
            if (clients.openWindow) {
                return clients.openWindow(targetUrl);
            }
        })
    );
});
