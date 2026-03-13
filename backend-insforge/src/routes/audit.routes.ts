import { Router } from 'express';
import { getAuditLogs } from '../controllers/audit.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.use(requireAuth);

router.get('/', getAuditLogs);

export default router;
