import { useState, useEffect } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, BookOpen, GraduationCap, LogOut, DollarSign, FileText, Calendar, BarChart3, Award, FileBadge, Sun, Moon } from 'lucide-react';
import NotificationsPopover from './NotificationsPopover';
import ProfilePopover from './ProfilePopover';

const SidebarItem = ({ to, icon: Icon, label }: { to: string; icon: any; label: string }) => {
    const location = useLocation();
    const isActive = location.pathname === to;
    return (
        <Link
            to={to}
            className={`flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-300 group ${isActive
                ? 'bg-brand-blue/20 text-brand-teal shadow-[0_0_15px_rgba(37,192,244,0.15)] backdrop-blur-sm border border-brand-teal/20'
                : 'text-slate-400 hover:bg-white/5 hover:text-white hover:translate-x-1'
                }`}
        >
            <Icon className={`h-5 w-5 transition-transform group-hover:scale-110 ${isActive ? 'text-brand-teal' : 'text-slate-500 group-hover:text-brand-teal'}`} />
            <span className="font-medium tracking-wide text-sm">{label}</span>
        </Link>
    );
};

const DashboardLayout = () => {
    const [isDarkMode, setIsDarkMode] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('theme') === 'dark' ||
                (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches);
        }
        return false;
    });

    useEffect(() => {
        const root = window.document.documentElement;
        if (isDarkMode) {
            root.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        } else {
            root.classList.remove('dark');
            localStorage.setItem('theme', 'light');
        }
    }, [isDarkMode]);

    const toggleTheme = () => setIsDarkMode(!isDarkMode);

    const handleLogout = () => {
        localStorage.clear();
        window.location.href = '/login';
    };

    return (
        <div className="flex h-screen bg-slate-50 dark:bg-brand-dark overflow-hidden font-sans transition-colors duration-300">
            {/* Sidebar */}
            <div className="w-72 bg-slate-900 border-r border-slate-800 dark:border-white/5 flex flex-col shadow-xl relative z-20 print:hidden transition-colors duration-300">
                {/* Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-b from-brand-blue/10 to-transparent pointer-events-none" />

                <div className="p-6 relative z-10 flex-1 overflow-y-auto custom-scrollbar">
                    <div className="flex items-center space-x-3 mb-8">
                        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-brand-purple to-brand-blue flex items-center justify-center shadow-[0_0_20px_rgba(127,13,242,0.3)]">
                            <span className="text-white font-bold text-xl">U</span>
                        </div>
                        <div>
                            <h1 className="text-lg font-bold text-white tracking-tight">Ultra Tecnología</h1>
                            <p className="text-[10px] text-brand-teal uppercase tracking-wider font-semibold">Panel Administrativo</p>
                        </div>
                    </div>

                    <nav className="space-y-1">
                        <p className="px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 mt-4">Principal</p>
                        <SidebarItem to="/" icon={LayoutDashboard} label="Dashboard" />
                        <SidebarItem to="/reports" icon={BarChart3} label="Reportes" />

                        <p className="px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 mt-6">Gestión</p>
                        <SidebarItem to="/users" icon={Users} label="Usuarios" />
                        <SidebarItem to="/courses" icon={BookOpen} label="Cursos" />
                        <SidebarItem to="/students" icon={Users} label="Estudiantes" />
                        <SidebarItem to="/enrollments" icon={GraduationCap} label="Inscripciones" />
                        <SidebarItem to="/attendance" icon={Calendar} label="Asistencia" />
                        <SidebarItem to="/grades" icon={Award} label="Calificaciones" />
                        <SidebarItem to="/course-gradebook" icon={BookOpen} label="Actas de Curso" />
                        <SidebarItem to="/report-cards" icon={FileBadge} label="Boletas" />

                        <p className="px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 mt-6">Finanzas</p>
                        <SidebarItem to="/payments" icon={DollarSign} label="Pagos" />
                        <SidebarItem to="/invoices" icon={FileText} label="Facturas" />
                    </nav>
                </div>

                <div className="mt-auto p-4 border-t border-slate-800 bg-slate-900/50 relative z-10">
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center justify-center space-x-2 px-4 py-3 text-sm font-medium text-brand-danger hover:text-red-300 hover:bg-red-500/10 rounded-xl transition-all duration-300 border border-transparent hover:border-red-500/20"
                    >
                        <LogOut className="h-4 w-4" />
                        <span>Cerrar Sesión</span>
                    </button>
                    <p className="text-[10px] text-center text-slate-600 mt-4 tracking-wider">v1.3.0 • Premium Build</p>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col overflow-hidden bg-slate-50 dark:bg-brand-dark relative transition-colors duration-300">
                {/* Decorative Top Glow */}
                <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-brand-blue/5 dark:from-brand-purple/10 to-transparent pointer-events-none" />

                {/* Top Header Row */}
                <header className="px-8 py-5 flex items-center justify-end space-x-5 relative z-20 border-b border-slate-200 dark:border-white/5 bg-white/50 dark:bg-brand-dark/50 backdrop-blur-md">
                    <button
                        onClick={toggleTheme}
                        className="p-2 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors shadow-sm"
                        aria-label="Toggle Dark Mode"
                    >
                        {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                    </button>

                    <NotificationsPopover />

                    <ProfilePopover />
                </header>

                {/* Page Content */}
                <main className="flex-1 overflow-auto p-8 relative z-10 custom-scrollbar">
                    <div className="max-w-7xl mx-auto">
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    );
};

export default DashboardLayout;
