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
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-800 animate-in zoom-in-95">
                <div className="bg-gradient-to-r from-brand-blue to-brand-purple p-6 flex justify-between items-center relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl transform translate-x-1/2 -translate-y-1/2"></div>
                    <h2 className="text-xl font-bold text-white relative z-10 flex items-center gap-2">
                        Recuperar Contraseña
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-colors relative z-10 text-white">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6">
                    {successMessage ? (
                        <div className="text-center py-6 animate-in slide-in-from-bottom-4">
                            <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
                                <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">¡Correo Enviado!</h3>
                            <p className="text-slate-500 dark:text-slate-400 text-sm">{successMessage}</p>
                            <button
                                onClick={onClose}
                                className="mt-8 px-6 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-medium transition-colors w-full"
                            >
                                Entendido
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                                Ingresa el correo electrónico asociado a tu cuenta y te enviaremos un enlace para restablecer tu contraseña.
                            </p>

                            {errorMsg && (
                                <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-xl border border-red-100 dark:border-red-900/50">
                                    {errorMsg}
                                </div>
                            )}

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1 block">Correo Electrónico</label>
                                <div className="relative group">
                                    <Mail className="absolute left-4 top-3.5 h-5 w-5 text-slate-400 group-focus-within:text-brand-blue transition-colors" />
                                    <input
                                        type="email"
                                        required
                                        className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-blue/50 text-slate-900 dark:text-white transition-all shadow-inner"
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
