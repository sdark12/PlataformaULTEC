import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { getCourses, createCourse, updateCourse, deleteCourse } from '../controllers/courses.controller';
import { getStudents, createStudent, updateStudent, deleteStudent } from '../controllers/students.controller';
import { enrollStudent, getEnrollments, updateEnrollment, deleteEnrollment } from '../controllers/enrollments.controller';

const router = Router();

router.use(requireAuth);

router.get('/courses', getCourses);
router.post('/courses', createCourse);
router.put('/courses/:id', updateCourse);
router.delete('/courses/:id', deleteCourse);

router.get('/students', getStudents);
router.post('/students', createStudent);
router.put('/students/:id', updateStudent);
router.delete('/students/:id', deleteStudent);

router.get('/enrollments', getEnrollments);
router.post('/enrollments', enrollStudent);
router.put('/enrollments/:id', updateEnrollment);
router.delete('/enrollments/:id', deleteEnrollment);

export default router;
