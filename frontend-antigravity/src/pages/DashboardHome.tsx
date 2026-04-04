import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
    Loader2, Users, BookOpen, DollarSign, AlertCircle, Clock,
    CheckCircle2, TrendingUp, FileText, Megaphone, Library,
    CalendarCheck, GraduationCap, UserPlus, AlertTriangle
} from 'lucide-react';
import { getDashboardStats, getStudentDashboardStats, getAdminDashboardExtended } from '../features/finance/reportService';

const DashboardHome = () => {
    let currentUser: any = null;
    try {
        const userStr = localStorage.getItem('user');
        currentUser = userStr ? JSON.parse(userStr) : null;
    } catch (e) { /* ignore */ }

    const role = currentUser?.role || 'student';
    const isStudent = role === 'student';
    const isAdmin = ['admin', 'superadmin', 'secretary'].includes(role);
    const isInstructor = role === 'instructor';

    // Admin primary stats
    const { data: stats, isLoading: loadingStats } = useQuery({
        queryKey: ['dashboardStats'],
        queryFn: getDashboardStats,
        enabled: !isStudent,
    });

    // Student stats
    const { data: studentStats, isLoading: loadingStudentStats } = useQuery({
        queryKey: ['studentDashboardStats'],
        queryFn: getStudentDashboardStats,
        enabled: isStudent,
    });

    // Admin extended stats
    const { data: adminExtended } = useQuery({
        queryKey: ['adminDashboardExtended'],
        queryFn: getAdminDashboardExtended,
        enabled: isAdmin,
    });

    const isLoading = isStudent ? loadingStudentStats : loadingStats;

    if (isLoading) return (
        <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
            <Loader2 className="animate-spin h-12 w-12 text-blue-500/50" />
            <p className="text-slate-400 font-medium animate-pulse">Cargando panel...</p>
        </div>
    );

    const greeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Buenos días';
        if (hour < 18) return 'Buenas tardes';
        return 'Buenas noches';
    };

    // ======== STUDENT DASHBOARD ========
    if (isStudent) {
        const attendanceColor = (studentStats?.attendance_percentage || 0) >= 80 ? 'text-emerald-500' :
            (studentStats?.attendance_percentage || 0) >= 60 ? 'text-amber-500' : 'text-rose-500';
        const attendanceBg = (studentStats?.attendance_percentage || 0) >= 80 ? 'bg-emerald-500/10' :
            (studentStats?.attendance_percentage || 0) >= 60 ? 'bg-amber-500/10' : 'bg-rose-500/10';

        return (
            <div className="space-y-8 animate-in fade-in duration-500">
                {/* Header */}
                <header>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
                        {greeting()}, {currentUser?.full_name?.split(' ')[0] || 'Estudiante'} 👋
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">Tu resumen académico en tiempo real.</p>
                </header>

                {/* KPI Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                    <Link to="/student-assignments" className="group">
                        <div className="glass-card p-5 flex items-center gap-4 hover:shadow-lg transition-all hover:-translate-y-0.5 cursor-pointer">
                            <div className="p-3 bg-amber-500/10 rounded-2xl group-hover:scale-110 transition-transform">
                                <Clock className="h-6 w-6 text-amber-500" />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Tareas Pendientes</p>
                                <p className="text-2xl font-black text-slate-900 dark:text-white">{studentStats?.pending_assignments || 0}</p>
                            </div>
                        </div>
                    </Link>

                    <Link to="/my-attendance" className="group">
                        <div className="glass-card p-5 flex items-center gap-4 hover:shadow-lg transition-all hover:-translate-y-0.5 cursor-pointer">
                            <div className={`p-3 ${attendanceBg} rounded-2xl group-hover:scale-110 transition-transform`}>
                                <CalendarCheck className={`h-6 w-6 ${attendanceColor}`} />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Asistencia</p>
                                <p className={`text-2xl font-black ${attendanceColor}`}>{studentStats?.attendance_percentage || 0}%</p>
                            </div>
                        </div>
                    </Link>

                    <Link to="/report-cards" className="group">
                        <div className="glass-card p-5 flex items-center gap-4 hover:shadow-lg transition-all hover:-translate-y-0.5 cursor-pointer">
                            <div className="p-3 bg-brand-blue/10 rounded-2xl group-hover:scale-110 transition-transform">
                                <TrendingUp className="h-6 w-6 text-brand-blue" />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Promedio</p>
                                <p className="text-2xl font-black text-slate-900 dark:text-white">{studentStats?.average_grade || '—'}</p>
                            </div>
                        </div>
                    </Link>

                    <Link to="/resources" className="group">
                        <div className="glass-card p-5 flex items-center gap-4 hover:shadow-lg transition-all hover:-translate-y-0.5 cursor-pointer">
                            <div className="p-3 bg-purple-500/10 rounded-2xl group-hover:scale-110 transition-transform">
                                <BookOpen className="h-6 w-6 text-purple-500" />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Mis Cursos</p>
                                <p className="text-2xl font-black text-slate-900 dark:text-white">{studentStats?.total_courses || 0}</p>
                            </div>
                        </div>
                    </Link>
                </div>

                {/* Bottom cards */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Recent Resources */}
                    <div className="glass-card p-6">
                        <div className="flex items-center gap-3 mb-5">
                            <div className="p-2.5 bg-indigo-500/10 rounded-xl">
                                <Library className="h-5 w-5 text-indigo-500" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Material Reciente</h3>
                        </div>
                        {studentStats?.recent_resources && studentStats.recent_resources.length > 0 ? (
                            <div className="space-y-3">
                                {studentStats.recent_resources.map((r: any) => (
                                    <div key={r.id} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-white/5 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 transition-colors">
                                        <FileText className="h-4 w-4 text-brand-blue shrink-0" />
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">{r.title}</p>
                                            <p className="text-xs text-slate-500">{r.courses?.name} • {new Date(r.created_at).toLocaleDateString('es-ES')}</p>
                                        </div>
                                    </div>
                                ))}
                                <Link to="/resources" className="block text-center text-sm font-bold text-brand-blue hover:underline mt-2">
                                    Ver toda la biblioteca →
                                </Link>
                            </div>
                        ) : (
                            <div className="text-center py-8 text-slate-400">
                                <Library className="h-10 w-10 mx-auto mb-2 opacity-30" />
                                <p className="text-sm">No hay material reciente</p>
                            </div>
                        )}
                    </div>

                    {/* Latest Announcement */}
                    <div className="glass-card p-6">
                        <div className="flex items-center gap-3 mb-5">
                            <div className="p-2.5 bg-amber-500/10 rounded-xl">
                                <Megaphone className="h-5 w-5 text-amber-500" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Último Comunicado</h3>
                        </div>
                        {studentStats?.latest_announcement ? (
                            <div className="bg-slate-50 dark:bg-white/5 rounded-xl p-4 border-l-4 border-brand-blue">
                                <h4 className="font-bold text-slate-800 dark:text-white mb-1">{studentStats.latest_announcement.title}</h4>
                                <p className="text-sm text-slate-600 dark:text-slate-300 line-clamp-3">{studentStats.latest_announcement.content}</p>
                                <p className="text-xs text-slate-400 mt-3">
                                    {new Date(studentStats.latest_announcement.created_at).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                                </p>
                                <Link to="/announcements" className="block text-sm font-bold text-brand-blue hover:underline mt-3">
                                    Ver todos los comunicados →
                                </Link>
                            </div>
                        ) : (
                            <div className="text-center py-8 text-slate-400">
                                <Megaphone className="h-10 w-10 mx-auto mb-2 opacity-30" />
                                <p className="text-sm">Sin comunicados recientes</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // ======== ADMIN / SECRETARY / INSTRUCTOR DASHBOARD ========
    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <header>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
                    {greeting()}, {currentUser?.full_name?.split(' ')[0] || 'Admin'} 👋
                </h1>
                <p className="text-slate-500 dark:text-slate-400 mt-1">Resumen general del estado de la academia.</p>
            </header>

            {/* Primary KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                {(isAdmin || isInstructor) && (
                    <>
                        <StatCard title="Estudiantes Activos" value={stats?.active_students || 0} icon={Users} color="blue" />
                        <StatCard title="Cursos Ofertados" value={stats?.active_courses || 0} icon={BookOpen} color="indigo" />
                    </>
                )}
                {isAdmin && (
                    <>
                        <StatCard
                            title="Recaudación Mensual"
                            value={`Q${(stats?.monthly_income || 0).toLocaleString('es-GT', { minimumFractionDigits: 2 })}`}
                            icon={DollarSign}
                            color="green"
                        />
                        <StatCard title="Pendientes de Pago" value={stats?.pending_payments || 0} icon={AlertCircle} color="amber" />
                    </>
                )}
            </div>

            {/* Secondary KPIs (admin only) */}
            {isAdmin && adminExtended && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    <StatCard title="Inscripciones este Mes" value={adminExtended.enrollments_this_month} icon={UserPlus} color="blue" />
                    <div className="glass-card p-6 md:col-span-2">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2.5 bg-rose-500/10 rounded-xl">
                                <AlertTriangle className="h-5 w-5 text-rose-500" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Estudiantes Morosos</h3>
                        </div>
                        {adminExtended.delinquent_students.length > 0 ? (
                            <div className="space-y-2">
                                {adminExtended.delinquent_students.map((s, i) => (
                                    <div key={i} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-white/5 rounded-xl">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-full flex items-center justify-center text-xs font-bold">
                                                {i + 1}
                                            </div>
                                            <span className="text-sm font-semibold text-slate-800 dark:text-white">{s.name}</span>
                                        </div>
                                        <span className="text-sm font-bold text-rose-600 dark:text-rose-400">Q{s.total.toFixed(2)}</span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-4 text-slate-400">
                                <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-400" />
                                <p className="text-sm font-medium">No hay estudiantes morosos 🎉</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Recent Activity (admin only) */}
            {isAdmin && adminExtended && adminExtended.recent_enrollments.length > 0 && (
                <div className="glass-card p-6">
                    <div className="flex items-center gap-3 mb-5">
                        <div className="p-2.5 bg-brand-blue/10 rounded-xl">
                            <GraduationCap className="h-5 w-5 text-brand-blue" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Inscripciones Recientes</h3>
                    </div>
                    <div className="space-y-2">
                        {adminExtended.recent_enrollments.map((e: any, i: number) => (
                            <div key={i} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-white/5 rounded-xl">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-brand-blue/10 text-brand-blue rounded-full flex items-center justify-center">
                                        <UserPlus className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-slate-800 dark:text-white">{e.students?.full_name}</p>
                                        <p className="text-xs text-slate-500">{e.courses?.name}</p>
                                    </div>
                                </div>
                                <span className="text-xs text-slate-400">{new Date(e.created_at).toLocaleDateString('es-ES')}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Welcome / Support section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 glass-card p-8 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-8 h-full flex items-center justify-center transition-transform group-hover:scale-110 duration-700 opacity-5 pointer-events-none">
                        <BookOpen className="h-64 w-64 text-blue-600" />
                    </div>
                    <div className="relative z-10">
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
                            {isInstructor ? 'Portal del Docente' : 'Bienvenido a Ultra Tecnología'}
                        </h2>
                        <p className="text-slate-600 dark:text-slate-300 max-w-lg leading-relaxed mb-6">
                            {isInstructor
                                ? 'Gestiona tus cursos, califica tareas y registra asistencia desde un solo lugar.'
                                : 'Tu plataforma integral para la gestión académica y financiera. Supervisá el progreso de tus estudiantes y optimizá la administración.'}
                        </p>
                        <div className="flex flex-wrap gap-3">
                            <Link to={isInstructor ? '/grades' : '/reports'}>
                                <div className="px-5 py-3 bg-brand-blue text-white font-bold rounded-2xl hover:bg-blue-600 transition-colors shadow-[0_0_15px_rgba(13,89,242,0.4)] cursor-pointer text-sm">
                                    {isInstructor ? 'Ir a Calificaciones' : 'Ver Reportes'}
                                </div>
                            </Link>
                            <Link to="/announcements">
                                <div className="px-5 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer border border-transparent dark:border-slate-700 text-sm">
                                    Comunicados
                                </div>
                            </Link>
                        </div>
                    </div>
                </div>

                <div className="bg-gradient-to-br from-brand-card to-slate-900 dark:from-slate-900 dark:to-black p-8 rounded-3xl shadow-2xl relative overflow-hidden flex flex-col justify-between border border-slate-200 dark:border-white/5">
                    <div className="absolute top-[-20%] right-[-10%] w-48 h-48 bg-brand-purple/20 blur-[60px] rounded-full pointer-events-none" />
                    <div className="absolute bottom-[-20%] left-[-10%] w-48 h-48 bg-brand-blue/20 blur-[60px] rounded-full pointer-events-none" />
                    <div className="relative z-10">
                        <h3 className="text-xl font-bold text-white mb-2">Soporte Directo</h3>
                        <p className="text-slate-400 text-sm">¿Necesitas ayuda con la plataforma? Estamos para servirte.</p>
                    </div>
                    <div className="mt-8 relative z-10">
                        <button className="w-full py-4 bg-white/10 hover:bg-white/20 text-white font-bold rounded-2xl border border-white/10 backdrop-blur-sm transition-all active:scale-95 shadow-[0_0_15px_rgba(255,255,255,0.05)]">
                            Contactar Soporte
                        </button>
                    </div>
                    <p className="text-[10px] text-slate-500 text-center mt-6 z-10 relative">Versión 1.4.0 Premium Edition</p>
                </div>
            </div>
        </div>
    );
};

const StatCard = ({ title, value, icon: Icon, color }: { title: string; value: string | number; icon: any; color: string }) => {
    const colors: Record<string, string> = {
        blue: "bg-blue-50 text-brand-blue dark:bg-brand-blue/10",
        indigo: "bg-indigo-50 text-brand-purple dark:bg-brand-purple/10",
        green: "bg-green-50 text-brand-success dark:bg-brand-success/10",
        amber: "bg-amber-50 text-brand-warning dark:bg-brand-warning/10"
    };

    return (
        <div className="glass-card p-6 flex items-center space-x-5 group">
            <div className={`p-4 ${colors[color] || colors.blue} rounded-2xl group-hover:scale-110 transition-transform duration-300 font-bold shadow-sm`}>
                <Icon className="h-7 w-7" />
            </div>
            <div>
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{title}</p>
                <p className="text-3xl font-black text-slate-900 dark:text-white mt-1 tracking-tight">{value}</p>
            </div>
        </div>
    );
};

export default DashboardHome;
