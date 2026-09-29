import { Router } from 'express';
import { getAuditLogs, getAuditStats } from '../controllers/audit.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.use(requireAuth);

router.get('/stats', getAuditStats);
router.get('/', getAuditLogs);

export default router;
