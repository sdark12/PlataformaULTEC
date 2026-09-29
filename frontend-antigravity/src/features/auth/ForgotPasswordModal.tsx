import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { X, Mail, Loader2, CheckCircle2 } from 'lucide-react';
import api from '../../services/apiClient';

interface ForgotPasswordModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const ForgotPasswordModal = ({ isOpen, onClose }: ForgotPasswordModalProps) => {
    const [email, setEmail] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [errorMsg, setErrorMsg] = useState('');

    const resetMutation = useMutation({
        mutationFn: async (userEmail: string) => {
            const response = await api.post('/forgot-password', { email: userEmail });
            return response.data;
        },
        onSuccess: (data) => {
            setSuccessMessage(data.message || 'Instrucciones enviadas. Revisa tu bandeja de entrada.');
            setErrorMsg('');
        },
        onError: (err: any) => {
            setErrorMsg(err.response?.data?.message || 'Error al procesar la solicitud.');
            setSuccessMessage('');
        }
    });

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg('');
        setSuccessMessage('');
        
        if (!email) {
            setErrorMsg('El correo electrónico es requerido.');
            return;
        }

        resetMutation.mutate(email);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-sm sm:max-w-md overflow-hidden border border-slate-200 dark:border-slate-800 animate-in zoom-in-95">
                <div className="bg-gradient-to-r from-brand-blue to-brand-purple p-5 sm:p-6 flex justify-between items-center relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl transform translate-x-1/2 -translate-y-1/2 pointer-events-none"></div>
                    <h2 className="text-lg sm:text-xl font-bold text-white relative z-10 flex items-center gap-2">
                        Recuperar Contraseña
                    </h2>
                    <button onClick={onClose} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors relative z-10 text-white" aria-label="Cerrar">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-5 sm:p-6">
                    {successMessage ? (
                        <div className="text-center py-4 sm:py-6 animate-in slide-in-from-bottom-4">
                            <div className="mx-auto w-14 h-14 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-3">
                                <CheckCircle2 className="w-7 h-7 text-green-600 dark:text-green-400" />
                            </div>
                            <h3 className="text-base sm:text-lg font-bold text-slate-800 dark:text-white mb-1.5">¡Correo Enviado!</h3>
                            <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm">{successMessage}</p>
                            <button
                                onClick={onClose}
                                className="mt-6 px-6 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-medium transition-colors w-full text-sm"
                            >
                                Entendido
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mb-4">
                                Ingresa el correo electrónico asociado a tu cuenta y te enviaremos las instrucciones de restablecimiento.
                            </p>

                            {errorMsg && (
                                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 text-xs sm:text-sm rounded-xl font-medium">
                                    {errorMsg}
                                </div>
                            )}

                            <div>
                                <label className="text-[11px] sm:text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider block mb-1.5">Correo Electrónico</label>
                                <div className="relative group">
                                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-slate-400 group-focus-within:text-brand-blue transition-colors pointer-events-none" />
                                    <input
                                        type="email"
                                        required
                                        className="w-full h-11 sm:h-12 pl-10 sm:pl-11 pr-3.5 bg-slate-50/80 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue transition-all"
                                        placeholder="usuario@ejemplo.com"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="px-5 py-2.5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl font-medium transition-colors flex-1"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={resetMutation.isPending}
                                    className="px-5 py-2.5 bg-brand-blue text-white rounded-xl font-medium shadow-md shadow-brand-blue/20 hover:bg-blue-600 transition-colors flex-1 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                                >
                                    {resetMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Enviar Enlace'}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ForgotPasswordModal;
