import { Router } from 'express';
import { login, adminResetPassword } from '../controllers/auth.controller';

const router = Router();

router.post('/login', login);
router.post('/admin-reset-password', adminResetPassword);

export default router;
