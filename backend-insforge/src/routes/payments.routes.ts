import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { 
    getPayments, 
    createPayment, 
    updatePayment, 
    deletePayment, 
    getStudentStatement, 
    createBulkGroupPayment,
    syncMonthlyFees
} from '../controllers/payments.controller';

const router = Router();

router.use(requireAuth);

router.get('/payments', getPayments);
router.get('/payments/statement/:studentId', getStudentStatement);
router.post('/payments/sync-monthly-fees', syncMonthlyFees);
router.post('/payments/bulk-group', createBulkGroupPayment);
router.post('/payments', createPayment);
router.put('/payments/:id', updatePayment);
router.delete('/payments/:id', deletePayment);

export default router;
