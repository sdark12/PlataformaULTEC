import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import {
    requestPhysicalCredential,
    getMyCredentialStatus,
    getCredentialRequests,
    updateCredentialRequestStatus,
    getStudentCredentialCard
} from '../controllers/credentials.controller';

const router = Router();

router.use(requireAuth);

// Student & Parent endpoints
router.post('/request', requestPhysicalCredential);
router.get('/my-status', getMyCredentialStatus);
router.get('/my-status/:studentId', getMyCredentialStatus);
router.get('/card-data', getStudentCredentialCard);
router.get('/card-data/:studentId', getStudentCredentialCard);

// Admin & Secretary endpoints
router.get('/requests', getCredentialRequests);
router.put('/requests/:id/status', updateCredentialRequestStatus);

export default router;
