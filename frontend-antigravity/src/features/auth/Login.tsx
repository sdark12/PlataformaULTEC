import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { login } from './authService';
import { Lock, Mail, Loader2 } from 'lucide-react';

const Login = () => {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

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
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 overflow-hidden relative transition-colors duration-500">
            {/* Background decorations - Animated Gradient */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-brand-blue/20 dark:bg-brand-blue/10 blur-[120px] mix-blend-multiply dark:mix-blend-screen animate-pulse-slow"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-brand-purple/20 dark:bg-brand-purple/10 blur-[120px] mix-blend-multiply dark:mix-blend-screen animate-pulse-slow" style={{ animationDelay: '2s' }}></div>
                <div className="absolute top-[20%] right-[20%] w-[30%] h-[30%] rounded-full bg-brand-teal/20 dark:bg-brand-teal/10 blur-[120px] mix-blend-multiply dark:mix-blend-screen animate-pulse-slow" style={{ animationDelay: '4s' }}></div>
            </div>

            <div className="w-full max-w-md p-8 relative z-10 mx-4">
                <div className="glass-card shadow-glass dark:shadow-glass-dark border border-white/40 dark:border-slate-700/50 rounded-3xl p-8 md:p-10 transform transition-all hover:shadow-[0_8px_32px_rgba(13,89,242,0.15)] duration-500 animate-in spin-in-2 zoom-in-95">
                    <div className="text-center mb-10">
                        <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-to-br from-brand-blue to-brand-purple mb-6 shadow-[0_0_20px_rgba(13,89,242,0.3)]">
                            <Lock className="h-8 w-8 text-white" />
                        </div>
                        <h1 className="text-3xl font-black bg-gradient-to-r from-slate-900 to-brand-blue dark:from-white dark:to-blue-400 bg-clip-text text-transparent mb-2 tracking-tight">
                            Ultra Tecnología
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400 text-sm font-bold tracking-widest uppercase">
                            Plataforma de Gestión
                        </p>
                    </div>

                    {error && (
                        <div className="bg-brand-danger/10 border border-brand-danger/30 text-brand-danger px-4 py-3 rounded-xl mb-6 text-sm flex items-start animate-in fade-in slide-in-from-top-2">
                            <span className="block font-medium">{error}</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2 relative">
                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1 block">Correo Electrónico</label>
                            <div className="relative group">
                                <Mail className="absolute left-4 top-3.5 h-5 w-5 text-slate-400 group-focus-within:text-brand-blue transition-colors" />
                                <input
                                    type="email"
                                    required
                                    className="w-full pl-12 pr-4 py-3.5 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-4 focus:ring-brand-blue/20 focus:border-brand-blue text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 transition-all shadow-inner"
                                    placeholder="nombre@ejemplo.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="space-y-2 relative">
                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1 block">Contraseña</label>
                            <div className="relative group">
                                <Lock className="absolute left-4 top-3.5 h-5 w-5 text-slate-400 group-focus-within:text-brand-blue transition-colors" />
                                <input
                                    type="password"
                                    required
                                    className="w-full pl-12 pr-4 py-3.5 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-4 focus:ring-brand-blue/20 focus:border-brand-blue text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 transition-all shadow-inner font-mono text-lg tracking-wider"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loginMutation.isPending}
                            className="w-full py-4 px-4 bg-gradient-to-r from-brand-blue to-brand-teal hover:from-blue-600 hover:to-teal-500 text-white font-bold rounded-xl shadow-[0_0_20px_rgba(13,89,242,0.3)] transform transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center mt-4 border border-white/10"
                        >
                            {loginMutation.isPending ? (
                                <Loader2 className="animate-spin h-5 w-5" />
                            ) : (
                                <span className="tracking-wide">INGRESAR A LA PLATAFORMA</span>
                            )}
                        </button>
                    </form>

                    <div className="mt-10 text-center">
                        <p className="text-xs font-medium text-slate-400 dark:text-slate-500">
                            © 2026 Ultra Tecnología. Todos los derechos reservados.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;
