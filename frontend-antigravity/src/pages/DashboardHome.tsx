import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
import {
    Loader2, Users, BookOpen, DollarSign, AlertCircle, Clock,
    TrendingUp, FileText, Megaphone,
    UserPlus, AlertTriangle,
    Zap, Flame, QrCode, Maximize2,
    MapPin, ChevronRight, CheckCircle2,
    Video, Image as ImageIcon, Link as LinkIcon,
    Eye
} from 'lucide-react';
import { getDashboardStats, getStudentDashboardStats, getAdminDashboardExtended } from '../features/finance/reportService';
import { getStudentBalance } from '../features/merits/meritsService';
import { assignmentsService } from '../services/assignmentsService';
import { getCourses } from '../features/academic/academicService';
import api from '../services/apiClient';
import ParentDashboard from './ParentDashboard';
import MediaViewerModal from '../features/academic/components/MediaViewerModal';
import type { ViewableResource } from '../features/academic/components/MediaViewerModal';
import { DigitalIDCardModal } from '../features/academic/components/DigitalIDCardModal';

const DashboardHome = () => {
    const navigate = useNavigate();
    const [isQrModalOpen, setIsQrModalOpen] = useState(false);
    const [qrDataUrl, setQrDataUrl] = useState<string>('');
    const [viewerResource, setViewerResource] = useState<ViewableResource | null>(null);
    const [isViewerModalOpen, setIsViewerModalOpen] = useState(false);
    let currentUser: any = null;
    try {
        const userStr = localStorage.getItem('user');
        currentUser = userStr ? JSON.parse(userStr) : null;
    } catch (e) { /* ignore */ }

    const role = currentUser?.role || 'student';
    const isStudent = role === 'student';
    const isParent = role === 'parent';
    const isAdmin = ['admin', 'superadmin', 'secretary'].includes(role);
    const isInstructor = role === 'instructor';
    const isSecretary = role === 'secretary';

    // Admin primary stats
    const { data: stats, isLoading: loadingStats } = useQuery({
        queryKey: ['dashboardStats'],
        queryFn: getDashboardStats,
        enabled: !isStudent && !isParent,
    });

    // Student stats
    const { data: studentStats, isLoading: loadingStudentStats } = useQuery({
        queryKey: ['studentDashboardStats'],
        queryFn: getStudentDashboardStats,
        enabled: isStudent,
    });

    // Student merits balance
    const { data: meritsBalance } = useQuery({
        queryKey: ['studentMerits', currentUser?.id],
        queryFn: () => getStudentBalance(currentUser?.id),
        enabled: isStudent && !!currentUser?.id,
    });

    // Student assignments
    const { data: studentAssignments } = useQuery({
        queryKey: ['studentAssignments', 'me'],
        queryFn: () => assignmentsService.getStudentAssignments('me'),
        enabled: isStudent,
    });

    // Student schedule
    const { data: studentSchedule } = useQuery({
        queryKey: ['studentSchedule'],
        queryFn: async () => {
            const res = await api.get('/api/resources/my-schedule');
            return res.data;
        },
        enabled: isStudent,
    });

    // Admin extended stats
    const { data: adminExtended } = useQuery({
        queryKey: ['adminDashboardExtended'],
        queryFn: getAdminDashboardExtended,
        enabled: isAdmin,
    });

    // Instructor courses
    const { data: instructorCourses } = useQuery({
        queryKey: ['instructorCourses'],
        queryFn: getCourses,
        enabled: isInstructor,
    });

    // QR Code & Student Credential generation
    const studentCode = studentStats?.student_code || currentUser?.personal_code || `UT-${new Date().getFullYear()}-${currentUser?.id?.slice(0, 4)?.toUpperCase() || 'EST'}`;

    useEffect(() => {
        if (isStudent && studentCode) {
            const verifyUrl = `${window.location.origin}/verify-student/${encodeURIComponent(studentCode)}`;
            QRCode.toDataURL(verifyUrl, {
                width: 360,
                margin: 1,
                color: {
                    dark: '#020617',
                    light: '#ffffff'
                }
            }).then(url => {
                setQrDataUrl(url);
            }).catch(err => {
                console.error('Error generating QR code:', err);
            });
        }
    }, [isStudent, studentCode]);

    const handleOpenResource = (r: any) => {
        if (!r.file_url) {
            navigate('/resources');
            return;
        }
        setViewerResource(r);
        setIsViewerModalOpen(true);
    };

    const getDashboardResourceIcon = (type?: string) => {
        switch (type) {
            case 'video':
                return { icon: Video, color: 'text-rose-500 bg-rose-500/10' };
            case 'document':
                return { icon: FileText, color: 'text-indigo-500 bg-indigo-500/10' };
            case 'image':
                return { icon: ImageIcon, color: 'text-emerald-500 bg-emerald-500/10' };
            case 'link':
                return { icon: LinkIcon, color: 'text-blue-500 bg-blue-500/10' };
            default:
                return { icon: BookOpen, color: 'text-amber-500 bg-amber-500/10' };
        }
    };

    // ======== PARENT / FAMILIAR DASHBOARD ========
    if (isParent) {
        return <ParentDashboard />;
    }

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

    // ======== STUDENT DASHBOARD (STITCH DESIGN) ========
    if (isStudent) {
        const hasRecords = studentStats?.has_attendance_records;
        const attendancePct = hasRecords ? (studentStats?.attendance_percentage ?? 100) : 100;
        const xp = meritsBalance?.balance ?? 0;
        const level = Math.max(1, Math.floor(xp / 200) + 1);
        const rankTitle = level >= 5 ? 'Maker Master • Élite' : level >= 3 ? 'Tech Innovator' : 'Estudiante Maker';

        const now = Date.now();
        const activePendingList = studentAssignments?.filter((a: any) =>
            a.status !== 'SUBMITTED' && a.status !== 'GRADED' &&
            (!a.due_date || new Date(a.due_date).getTime() >= now)
        ) || [];
        const expiredList = studentAssignments?.filter((a: any) =>
            a.status !== 'SUBMITTED' && a.status !== 'GRADED' &&
            a.due_date && new Date(a.due_date).getTime() < now
        ) || [];
        const totalAssignments = studentAssignments?.length || 0;
        const completedAssignments = studentAssignments?.filter((a: any) => a.status === 'SUBMITTED' || a.status === 'GRADED')?.length || 0;

        // Determine next class (check if there is one today, otherwise next scheduled)
        const DAYS_ES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        const todayName = DAYS_ES[new Date().getDay()];
        const todayClasses = studentSchedule?.filter((s: any) => {
            const d = (s.day_of_week || '').toLowerCase();
            return d.includes(todayName.toLowerCase());
        }) || [];
        const nextClass = todayClasses[0] || (studentSchedule && studentSchedule.length > 0 ? studentSchedule[0] : null);
        const isClassToday = todayClasses.length > 0;

        const dateStr = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
        const capitalizedDate = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);

        return (
            <div className="space-y-6 animate-in fade-in duration-500 pb-20 md:pb-8">
                {/* 1. Header: Greeting & Player Gamification Stats */}
                <section className="flex flex-col space-y-2 pt-1">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                            {capitalizedDate}
                        </span>
                        <div className="flex items-center space-x-1 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-white/10 shadow-inner">
                            <Zap className="h-3.5 w-3.5 text-brand-teal fill-brand-teal" />
                            <span className="text-xs font-black text-brand-teal">{xp.toLocaleString()} XP</span>
                        </div>
                    </div>

                    <div className="flex items-center justify-between">
                        <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white flex items-center gap-2 tracking-tight">
                            <span>¡Hola, {currentUser?.full_name?.split(' ')[0] || 'Estudiante'}!</span>
                            <span className="inline-block animate-bounce">🚀</span>
                        </h1>
                        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full border border-slate-200 dark:border-white/10 shadow-sm">
                            <Flame className="h-4 w-4 text-emerald-500 fill-emerald-500" />
                            <span className="text-xs font-extrabold text-slate-800 dark:text-white">
                                {hasRecords ? `${attendancePct}/100` : '100/100'}
                            </span>
                        </div>
                    </div>

                    {/* Student Rank & Specialty Chip */}
                    <div className="flex items-center gap-2 pt-0.5">
                        <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-gradient-to-r from-brand-purple to-brand-blue text-white font-black tracking-wider uppercase shadow-[0_0_12px_rgba(127,13,242,0.35)]">
                            NIVEL {level}
                        </span>
                        <span className="text-xs text-brand-teal font-bold truncate">
                            {rankTitle} {studentSchedule?.[0]?.course_name ? `• ${studentSchedule[0].course_name}` : '• ULTEC Campus'}
                        </span>
                    </div>
                </section>

                {/* 2. Digital Student Credential & Fast Pass (Credencial Digital) */}
                <section
                    onClick={() => setIsQrModalOpen(true)}
                    className="relative overflow-hidden rounded-3xl bg-slate-900 border border-white/15 p-5 shadow-2xl transition-all duration-300 active:scale-[0.99] cursor-pointer group"
                >
                    {/* Ambient Neon Backlight */}
                    <div className="absolute -right-10 -top-10 w-36 h-36 bg-brand-purple/30 rounded-full blur-3xl pointer-events-none group-hover:bg-brand-purple/45 transition-colors"></div>
                    <div className="absolute -left-10 -bottom-10 w-36 h-36 bg-brand-teal/20 rounded-full blur-3xl pointer-events-none group-hover:bg-brand-teal/35 transition-colors"></div>

                    <div className="relative z-10 flex flex-col space-y-4">
                        {/* Header of Credential */}
                        <div className="flex items-start justify-between">
                            <div className="space-y-0.5">
                                <div className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                                    <span className="text-[10px] text-emerald-400 uppercase tracking-widest font-black">Activo en Sistema</span>
                                </div>
                                <h2 className="text-lg md:text-xl font-black text-white tracking-tight">Credencial Digital</h2>
                                <p className="text-xs text-slate-400">Pase de Acceso Rápido & Laboratorios</p>
                            </div>
                            <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center shadow-lg border border-white/15 group-hover:scale-105 transition-transform">
                                <QrCode className="h-5 w-5 text-brand-teal" />
                            </div>
                        </div>

                        {/* Center Dynamic QR Block */}
                        <div className="flex flex-col items-center justify-center py-2">
                            <div className="relative p-2.5 bg-white rounded-2xl border border-white/20 shadow-[0_0_25px_rgba(37,192,244,0.25)] flex items-center justify-center">
                                {/* Neon Corner Guides */}
                                <div className="absolute top-1.5 left-1.5 w-3.5 h-3.5 border-t-2 border-l-2 border-brand-teal rounded-tl-sm pointer-events-none"></div>
                                <div className="absolute top-1.5 right-1.5 w-3.5 h-3.5 border-t-2 border-r-2 border-brand-teal rounded-tr-sm pointer-events-none"></div>
                                <div className="absolute bottom-1.5 left-1.5 w-3.5 h-3.5 border-b-2 border-l-2 border-brand-teal rounded-bl-sm pointer-events-none"></div>
                                <div className="absolute bottom-1.5 right-1.5 w-3.5 h-3.5 border-b-2 border-r-2 border-brand-teal rounded-br-sm pointer-events-none"></div>

                                {qrDataUrl ? (
                                    <img 
                                        src={qrDataUrl} 
                                        alt={`QR ${studentCode}`} 
                                        className="w-32 h-32 md:w-36 md:h-36 rounded-xl object-contain transition-transform duration-300 group-hover:scale-105" 
                                    />
                                ) : (
                                    <div className="w-32 h-32 md:w-36 md:h-36 rounded-xl bg-slate-100 flex items-center justify-center">
                                        <QrCode className="h-10 w-10 text-slate-400 animate-pulse" />
                                    </div>
                                )}
                            </div>
                            <p className="mt-2 text-[11px] text-brand-teal font-semibold flex items-center gap-1">
                                <Maximize2 className="h-3 w-3" />
                                Toca para ampliar credencial
                            </p>
                        </div>

                        {/* Credential Info Bottom */}
                        <div className="bg-slate-950/80 rounded-2xl p-3.5 border border-white/10 flex justify-between items-center">
                            <div className="min-w-0 pr-2">
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Estudiante & Código</p>
                                <p className="text-sm font-black text-white truncate">{currentUser?.full_name || 'Estudiante ULTEC'}</p>
                                <span className="text-xs text-brand-teal font-mono font-bold">{studentCode}</span>
                            </div>
                            <div className="text-right shrink-0">
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Especialidad / Curso</p>
                                <p className="text-xs font-bold text-white truncate max-w-[140px]">
                                    {studentSchedule?.[0]?.course_name || (studentStats?.total_courses ? `${studentStats.total_courses} Curso(s)` : 'General')}
                                </p>
                                <span className="text-[10px] text-emerald-400 font-semibold">Ciclo {new Date().getFullYear()} • Activo</span>
                            </div>
                        </div>
                    </div>
                </section>

                {/* 3. Performance Metrics (2-Column Bento) */}
                <section className="grid grid-cols-2 gap-3">
                    {/* Card 1: Attendance */}
                    <Link to="/my-attendance" className="flex flex-col justify-between p-4 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/80 dark:border-white/10 shadow-md hover:shadow-lg transition-all group">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">ASISTENCIA</span>
                            <div className="w-5 h-5 rounded-full bg-emerald-500/10 flex items-center justify-center">
                                <span className="text-xs text-emerald-500">✓</span>
                            </div>
                        </div>
                        <div className="flex items-center justify-center my-2 relative">
                            <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 36 36">
                                <path className="text-slate-100 dark:text-slate-800" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3.5"></path>
                                <path className="text-emerald-500 stroke-current" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" strokeDasharray={`${attendancePct}, 100`} strokeLinecap="round" strokeWidth="3.5"></path>
                            </svg>
                            <span className="absolute text-base font-black text-slate-900 dark:text-white">{attendancePct}%</span>
                        </div>
                        <div className="space-y-0.5 text-center">
                            <span className="text-[11px] font-bold text-emerald-500">
                                {hasRecords ? (attendancePct >= 80 ? 'Excelente récord' : 'Por mejorar') : 'Al día • Sin inasistencias'}
                            </span>
                            <p className="text-[10px] text-slate-400">{hasRecords ? 'Puntualidad y asistencia' : 'Ciclo en progreso'}</p>
                        </div>
                    </Link>

                    {/* Card 2: Homework Progress */}
                    <Link to="/student-assignments" className="flex flex-col justify-between p-4 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/80 dark:border-white/10 shadow-md hover:shadow-lg transition-all group">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">TAREAS</span>
                            <div className="w-5 h-5 rounded-full bg-blue-500/10 flex items-center justify-center">
                                <Clock className="h-3 w-3 text-brand-blue" />
                            </div>
                        </div>
                        <div className="my-auto py-2">
                            <div className="flex items-baseline gap-1">
                                <span className="text-2xl font-black text-slate-900 dark:text-white">
                                    {completedAssignments}
                                </span>
                                <span className="text-xs font-semibold text-slate-400">/ {totalAssignments}</span>
                            </div>
                            {/* Progress bar */}
                            <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full mt-2 overflow-hidden">
                                <div
                                    className="bg-gradient-to-r from-brand-blue to-brand-teal h-full rounded-full transition-all"
                                    style={{ width: `${totalAssignments > 0 ? Math.min(100, Math.round((completedAssignments / totalAssignments) * 100)) : 100}%` }}
                                ></div>
                            </div>
                        </div>
                        <div className="space-y-0.5">
                            <span className={`text-[11px] font-bold ${activePendingList.length > 0 ? 'text-brand-teal' : expiredList.length > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                                {activePendingList.length > 0
                                    ? `${activePendingList.length} por entregar`
                                    : expiredList.length > 0
                                    ? `${expiredList.length} expirada${expiredList.length > 1 ? 's' : ''}`
                                    : '¡Al día!'}
                            </span>
                            <p className="text-[10px] text-slate-400">
                                {activePendingList.length > 0
                                    ? 'Pendientes activas'
                                    : expiredList.length > 0
                                    ? 'Plazo vencido'
                                    : 'Sin pendientes'}
                            </p>
                        </div>
                    </Link>
                </section>

                {/* 4. Today's Next Class Banner */}
                {nextClass ? (
                    <section className="flex flex-col p-5 rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white shadow-xl relative overflow-hidden border border-white/15">
                        <div className="absolute right-0 top-0 bottom-0 w-32 bg-brand-blue/10 pointer-events-none rounded-r-2xl blur-xl"></div>
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-white/10 text-brand-teal font-bold flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {isClassToday ? 'Próxima Clase Hoy' : `Próxima Clase (${nextClass.day_of_week})`}
                            </span>
                            <span className={`text-[11px] font-bold ${isClassToday ? 'text-emerald-400' : 'text-slate-300'}`}>
                                {isClassToday ? 'Hoy' : nextClass.day_of_week}
                            </span>
                        </div>

                        <h3 className="text-lg font-black text-white tracking-tight">
                            {nextClass.course_name}
                        </h3>

                        <div className="flex flex-col space-y-1.5 my-3 text-xs text-slate-300">
                            <div className="flex items-center gap-2">
                                <MapPin className="h-3.5 w-3.5 text-brand-teal shrink-0" />
                                <span>{nextClass.grade ? `Grupo ${nextClass.grade}` : 'Campus ULTEC'}</span>
                            </div>
                            <div className="flex items-center gap-2 text-white font-semibold">
                                <Clock className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                                <span>{nextClass.start_time} - {nextClass.end_time}</span>
                            </div>
                        </div>

                        <Link
                            to="/my-schedule"
                            className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-95 border border-white/10 shadow-sm"
                        >
                            <BookOpen className="h-4 w-4 text-brand-teal" />
                            <span>Ver Horario Completo</span>
                        </Link>
                    </section>
                ) : (
                    <section className="flex flex-col p-5 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white shadow-xl relative overflow-hidden border border-white/15">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-white/10 text-brand-teal font-bold flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                Horario Académico
                            </span>
                            <span className="text-[11px] text-slate-400 font-bold">Sin clases hoy</span>
                        </div>
                        <h3 className="text-base font-bold text-white tracking-tight mb-1">
                            No tienes clases programadas hoy
                        </h3>
                        <p className="text-xs text-slate-400 mb-3">
                            Revisa tus cursos inscritos o consulta tu horario semanal para ver tus próximas sesiones.
                        </p>
                        <Link
                            to="/my-schedule"
                            className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-95 border border-white/10 shadow-sm"
                        >
                            <BookOpen className="h-4 w-4 text-brand-teal" />
                            <span>Consultar Horario Completo</span>
                        </Link>
                    </section>
                )}

                {/* 5. Tareas Pendientes */}
                <section className="flex flex-col space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">Tareas Pendientes</h2>
                            <span className={`px-2 py-0.5 rounded-full font-black text-xs ${activePendingList.length > 0 ? 'bg-brand-blue/15 text-brand-blue dark:text-teal-400' : expiredList.length > 0 ? 'bg-rose-500/15 text-rose-500' : 'bg-emerald-500/15 text-emerald-500'}`}>
                                {activePendingList.length > 0 ? activePendingList.length : expiredList.length > 0 ? `${expiredList.length} exp` : '0'}
                            </span>
                        </div>
                        <Link to="/student-assignments" className="text-xs font-bold text-brand-blue dark:text-brand-teal hover:underline flex items-center gap-0.5">
                            Ver todas
                            <ChevronRight className="h-3.5 w-3.5" />
                        </Link>
                    </div>

                    {activePendingList.length > 0 ? (
                        <div className="space-y-3">
                            {activePendingList.slice(0, 2).map((assignment: any) => {
                                const dueDateStr = assignment.due_date
                                    ? new Date(assignment.due_date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
                                    : 'Sin fecha';
                                return (
                                    <div key={assignment.id || assignment.assignment_id} className="p-4 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/80 dark:border-white/10 shadow-md flex flex-col space-y-3">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="space-y-0.5 min-w-0">
                                                <span className="text-[11px] font-bold text-brand-blue dark:text-brand-teal truncate block">
                                                    {assignment.course_name}
                                                </span>
                                                <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-snug">
                                                    {assignment.title}
                                                </h3>
                                            </div>
                                            <span className="px-2 py-1 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400 font-bold text-[10px] flex items-center gap-1 shrink-0">
                                                <Clock className="h-3 w-3" />
                                                {dueDateStr}
                                            </span>
                                        </div>

                                        {assignment.description && (
                                            <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                                                {assignment.description}
                                            </p>
                                        )}

                                        <Link
                                            to="/student-assignments"
                                            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-brand-blue via-indigo-600 to-brand-purple text-white font-bold text-xs flex items-center justify-center gap-2 shadow-[0_4px_16px_rgba(13,89,242,0.35)] active:scale-95 transition-all"
                                        >
                                            <span>Subir Tarea 📤</span>
                                        </Link>
                                    </div>
                                );
                            })}
                        </div>
                    ) : expiredList.length > 0 ? (
                        <div className="p-5 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-rose-500/20 shadow-sm flex flex-col space-y-3">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center shrink-0">
                                    <AlertTriangle className="h-5 w-5" />
                                </div>
                                <div className="space-y-0.5 min-w-0">
                                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                                        {expiredList.length} {expiredList.length === 1 ? 'tarea con plazo vencido' : 'tareas con plazo vencido'}
                                    </h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        No tienes entregas activas pendientes. Tus tareas anteriores ya superaron su fecha límite.
                                    </p>
                                </div>
                            </div>
                            <Link
                                to="/student-assignments"
                                className="w-full py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/15 text-rose-600 dark:text-rose-400 font-bold text-xs flex items-center justify-center gap-2 transition-all border border-rose-500/20"
                            >
                                <span>Ver Tareas Expiradas</span>
                                <ChevronRight className="h-4 w-4" />
                            </Link>
                        </div>
                    ) : (
                        <div className="p-5 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-emerald-500/20 shadow-sm flex flex-col items-center justify-center text-center space-y-2">
                            <div className="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                                <CheckCircle2 className="h-5 w-5" />
                            </div>
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white">¡Estás al día!</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs">
                                No tienes tareas pendientes por entregar en este momento.
                            </p>
                            <Link
                                to="/student-assignments"
                                className="text-xs font-bold text-brand-blue dark:text-brand-teal hover:underline pt-1"
                            >
                                Ver historial de tareas →
                            </Link>
                        </div>
                    )}
                </section>

                {/* 6. Biblioteca & Descargas Recientes */}
                <section className="flex flex-col space-y-3">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">Biblioteca & Descargas</h2>
                            <p className="text-xs text-slate-400">Archivos y materiales de tus cursos</p>
                        </div>
                        <Link to="/resources" className="text-xs font-bold text-brand-blue dark:text-brand-teal hover:underline flex items-center gap-1">
                            <span>Ver biblioteca</span>
                            <ChevronRight className="h-3.5 w-3.5" />
                        </Link>
                    </div>

                    {studentStats?.recent_resources && studentStats.recent_resources.length > 0 ? (
                        <div className="space-y-2">
                            {studentStats.recent_resources.slice(0, 3).map((r: any) => {
                                const { icon: ResourceIcon, color: iconStyle } = getDashboardResourceIcon(r.resource_type);
                                return (
                                    <div 
                                        key={r.id} 
                                        onClick={() => handleOpenResource(r)}
                                        className="p-3 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-white/10 flex items-center justify-between shadow-sm hover:border-brand-blue/30 dark:hover:border-white/20 transition-all cursor-pointer group"
                                    >
                                        <div className="flex items-center gap-3 min-w-0 pr-2">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${iconStyle}`}>
                                                <ResourceIcon className="h-5 w-5" />
                                            </div>
                                            <div className="min-w-0">
                                                <h3 className="text-xs font-bold text-slate-900 dark:text-white truncate group-hover:text-brand-blue transition-colors">{r.title}</h3>
                                                <p className="text-[10px] text-slate-400 truncate">
                                                    {r.courses?.name || 'Curso'} • {new Date(r.created_at).toLocaleDateString('es-ES')}
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleOpenResource(r);
                                            }}
                                            className="w-9 h-9 rounded-xl bg-brand-blue/10 dark:bg-brand-blue/20 flex items-center justify-center text-brand-blue dark:text-teal-400 hover:scale-105 active:scale-95 transition-all shrink-0 cursor-pointer shadow-xs"
                                            title="Previsualizar material"
                                        >
                                            <Eye className="h-4 w-4" />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="p-5 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/80 dark:border-white/10 shadow-sm flex flex-col items-center justify-center text-center space-y-2">
                            <div className="w-10 h-10 rounded-full bg-brand-blue/10 text-brand-teal flex items-center justify-center">
                                <BookOpen className="h-5 w-5" />
                            </div>
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Sin nuevos materiales</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs">
                                Tus docentes aún no han publicado documentos en tus cursos inscritos.
                            </p>
                            <Link
                                to="/resources"
                                className="text-xs font-bold text-brand-blue dark:text-brand-teal hover:underline pt-1 inline-flex items-center gap-1"
                            >
                                <span>Explorar biblioteca general</span>
                                <ChevronRight className="h-3 w-3" />
                            </Link>
                        </div>
                    )}
                </section>

                {/* Official Digital Credential Modal with strict security anti-print */}
                <DigitalIDCardModal
                    isOpen={isQrModalOpen}
                    onClose={() => setIsQrModalOpen(false)}
                    studentId="me"
                    studentName={currentUser?.full_name}
                />

                {/* Media Viewer Modal for direct video and document previews */}
                <MediaViewerModal
                    isOpen={isViewerModalOpen}
                    onClose={() => {
                        setIsViewerModalOpen(false);
                        setViewerResource(null);
                    }}
                    resource={viewerResource}
                />
            </div>
        );
    }

    // ======== INSTRUCTOR / DOCENTE DASHBOARD (STITCH DESIGN) ========
    if (isInstructor) {
        const todayFormatted = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
        const capitalizedDate = todayFormatted.charAt(0).toUpperCase() + todayFormatted.slice(1);
        const activeCourses = instructorCourses?.filter((c: any) => c.is_active !== false) || [];
        const totalStudents = stats?.active_students ?? 0;
        const mainCourse = activeCourses.length > 0 ? activeCourses[0] : null;

        return (
            <div className="space-y-6 animate-in fade-in duration-500 pb-20 md:pb-8">
                {/* 1. Header Greeting & Status Chips */}
                <section className="flex flex-col gap-2 pt-1">
                    <div className="flex items-start justify-between">
                        <div>
                            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                                Hola, {currentUser?.full_name?.split(' ')[0] || 'Profesor'}
                                <span className="inline-block animate-bounce">👋</span>
                            </h1>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1.5">
                                <Clock className="h-3.5 w-3.5 text-brand-teal" />
                                {capitalizedDate} • Ciclo Escolar {new Date().getFullYear()}
                            </p>
                        </div>
                        <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-brand-purple/20 to-brand-blue/20 text-brand-teal flex items-center justify-center shadow-md border border-brand-blue/20">
                            <BookOpen className="h-5 w-5" />
                        </div>
                    </div>

                    {/* Quick Stats Pills from Real Data */}
                    <div className="flex items-center gap-2 overflow-x-auto py-1 scrollbar-none">
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-white/10 shadow-sm flex-shrink-0">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                            <span className="text-xs font-bold text-slate-900 dark:text-white">
                                {activeCourses.length} {activeCourses.length === 1 ? 'Curso Asignado' : 'Cursos Asignados'}
                            </span>
                        </div>
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-white/10 shadow-sm flex-shrink-0">
                            <Users className="h-3.5 w-3.5 text-brand-teal" />
                            <span className="text-xs text-slate-600 dark:text-slate-300 font-semibold">
                                {totalStudents} Alumnos en campus
                            </span>
                        </div>
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 shadow-sm flex-shrink-0">
                            <span className="text-xs font-bold">✓ Portal Docente Activo</span>
                        </div>
                    </div>
                </section>

                {/* 2. Hero Action Card: Curso Principal / Aula */}
                {mainCourse ? (
                    <section className="relative rounded-3xl p-5 bg-slate-900 border border-white/15 shadow-2xl overflow-hidden text-white">
                        {/* Ambient Glow */}
                        <div className="absolute -right-10 -top-10 w-44 h-44 rounded-full bg-emerald-500/15 blur-3xl pointer-events-none"></div>
                        <div className="absolute -left-10 -bottom-10 w-40 h-40 rounded-full bg-brand-purple/20 blur-3xl pointer-events-none"></div>

                        <div className="relative flex flex-col gap-3 z-10">
                            <div className="flex items-center justify-between">
                                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                                    <span className="text-[10px] uppercase tracking-wider font-black">Curso Activo</span>
                                </div>
                                <span className="text-xs text-brand-teal font-bold">
                                    Q{mainCourse.monthly_fee}/mes
                                </span>
                            </div>

                            <div>
                                <h2 className="text-xl font-black text-white tracking-tight">{mainCourse.name}</h2>
                                <p className="text-slate-400 text-xs mt-0.5 line-clamp-1">
                                    {mainCourse.description || 'Programa de formación técnica especializada'}
                                </p>
                            </div>

                            {/* Action CTAs */}
                            <div className="grid grid-cols-1 gap-2 pt-2">
                                <Link
                                    to="/attendance"
                                    className="w-full py-3 rounded-xl bg-gradient-to-r from-brand-blue via-indigo-600 to-brand-teal flex items-center justify-center gap-2 shadow-lg shadow-brand-blue/30 active:scale-[0.98] transition-transform text-white font-bold text-xs"
                                >
                                    <span>Tomar Asistencia de Curso</span>
                                </Link>
                                <Link
                                    to="/course-gradebook"
                                    className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/15 flex items-center justify-center gap-2 text-brand-teal border border-white/10 active:scale-[0.98] transition-all font-bold text-xs"
                                >
                                    <BookOpen className="h-4 w-4" />
                                    <span>Libro de Calificaciones & Bitácora</span>
                                </Link>
                            </div>
                        </div>
                    </section>
                ) : (
                    <section className="relative rounded-3xl p-5 bg-slate-900 border border-white/15 shadow-xl text-white">
                        <div className="flex flex-col gap-2">
                            <h3 className="text-base font-bold">Sin cursos asignados</h3>
                            <p className="text-xs text-slate-400">
                                Actualmente no tienes cursos activos vinculados. Consulta con la administración para asignar tus grupos académicos.
                            </p>
                            <Link
                                to="/courses"
                                className="mt-2 py-2 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-brand-teal text-xs font-bold inline-flex items-center gap-1.5 self-start"
                            >
                                <BookOpen className="h-4 w-4" />
                                <span>Ver Catálogo de Cursos</span>
                            </Link>
                        </div>
                    </section>
                )}

                {/* 3. Cursos Asignados al Docente */}
                <section className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <BookOpen className="h-5 w-5 text-brand-teal" />
                            <h3 className="text-base font-bold text-slate-900 dark:text-white">Cursos Ofertados</h3>
                        </div>
                        <span className="px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 text-[11px] font-bold">
                            {activeCourses.length} {activeCourses.length === 1 ? 'curso' : 'cursos'}
                        </span>
                    </div>

                    <div className="flex flex-col space-y-2">
                        {activeCourses.length > 0 ? (
                            activeCourses.slice(0, 4).map((course: any) => (
                                <div
                                    key={course.id}
                                    className="p-3.5 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-white/10 flex items-center justify-between shadow-sm"
                                >
                                    <div className="flex items-center gap-3 min-w-0 pr-2">
                                        <div className="w-9 h-9 rounded-xl bg-brand-blue/15 text-brand-teal flex items-center justify-center shrink-0">
                                            <BookOpen className="h-4 w-4" />
                                        </div>
                                        <div className="min-w-0">
                                            <h4 className="text-xs font-black text-slate-900 dark:text-white truncate">
                                                {course.name}
                                            </h4>
                                            <p className="text-[11px] text-slate-400 truncate">
                                                Cuota: Q{course.monthly_fee} • Estado: Activo
                                            </p>
                                        </div>
                                    </div>
                                    <Link
                                        to="/attendance"
                                        className="px-3 py-1.5 rounded-xl bg-brand-blue/10 hover:bg-brand-blue/20 text-brand-blue dark:text-brand-teal text-xs font-bold shrink-0 transition-colors"
                                    >
                                        Asistencia
                                    </Link>
                                </div>
                            ))
                        ) : (
                            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 text-center text-xs text-slate-500">
                                No se encontraron cursos registrados en el sistema.
                            </div>
                        )}
                    </div>
                </section>

                {/* 4. Evaluaciones & Tareas */}
                <section className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Clock className="h-5 w-5 text-amber-500" />
                            <h3 className="text-base font-bold text-slate-900 dark:text-white">Tareas & Evaluaciones</h3>
                        </div>
                        <span className="px-2 py-0.5 rounded-full bg-brand-blue/15 text-brand-blue dark:text-brand-teal font-bold text-xs">
                            Módulo Académico
                        </span>
                    </div>

                    <div className="p-4 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-white/10 flex flex-col gap-3 shadow-md">
                        <div className="flex items-start gap-3">
                            <div className="w-11 h-11 rounded-xl bg-brand-purple/15 text-brand-purple flex items-center justify-center shrink-0">
                                <BookOpen className="h-5 w-5" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <span className="text-[10px] text-brand-blue font-bold uppercase tracking-wider">Gestión de Tareas</span>
                                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                                    Revisión y Calificación de Entregas
                                </h4>
                                <p className="text-xs text-slate-400 mt-0.5">
                                    Crea asignaciones, descarga entregas de estudiantes y califica en tiempo real.
                                </p>
                            </div>
                        </div>

                        <Link
                            to="/assignments"
                            className="w-full py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
                        >
                            <span>Ir al Centro de Tareas y Calificaciones</span>
                            <ChevronRight className="h-4 w-4 text-brand-teal" />
                        </Link>
                    </div>
                </section>

                {/* 5. Conducta & Méritos en Vivo */}
                <section className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Zap className="h-5 w-5 text-brand-teal" />
                            <h3 className="text-base font-bold text-slate-900 dark:text-white">Conducta & Méritos</h3>
                        </div>
                        <span className="text-xs text-slate-400 font-medium">Reconocimiento</span>
                    </div>

                    <div className="p-4 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-white/10 flex flex-col gap-3 shadow-md">
                        <p className="text-xs text-slate-500 dark:text-slate-400">Acciones rápidas de reconocimiento para tus estudiantes:</p>
                        <div className="grid grid-cols-2 gap-2.5">
                            <Link
                                to="/merits"
                                className="p-3 rounded-xl bg-brand-teal/10 hover:bg-brand-teal/20 border border-brand-teal/30 text-center active:scale-95 transition-all"
                            >
                                <span className="block text-base mb-0.5">⭐</span>
                                <span className="text-xs font-bold text-brand-teal block">Otorgar Méritos</span>
                                <span className="text-[10px] text-slate-400">Puntos Maker</span>
                            </Link>
                            <Link
                                to="/discipline"
                                className="p-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-center active:scale-95 transition-all"
                            >
                                <span className="block text-base mb-0.5">⚠️</span>
                                <span className="text-xs font-bold text-rose-500 block">Reporte Disciplinario</span>
                                <span className="text-[10px] text-slate-400">Observaciones</span>
                            </Link>
                        </div>
                    </div>
                </section>
            </div>
        );
    }

    // ======== ADMIN / SECRETARY DASHBOARD ========
    const todayFormatted = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const capitalizedDate = todayFormatted.charAt(0).toUpperCase() + todayFormatted.slice(1);
    const delinquentCount = adminExtended?.delinquent_students?.length || 0;

    return (
        <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500">
            {/* Header / Greeting & Live Pulse Banner */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                <div>
                    <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                        {greeting()}, {currentUser?.full_name?.split(' ')[0] || 'Administrador'}
                        <span className="inline-block animate-pulse">👋</span>
                    </h1>
                    <p className="text-xs md:text-sm font-medium text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-brand-teal" />
                        {capitalizedDate} • Ciclo Escolar {new Date().getFullYear()}
                    </p>
                </div>
                {/* Live Pulse Attendance Pill */}
                <div className="self-start sm:self-auto bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-1.5 rounded-full flex items-center gap-2 shadow-sm">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                        ⚡ Campus Conectado
                    </span>
                </div>
            </div>

            {/* Executive KPI Metrics Grid (Stitch 2x2 on Mobile, 4-col on Desktop) */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 md:gap-5">
                {/* Card 1: Estudiantes Activos */}
                <Link to="/students" className="group relative bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-white/5 rounded-2xl p-4 md:p-5 flex flex-col justify-between overflow-hidden shadow-sm hover:shadow-md hover:border-brand-teal/40 active:scale-[0.98] transition-all">
                    <div className="absolute -right-6 -bottom-6 w-20 h-20 bg-brand-purple/20 rounded-full blur-xl pointer-events-none" />
                    <div>
                        <div className="flex items-center justify-between gap-1 mb-2">
                            <span className="text-[11px] md:text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold truncate">Estudiantes</span>
                            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand-purple to-brand-blue flex items-center justify-center text-white shadow-sm flex-shrink-0">
                                <Users className="h-4 w-4" />
                            </div>
                        </div>
                        <div className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-none my-1">
                            {stats?.active_students ?? 0}
                        </div>
                        <p className="text-[11px] md:text-xs text-slate-500 dark:text-slate-400 truncate">Total matriculados</p>
                    </div>
                    <div className="mt-3 pt-2 flex items-center gap-1 text-emerald-500 text-[11px] md:text-xs font-bold border-t border-slate-100 dark:border-white/5">
                        <TrendingUp className="h-3.5 w-3.5" />
                        <span>Alumnos registrados</span>
                    </div>
                </Link>

                {/* Card 2: Recaudación / Mi Caja de Hoy */}
                <Link to="/payments" className="group relative bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-white/5 rounded-2xl p-4 md:p-5 flex flex-col justify-between overflow-hidden shadow-sm hover:shadow-md hover:border-brand-teal/40 active:scale-[0.98] transition-all">
                    <div className="absolute -right-6 -bottom-6 w-20 h-20 bg-brand-teal/20 rounded-full blur-xl pointer-events-none" />
                    <div>
                        <div className="flex items-center justify-between gap-1 mb-2">
                            <span className="text-[11px] md:text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold truncate">
                                {isSecretary ? 'Mi Caja de Hoy' : 'Recaudación'}
                            </span>
                            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand-teal to-emerald-500 flex items-center justify-center text-white shadow-sm flex-shrink-0">
                                <DollarSign className="h-4 w-4" />
                            </div>
                        </div>
                        <div className="text-xl md:text-2xl font-black text-brand-teal tracking-tight leading-tight my-1 truncate">
                            Q{(stats?.monthly_income ?? 0).toLocaleString('es-GT', { minimumFractionDigits: 2 })}
                        </div>
                        <p className="text-[11px] md:text-xs text-slate-500 dark:text-slate-400 truncate">
                            {isSecretary ? 'Cobros de tu turno hoy' : 'Cobros del mes actual'}
                        </p>
                    </div>
                    <div className="mt-3 pt-2 flex items-center gap-1 text-emerald-500 text-[11px] md:text-xs font-bold border-t border-slate-100 dark:border-white/5">
                        <TrendingUp className="h-3.5 w-3.5" />
                        <span>{isSecretary ? 'Turno en vivo' : 'Ingresos en tiempo real'}</span>
                    </div>
                </Link>

                {/* Card 3: Pendientes de Pago */}
                <Link to="/reports" className="group relative bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-white/5 rounded-2xl p-4 md:p-5 flex flex-col justify-between overflow-hidden shadow-sm hover:shadow-md hover:border-rose-500/40 active:scale-[0.98] transition-all">
                    <div className="absolute -right-6 -bottom-6 w-20 h-20 bg-rose-500/20 rounded-full blur-xl pointer-events-none" />
                    <div>
                        <div className="flex items-center justify-between gap-1 mb-2">
                            <span className="text-[11px] md:text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold truncate">Pendientes</span>
                            <div className="w-8 h-8 rounded-xl bg-rose-500/20 text-rose-500 flex items-center justify-center shadow-sm flex-shrink-0">
                                <AlertCircle className="h-4 w-4" />
                            </div>
                        </div>
                        <div className="text-2xl md:text-3xl font-black text-rose-500 tracking-tight leading-none my-1">
                            {stats?.pending_payments ?? 0} <span className="text-xs md:text-sm font-semibold text-slate-700 dark:text-slate-300">Alumnos</span>
                        </div>
                        <p className="text-[11px] md:text-xs text-slate-500 dark:text-slate-400 truncate">Mora o cuota vencida</p>
                    </div>
                    <div className="mt-3 pt-2 flex items-center border-t border-slate-100 dark:border-white/5">
                        <span className="px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400 text-[10px] md:text-[11px] font-bold flex items-center gap-1 truncate">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                            {(stats?.pending_payments ?? 0) > 0 ? 'Requiere gestión' : 'Al día'}
                        </span>
                    </div>
                </Link>

                {/* Card 4: Cursos Ofertados / Academia */}
                <Link to="/courses" className="group relative bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-white/5 rounded-2xl p-4 md:p-5 flex flex-col justify-between overflow-hidden shadow-sm hover:shadow-md hover:border-brand-blue/40 active:scale-[0.98] transition-all">
                    <div className="absolute -right-6 -bottom-6 w-20 h-20 bg-brand-blue/20 rounded-full blur-xl pointer-events-none" />
                    <div>
                        <div className="flex items-center justify-between gap-1 mb-2">
                            <span className="text-[11px] md:text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold truncate">Academia</span>
                            <div className="w-8 h-8 rounded-xl bg-slate-200 dark:bg-slate-800 text-brand-blue flex items-center justify-center shadow-sm flex-shrink-0">
                                <BookOpen className="h-4 w-4" />
                            </div>
                        </div>
                        <div className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-none my-1">
                            {stats?.active_courses ?? 0} <span className="text-xs md:text-sm font-semibold text-brand-teal">Activos</span>
                        </div>
                        <p className="text-[11px] md:text-xs text-slate-500 dark:text-slate-400 truncate">Catálogo de formación</p>
                    </div>
                    <div className="mt-3 pt-2 flex items-center border-t border-slate-100 dark:border-white/5 text-[10px] md:text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate">
                        <span>Horarios y sedes configuradas</span>
                    </div>
                </Link>
            </div>

            {/* Quick Actions Grid (Stitch 4-Column Compact Grid) */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-brand-teal"></span>
                        <h2 className="text-sm md:text-base font-bold text-slate-900 dark:text-white tracking-tight">Acciones Rápidas</h2>
                    </div>
                    <span className="text-xs font-semibold text-brand-teal">Accesos directos</span>
                </div>

                <div className="grid grid-cols-4 gap-2 md:gap-4">
                    <Link
                        to="/students"
                        className="group flex flex-col items-center justify-center p-3 rounded-2xl bg-white/70 dark:bg-slate-900/70 border border-slate-200/80 dark:border-white/5 hover:border-brand-teal/40 active:scale-95 transition-all text-center shadow-sm"
                    >
                        <div className="relative w-11 h-11 md:w-12 md:h-12 rounded-xl bg-gradient-to-tr from-brand-purple to-brand-blue flex items-center justify-center text-white shadow-md mb-2 shadow-brand-purple/20">
                            <UserPlus className="h-5 w-5" />
                        </div>
                        <span className="text-[11px] md:text-xs font-semibold text-slate-800 dark:text-slate-200 leading-tight">Inscribir Alumno</span>
                    </Link>

                    <Link
                        to="/payments"
                        className="group flex flex-col items-center justify-center p-3 rounded-2xl bg-white/70 dark:bg-slate-900/70 border border-slate-200/80 dark:border-white/5 hover:border-brand-teal/40 active:scale-95 transition-all text-center shadow-sm"
                    >
                        <div className="w-11 h-11 md:w-12 md:h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-brand-teal mb-2 group-hover:bg-brand-teal group-hover:text-slate-900 transition-colors shadow-sm">
                            <DollarSign className="h-5 w-5" />
                        </div>
                        <span className="text-[11px] md:text-xs font-semibold text-slate-800 dark:text-slate-200 leading-tight">Registrar Pago</span>
                    </Link>

                    <Link
                        to="/announcements"
                        className="group flex flex-col items-center justify-center p-3 rounded-2xl bg-white/70 dark:bg-slate-900/70 border border-slate-200/80 dark:border-white/5 hover:border-brand-teal/40 active:scale-95 transition-all text-center shadow-sm"
                    >
                        <div className="w-11 h-11 md:w-12 md:h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-brand-purple mb-2 group-hover:bg-brand-purple group-hover:text-white transition-colors shadow-sm">
                            <Megaphone className="h-5 w-5" />
                        </div>
                        <span className="text-[11px] md:text-xs font-semibold text-slate-800 dark:text-slate-200 leading-tight">Nuevo Aviso</span>
                    </Link>

                    <Link
                        to="/branches"
                        className="group flex flex-col items-center justify-center p-3 rounded-2xl bg-white/70 dark:bg-slate-900/70 border border-slate-200/80 dark:border-white/5 hover:border-brand-teal/40 active:scale-95 transition-all text-center shadow-sm"
                    >
                        <div className="w-11 h-11 md:w-12 md:h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-emerald-500 mb-2 group-hover:bg-emerald-500 group-hover:text-white transition-colors shadow-sm">
                            <BookOpen className="h-5 w-5" />
                        </div>
                        <span className="text-[11px] md:text-xs font-semibold text-slate-800 dark:text-slate-200 leading-tight">Ver Sedes</span>
                    </Link>
                </div>
            </div>

            {/* Operational Alerts Card (Stitch Alert Style) */}
            {delinquentCount > 0 && (
                <div className="relative bg-gradient-to-r from-rose-500/10 via-brand-purple/5 to-transparent border border-rose-500/20 rounded-2xl p-4 md:p-5 shadow-sm overflow-hidden">
                    <div className="flex items-start gap-3.5">
                        <div className="w-9 h-9 rounded-xl bg-rose-500/20 text-rose-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <AlertTriangle className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                                <span className="text-sm md:text-base font-bold text-slate-900 dark:text-white">Alerta de Colegiaturas</span>
                            </div>
                            <p className="text-xs md:text-sm text-slate-600 dark:text-slate-300 mt-1 leading-snug">
                                <strong className="text-rose-500 font-bold">{delinquentCount} alumnos</strong> presentan mora en cuotas mensuales.
                            </p>
                            <div className="flex flex-wrap items-center gap-2.5 mt-3">
                                <a
                                    href={`https://wa.me/?text=${encodeURIComponent('Estimado padre de familia, le saludamos de Ultra Tecnología para recordarle su cuota pendiente.')}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-brand-purple to-brand-blue text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-brand-purple/30 active:scale-95 transition-all"
                                >
                                    <span>Enviar WhatsApp</span>
                                </a>
                                <Link
                                    to="/reports"
                                    className="px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-300 dark:hover:bg-slate-700 active:scale-95 transition-all"
                                >
                                    Ver Detalle
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Actividad en Vivo (Stitch Live Feed) */}
            {isAdmin && adminExtended && (
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="relative flex h-2 w-2">
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-teal"></span>
                            </span>
                            <h2 className="text-sm md:text-base font-bold text-slate-900 dark:text-white tracking-tight">Actividad en Vivo</h2>
                        </div>
                        <Link to="/reports" className="text-xs font-bold text-brand-teal hover:underline flex items-center gap-0.5">
                            Ver todo →
                        </Link>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                        {/* Inscripciones recientes */}
                        {adminExtended.recent_enrollments.slice(0, 2).map((e: any, i: number) => (
                            <div key={`enr-${i}`} className="bg-white/70 dark:bg-slate-900/70 border border-slate-200/80 dark:border-white/5 rounded-2xl p-3 flex items-center justify-between gap-3 shadow-sm">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-10 h-10 rounded-xl bg-brand-blue/10 text-brand-blue flex items-center justify-center flex-shrink-0">
                                        <UserPlus className="h-5 w-5" />
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-xs md:text-sm font-bold text-slate-900 dark:text-white truncate">{e.students?.full_name}</span>
                                            <span className="px-1.5 py-0.2 rounded bg-brand-blue/20 text-brand-teal text-[10px] font-bold">Nuevo</span>
                                        </div>
                                        <p className="text-[11px] text-slate-500 truncate">{e.courses?.name || 'Sede Central'}</p>
                                    </div>
                                </div>
                                <span className="text-[10px] font-medium text-slate-400 whitespace-nowrap">Matrícula</span>
                            </div>
                        ))}

                        {/* Morosos destacados */}
                        {adminExtended.delinquent_students.slice(0, 2).map((s: any, i: number) => (
                            <div key={`mor-${i}`} className="bg-white/70 dark:bg-slate-900/70 border border-slate-200/80 dark:border-white/5 rounded-2xl p-3 flex items-center justify-between gap-3 shadow-sm">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center flex-shrink-0">
                                        <AlertCircle className="h-5 w-5" />
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-xs md:text-sm font-bold text-slate-900 dark:text-white truncate">{s.name}</span>
                                            <span className="px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-500 text-[10px] font-bold">Q{s.total.toFixed(0)}</span>
                                        </div>
                                        <p className="text-[11px] text-slate-500 truncate">Cuota Pendiente • Sede Central</p>
                                    </div>
                                </div>
                                <span className="text-[10px] font-medium text-rose-500 whitespace-nowrap">Pendiente</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Welcome / Support section (Responsive Desktop Card) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-2">
                <div className="lg:col-span-2 glass-card p-6 md:p-8 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-8 h-full flex items-center justify-center transition-transform group-hover:scale-110 duration-700 opacity-5 pointer-events-none">
                        <BookOpen className="h-64 w-64 text-blue-600" />
                    </div>
                    <div className="relative z-10">
                        <h2 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white mb-2 md:mb-4">
                            {isInstructor ? 'Portal del Docente' : 'Bienvenido a Ultra Tecnología'}
                        </h2>
                        <p className="text-xs md:text-sm text-slate-600 dark:text-slate-300 max-w-lg leading-relaxed mb-5">
                            {isInstructor
                                ? 'Gestiona tus cursos, califica tareas y registra asistencia desde un solo lugar.'
                                : 'Tu plataforma integral para la gestión académica y financiera. Supervisá el progreso de tus estudiantes y optimizá la administración.'}
                        </p>
                        <div className="flex flex-wrap gap-2.5">
                            <Link to={isInstructor ? '/grades' : '/reports'}>
                                <div className="px-4 py-2.5 bg-brand-blue text-white font-bold rounded-xl hover:bg-blue-600 transition-colors shadow-sm cursor-pointer text-xs md:text-sm">
                                    {isInstructor ? 'Ir a Calificaciones' : 'Ver Reportes'}
                                </div>
                            </Link>
                            <Link to="/announcements">
                                <div className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer text-xs md:text-sm">
                                    Comunicados
                                </div>
                            </Link>
                        </div>
                    </div>
                </div>

                <div className="bg-gradient-to-br from-slate-900 to-black p-6 md:p-8 rounded-3xl shadow-xl relative overflow-hidden flex flex-col justify-between border border-white/5">
                    <div className="absolute top-[-20%] right-[-10%] w-48 h-48 bg-brand-purple/20 blur-[60px] rounded-full pointer-events-none" />
                    <div className="absolute bottom-[-20%] left-[-10%] w-48 h-48 bg-brand-blue/20 blur-[60px] rounded-full pointer-events-none" />
                    <div className="relative z-10">
                        <h3 className="text-lg md:text-xl font-bold text-white mb-1.5">Soporte Directo</h3>
                        <p className="text-slate-400 text-xs md:text-sm">¿Necesitas ayuda con la plataforma? Estamos para servirte.</p>
                    </div>
                    <div className="mt-6 relative z-10">
                        <a
                            href="https://wa.me/"
                            target="_blank"
                            rel="noreferrer"
                            className="w-full py-3 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl border border-white/10 backdrop-blur-sm transition-all active:scale-95 shadow-sm text-xs md:text-sm flex items-center justify-center gap-2"
                        >
                            Contactar Soporte
                        </a>
                    </div>
                    <p className="text-[10px] text-slate-500 text-center mt-4 z-10 relative">v1.4.0 • Ultra Tecnología Mobile</p>
                </div>
            </div>
        </div>
    );
};

export default DashboardHome;
