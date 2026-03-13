import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Lock, Loader2, ArrowRight } from 'lucide-react';
import api from '../../services/apiClient';

const ResetPassword = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    const resetMutation = useMutation({
        mutationFn: async (data: any) => {
            const response = await api.post('/reset-password', data);
            return response.data;
        },
        onSuccess: (data) => {
            setSuccessMessage(data.message || 'Contraseña actualizada correctamente.');
            setError('');
            setTimeout(() => {
                navigate('/login');
            }, 3000);
        },
        onError: (err: any) => {
            console.error('Reset error:', err);
            setError(err.response?.data?.message || 'El enlace es inválido o ha expirado.');
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!token) {
            setError('Falta el token de recuperación en la URL.');
            return;
        }

        if (password.length < 6) {
            setError('La contraseña debe tener al menos 6 caracteres.');
            return;
        }

        if (password !== confirmPassword) {
            setError('Las contraseñas no coinciden.');
            return;
        }

        resetMutation.mutate({ token, newPassword: password });
    };

    if (!token && !successMessage && !error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">Enlace Inválido</h2>
                    <p className="text-slate-500 mb-6">Por favor, utilice el enlace enviado a su correo.</p>
                    <button onClick={() => navigate('/login')} className="bg-brand-blue text-white px-6 py-2 rounded-xl">Ir al Login</button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 overflow-hidden relative transition-colors duration-500">
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
                <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-brand-teal/20 dark:bg-brand-teal/10 blur-[120px] mix-blend-multiply dark:mix-blend-screen animate-pulse-slow"></div>
            </div>

            <div className="w-full max-w-md p-8 relative z-10 mx-4">
                <div className="glass-card shadow-glass dark:shadow-glass-dark border border-white/40 dark:border-slate-700/50 rounded-3xl p-8 md:p-10 transform transition-all hover:shadow-[0_8px_32px_rgba(13,89,242,0.15)] duration-500">
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-to-br from-brand-teal to-brand-blue mb-6 shadow-[0_0_20px_rgba(37,192,244,0.3)]">
                            <Lock className="h-8 w-8 text-white" />
                        </div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                            Crear Nueva Contraseña
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400 text-sm">
                            Ingresa tu nueva contraseña para acceder.
                        </p>
                    </div>

                    {successMessage ? (
                        <div className="text-center animate-in zoom-in">
                            <div className="bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 p-4 rounded-xl mb-6 font-medium">
                                {successMessage}
                            </div>
                            <p className="text-sm text-slate-500 mb-6 flex items-center justify-center gap-2">
                                Redirigiendo al inicio de sesión <Loader2 className="w-4 h-4 animate-spin" />
                            </p>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-5">
                            {error && (
                                <div className="bg-brand-danger/10 border border-brand-danger/30 text-brand-danger px-4 py-3 rounded-xl text-sm font-medium">
                                    {error}
                                </div>
                            )}

                            <div className="space-y-2 relative">
                                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1 block">Nueva Contraseña</label>
                                <div className="relative group">
                                    <Lock className="absolute left-4 top-3.5 h-5 w-5 text-slate-400 group-focus-within:text-brand-blue transition-colors" />
                                    <input
                                        type="password"
                                        required
                                        className="w-full pl-12 pr-4 py-3.5 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-blue/50 text-slate-900 dark:text-white transition-all shadow-inner font-mono tracking-wider"
                                        placeholder="••••••••"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        minLength={6}
                                    />
                                </div>
                            </div>
                            
                            <div className="space-y-2 relative">
                                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1 block">Confirmar Contraseña</label>
                                <div className="relative group">
                                    <Lock className="absolute left-4 top-3.5 h-5 w-5 text-slate-400 group-focus-within:text-brand-blue transition-colors" />
                                    <input
                                        type="password"
                                        required
                                        className="w-full pl-12 pr-4 py-3.5 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-blue/50 text-slate-900 dark:text-white transition-all shadow-inner font-mono tracking-wider"
                                        placeholder="••••••••"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        minLength={6}
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={resetMutation.isPending}
                                className="w-full py-4 bg-brand-blue hover:bg-blue-600 text-white font-bold rounded-xl shadow-[0_0_20px_rgba(13,89,242,0.3)] transform transition-active active:scale-95 disabled:opacity-70 flex justify-center items-center gap-2 mt-2"
                            >
                                {resetMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                                    <>Restablecer y Entrar <ArrowRight className="w-5 h-5" /></>
                                )}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ResetPassword;
