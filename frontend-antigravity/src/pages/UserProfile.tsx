import React, { useState, useEffect } from 'react';
import { 
    User, Mail, Phone, KeyRound, Save, Loader2, 
    CheckCircle2, AlertCircle, Building2, Sparkles, Lock
} from 'lucide-react';
import { updateUser, resetUserPassword, getUserById } from '../features/users/userService';

const UserProfile: React.FC = () => {
    let storedUser: any = null;
    try {
        const u = localStorage.getItem('user');
        storedUser = u ? JSON.parse(u) : null;
    } catch (e) { /* ignore */ }

    const [fullName, setFullName] = useState(storedUser?.full_name || '');
    const [email, setEmail] = useState(storedUser?.email || '');
    const [phone, setPhone] = useState(storedUser?.phone || '');
    const [role, setRole] = useState(storedUser?.role || 'student');
    const [studentCode, setStudentCode] = useState(storedUser?.personal_code || '');

    // Password fields
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    // Loading & feedback states
    const [isSavingProfile, setIsSavingProfile] = useState(false);
    const [isChangingPassword, setIsChangingPassword] = useState(false);
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    // Fetch fresh profile data on mount
    useEffect(() => {
        if (!storedUser?.id) return;

        const fetchUserData = async () => {
            try {
                const data = await getUserById(storedUser.id);
                if (data) {
                    setFullName(data.full_name || storedUser.full_name || '');
                    setEmail(data.email || storedUser.email || '');
                    setPhone(data.phone || '');
                    setRole(data.role || storedUser.role || 'student');
                    if (data.personal_code) setStudentCode(data.personal_code);
                }
            } catch (err) {
                console.error('Error fetching user profile:', err);
            }
        };

        fetchUserData();
    }, [storedUser?.id]);

    const showFeedback = (type: 'success' | 'error', message: string) => {
        setFeedback({ type, message });
        setTimeout(() => setFeedback(null), 4000);
    };

    const handleSaveProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!storedUser?.id) return;

        if (!fullName.trim()) {
            showFeedback('error', 'El nombre completo no puede estar vacío.');
            return;
        }

        setIsSavingProfile(true);
        try {
            await updateUser(storedUser.id, {
                full_name: fullName.trim(),
                phone: phone.trim(),
                email: storedUser.email
            });

            // Update localStorage so topbar and other components sync
            const updatedUser = {
                ...storedUser,
                full_name: fullName.trim(),
                phone: phone.trim()
            };
            localStorage.setItem('user', JSON.stringify(updatedUser));

            showFeedback('success', 'Tus datos han sido actualizados correctamente.');
        } catch (err: any) {
            console.error('Error updating profile:', err);
            showFeedback('error', err.response?.data?.message || 'Error al guardar los cambios del perfil.');
        } finally {
            setIsSavingProfile(false);
        }
    };

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!storedUser?.id) return;

        if (!newPassword || newPassword.length < 6) {
            showFeedback('error', 'La nueva contraseña debe tener al menos 6 caracteres.');
            return;
        }

        if (newPassword !== confirmPassword) {
            showFeedback('error', 'Las contraseñas no coinciden. Por favor verifica.');
            return;
        }

        setIsChangingPassword(true);
        try {
            await resetUserPassword({
                userId: storedUser.id,
                newPassword: newPassword
            });

            setNewPassword('');
            setConfirmPassword('');
            showFeedback('success', '¡Tu contraseña ha sido cambiada con éxito!');
        } catch (err: any) {
            console.error('Error changing password:', err);
            showFeedback('error', err.response?.data?.message || 'Error al actualizar la contraseña.');
        } finally {
            setIsChangingPassword(false);
        }
    };

    const roleBadges: Record<string, { label: string; color: string }> = {
        superadmin: { label: 'Super Administrador', color: 'bg-indigo-500/20 text-indigo-500 border-indigo-500/30' },
        admin: { label: 'Administrador', color: 'bg-brand-blue/20 text-brand-blue border-brand-blue/30' },
        secretary: { label: 'Secretaría Académica', color: 'bg-amber-500/20 text-amber-500 border-amber-500/30' },
        instructor: { label: 'Docente / Instructor', color: 'bg-brand-purple/20 text-brand-purple border-brand-purple/30' },
        student: { label: 'Estudiante Ultra', color: 'bg-brand-teal/20 text-brand-teal border-brand-teal/30' },
        parent: { label: 'Padre / Encargado Familiar', color: 'bg-emerald-500/20 text-emerald-500 border-emerald-500/30' }
    };

    const currentBadge = roleBadges[role] || { label: role, color: 'bg-slate-500/20 text-slate-400 border-slate-500/30' };

    return (
        <div className="space-y-6 max-w-4xl mx-auto pb-20 md:pb-8 animate-in fade-in duration-500">
            {/* Header & Quick Intro */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
                        <User className="h-7 w-7 text-brand-blue dark:text-brand-teal" />
                        <span>Mi Perfil y Cuenta</span>
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                        Consulta y actualiza tus datos personales y credenciales de acceso a la plataforma.
                    </p>
                </div>

                <div className={`px-3.5 py-1.5 rounded-full border text-xs font-bold uppercase tracking-wider ${currentBadge.color}`}>
                    {currentBadge.label}
                </div>
            </div>

            {/* Notification alert */}
            {feedback && (
                <div className={`p-4 rounded-2xl border flex items-center space-x-3 animate-in slide-in-from-top-2 duration-300 ${
                    feedback.type === 'success' 
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400' 
                        : 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400'
                }`}>
                    {feedback.type === 'success' ? (
                        <CheckCircle2 className="h-5 w-5 shrink-0" />
                    ) : (
                        <AlertCircle className="h-5 w-5 shrink-0" />
                    )}
                    <span className="text-sm font-semibold">{feedback.message}</span>
                </div>
            )}

            {/* Profile Overview Card (Banner Stitch) */}
            <div className="rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white p-6 md:p-8 shadow-xl border border-white/10 relative overflow-hidden">
                <div className="absolute right-0 top-0 bottom-0 w-64 bg-brand-blue/15 pointer-events-none rounded-r-3xl blur-2xl"></div>

                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 relative z-10">
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-brand-blue to-brand-purple flex items-center justify-center text-white text-3xl font-black shadow-lg shadow-brand-blue/30 border-2 border-white/20">
                        {fullName ? fullName.charAt(0).toUpperCase() : email.charAt(0).toUpperCase()}
                    </div>

                    <div className="flex-1 text-center sm:text-left space-y-1.5">
                        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                            <h2 className="text-xl md:text-2xl font-black text-white">{fullName || 'Usuario Ultra'}</h2>
                            <span className="px-2.5 py-0.5 rounded-full bg-white/10 text-brand-teal text-[11px] font-bold">
                                Activo
                            </span>
                        </div>
                        <p className="text-sm text-slate-300 flex items-center justify-center sm:justify-start gap-1.5">
                            <Mail className="h-3.5 w-3.5 text-brand-teal" />
                            <span>{email}</span>
                        </p>
                        {studentCode && (
                            <p className="text-xs text-brand-teal font-mono font-bold">
                                Código ID: {studentCode}
                            </p>
                        )}
                        <div className="pt-2 flex flex-wrap items-center justify-center sm:justify-start gap-3 text-xs text-slate-400">
                            <span className="flex items-center gap-1">
                                <Building2 className="h-3.5 w-3.5 text-slate-400" />
                                Campus Central ULTEC
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                                <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                                Sistema Ultra Tecnología
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Section 1: Edit Personal Details */}
                <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-3xl p-6 border border-slate-200/80 dark:border-white/10 shadow-sm flex flex-col justify-between">
                    <div>
                        <div className="flex items-center space-x-2.5 mb-5 pb-3 border-b border-slate-100 dark:border-white/5">
                            <User className="h-5 w-5 text-brand-blue" />
                            <h3 className="text-base font-bold text-slate-900 dark:text-white">Datos Personales</h3>
                        </div>

                        <form onSubmit={handleSaveProfile} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                                    Nombre Completo
                                </label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={fullName}
                                        onChange={(e) => setFullName(e.target.value)}
                                        placeholder="Ej. Rosa Delia Morales"
                                        required
                                        className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue transition-all"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                                    <Phone className="h-3.5 w-3.5 text-brand-blue" />
                                    <span>Teléfono / WhatsApp</span>
                                </label>
                                <div className="relative">
                                    <input
                                        type="tel"
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value)}
                                        placeholder="Ej. +502 5555-1234"
                                        className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue transition-all"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                                    Correo Electrónico (Institucional)
                                </label>
                                <input
                                    type="email"
                                    value={email}
                                    disabled
                                    className="w-full px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-sm font-medium text-slate-400 cursor-not-allowed"
                                />
                                <p className="text-[10px] text-slate-400 mt-1">El correo está vinculado a tu cuenta institucional y no puede modificarse directamente.</p>
                            </div>

                            <button
                                type="submit"
                                disabled={isSavingProfile}
                                className="w-full mt-2 py-2.5 rounded-xl bg-brand-blue hover:bg-blue-600 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 active:scale-95 transition-all"
                            >
                                {isSavingProfile ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        <span>Guardando...</span>
                                    </>
                                ) : (
                                    <>
                                        <Save className="h-4 w-4" />
                                        <span>Guardar Mis Datos</span>
                                    </>
                                )}
                            </button>
                        </form>
                    </div>
                </div>

                {/* Section 2: Security & Password */}
                <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-3xl p-6 border border-slate-200/80 dark:border-white/10 shadow-sm flex flex-col justify-between">
                    <div>
                        <div className="flex items-center space-x-2.5 mb-5 pb-3 border-b border-slate-100 dark:border-white/5">
                            <KeyRound className="h-5 w-5 text-brand-purple" />
                            <h3 className="text-base font-bold text-slate-900 dark:text-white">Cambio de Contraseña</h3>
                        </div>

                        <form onSubmit={handleChangePassword} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                                    Nueva Contraseña
                                </label>
                                <input
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder="Mínimo 6 caracteres"
                                    required
                                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-purple/30 focus:border-brand-purple transition-all"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                                    Confirmar Nueva Contraseña
                                </label>
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="Repite tu nueva contraseña"
                                    required
                                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-purple/30 focus:border-brand-purple transition-all"
                                />
                            </div>

                            <p className="text-[11px] text-slate-400">
                                Asegúrate de elegir una contraseña segura con letras, números y símbolos para proteger tu acceso.
                            </p>

                            <button
                                type="submit"
                                disabled={isChangingPassword}
                                className="w-full mt-2 py-2.5 rounded-xl bg-brand-purple hover:bg-purple-600 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-purple-500/20 active:scale-95 transition-all"
                            >
                                {isChangingPassword ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        <span>Actualizando...</span>
                                    </>
                                ) : (
                                    <>
                                        <Lock className="h-4 w-4" />
                                        <span>Actualizar Contraseña</span>
                                    </>
                                )}
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default UserProfile;
