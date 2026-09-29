import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { getTelemetry } from '../controllers/devops.controller';

const router = Router();

router.use(requireAuth);

router.get('/telemetry', getTelemetry);

export default router;
