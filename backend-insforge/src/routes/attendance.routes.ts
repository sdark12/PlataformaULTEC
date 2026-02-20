import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { getAttendance, markAttendance } from '../controllers/attendance.controller';

const router = Router();

router.use(requireAuth);

router.get('/attendance', getAttendance);
router.post('/attendance', markAttendance);

export default router;
