import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { getTelemetry } from '../controllers/devops.controller';
import { 
    getBackups, 
    getStats, 
    triggerBackup, 
    downloadBackup, 
    removeBackup 
} from '../controllers/backup.controller';

const router = Router();

router.use(requireAuth);

router.get('/telemetry', getTelemetry);

// Disaster Recovery & Backup endpoints (SuperAdmin only)
router.get('/backups', getBackups);
router.get('/backups/stats', getStats);
router.post('/backups/create', triggerBackup);
router.get('/backups/:filename/download', downloadBackup);
router.delete('/backups/:filename', removeBackup);

export default router;
