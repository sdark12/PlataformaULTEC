import React from 'react';
import { validatePassword } from '../../utils/passwordValidator';
import { Check, X, ShieldAlert, ShieldCheck } from 'lucide-react';

interface PasswordStrengthMeterProps {
    password: string;
    role?: string;
    showCriteria?: boolean;
    className?: string;
}

export const PasswordStrengthMeter: React.FC<PasswordStrengthMeterProps> = ({
    password,
    role,
    showCriteria = true,
    className = ''
}) => {
    if (!password) {
        return null;
    }

    const result = validatePassword(password, role);
    const minLength = (role === 'admin' || role === 'superadmin') ? 10 : 8;

    // Segment calculation (1 to 4)
    const activeSegments = result.score >= 90 ? 4 : result.score >= 70 ? 3 : result.score >= 45 ? 2 : 1;

    const getSegmentColor = (segmentIndex: number) => {
        if (segmentIndex > activeSegments) {
            return 'bg-slate-200 dark:bg-slate-700';
        }
        if (activeSegments === 4) return 'bg-emerald-500';
        if (activeSegments === 3) return 'bg-blue-500';
        if (activeSegments === 2) return 'bg-amber-500';
        return 'bg-rose-500';
    };

    return (
        <div className={`mt-2.5 space-y-2 animate-in fade-in duration-300 ${className}`}>
            {/* Header with Label and Meter */}
            <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    {result.isValid ? (
                        <ShieldCheck className="w-4 h-4 text-emerald-500" />
                    ) : (
                        <ShieldAlert className="w-4 h-4 text-amber-500" />
                    )}
                    Seguridad de la contraseña:
                </span>
                <span className={`font-bold ${result.textColor}`}>
                    {result.label} ({result.score}%)
                </span>
            </div>

            {/* 4 Segmented Progress Bar */}
            <div className="grid grid-cols-4 gap-1.5 h-1.5">
                {[1, 2, 3, 4].map((seg) => (
                    <div
                        key={seg}
                        className={`rounded-full transition-all duration-300 ${getSegmentColor(seg)}`}
                    />
                ))}
            </div>

            {/* Criteria Checklist */}
            {showCriteria && (
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/70 dark:border-slate-700/60 grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px]">
                    <div className="flex items-center gap-1.5">
                        {result.criteria.hasMinLength ? (
                            <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        ) : (
                            <X className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        )}
                        <span className={result.criteria.hasMinLength ? 'text-slate-700 dark:text-slate-200 font-medium' : 'text-slate-400'}>
                            Mínimo {minLength} caracteres
                        </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                        {result.criteria.hasUpper ? (
                            <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        ) : (
                            <X className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        )}
                        <span className={result.criteria.hasUpper ? 'text-slate-700 dark:text-slate-200 font-medium' : 'text-slate-400'}>
                            Una mayúscula (A-Z)
                        </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                        {result.criteria.hasLower ? (
                            <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        ) : (
                            <X className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        )}
                        <span className={result.criteria.hasLower ? 'text-slate-700 dark:text-slate-200 font-medium' : 'text-slate-400'}>
                            Una minúscula (a-z)
                        </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                        {result.criteria.hasNumber ? (
                            <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        ) : (
                            <X className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        )}
                        <span className={result.criteria.hasNumber ? 'text-slate-700 dark:text-slate-200 font-medium' : 'text-slate-400'}>
                            Un número (0-9)
                        </span>
                    </div>

                    <div className="flex items-center gap-1.5 sm:col-span-2">
                        {result.criteria.hasSpecial ? (
                            <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        ) : (
                            <X className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        )}
                        <span className={result.criteria.hasSpecial ? 'text-slate-700 dark:text-slate-200 font-medium' : 'text-slate-400'}>
                            Un símbolo especial (!@#$%^&*...)
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PasswordStrengthMeter;
