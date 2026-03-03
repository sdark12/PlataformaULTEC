import { Router } from 'express';
import { assignmentsController } from '../controllers/assignments.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

// Add authentication middleware
router.use(requireAuth);

// --- Instructor/Admin Routes ---
router.post(
    '/',
    assignmentsController.createAssignment
);

router.get(
    '/course/:courseId',
    assignmentsController.getCourseAssignments
);

router.get(
    '/course/:courseId/report',
    assignmentsController.getCourseAssignmentReport
);

router.get(
    '/:assignmentId/submissions',
    assignmentsController.getAssignmentSubmissions
);

router.put(
    '/submission/:submissionId/grade',
    assignmentsController.gradeSubmission
);

// --- Student Routes ---
router.get(
    '/student/:studentId',
    assignmentsController.getStudentAssignments
);

import upload from '../middleware/upload.middleware';

router.post(
    '/submit',
    assignmentsController.submitAssignment
);

// Route for file uploads
router.post(
    '/upload',
    upload.single('file'),
    (req, res) => {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }
        // Return the static URL path of the file
        const fileUrl = `/uploads/${req.file.filename}`;
        res.status(200).json({ fileUrl });
    }
);

export default router;
