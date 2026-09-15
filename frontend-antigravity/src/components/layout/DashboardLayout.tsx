import { useState, useEffect } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import {
    LayoutDashboard,
    Users,
    User,
    BookOpen,
    DollarSign,
    FileText,
    LogOut,
    ClipboardList,
    Award,
    Calendar,
    GraduationCap,
    BarChart3,
    FileBadge,
    ClipboardCheck,
    ShieldAlert,
    Library,
    Sun,
    Moon,
    Bell,
    Settings,
    Menu,
    X,
    Building2
} from 'lucide-react';
import NotificationsPopover from './NotificationsPopover';
import ProfilePopover from './ProfilePopover';

const SidebarItem = ({ to, icon: Icon, label, onClick }: { to: string; icon: any; label: string; onClick?: () => void }) => {
    const location = useLocation();
    const isActive = location.pathname === to;
    return (
        <Link
            to={to}
            onClick={onClick}
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

    let currentUser = null;
    try {
        const userStr = localStorage.getItem('user');
        currentUser = userStr ? JSON.parse(userStr) : null;
    } catch (e) {
        console.error('Error parsing user data:', e);
    }
    const role = currentUser?.role || 'student';

    const roleBadges: Record<string, string> = {
        superadmin: 'SuperAdmin',
        admin: 'Admin',
        secretary: 'Secretaría',
        instructor: 'Docente',
        student: 'Estudiante',
        parent: 'Familiar'
    };

    const roleTitles: Record<string, string> = {
        superadmin: 'Panel Super Admin',
        admin: 'Panel Administrativo',
        secretary: 'Panel de Secretaría',
        instructor: 'Panel Docente',
        student: 'Portal Estudiante',
        parent: 'Portal Familiar'
    };

    const displayRoleBadge = roleBadges[role] || 'Usuario';
    const displayRoleTitle = roleTitles[role] || 'Plataforma ULTEC';

    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    return (
        <div className="flex h-screen print:h-auto bg-slate-50 dark:bg-brand-dark overflow-hidden print:overflow-visible font-sans transition-colors duration-300">
            {/* Mobile Sidebar Backdrop Overlay */}
            {isMobileMenuOpen && (
                <div 
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 md:hidden transition-opacity duration-300"
                />
            )}

            {/* Sidebar (Responsive: Drawer on Mobile, Fixed on Desktop) */}
            <div className={`
                fixed inset-y-0 left-0 z-50 w-72 bg-slate-900 border-r border-slate-800 dark:border-white/5 flex flex-col shadow-2xl transition-transform duration-300 ease-in-out print:hidden
                md:static md:translate-x-0
                ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
            `}>
                {/* Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-b from-brand-blue/10 to-transparent pointer-events-none" />

                <div className="p-6 relative z-10 flex-1 overflow-y-auto custom-scrollbar">
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center space-x-3">
                            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-brand-purple to-brand-blue flex items-center justify-center shadow-[0_0_20px_rgba(127,13,242,0.3)]">
                                <span className="text-white font-bold text-xl">U</span>
                            </div>
                            <div>
                                <h1 className="text-lg font-bold text-white tracking-tight">Ultra Tecnología</h1>
                                <p className="text-[10px] text-brand-teal uppercase tracking-wider font-semibold">{displayRoleTitle}</p>
                            </div>
                        </div>
                        {/* Close button on mobile */}
                        <button
                            onClick={() => setIsMobileMenuOpen(false)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 md:hidden transition-colors"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    <nav className="space-y-1">
                        <p className="px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 mt-4">Principal</p>
                        <SidebarItem to="/" icon={LayoutDashboard} label="Dashboard" onClick={() => setIsMobileMenuOpen(false)} />
                        <SidebarItem to="/profile" icon={User} label="Mi Perfil" onClick={() => setIsMobileMenuOpen(false)} />
                        
                        {['admin', 'superadmin', 'secretary'].includes(role) && (
                            <>
                                <SidebarItem to="/reports" icon={BarChart3} label="Reportes Financieros" onClick={() => setIsMobileMenuOpen(false)} />
                                <SidebarItem to="/student-reports" icon={BarChart3} label="Reporte de Alumnos" onClick={() => setIsMobileMenuOpen(false)} />
                            </>
                        )}

                        <p className="px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 mt-6">Gestión</p>

                        {['admin', 'superadmin'].includes(role) && (
                            <>
                                <SidebarItem to="/users" icon={Users} label="Usuarios" onClick={() => setIsMobileMenuOpen(false)} />
                                <SidebarItem to="/branches" icon={LayoutDashboard} label="Sedes" onClick={() => setIsMobileMenuOpen(false)} />
                                <SidebarItem to="/audit-logs" icon={ShieldAlert} label="Auditoría" onClick={() => setIsMobileMenuOpen(false)} />
                            </>
                        )}

                        {['admin', 'superadmin', 'secretary'].includes(role) && (
                            <>
                                <SidebarItem to="/courses" icon={BookOpen} label="Cursos" onClick={() => setIsMobileMenuOpen(false)} />
                                <SidebarItem to="/students" icon={Users} label="Estudiantes" onClick={() => setIsMobileMenuOpen(false)} />
                                <SidebarItem to="/enrollments" icon={GraduationCap} label="Inscripciones" onClick={() => setIsMobileMenuOpen(false)} />
                                <SidebarItem to="/documents" icon={FileBadge} label="Documentos" onClick={() => setIsMobileMenuOpen(false)} />
                            </>
                        )}

                        {['admin', 'superadmin', 'secretary', 'instructor'].includes(role) && (
                            <>
                                <SidebarItem to="/attendance" icon={Calendar} label="Asistencia" onClick={() => setIsMobileMenuOpen(false)} />
                                <SidebarItem to="/grades" icon={Award} label="Calificaciones" onClick={() => setIsMobileMenuOpen(false)} />
                            </>
                        )}

                        {['admin', 'superadmin', 'instructor'].includes(role) && (
                            <>
                                <SidebarItem to="/course-gradebook" icon={BookOpen} label="Actas de Curso" onClick={() => setIsMobileMenuOpen(false)} />
                                <SidebarItem to="/assignments" icon={ClipboardList} label="Gestión de Tareas" onClick={() => setIsMobileMenuOpen(false)} />
                                <SidebarItem to="/discipline" icon={ShieldAlert} label="Disciplina" onClick={() => setIsMobileMenuOpen(false)} />
                                <SidebarItem to="/merits" icon={Award} label="Méritos y Premios" onClick={() => setIsMobileMenuOpen(false)} />
                            </>
                        )}

                        {['admin', 'superadmin', 'student'].includes(role) && (
                            <SidebarItem to="/documents" icon={FileBadge} label="Documentos" onClick={() => setIsMobileMenuOpen(false)} />
                        )}

                        {role === 'student' && (
                            <>
                                <SidebarItem to="/student-assignments" icon={ClipboardCheck} label="Mis Tareas" onClick={() => setIsMobileMenuOpen(false)} />
                                <SidebarItem to="/my-attendance" icon={Calendar} label="Mi Asistencia" onClick={() => setIsMobileMenuOpen(false)} />
                                <SidebarItem to="/my-schedule" icon={Calendar} label="Mi Horario" onClick={() => setIsMobileMenuOpen(false)} />
                                <SidebarItem to="/my-merits" icon={Award} label="Mis Méritos" onClick={() => setIsMobileMenuOpen(false)} />
                            </>
                        )}

                        {role === 'parent' && (
                            <>
                                <SidebarItem to="/parent-dashboard" icon={LayoutDashboard} label="Panel de Padres" onClick={() => setIsMobileMenuOpen(false)} />
                            </>
                        )}
                        
                        {['admin', 'superadmin', 'instructor', 'student', 'secretary', 'parent'].includes(role) && (
                            <>
                                <SidebarItem to="/resources" icon={Library} label="Biblioteca" onClick={() => setIsMobileMenuOpen(false)} />
                                <SidebarItem to="/announcements" icon={Bell} label="Comunicados" onClick={() => setIsMobileMenuOpen(false)} />
                            </>
                        )}

                        {['admin', 'superadmin', 'secretary'].includes(role) && (
                            <>
                                <p className="px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 mt-6">Finanzas</p>
                                <SidebarItem to="/payments" icon={DollarSign} label="Pagos" onClick={() => setIsMobileMenuOpen(false)} />
                                <SidebarItem to="/invoices" icon={FileText} label="Facturas" onClick={() => setIsMobileMenuOpen(false)} />
                            </>
                        )}

                        {['admin', 'superadmin'].includes(role) && (
                            <>
                                <p className="px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 mt-6">Sistema</p>
                                <SidebarItem to="/settings" icon={Settings} label="Configuración" onClick={() => setIsMobileMenuOpen(false)} />
                            </>
                        )}
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
            <div className="flex-1 flex flex-col overflow-hidden print:overflow-visible bg-slate-50 dark:bg-brand-dark relative transition-colors duration-300">
                {/* Decorative Top Glow */}
                <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-brand-blue/5 dark:from-brand-purple/10 to-transparent pointer-events-none" />

                {/* Top Header Row (Responsive) */}
                <header className="px-4 md:px-8 py-3.5 md:py-5 flex items-center justify-between relative z-20 border-b border-slate-200 dark:border-white/5 bg-white/70 dark:bg-brand-dark/70 backdrop-blur-md print:hidden">
                    {/* Mobile Brand / Logo */}
                    <div className="flex items-center space-x-2 md:hidden">
                        <button
                            onClick={() => setIsMobileMenuOpen(true)}
                            className="p-2 -ml-1 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 active:scale-95 transition-all"
                            aria-label="Open Menu"
                        >
                            <Menu className="h-6 w-6 text-brand-teal" />
                        </button>
                        <div className="flex items-center space-x-1.5">
                            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-brand-purple to-brand-blue flex items-center justify-center shadow-sm">
                                <span className="text-white font-bold text-xs">U</span>
                            </div>
                            <span className="font-bold text-sm text-slate-900 dark:text-white tracking-tight">Ultra Tecnología</span>
                            <span className="px-1.5 py-0.5 rounded-full bg-brand-purple/20 text-brand-teal text-[9px] uppercase font-bold tracking-wider">{displayRoleBadge}</span>
                        </div>
                    </div>

                    {/* Right side controls */}
                    <div className="flex items-center space-x-2.5 md:space-x-4 ml-auto">
                        {/* Branch Selector Pill */}
                        <Link 
                            to="/branches"
                            className="hidden sm:flex items-center space-x-1 px-2.5 py-1 rounded-full bg-slate-200/80 dark:bg-slate-800/80 border border-slate-300/50 dark:border-slate-700/50 text-xs font-medium text-slate-700 dark:text-slate-300 hover:border-brand-teal/50 transition-colors"
                        >
                            <Building2 className="h-3.5 w-3.5 text-brand-teal" />
                            <span className="truncate max-w-[90px]">Sede Central</span>
                        </Link>

                        <button
                            onClick={toggleTheme}
                            className="p-2 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors shadow-sm"
                            aria-label="Toggle Dark Mode"
                        >
                            {isDarkMode ? <Sun className="h-4.5 w-4.5" /> : <Moon className="h-4.5 w-4.5" />}
                        </button>

                        <NotificationsPopover />

                        <ProfilePopover />
                    </div>
                </header>

                {/* Page Content */}
                <main className="flex-1 overflow-auto print:overflow-visible p-4 md:p-8 pb-24 md:pb-8 relative z-10 custom-scrollbar">
                    <div className="max-w-7xl mx-auto">
                        <Outlet />
                    </div>
                </main>

                {/* Mobile Bottom Navigation Bar (Stitch Dock Style) */}
                <nav className="fixed bottom-0 inset-x-0 z-40 md:hidden bg-slate-900/90 backdrop-blur-xl border-t border-slate-800/80 shadow-[0_-4px_24px_rgba(0,0,0,0.5)]">
                    <div className="flex justify-around items-center h-16 px-1">
                        <Link
                            to="/"
                            className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
                                location.pathname === '/' 
                                    ? 'text-brand-teal drop-shadow-[0_0_12px_rgba(37,192,244,0.45)] font-semibold' 
                                    : 'text-slate-400 hover:text-slate-200'
                            }`}
                        >
                            <LayoutDashboard className="h-5 w-5" />
                            <span className="text-[10px] tracking-wide mt-1">Inicio</span>
                        </Link>

                        {['admin', 'superadmin', 'secretary', 'instructor'].includes(role) && (
                            <Link
                                to="/courses"
                                className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
                                    location.pathname.startsWith('/courses') || location.pathname.startsWith('/students')
                                        ? 'text-brand-teal drop-shadow-[0_0_12px_rgba(37,192,244,0.45)] font-semibold' 
                                        : 'text-slate-400 hover:text-slate-200'
                                }`}
                            >
                                <GraduationCap className="h-5 w-5" />
                                <span className="text-[10px] tracking-wide mt-1">Académico</span>
                            </Link>
                        )}

                        {['admin', 'superadmin', 'secretary'].includes(role) && (
                            <Link
                                to="/payments"
                                className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
                                    location.pathname.startsWith('/payments') || location.pathname.startsWith('/invoices')
                                        ? 'text-brand-teal drop-shadow-[0_0_12px_rgba(37,192,244,0.45)] font-semibold' 
                                        : 'text-slate-400 hover:text-slate-200'
                                }`}
                            >
                                <DollarSign className="h-5 w-5" />
                                <span className="text-[10px] tracking-wide mt-1">Finanzas</span>
                            </Link>
                        )}

                        {['admin', 'superadmin', 'secretary'].includes(role) && (
                            <Link
                                to="/reports"
                                className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
                                    location.pathname.startsWith('/reports')
                                        ? 'text-brand-teal drop-shadow-[0_0_12px_rgba(37,192,244,0.45)] font-semibold' 
                                        : 'text-slate-400 hover:text-slate-200'
                                }`}
                            >
                                <BarChart3 className="h-5 w-5" />
                                <span className="text-[10px] tracking-wide mt-1">Reportes</span>
                            </Link>
                        )}

                        {role === 'student' && (
                            <>
                                <Link
                                    to="/student-assignments"
                                    className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
                                        location.pathname.startsWith('/student-assignments')
                                            ? 'text-brand-teal drop-shadow-[0_0_12px_rgba(37,192,244,0.45)] font-semibold' 
                                            : 'text-slate-400 hover:text-slate-200'
                                    }`}
                                >
                                    <ClipboardCheck className="h-5 w-5" />
                                    <span className="text-[10px] tracking-wide mt-1">Tareas</span>
                                </Link>
                                <Link
                                    to="/my-schedule"
                                    className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
                                        location.pathname.startsWith('/my-schedule') || location.pathname.startsWith('/my-attendance')
                                            ? 'text-brand-teal drop-shadow-[0_0_12px_rgba(37,192,244,0.45)] font-semibold' 
                                            : 'text-slate-400 hover:text-slate-200'
                                    }`}
                                >
                                    <Calendar className="h-5 w-5" />
                                    <span className="text-[10px] tracking-wide mt-1">Horario</span>
                                </Link>
                                <Link
                                    to="/resources"
                                    className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
                                        location.pathname.startsWith('/resources')
                                            ? 'text-brand-teal drop-shadow-[0_0_12px_rgba(37,192,244,0.45)] font-semibold' 
                                            : 'text-slate-400 hover:text-slate-200'
                                    }`}
                                >
                                    <Library className="h-5 w-5" />
                                    <span className="text-[10px] tracking-wide mt-1">Material</span>
                                </Link>
                            </>
                        )}

                        {role === 'instructor' && (
                            <>
                                <Link
                                    to="/attendance"
                                    className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
                                        location.pathname.startsWith('/attendance')
                                            ? 'text-brand-teal drop-shadow-[0_0_12px_rgba(37,192,244,0.45)] font-semibold' 
                                            : 'text-slate-400 hover:text-slate-200'
                                    }`}
                                >
                                    <Calendar className="h-5 w-5" />
                                    <span className="text-[10px] tracking-wide mt-1">Asistencia</span>
                                </Link>
                                <Link
                                    to="/assignments"
                                    className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
                                        location.pathname.startsWith('/assignments') || location.pathname.startsWith('/grades')
                                            ? 'text-brand-teal drop-shadow-[0_0_12px_rgba(37,192,244,0.45)] font-semibold' 
                                            : 'text-slate-400 hover:text-slate-200'
                                    }`}
                                >
                                    <ClipboardList className="h-5 w-5" />
                                    <span className="text-[10px] tracking-wide mt-1">Tareas</span>
                                </Link>
                                <Link
                                    to="/merits"
                                    className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
                                        location.pathname.startsWith('/merits') || location.pathname.startsWith('/discipline')
                                            ? 'text-brand-teal drop-shadow-[0_0_12px_rgba(37,192,244,0.45)] font-semibold' 
                                            : 'text-slate-400 hover:text-slate-200'
                                    }`}
                                >
                                    <Award className="h-5 w-5" />
                                    <span className="text-[10px] tracking-wide mt-1">Méritos</span>
                                </Link>
                            </>
                        )}

                        {role === 'parent' && (
                            <>
                                <Link
                                    to="/parent-dashboard"
                                    className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
                                        location.pathname === '/parent-dashboard'
                                            ? 'text-brand-teal drop-shadow-[0_0_12px_rgba(37,192,244,0.45)] font-semibold' 
                                            : 'text-slate-400 hover:text-slate-200'
                                    }`}
                                >
                                    <Users className="h-5 w-5" />
                                    <span className="text-[10px] tracking-wide mt-1">Familia</span>
                                </Link>
                                <Link
                                    to="/announcements"
                                    className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
                                        location.pathname.startsWith('/announcements')
                                            ? 'text-brand-teal drop-shadow-[0_0_12px_rgba(37,192,244,0.45)] font-semibold' 
                                            : 'text-slate-400 hover:text-slate-200'
                                    }`}
                                >
                                    <Bell className="h-5 w-5" />
                                    <span className="text-[10px] tracking-wide mt-1">Avisos</span>
                                </Link>
                            </>
                        )}

                        <button
                            onClick={() => setIsMobileMenuOpen(true)}
                            className="flex flex-col items-center justify-center flex-1 py-1 text-slate-400 hover:text-slate-200 transition-colors"
                        >
                            <Menu className="h-5 w-5" />
                            <span className="text-[10px] tracking-wide mt-1">Más</span>
                        </button>
                    </div>
                </nav>
            </div>
        </div>
    );
};

export default DashboardLayout;
