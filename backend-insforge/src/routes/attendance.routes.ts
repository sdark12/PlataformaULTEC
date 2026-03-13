import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { getAttendance, markAttendance, getStudentAttendanceHistory } from '../controllers/attendance.controller';

const router = Router();

router.use(requireAuth);

router.get('/attendance', getAttendance);
router.post('/attendance', markAttendance);
router.get('/my-attendance', getStudentAttendanceHistory);

export default router;
