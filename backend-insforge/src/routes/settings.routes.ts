import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import upload from '../middleware/upload.middleware';
import {
    getSettings,
    updateSettings,
    getSettingsAuditHistory,
    uploadBrandingAsset,
    getSmtpStatus,
    testEmailDiagnostic
} from '../controllers/settings.controller';

const router = Router();

router.use(requireAuth);

router.get('/audit-history', getSettingsAuditHistory);
router.get('/smtp-status', getSmtpStatus);
router.post('/test-email', testEmailDiagnostic);
router.post('/upload-branding', upload.single('file'), uploadBrandingAsset);
router.get('/', getSettings);
router.put('/', updateSettings);

export default router;

