import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import upload from '../middleware/upload.middleware';
import { 
    getAllResources,
    getResourcesSummary,
    getCourseResources, 
    uploadResourceFile,
    createCourseResource, 
    updateCourseResource,
    deleteCourseResource, 
    getStudentEnrolledCourses, 
    getStudentSchedule 
} from '../controllers/resources.controller';

const router = Router();

router.use(requireAuth);

router.get('/', getAllResources);
router.get('/summary/counts', getResourcesSummary);
router.get('/my-courses', getStudentEnrolledCourses);
router.get('/my-schedule', getStudentSchedule);

// File upload
router.post('/upload', (req, res, next) => {
    upload.single('file')(req, res, (err) => {
        if (err) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ message: 'El archivo supera el tamaño máximo permitido de 15 MB.' });
            }
            return res.status(400).json({ message: err.message || 'Error al procesar el archivo.' });
        }
        next();
    });
}, uploadResourceFile);

// Resource item update & delete
router.put('/resource/:resourceId', updateCourseResource);
router.delete('/resource/:resourceId', deleteCourseResource);

// Course-specific routes
router.get('/:courseId', getCourseResources);
router.post('/:courseId', createCourseResource);

export default router;
