import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { getCourseResources, createCourseResource, deleteCourseResource, getStudentEnrolledCourses } from '../controllers/resources.controller';

const router = Router();

router.use(requireAuth);

router.get('/my-courses', getStudentEnrolledCourses);
router.get('/:courseId', getCourseResources);
router.post('/:courseId', createCourseResource);
router.delete('/resource/:resourceId', deleteCourseResource);

export default router;
