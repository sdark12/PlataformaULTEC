import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { getInvoices, createInvoice, downloadInvoicePdf, verifyInvoicePublic } from '../controllers/invoices.controller';

const router = Router();

// Public verification route (no auth required)
router.get('/invoices/verify/:invoiceNumber', verifyInvoicePublic);

router.use(requireAuth);

router.get('/invoices', getInvoices);
router.post('/invoices', createInvoice);
router.get('/invoices/:id/pdf', downloadInvoicePdf);

export default router;
