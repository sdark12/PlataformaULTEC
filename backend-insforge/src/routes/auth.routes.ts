import { Router } from 'express';
import { login, adminResetPassword, forgotPassword, resetPassword } from '../controllers/auth.controller';
import { validateSchema } from '../middleware/validateSchema';
import { loginSchema, adminResetPasswordSchema } from '../schemas/auth.schema';
import { loginRateLimiter } from '../middleware/rateLimiter';

const router = Router();

router.post('/login', loginRateLimiter, validateSchema(loginSchema), login);
router.post('/admin-reset-password', validateSchema(adminResetPasswordSchema), adminResetPassword);

router.post('/forgot-password', loginRateLimiter, forgotPassword);
router.post('/reset-password', resetPassword);

export default router;
