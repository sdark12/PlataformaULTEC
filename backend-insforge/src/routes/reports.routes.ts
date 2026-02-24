import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { getDashboardStats, getFinancialReport, getPendingPaymentsReport } from '../controllers/reports.controller';

const router = Router();

router.use(requireAuth);

router.get('/reports/dashboard', getDashboardStats);
router.get('/reports/financial', getFinancialReport);
router.get('/reports/pending-payments', getPendingPaymentsReport);

export default router;
