import rateLimit from 'express-rate-limit';

export const loginRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 5, // Limita a 5 solicitudes por IP
    message: {
        message: 'Demasiados intentos de inicio de sesión. Por favor, inténtelo de nuevo después de 15 minutos.'
    },
    standardHeaders: true, 
    legacyHeaders: false, 
});
