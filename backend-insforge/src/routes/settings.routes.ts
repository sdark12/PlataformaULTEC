import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { getSettings, updateSettings } from '../controllers/settings.controller';

const router = Router();

router.use(requireAuth);

router.get('/', getSettings);
router.put('/', updateSettings);

export default router;
