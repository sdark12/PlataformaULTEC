import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { getDashboardStats, getFinancialReport } from '../controllers/reports.controller';

const router = Router();

router.use(requireAuth);

router.get('/reports/dashboard', getDashboardStats);
router.get('/reports/financial', getFinancialReport);

export default router;
