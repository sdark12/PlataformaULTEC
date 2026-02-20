import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { getPayments, createPayment, updatePayment, deletePayment } from '../controllers/payments.controller';

const router = Router();

router.use(requireAuth);

router.get('/payments', getPayments);
router.post('/payments', createPayment);
router.put('/payments/:id', updatePayment);
router.delete('/payments/:id', deletePayment);

export default router;
