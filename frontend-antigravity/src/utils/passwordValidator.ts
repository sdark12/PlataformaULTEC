/**
 * Validador de fortaleza y política de seguridad de contraseñas en frontend
 */

export interface PasswordValidationResult {
    isValid: boolean;
    score: number; // 0 - 100
    label: string;
    color: string;
    textColor: string;
    errors: string[];
    criteria: {
        hasMinLength: boolean;
        hasUpper: boolean;
        hasLower: boolean;
        hasNumber: boolean;
        hasSpecial: boolean;
        notCommon: boolean;
    };
}

const COMMON_PASSWORDS = new Set([
    '123456', '12345678', '123456789', 'password', 'contraseña', 
    'admin123', 'admin1234', 'ultec123', 'ultec2026', 'qwerty123',
    'password123', 'iloveyou', 'secret123', 'welcome1'
]);

export const validatePassword = (password: string, role?: string): PasswordValidationResult => {
    const minLength = (role === 'admin' || role === 'superadmin') ? 10 : 8;
    const errors: string[] = [];

    const hasMinLength = password.length >= minLength;
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[!@#$%^&*()_+\-=\[\]{}|;:,.<>?~`\\/]/.test(password);
    const notCommon = !COMMON_PASSWORDS.has(password.toLowerCase().trim());

    if (!hasMinLength) {
        errors.push(`Mínimo ${minLength} caracteres`);
    }
    if (!hasUpper) {
        errors.push('Al menos una mayúscula (A-Z)');
    }
    if (!hasLower) {
        errors.push('Al menos una minúscula (a-z)');
    }
    if (!hasNumber) {
        errors.push('Al menos un número (0-9)');
    }
    if (!hasSpecial) {
        errors.push('Al menos un símbolo especial (!@#$...)');
    }
    if (!notCommon) {
        errors.push('No uses contraseñas comunes');
    }

    let score = 0;
    if (password.length >= minLength) score += 20;
    if (password.length >= 12) score += 10;
    if (hasUpper) score += 20;
    if (hasLower) score += 15;
    if (hasNumber) score += 20;
    if (hasSpecial) score += 15;
    if (!notCommon) score = Math.min(score, 25);

    score = Math.min(100, Math.max(0, score));

    let label = 'Muy débil';
    let color = 'bg-rose-500';
    let textColor = 'text-rose-500';

    if (score >= 90) {
        label = 'Excelente';
        color = 'bg-emerald-500';
        textColor = 'text-emerald-500';
    } else if (score >= 75) {
        label = 'Fuerte';
        color = 'bg-blue-500';
        textColor = 'text-blue-500';
    } else if (score >= 50) {
        label = 'Aceptable';
        color = 'bg-amber-500';
        textColor = 'text-amber-500';
    } else if (score >= 30) {
        label = 'Débil';
        color = 'bg-orange-500';
        textColor = 'text-orange-500';
    }

    const isValid = errors.length === 0;

    return {
        isValid,
        score,
        label,
        color,
        textColor,
        errors,
        criteria: {
            hasMinLength,
            hasUpper,
            hasLower,
            hasNumber,
            hasSpecial,
            notCommon
        }
    };
};
