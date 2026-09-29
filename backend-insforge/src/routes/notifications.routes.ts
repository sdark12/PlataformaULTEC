import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { getNotifications, markAsRead, markAllAsRead } from '../controllers/notifications.controller';
import { 
    getVapidPublicKey, 
    subscribePushDevice, 
    unsubscribePushDevice, 
    sendTestPush, 
    broadcastPushAlert 
} from '../controllers/pushNotification.controller';

const router = Router();

router.use(requireAuth);

router.get('/notifications', getNotifications);
router.put('/notifications/read-all', markAllAsRead);
router.put('/notifications/:id/read', markAsRead);

// Web Push Notifications
router.get('/notifications/vapid-public-key', getVapidPublicKey);
router.post('/notifications/subscribe', subscribePushDevice);
router.post('/notifications/unsubscribe', unsubscribePushDevice);
router.post('/notifications/test-push', sendTestPush);
router.post('/notifications/broadcast-push', broadcastPushAlert);

export default router;
