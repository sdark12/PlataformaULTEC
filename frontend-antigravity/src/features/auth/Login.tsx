import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { login } from './authService';
import { Lock, Mail, Loader2, Eye, EyeOff, AlertCircle, Clock, ShieldAlert, Wrench, ShieldOff } from 'lucide-react';
import ForgotPasswordModal from './ForgotPasswordModal';

const Login = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const reason = searchParams.get('reason');
    const maintenanceMsg = sessionStorage.getItem('maintenance_message') || 'La plataforma se encuentra en mantenimiento programado. Regresaremos en breve.';

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);

    const loginMutation = useMutation({
        mutationFn: login,
        onSuccess: (data: any) => {
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            navigate('/');
        },
        onError: (err: any) => {
            console.error('Login error:', err);
            setError(err.response?.data?.message || 'Error al iniciar sesión. Verifique sus credenciales.');
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (!email || !password) {
            setError('Por favor complete todos los campos');
            return;
        }
        loginMutation.mutate({ email, password });
    };

    return (
        <div className="min-h-screen min-h-[100dvh] flex flex-col justify-between items-center bg-slate-50 dark:bg-slate-950 px-4 py-6 sm:p-8 relative overflow-hidden transition-colors duration-500">
            {/* Background decorations - Subtle ambient gradient blurs */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
                <div className="absolute -top-24 -left-24 w-72 h-72 sm:w-96 sm:h-96 rounded-full bg-brand-blue/20 dark:bg-brand-blue/10 blur-[90px] mix-blend-multiply dark:mix-blend-screen animate-pulse-slow"></div>
                <div className="absolute -bottom-24 -right-24 w-72 h-72 sm:w-96 sm:h-96 rounded-full bg-brand-purple/20 dark:bg-brand-purple/10 blur-[90px] mix-blend-multiply dark:mix-blend-screen animate-pulse-slow" style={{ animationDelay: '2s' }}></div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-brand-teal/15 dark:bg-brand-teal/5 blur-[100px] pointer-events-none"></div>
            </div>

            {/* Spacer for top balance on mobile */}
            <div className="hidden sm:block"></div>

            {/* Main Login Card */}
            <div className="w-full max-w-sm sm:max-w-md my-auto relative z-10">
                <div className="bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl border border-white/70 dark:border-slate-800 rounded-2xl sm:rounded-3xl p-6 sm:p-8 shadow-xl shadow-slate-200/50 dark:shadow-black/60 transition-all">
                    {/* Header with App Logo */}
                    <div className="text-center mb-6 sm:mb-8">
                        <div className="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-brand-blue to-brand-purple mb-3.5 shadow-lg shadow-brand-blue/30 text-white">
                            <span className="font-black text-2xl sm:text-3xl tracking-tighter">U</span>
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                            Ultra Tecnología
                        </h1>
                        <p className="text-[11px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-1">
                            Plataforma de Gestión
                        </p>
                    </div>

                    {reason === 'idle_timeout' && (
                        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 text-amber-700 dark:text-amber-300 px-3.5 py-2.5 rounded-xl mb-5 text-xs sm:text-sm font-medium flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
                            <Clock className="w-4 h-4 text-amber-500 shrink-0" />
                            <span>Tu sesión se cerró por inactividad prolongada (30 min) para proteger tus datos.</span>
                        </div>
                    )}

                    {reason === 'deactivated' && (
                        <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 px-3.5 py-2.5 rounded-xl mb-5 text-xs sm:text-sm font-medium flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
                            <ShieldAlert className="w-4 h-4 text-rose-500 shrink-0" />
                            <span>Tu cuenta ha sido desactivada o suspendida. Comunícate con la administración.</span>
                        </div>
                    )}

                    {reason === 'session_expired' && (
                        <div className="bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/50 text-indigo-700 dark:text-indigo-300 px-3.5 py-2.5 rounded-xl mb-5 text-xs sm:text-sm font-medium flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
                            <AlertCircle className="w-4 h-4 text-indigo-500 shrink-0" />
                            <span>Tu sesión ha expirado. Por favor ingresa tus credenciales nuevamente.</span>
                        </div>
                    )}

                    {reason === 'maintenance' && (
                        <div className="bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-200 p-4 rounded-2xl mb-5 text-xs sm:text-sm font-semibold flex items-start gap-3 animate-in fade-in slide-in-from-top-1 shadow-sm">
                            <Wrench className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5 animate-bounce" />
                            <div>
                                <span className="font-black block text-amber-900 dark:text-amber-100 mb-0.5">Modo Mantenimiento Activo</span>
                                <span className="opacity-90">{maintenanceMsg}</span>
                            </div>
                        </div>
                    )}

                    {reason === 'portal_disabled' && (
                        <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 p-3.5 rounded-xl mb-5 text-xs sm:text-sm font-medium flex items-center gap-2.5 animate-in fade-in slide-in-from-top-1">
                            <ShieldOff className="w-4 h-4 text-rose-500 shrink-0" />
                            <span>El portal para tu perfil se encuentra temporalmente deshabilitado por la dirección.</span>
                        </div>
                    )}

                    {error && (
                        <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 px-3.5 py-2.5 rounded-xl mb-5 text-xs sm:text-sm font-medium flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0"></span>
                            <span>{error}</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
                        {/* Email Input */}
                        <div>
                            <label className="text-[11px] sm:text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider block mb-1.5">
                                Correo Electrónico
                            </label>
                            <div className="relative group">
                                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-slate-400 group-focus-within:text-brand-blue transition-colors pointer-events-none" />
                                <input
                                    type="email"
                                    required
                                    autoComplete="email"
                                    className="w-full h-11 sm:h-12 pl-10 sm:pl-11 pr-3.5 bg-slate-50/80 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue transition-all"
                                    placeholder="nombre@ejemplo.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Password Input with Show/Hide toggle */}
                        <div>
                            <label className="text-[11px] sm:text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider block mb-1.5">
                                Contraseña
                            </label>
                            <div className="relative group">
                                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-slate-400 group-focus-within:text-brand-blue transition-colors pointer-events-none" />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    required
                                    autoComplete="current-password"
                                    className="w-full h-11 sm:h-12 pl-10 sm:pl-11 pr-11 bg-slate-50/80 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue transition-all"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors focus:outline-none"
                                    tabIndex={-1}
                                    aria-label={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                                >
                                    {showPassword ? (
                                        <EyeOff className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                                    ) : (
                                        <Eye className="h-4 w-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300" />
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Forgot password */}
                        <div className="flex justify-end pt-0.5">
                            <button
                                type="button"
                                onClick={() => setIsForgotModalOpen(true)}
                                className="text-xs font-semibold text-brand-blue hover:text-blue-700 dark:text-brand-teal dark:hover:text-teal-300 transition-colors"
                            >
                                ¿Olvidaste tu contraseña?
                            </button>
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={loginMutation.isPending}
                            className="w-full h-11 sm:h-12 bg-gradient-to-r from-brand-blue to-brand-teal hover:from-blue-600 hover:to-teal-500 text-white font-bold rounded-xl shadow-lg shadow-brand-blue/25 hover:shadow-brand-blue/40 active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-sm sm:text-base mt-2 disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
                        >
                            {loginMutation.isPending ? (
                                <>
                                    <Loader2 className="animate-spin h-4 w-4" />
                                    <span>Iniciando sesión...</span>
                                </>
                            ) : (
                                <span>Iniciar Sesión</span>
                            )}
                        </button>
                    </form>

                    <ForgotPasswordModal 
                        isOpen={isForgotModalOpen} 
                        onClose={() => setIsForgotModalOpen(false)} 
                    />
                </div>
            </div>

            {/* Footer */}
            <footer className="w-full text-center py-3 relative z-10 text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                © 2026 Ultra Tecnología. Todos los derechos reservados.
            </footer>
        </div>
    );
};

export default Login;

