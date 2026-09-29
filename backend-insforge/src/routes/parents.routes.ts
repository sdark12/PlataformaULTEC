import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import {
    getParentLinks,
    createParentLink,
    syncParentLinks,
    deleteParentLink,
    getMyStudents,
    getChildDashboard,
    getChildPayments,
    getChildGrades,
    getChildAssignments,
    getChildDiscipline
} from '../controllers/parents.controller';

const router = Router();

router.use(requireAuth);

// Admin endpoints
router.get('/links', getParentLinks);
router.post('/links', createParentLink);
router.post('/sync-links', syncParentLinks);
router.delete('/links/:id', deleteParentLink);

// Parent endpoints
router.get('/my-students', getMyStudents);
router.get('/child/:studentId/dashboard', getChildDashboard);
router.get('/child/:studentId/payments', getChildPayments);
router.get('/child/:studentId/grades', getChildGrades);
router.get('/child/:studentId/assignments', getChildAssignments);
router.get('/child/:studentId/discipline', getChildDiscipline);

export default router;

