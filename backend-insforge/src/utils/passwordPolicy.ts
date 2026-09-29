/**
 * Utilidad de validación y política de seguridad de contraseñas
 * Sigue los estándares modernos de NIST SP 800-63B y OWASP
 */

export interface PasswordPolicyResult {
    isValid: boolean;
    score: number; // 0 a 100
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

export const validatePasswordPolicy = (password: string, role?: string): PasswordPolicyResult => {
    const minLength = (role === 'admin' || role === 'superadmin') ? 10 : 8;
    const errors: string[] = [];

    const hasMinLength = password.length >= minLength;
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[!@#$%^&*()_+\-=\[\]{}|;:,.<>?~`\\/]/.test(password);
    const notCommon = !COMMON_PASSWORDS.has(password.toLowerCase().trim());

    if (!hasMinLength) {
        errors.push(`Debe tener al menos ${minLength} caracteres.`);
    }
    if (!hasUpper) {
        errors.push('Debe incluir al menos una letra mayúscula (A-Z).');
    }
    if (!hasLower) {
        errors.push('Debe incluir al menos una letra minúscula (a-z).');
    }
    if (!hasNumber) {
        errors.push('Debe incluir al menos un número (0-9).');
    }
    if (!hasSpecial) {
        errors.push('Debe incluir al menos un carácter especial o símbolo (!@#$%^&*...).');
    }
    if (!notCommon) {
        errors.push('La contraseña es demasiado predecible o común.');
    }

    let score = 0;
    if (password.length >= minLength) score += 20;
    if (password.length >= 12) score += 10;
    if (hasUpper) score += 20;
    if (hasLower) score += 15;
    if (hasNumber) score += 20;
    if (hasSpecial) score += 15;
    if (!notCommon) score = Math.min(score, 30);

    const isValid = errors.length === 0;

    return {
        isValid,
        score: Math.min(100, Math.max(0, score)),
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
