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

export const apiRateLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minuto
    max: 300, // 300 peticiones por minuto por IP para acomodar cargas iniciales
    message: {
        message: 'Demasiadas solicitudes. Inténtelo de nuevo en un momento.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

