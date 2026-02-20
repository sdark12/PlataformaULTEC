import { Link, Outlet, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, BookOpen, GraduationCap, LogOut, DollarSign, FileText, Calendar, BarChart3 } from 'lucide-react';

const SidebarItem = ({ to, icon: Icon, label }: { to: string; icon: any; label: string }) => {
    const location = useLocation();
    const isActive = location.pathname === to;
    return (
        <Link
            to={to}
            className={`flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 group ${isActive
                ? 'bg-white/10 text-white shadow-lg backdrop-blur-sm border border-white/10'
                : 'text-slate-400 hover:bg-white/5 hover:text-white hover:translate-x-1'
                }`}
        >
            <Icon className={`h-5 w-5 transition-transform group-hover:scale-110 ${isActive ? 'text-blue-400' : 'text-slate-500 group-hover:text-blue-400'}`} />
            <span className="font-medium tracking-wide text-sm">{label}</span>
        </Link>
    );
};

const DashboardLayout = () => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    const handleLogout = () => {
        localStorage.clear();
        window.location.href = '/login';
    };

    return (
        <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
            {/* Sidebar */}
            <div className="w-72 bg-slate-900 flex flex-col shadow-xl relative z-20">
                {/* Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-b from-slate-800/50 to-transparent pointer-events-none" />

                <div className="p-6 relative z-10">
                    <div className="flex items-center space-x-3 mb-8">
                        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                            <span className="text-white font-bold text-xl">U</span>
                        </div>
                        <div>
                            <h1 className="text-lg font-bold text-white tracking-tight">Ultra Tecnología</h1>
                            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Panel Administrativo</p>
                        </div>
                    </div>

                    <nav className="space-y-1">
                        <p className="px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 mt-4">Principal</p>
                        <SidebarItem to="/" icon={LayoutDashboard} label="Dashboard" />
                        <SidebarItem to="/reports" icon={BarChart3} label="Reportes" />

                        <p className="px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 mt-6">Gestión</p>
                        <SidebarItem to="/courses" icon={BookOpen} label="Cursos" />
                        <SidebarItem to="/students" icon={Users} label="Estudiantes" />
                        <SidebarItem to="/enrollments" icon={GraduationCap} label="Inscripciones" />

                        <p className="px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 mt-6">Finanzas</p>
                        <SidebarItem to="/payments" icon={DollarSign} label="Pagos" />
                        <SidebarItem to="/invoices" icon={FileText} label="Facturas" />
                        <SidebarItem to="/attendance" icon={Calendar} label="Asistencia" />
                    </nav>
                </div>

                <div className="mt-auto p-4 border-t border-slate-800 bg-slate-900/50 relative z-10">
                    <div className="flex items-center space-x-3 mb-4 px-3 py-2 rounded-lg bg-slate-800/50 border border-slate-700/50">
                        <div className="h-9 w-9 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 flex items-center justify-center text-white font-bold text-sm shadow-md">
                            {user.email?.charAt(0).toUpperCase()}
                        </div>
                        <div className="overflow-hidden">
                            <p className="text-sm font-medium text-slate-200 truncate">{user.email}</p>
                            <p className="text-xs text-blue-400 truncate font-medium">{user.role}</p>
                        </div>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center justify-center space-x-2 px-4 py-2 text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-all duration-200 border border-transparent hover:border-red-500/20"
                    >
                        <LogOut className="h-4 w-4" />
                        <span>Cerrar Sesión</span>
                    </button>
                    <p className="text-[10px] text-center text-slate-600 mt-4">v1.2.0 • Build 2026</p>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-auto bg-slate-50 relative">
                {/* Top subtle decoration */}
                <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-blue-50/50 to-transparent pointer-events-none" />

                <div className="p-8 relative z-10 max-w-7xl mx-auto">
                    <Outlet />
                </div>
            </div>
        </div>
    );
};

export default DashboardLayout;
