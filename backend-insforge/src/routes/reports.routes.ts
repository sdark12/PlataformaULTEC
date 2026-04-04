import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { getDashboardStats, getFinancialReport, getPendingPaymentsReport, getStudentReports, getStudentDashboardStats, getAdminDashboardExtended } from '../controllers/reports.controller';

const router = Router();

router.use(requireAuth);

router.get('/reports/dashboard', getDashboardStats);
router.get('/reports/student-dashboard', getStudentDashboardStats);
router.get('/reports/admin-dashboard-extended', getAdminDashboardExtended);
router.get('/reports/financial', getFinancialReport);
router.get('/reports/pending-payments', getPendingPaymentsReport);
router.get('/reports/students', getStudentReports);

export default router;
