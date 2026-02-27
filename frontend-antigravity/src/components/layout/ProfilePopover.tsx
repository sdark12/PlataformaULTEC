import { useState, useRef, useEffect } from 'react';
import { User, LogOut } from 'lucide-react';
import { Link } from 'react-router-dom';

const ProfilePopover = () => {
    const [isOpen, setIsOpen] = useState(false);
    const popoverRef = useRef<HTMLDivElement>(null);

    const user = JSON.parse(localStorage.getItem('user') || '{}');

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

    return (
        <div className="relative" ref={popoverRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center space-x-3 pl-4 border-l border-slate-300 dark:border-slate-700 focus:outline-none hover:opacity-80 transition-opacity"
            >
                <div className="text-right hidden sm:block">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white leading-tight">{user.email || 'Admin User'}</p>
                    <p className="text-xs text-brand-blue dark:text-brand-teal capitalize">{user.role || 'Administrator'}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-brand-blue to-brand-purple flex items-center justify-center text-white font-bold text-shadow-sm shadow-md border-2 border-white dark:border-slate-800">
                    {user.email?.charAt(0).toUpperCase() || 'A'}
                </div>
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-3 w-56 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-700/50 py-2 z-50 animate-in fade-in slide-in-from-top-2">
                    <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700/50 sm:hidden">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white leading-tight">{user.email || 'Admin User'}</p>
                        <p className="text-xs text-brand-blue dark:text-brand-teal capitalize">{user.role || 'Administrator'}</p>
                    </div>

                    <Link
                        to="/users"
                        onClick={() => setIsOpen(false)}
                        className="flex items-center space-x-3 px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 hover:text-brand-blue transition-colors"
                    >
                        <User className="h-4 w-4" />
                        <span>Gestión de Usuarios</span>
                    </Link>

                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center space-x-3 px-4 py-2.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                    >
                        <LogOut className="h-4 w-4" />
                        <span>Cerrar Sesión</span>
                    </button>
                </div>
            )}
        </div>
    );
};

export default ProfilePopover;
