import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { getNotifications, markAsRead, markAllAsRead } from '../controllers/notifications.controller';

const router = Router();

router.use(requireAuth);

router.get('/notifications', getNotifications);
router.put('/notifications/read-all', markAllAsRead);
router.put('/notifications/:id/read', markAsRead);

export default router;
