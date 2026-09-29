import { Router } from 'express';
import { login, adminResetPassword, forgotPassword, resetPassword, changePassword, getMe } from '../controllers/auth.controller';
import { validateSchema } from '../middleware/validateSchema';
import { loginSchema, adminResetPasswordSchema, changePasswordSchema } from '../schemas/auth.schema';
import { loginRateLimiter } from '../middleware/rateLimiter';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.get('/me', requireAuth, getMe);
router.post('/login', loginRateLimiter, validateSchema(loginSchema), login);
router.post('/admin-reset-password', requireAuth, validateSchema(adminResetPasswordSchema), adminResetPassword);
router.post('/change-password', requireAuth, validateSchema(changePasswordSchema), changePassword);

router.post('/forgot-password', loginRateLimiter, forgotPassword);
router.post('/reset-password', resetPassword);

export default router;

