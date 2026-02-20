import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { getInvoices, createInvoice, downloadInvoicePdf } from '../controllers/invoices.controller';

const router = Router();

router.use(requireAuth);

router.get('/invoices', getInvoices);
router.post('/invoices', createInvoice);
router.get('/invoices/:id/pdf', downloadInvoicePdf);

export default router;
