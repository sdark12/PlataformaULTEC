import { useState, useRef, useEffect } from 'react';
import { User, LogOut, Users, Smartphone } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAppUpdate } from '../../context/UpdateContext';

const ProfilePopover = () => {
    const [isOpen, setIsOpen] = useState(false);
    const popoverRef = useRef<HTMLDivElement>(null);
    const { hasUpdate, latestVersion, currentVersion, openUpdateModal } = useAppUpdate();

    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const role = user.role || 'student';
    const isAdmin = role === 'admin' || role === 'superadmin';

    const roleLabels: Record<string, string> = {
        superadmin: 'Super Admin',
        admin: 'Administrador',
        secretary: 'Secretaría',
        instructor: 'Docente',
        student: 'Estudiante',
        parent: 'Familiar'
    };

    // Handle clicks outside to close the popover
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const handleLogout = () => {
        setIsOpen(false);
        localStorage.clear();
        window.location.href = '/login';
    };

    const displayName = user.full_name || user.email || 'Usuario';
    const displayRole = roleLabels[role] || role;

    return (
        <div className="relative shrink-0" ref={popoverRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center space-x-2 sm:space-x-3 pl-1 sm:pl-3 sm:border-l sm:border-slate-300 dark:sm:border-slate-700 focus:outline-none hover:opacity-80 transition-opacity shrink-0"
                aria-label="Abrir menú de usuario"
            >
                <div className="text-right hidden sm:block">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white leading-tight truncate max-w-[150px]">
                        {displayName}
                    </p>
                    <p className="text-xs text-brand-blue dark:text-brand-teal capitalize">{displayRole}</p>
                </div>
                <div className="h-8 w-8 sm:h-9 sm:w-9 md:h-10 md:w-10 rounded-full bg-gradient-to-tr from-brand-blue to-brand-purple flex items-center justify-center text-white font-bold text-xs sm:text-sm text-shadow-sm shadow-md border-2 border-white dark:border-slate-800 shrink-0">
                    {displayName.charAt(0).toUpperCase()}
                </div>
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2.5 w-56 sm:w-60 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-700/50 py-2 z-50 animate-in fade-in slide-in-from-top-2">
                    <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700/50">
                        <p className="text-sm font-bold text-slate-900 dark:text-white leading-tight truncate">{displayName}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{user.email}</p>
                        <span className="inline-block mt-1 px-2 py-0.5 rounded-md bg-brand-blue/10 dark:bg-brand-teal/10 text-brand-blue dark:text-brand-teal text-[10px] font-bold">
                            {displayRole}
                        </span>
                    </div>

                    <div className="py-1">
                        {/* Mi Perfil: For admin routes to settings?tab=profile, for others to /profile */}
                        <Link
                            to={isAdmin ? "/settings?tab=profile" : "/profile"}
                            onClick={() => setIsOpen(false)}
                            className="flex items-center space-x-3 px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 hover:text-brand-blue dark:hover:text-brand-teal transition-colors"
                        >
                            <User className="h-4 w-4 text-brand-blue dark:text-brand-teal" />
                            <span>Mi Perfil y Cuenta</span>
                        </Link>

                        {/* Gestión de Usuarios: ONLY for Admin and Superadmin */}
                        {isAdmin && (
                            <Link
                                to="/users"
                                onClick={() => setIsOpen(false)}
                                className="flex items-center space-x-3 px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 hover:text-brand-blue transition-colors"
                            >
                                <Users className="h-4 w-4" />
                                <span>Gestión de Usuarios</span>
                            </Link>
                        )}
                    </div>

                    <div className="border-t border-slate-100 dark:border-slate-700/50 py-1">
                        <button
                            onClick={() => {
                                setIsOpen(false);
                                openUpdateModal();
                            }}
                            className="w-full flex items-center justify-between px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 hover:text-brand-blue dark:hover:text-brand-teal transition-colors"
                        >
                            <div className="flex items-center space-x-3">
                                <Smartphone className="h-4 w-4 text-emerald-500" />
                                <span>Actualizaciones</span>
                            </div>
                            {hasUpdate ? (
                                <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-300/40 animate-pulse">
                                    Nueva v{latestVersion?.version}
                                </span>
                            ) : (
                                <span className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/50 dark:border-emerald-800/40">
                                    ✓ v{currentVersion}
                                </span>
                            )}
                        </button>
                    </div>

                    <div className="border-t border-slate-100 dark:border-slate-700/50 pt-1">
                        <button
                            onClick={handleLogout}
                            className="w-full flex items-center space-x-3 px-4 py-2.5 text-sm font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
                        >
                            <LogOut className="h-4 w-4" />
                            <span>Cerrar Sesión</span>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProfilePopover;
