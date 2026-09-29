import { Router } from 'express';
import { 
    getGrades, 
    saveGrades, 
    getStudentReportCard, 
    getCourseGradebook,
    requestDocumentAuthorization,
    getDocumentAuthorizationStatus,
    getStudentDocumentAuthorizations,
    getAllDocumentAuthorizations,
    updateDocumentAuthorization,
    getCourseActaAuthorization,
    requestCourseActaAuthorization,
    trackDocumentDownload
} from '../controllers/grades.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.use(requireAuth);

router.get('/grades', getGrades);
router.post('/grades', saveGrades);
router.get('/grades/report/:student_id', getStudentReportCard);
router.get('/grades/course/:course_id', getCourseGradebook);

// Document Authorizations
router.post('/grades/authorization-request', requestDocumentAuthorization);
router.get('/grades/authorization-status/:student_id', getDocumentAuthorizationStatus);
router.get('/grades/student-authorizations/:student_id', getStudentDocumentAuthorizations);
router.get('/grades/authorizations', getAllDocumentAuthorizations);
router.put('/grades/authorizations/:id', updateDocumentAuthorization);
router.post('/grades/authorizations/:id/track-download', trackDocumentDownload);
router.get('/grades/courses/:courseId/auth-status', getCourseActaAuthorization);
router.post('/grades/courses/:courseId/request-auth', requestCourseActaAuthorization);

export default router;
