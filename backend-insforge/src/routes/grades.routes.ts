import { Router } from 'express';
import { getGrades, saveGrades, getStudentReportCard, getCourseGradebook } from '../controllers/grades.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.use(requireAuth);

router.get('/grades', getGrades);
router.post('/grades', saveGrades);
router.get('/grades/report/:student_id', getStudentReportCard);
router.get('/grades/course/:course_id', getCourseGradebook);

export default router;
