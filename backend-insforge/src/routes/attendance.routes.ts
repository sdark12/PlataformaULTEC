import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { 
    getAttendance, 
    markAttendance, 
    getStudentAttendanceHistory,
    getAttendanceMatrix,
    createJustification,
    getJustifications,
    reviewJustification
} from '../controllers/attendance.controller';

const router = Router();

router.use(requireAuth);

// Daily attendance
router.get('/attendance', getAttendance);
router.post('/attendance', markAttendance);

// Monthly attendance matrix / sábana
router.get('/attendance/matrix', getAttendanceMatrix);

// Justifications module
router.get('/attendance/justifications', getJustifications);
router.post('/attendance/justifications', createJustification);
router.patch('/attendance/justifications/:id/review', reviewJustification);

// Personal student attendance
router.get('/my-attendance', getStudentAttendanceHistory);

export default router;
