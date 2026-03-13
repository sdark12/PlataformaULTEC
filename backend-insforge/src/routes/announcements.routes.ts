import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { getAnnouncements, createAnnouncement, deleteAnnouncement } from '../controllers/announcements.controller';

const router = Router();

router.use(requireAuth);

router.get('/', getAnnouncements);
router.post('/', createAnnouncement);
router.delete('/:id', deleteAnnouncement);

export default router;
