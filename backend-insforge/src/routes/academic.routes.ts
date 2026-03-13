import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { getCourses, createCourse, updateCourse, deleteCourse, getCourseSchedules, createCourseSchedule, deleteCourseSchedule } from '../controllers/courses.controller';
import { getStudents, createStudent, updateStudent, deleteStudent } from '../controllers/students.controller';
import { enrollStudent, getEnrollments, updateEnrollment, deleteEnrollment } from '../controllers/enrollments.controller';
import { validateSchema } from '../middleware/validateSchema';
import { createCourseSchema, updateCourseSchema, createCourseScheduleSchema, createStudentSchema, updateStudentSchema } from '../schemas/academic.schema';

const router = Router();

router.use(requireAuth);

router.get('/courses', getCourses);
router.post('/courses', validateSchema(createCourseSchema), createCourse);
router.put('/courses/:id', validateSchema(updateCourseSchema), updateCourse);
router.delete('/courses/:id', deleteCourse);

router.get('/courses/:id/schedules', getCourseSchedules);
router.post('/courses/:id/schedules', validateSchema(createCourseScheduleSchema), createCourseSchedule);
router.delete('/courses/schedules/:scheduleId', deleteCourseSchedule);

router.get('/students', getStudents);
router.post('/students', validateSchema(createStudentSchema), createStudent);
router.put('/students/:id', validateSchema(updateStudentSchema), updateStudent);
router.delete('/students/:id', deleteStudent);

router.get('/enrollments', getEnrollments);
router.post('/enrollments', enrollStudent);
router.put('/enrollments/:id', updateEnrollment);
router.delete('/enrollments/:id', deleteEnrollment);

export default router;
