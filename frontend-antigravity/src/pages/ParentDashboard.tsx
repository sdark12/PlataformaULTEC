import { useState, useMemo, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Users, CalendarCheck, BookOpen, AlertCircle, ChevronDown, ChevronUp, Receipt, CreditCard, DollarSign, CheckCircle2, XCircle, ChevronLeft, ChevronRight, Clock, ClipboardCheck, GraduationCap, FileCheck, ShieldAlert, AlertTriangle, Phone, ShieldCheck, Paperclip } from 'lucide-react';
import api from '../services/apiClient';

interface StudentLink {
    id: string;
    student_id: string;
    relationship: string;
    students?: { full_name: string; personal_code: string };
}

interface AttendanceRecord { date: string; status: string; }
interface PaymentRecord { id: string; payment_date: string; amount: number; discount: number; payment_type: string; method: string; description: string; tuition_month: string; receipt_number: string; course_name: string; }
interface CourseBreakdown { course_name: string; monthly_fee: number; months_charged: number; total_due: number; total_paid: number; pending_amount: number; saldo_a_favor: number; }
interface GradesReport { courses: { course_name: string; average: number; units: { unit_name: string; score: number; remarks: string }[] }[]; general_average: number; }
interface AssignmentInfo { assignment_id: string; title: string; description: string; assignment_type: string; due_date: string; max_score: number; course_name: string; status: string; submission_date: string | null; score: number | null; feedback: string; attachment_url?: string | null; guide_url?: string | null; }
interface DisciplineRecord { id: string; incident_type: string; severity: string; title: string; description: string | null; action_taken: string | null; incident_date: string; parent_notified: boolean; resolved: boolean; resolution_notes: string | null; resolved_at: string | null; courses?: { name: string } | null; reporter?: { full_name: string } | null; }
interface StudentDashboardInfo { attendance_percentage: number; attendance_records: AttendanceRecord[]; average_grade: number; total_courses: number; courses: string[]; pending_payment: number; saldo_a_favor: number; inscription_paid: boolean; course_breakdown: CourseBreakdown[]; payment_history: PaymentRecord[]; }

const fetchMyStudents = async (): Promise<StudentLink[]> => { const res = await api.get('/api/parents/my-students'); return res.data; };
const fetchChildDashboard = async (sid: string): Promise<StudentDashboardInfo> => { const res = await api.get(`/api/parents/child/${sid}/dashboard`); return res.data; };
const fetchChildGrades = async (sid: string): Promise<GradesReport> => { const res = await api.get(`/api/parents/child/${sid}/grades`); return res.data; };
const fetchChildAssignments = async (sid: string): Promise<AssignmentInfo[]> => { const res = await api.get(`/api/parents/child/${sid}/assignments`); return res.data; };
const fetchChildDiscipline = async (sid: string): Promise<DisciplineRecord[]> => { const res = await api.get(`/api/parents/child/${sid}/discipline`); return res.data; };

const incidentTypeInfo: Record<string, { label: string; color: string; bg: string }> = {
    positive: { label: 'Positivo', color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
    warning: { label: 'Advertencia', color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20' },
    minor: { label: 'Falta Menor', color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-900/20' },
    major: { label: 'Falta Mayor', color: 'text-rose-600', bg: 'bg-rose-50 dark:bg-rose-900/20' },
    suspension: { label: 'Suspensión', color: 'text-red-700', bg: 'bg-red-50 dark:bg-red-900/20' },
};
const severityDot: Record<string, string> = { low: 'bg-emerald-500', medium: 'bg-amber-500', high: 'bg-orange-500', critical: 'bg-rose-500' };

const assignmentStatusLabel: Record<string, { text: string; color: string }> = {
    PENDING: { text: 'Pendiente', color: 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400' },
    SUBMITTED: { text: 'Entregada', color: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' },
    GRADED: { text: 'Calificada', color: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400' },
    LATE: { text: 'Tarde', color: 'bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400' },
};
const assignmentTypeLabel: Record<string, string> = { homework: 'Tarea', exam: 'Examen', quiz: 'Quiz', project: 'Proyecto', classwork: 'Trabajo en clase', other: 'Otro' };

const formatDate = (dateStr: string) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('es-GT', { day: '2-digit', month: 'short', year: 'numeric' });
};

const paymentTypeLabel = (type: string) => {
    const l: Record<string, string> = { TUITION: 'Colegiatura', ENROLLMENT: 'Inscripción', INSCRIPTION: 'Inscripción', BOOKS: 'Libros', UNIFORM: 'Uniforme', OTHER: 'Otro' };
    return l[type] || type;
};
const methodLabel = (method: string) => {
    const l: Record<string, string> = { CASH: 'Efectivo', TRANSFER: 'Transferencia', CARD: 'Tarjeta', CHECK: 'Cheque', OTHER: 'Otro' };
    return l[method] || method;
};

/* ──── Attendance Calendar ──── */
const AttendanceCalendar = ({ records }: { records: AttendanceRecord[] }) => {
    const today = new Date();
    const [viewMonth, setViewMonth] = useState(today.getMonth());
    const [viewYear, setViewYear] = useState(today.getFullYear());

    const recordMap = useMemo(() => {
        const map: Record<string, string> = {};
        records?.forEach(r => { map[r.date] = r.status; });
        return map;
    }, [records]);

    const statusColor: Record<string, string> = { present: 'bg-emerald-500', absent: 'bg-rose-500', late: 'bg-amber-500', excused: 'bg-blue-500', permission: 'bg-purple-500' };
    const statusLabel: Record<string, string> = { present: 'Presente', absent: 'Ausente', late: 'Tarde', excused: 'Justificado', permission: 'Permiso' };
    const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const startDay = new Date(viewYear, viewMonth, 1).getDay();
    const cells: (number | null)[] = [];
    for (let i = 0; i < startDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);

    const prev = () => { if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); } else setViewMonth(viewMonth - 1); };
    const next = () => { if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); } else setViewMonth(viewMonth + 1); };

    return (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
                <button onClick={prev} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"><ChevronLeft className="w-4 h-4" /></button>
                <h4 className="font-bold text-slate-900 dark:text-white">{months[viewMonth]} {viewYear}</h4>
                <button onClick={next} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"><ChevronRight className="w-4 h-4" /></button>
            </div>
            <div className="grid grid-cols-7 gap-1 mb-2">
                {days.map(d => <div key={d} className="text-center text-[11px] font-bold text-slate-400 uppercase">{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
                {cells.map((day, i) => {
                    if (day === null) return <div key={`e-${i}`} />;
                    const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    const status = recordMap[dateStr];
                    const isToday = day === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear();
                    return (
                        <div key={dateStr} className={`h-9 flex flex-col items-center justify-center rounded-lg text-xs font-semibold relative ${isToday ? 'ring-2 ring-brand-blue' : ''} ${status ? `${statusColor[status]} text-white` : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50'}`} title={status ? `${day} - ${statusLabel[status]}` : `${day}`}>
                            {day}
                        </div>
                    );
                })}
            </div>
            <div className="flex flex-wrap items-center justify-center gap-4 mt-4 pt-3 border-t border-slate-100 dark:border-slate-700 text-xs">
                {Object.entries(statusLabel).map(([k, v]) => (
                    <div key={k} className="flex items-center gap-1.5">
                        <span className={`w-2.5 h-2.5 rounded-full ${statusColor[k]}`} />
                        <span className="text-slate-500">{v}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

/* ──── Tab definitions ──── */
type TabKey = 'summary' | 'grades' | 'assignments' | 'attendance' | 'finance' | 'discipline';
const TABS: { key: TabKey; label: string; icon: any }[] = [
    { key: 'summary', label: 'Resumen', icon: BookOpen },
    { key: 'grades', label: 'Calificaciones', icon: GraduationCap },
    { key: 'assignments', label: 'Tareas', icon: ClipboardCheck },
    { key: 'attendance', label: 'Asistencia', icon: CalendarCheck },
    { key: 'finance', label: 'Finanzas', icon: DollarSign },
    { key: 'discipline', label: 'Disciplina', icon: ShieldAlert },
];

/* ──── Child View Component ──── */
interface ChildViewProps {
    student: StudentLink;
    autoExpand?: boolean;
    activeTab?: TabKey;
    onTabChange?: (tab: TabKey) => void;
}

const ChildView = ({ student, autoExpand, activeTab: controlledTab, onTabChange }: ChildViewProps) => {
    const [expanded, setExpanded] = useState(autoExpand !== undefined ? autoExpand : false);
    const [localTab, setLocalTab] = useState<TabKey>('summary');

    useEffect(() => {
        if (autoExpand !== undefined) {
            setExpanded(autoExpand);
        }
    }, [autoExpand]);

    const activeTab = controlledTab !== undefined ? controlledTab : localTab;
    const handleTabSelect = (t: TabKey) => {
        setLocalTab(t);
        onTabChange?.(t);
    };

    const { data: info, isLoading } = useQuery({ queryKey: ['childDashboard', student.student_id], queryFn: () => fetchChildDashboard(student.student_id), enabled: expanded });
    const { data: gradesData } = useQuery({ queryKey: ['childGrades', student.student_id], queryFn: () => fetchChildGrades(student.student_id), enabled: expanded });
    const { data: assignmentsData } = useQuery({ queryKey: ['childAssignments', student.student_id], queryFn: () => fetchChildAssignments(student.student_id), enabled: expanded });
    const { data: disciplineData } = useQuery({ queryKey: ['childDiscipline', student.student_id], queryFn: () => fetchChildDiscipline(student.student_id), enabled: expanded });

    return (
        <div className="glass-card mb-4 overflow-hidden animate-in fade-in rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-lg">
            {/* Header / Student Switcher Card from Stitch */}
            <div className="p-4 sm:p-5 flex items-center justify-between cursor-pointer hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors" onClick={() => setExpanded(!expanded)}>
                <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                    <div className="relative shrink-0">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-brand-blue to-brand-purple flex items-center justify-center text-white font-bold text-lg shadow-sm">
                            {student.students?.full_name?.charAt(0) || 'E'}
                        </div>
                        <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-emerald-400 ring-2 ring-white dark:ring-slate-900"></span>
                    </div>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white truncate">{student.students?.full_name}</h3>
                            <span className="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">
                                ✓ En Campus
                            </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                            <span className="font-mono">{student.students?.personal_code || 'UT-2026'}</span>
                            <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
                            <span className="font-semibold text-brand-blue capitalize">{student.relationship}</span>
                        </div>
                    </div>
                </div>
                <div className="p-2 text-slate-400 hover:text-brand-blue transition-colors shrink-0">
                    {expanded ? <ChevronUp className="w-6 h-6" /> : <ChevronDown className="w-6 h-6" />}
                </div>
            </div>

            {expanded && (
                <div className="border-t border-slate-100 dark:border-white/5">
                    {/* Live Student Status Card (Real Data from Database) */}
                    <div className="mx-4 my-3 relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-4 text-white shadow-xl border border-white/15">
                        <div className="absolute -right-10 -top-10 w-36 h-36 rounded-full bg-emerald-500/15 blur-2xl pointer-events-none"></div>
                        <div className="flex flex-col gap-3 relative z-10">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-[10px] border border-emerald-500/30">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                                    <span>ESTADO ACADÉMICO EN VIVO</span>
                                </div>
                                <span className="text-[10px] text-brand-teal font-mono font-bold">
                                    {student.students?.personal_code || `ID #${student.student_id.slice(0, 8).toUpperCase()}`}
                                </span>
                            </div>

                            <div className="flex items-start gap-3">
                                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0 border border-emerald-500/30">
                                    <ShieldCheck className="w-5 h-5" />
                                </div>
                                <div>
                                    <h2 className="text-sm font-bold text-white leading-tight">
                                        {student.students?.full_name || 'Estudiante'}
                                    </h2>
                                    <p className="text-xs text-slate-300 mt-1">
                                        {info ? (
                                            <>Récord de asistencia: <span className="text-brand-teal font-bold">{info.attendance_percentage}%</span> • <span className="text-white font-bold">{info.total_courses}</span> curso(s) activo(s) • Promedio general: <span className="text-emerald-400 font-bold">{info.average_grade || 0} pts</span></>
                                        ) : (
                                            'Información académica sincronizada con el campus.'
                                        )}
                                    </p>
                                </div>
                            </div>

                            {/* Summary Metrics from Database */}
                            {info && (
                                <div className="grid grid-cols-3 gap-2 mt-1 bg-slate-950/70 border border-white/10 rounded-xl p-2.5">
                                    <div className="flex flex-col items-center text-center">
                                        <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1">
                                            {info.attendance_percentage}%
                                        </span>
                                        <span className="text-[10px] text-slate-400 mt-0.5">Asistencia</span>
                                    </div>
                                    <div className="flex flex-col items-center text-center">
                                        <span className="text-[11px] font-bold text-brand-teal flex items-center gap-1">
                                            {info.average_grade || 0} pts
                                        </span>
                                        <span className="text-[10px] text-slate-400 mt-0.5">Promedio</span>
                                    </div>
                                    <div className="flex flex-col items-center text-center">
                                        <span className={`text-[11px] font-bold flex items-center gap-1 ${info.pending_payment > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                                            {info.pending_payment > 0 ? `Q${info.pending_payment}` : 'Al día'}
                                        </span>
                                        <span className="text-[10px] text-slate-400 mt-0.5">{info.pending_payment > 0 ? 'Pendiente' : 'Pagos'}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-8">
                            <Loader2 className="w-8 h-8 animate-spin text-brand-blue/50 mb-3" />
                            <span className="text-sm text-slate-500 font-medium">Cargando información...</span>
                        </div>
                    ) : info ? (
                        <>
                            {/* Tab Navigation */}
                            <div className="px-4 pt-3 bg-slate-50/50 dark:bg-white/[0.01] border-b border-slate-100 dark:border-slate-700/50 overflow-x-auto">
                                <div className="flex gap-1 min-w-max">
                                    {TABS.map(tab => {
                                        const Icon = tab.icon;
                                        const isActive = activeTab === tab.key;
                                        return (
                                            <button
                                                key={tab.key}
                                                onClick={() => handleTabSelect(tab.key)}
                                                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-t-xl transition-all whitespace-nowrap
                                                    ${isActive
                                                        ? 'bg-white dark:bg-slate-800 text-brand-blue border border-slate-200 dark:border-slate-700 border-b-white dark:border-b-slate-800 -mb-px shadow-sm'
                                                        : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-white/50 dark:hover:bg-white/5'
                                                    }`}
                                            >
                                                <Icon className="w-4 h-4" />
                                                {tab.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Tab Content */}
                            <div className="p-6 bg-white dark:bg-slate-800/30">
                                {/* ── RESUMEN ── */}
                                {activeTab === 'summary' && (
                                    <div className="space-y-5 animate-in fade-in duration-300">
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                                            <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 flex items-center gap-4">
                                                <div className={`p-3 rounded-xl ${info.attendance_percentage >= 80 ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20' : 'bg-rose-50 text-rose-600 dark:bg-rose-900/20'}`}><CalendarCheck className="w-5 h-5" /></div>
                                                <div><p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Asistencia</p><p className="text-xl font-black text-slate-900 dark:text-white">{info.attendance_percentage}%</p></div>
                                            </div>
                                            <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 flex items-center gap-4">
                                                <div className={`p-3 rounded-xl ${info.average_grade >= 60 ? 'bg-blue-50 text-brand-blue dark:bg-blue-900/20' : 'bg-rose-50 text-rose-600 dark:bg-rose-900/20'}`}><BookOpen className="w-5 h-5" /></div>
                                                <div><p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Promedio</p><p className="text-xl font-black text-slate-900 dark:text-white">{info.average_grade || '—'}</p></div>
                                            </div>
                                            <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 flex items-center gap-4">
                                                <div className="p-3 bg-purple-50 text-purple-600 dark:bg-purple-900/20 rounded-xl"><Users className="w-5 h-5" /></div>
                                                <div><p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Cursos</p><p className="text-xl font-black text-slate-900 dark:text-white">{info.total_courses}</p></div>
                                            </div>
                                            <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 flex items-center gap-4">
                                                <div className={`p-3 rounded-xl ${info.pending_payment > 0 ? 'bg-amber-50 text-amber-600 dark:bg-amber-900/20' : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20'}`}><AlertCircle className="w-5 h-5" /></div>
                                                <div>
                                                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pendiente</p>
                                                    <p className={`text-xl font-black ${info.pending_payment > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>Q{info.pending_payment.toFixed(2)}</p>
                                                    {info.saldo_a_favor > 0 && <p className="text-xs font-bold text-emerald-500 mt-0.5">+Q{info.saldo_a_favor.toFixed(2)} a favor</p>}
                                                </div>
                                            </div>
                                            <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 flex items-center gap-4">
                                                <div className={`p-3 rounded-xl ${info.inscription_paid ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20' : 'bg-rose-50 text-rose-600 dark:bg-rose-900/20'}`}>
                                                    {info.inscription_paid ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                                                </div>
                                                <div><p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Inscripción</p><p className={`text-sm font-black ${info.inscription_paid ? 'text-emerald-600' : 'text-rose-600'}`}>{info.inscription_paid ? 'Pagada' : 'Pendiente'}</p></div>
                                            </div>
                                        </div>
                                        {/* Course list */}
                                        {info.courses && info.courses.length > 0 && (
                                            <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-5">
                                                <h4 className="font-bold text-sm text-slate-700 dark:text-slate-300 mb-3">Cursos Inscritos</h4>
                                                <div className="flex flex-wrap gap-2">
                                                    {info.courses.map((c, i) => (
                                                        <span key={i} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-brand-blue/10 text-brand-blue">{c}</span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* ── CALIFICACIONES ── */}
                                {activeTab === 'grades' && (
                                    <div className="animate-in fade-in duration-300">
                                        {gradesData && gradesData.courses && gradesData.courses.length > 0 ? (
                                            <div className="space-y-4">
                                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                                                    <h4 className="font-bold text-slate-900 dark:text-white">Boleta de Calificaciones</h4>
                                                    <span className={`text-sm font-black px-3 py-1 rounded-lg self-start sm:self-auto ${gradesData.general_average >= 60 ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20' : 'bg-rose-50 text-rose-600 dark:bg-rose-900/20'}`}>
                                                        Promedio General: {gradesData.general_average} pts
                                                    </span>
                                                </div>
                                                {gradesData.courses.map((course: any, ci: number) => (
                                                    <div key={ci} className="bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-4 sm:p-5">
                                                        <div className="flex items-center justify-between mb-2">
                                                            <h5 className="font-bold text-slate-800 dark:text-slate-200 text-sm sm:text-base">{course.course_name}</h5>
                                                            <span className={`text-xs font-black px-2.5 py-1 rounded-lg ${course.average >= 60 ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20' : 'bg-rose-50 text-rose-600 dark:bg-rose-900/20'}`}>
                                                                Promedio: {course.average} pts
                                                            </span>
                                                        </div>
                                                        {/* Course Visual Progress Bar */}
                                                        <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full mb-3.5 overflow-hidden">
                                                            <div
                                                                className={`h-full rounded-full transition-all duration-500 ${Number(course.average) >= 60 ? 'bg-emerald-500' : 'bg-rose-500'}`}
                                                                style={{ width: `${Math.min(100, Math.max(0, Number(course.average) || 0))}%` }}
                                                            />
                                                        </div>
                                                        {course.payment_restricted && (
                                                            <div className="mb-3 p-2.5 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-700/30 rounded-xl flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400">
                                                                <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                                                <span>Algunas notas están restringidas por pagos pendientes.</span>
                                                            </div>
                                                        )}
                                                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                                                            {course.units.map((unit: any, ui: number) => (
                                                                <div key={ui} className={`rounded-xl p-3 text-center ${unit.restricted ? 'bg-slate-100 dark:bg-slate-700/10 opacity-60' : 'bg-white dark:bg-slate-700/30'}`}>
                                                                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 truncate" title={unit.unit_name}>{unit.unit_name}</p>
                                                                    {unit.restricted ? (
                                                                        <div className="flex flex-col items-center gap-0.5">
                                                                            <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                                                            <p className="text-[10px] text-slate-400">Pago pendiente</p>
                                                                        </div>
                                                                    ) : (
                                                                        <>
                                                                            <p className={`text-lg font-black ${Number(unit.score) >= 60 ? 'text-slate-900 dark:text-white' : 'text-rose-500'}`}>{unit.score}</p>
                                                                            {unit.remarks && <p className="text-[10px] text-slate-400 mt-0.5 truncate" title={unit.remarks}>{unit.remarks}</p>}
                                                                        </>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="text-center py-12"><GraduationCap className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" /><p className="text-sm text-slate-500">No hay calificaciones registradas aún.</p></div>
                                        )}
                                    </div>
                                )}

                                {/* ── TAREAS ── */}
                                {activeTab === 'assignments' && (
                                    <div className="animate-in fade-in duration-300">
                                        {assignmentsData && assignmentsData.length > 0 ? (
                                            <div className="space-y-2">
                                                {assignmentsData.map((task) => {
                                                    const statusInfo = assignmentStatusLabel[task.status] || assignmentStatusLabel.PENDING;
                                                    const isOverdue = task.status === 'PENDING' && task.due_date && new Date(task.due_date) < new Date();
                                                    return (
                                                        <div key={task.assignment_id} className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 hover:shadow-sm transition-all">
                                                            <div className="flex items-start justify-between gap-4">
                                                                <div className="flex items-start gap-3 min-w-0">
                                                                    <div className={`p-2 rounded-lg mt-0.5 shrink-0 ${task.status === 'GRADED' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20' : isOverdue ? 'bg-rose-50 text-rose-500 dark:bg-rose-900/20' : 'bg-slate-100 text-slate-500 dark:bg-slate-700'}`}>
                                                                        <FileCheck className="w-4 h-4" />
                                                                    </div>
                                                                    <div className="min-w-0">
                                                                        <p className="font-bold text-slate-800 dark:text-white text-sm truncate">{task.title}</p>
                                                                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                                            <span className="text-xs text-slate-500">{task.course_name}</span>
                                                                            {task.assignment_type && <><span className="w-1 h-1 rounded-full bg-slate-300" /><span className="text-xs text-slate-400">{assignmentTypeLabel[task.assignment_type] || task.assignment_type}</span></>}
                                                                            {task.due_date && <><span className="w-1 h-1 rounded-full bg-slate-300" /><span className={`text-xs flex items-center gap-1 ${isOverdue ? 'text-rose-500 font-bold' : 'text-slate-400'}`}><Clock className="w-3 h-3" />{formatDate(task.due_date)}{isOverdue && ' (Vencida)'}</span></>}
                                                                        </div>
                                                                        {task.feedback && <p className="text-xs text-slate-500 mt-1 italic">💬 {task.feedback}</p>}
                                                                        {(task.guide_url || task.attachment_url) && (
                                                                            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-100 dark:border-slate-700/50 flex-wrap">
                                                                                {task.guide_url && (
                                                                                    <a
                                                                                        href={`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}${task.guide_url}`}
                                                                                        target="_blank"
                                                                                        rel="noopener noreferrer"
                                                                                        className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 px-2.5 py-1 rounded-lg transition-colors border border-indigo-200 dark:border-indigo-800/40"
                                                                                    >
                                                                                        <BookOpen className="w-3.5 h-3.5" />
                                                                                        <span>Guía de Tarea</span>
                                                                                    </a>
                                                                                )}
                                                                                {task.attachment_url && (
                                                                                    <a
                                                                                        href={`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}${task.attachment_url}`}
                                                                                        target="_blank"
                                                                                        rel="noopener noreferrer"
                                                                                        className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-blue dark:text-blue-400 bg-brand-blue/5 dark:bg-brand-blue/15 hover:bg-brand-blue/10 px-2.5 py-1 rounded-lg transition-colors border border-brand-blue/20"
                                                                                    >
                                                                                        <Paperclip className="w-3.5 h-3.5" />
                                                                                        <span>Ver Entrega</span>
                                                                                    </a>
                                                                                )}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                <div className="flex flex-col items-end gap-1 shrink-0">
                                                                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-lg ${statusInfo.color}`}>{statusInfo.text}</span>
                                                                    {task.score !== null && task.score !== undefined && <span className="text-sm font-black text-slate-900 dark:text-white">{task.score}/{task.max_score || '—'}</span>}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <div className="text-center py-12"><ClipboardCheck className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" /><p className="text-sm text-slate-500">No hay tareas asignadas aún.</p></div>
                                        )}
                                    </div>
                                )}

                                {/* ── ASISTENCIA ── */}
                                {activeTab === 'attendance' && (
                                    <div className="animate-in fade-in duration-300">
                                        <AttendanceCalendar records={info.attendance_records} />
                                    </div>
                                )}

                                {/* ── DISCIPLINA ── */}
                                {activeTab === 'discipline' && (
                                    <div className="animate-in fade-in duration-300">
                                        {disciplineData && disciplineData.length > 0 ? (
                                            <div className="space-y-2">
                                                {disciplineData.map((inc) => {
                                                    const typeInfo = incidentTypeInfo[inc.incident_type] || incidentTypeInfo.warning;
                                                    const sevDot = severityDot[inc.severity] || severityDot.low;
                                                    return (
                                                        <div key={inc.id} className={`p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 transition-all ${inc.resolved ? 'opacity-60' : ''}`}>
                                                            <div className="flex items-start gap-3">
                                                                <div className={`p-2 rounded-lg mt-0.5 shrink-0 ${typeInfo.bg}`}><AlertTriangle className={`w-4 h-4 ${typeInfo.color}`} /></div>
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="flex items-center gap-2 flex-wrap">
                                                                        <p className="font-bold text-sm text-slate-800 dark:text-white">{inc.title}</p>
                                                                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${typeInfo.bg} ${typeInfo.color}`}>{typeInfo.label}</span>
                                                                        <span className={`w-2 h-2 rounded-full ${sevDot}`} />
                                                                        {inc.resolved && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20">✓ Resuelta</span>}
                                                                    </div>
                                                                    <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                                                                        <span>{formatDate(inc.incident_date)}</span>
                                                                        {inc.courses && <><span className="w-1 h-1 rounded-full bg-slate-300" /><span>{inc.courses.name}</span></>}
                                                                        {inc.reporter && <><span className="w-1 h-1 rounded-full bg-slate-300" /><span>Por: {inc.reporter.full_name}</span></>}
                                                                    </div>
                                                                    {inc.description && <p className="text-xs text-slate-600 dark:text-slate-400 mt-1.5">{inc.description}</p>}
                                                                    {inc.action_taken && <p className="text-xs mt-1"><span className="font-bold text-slate-700 dark:text-slate-300">Acción:</span> <span className="text-slate-500">{inc.action_taken}</span></p>}
                                                                    {inc.resolved && inc.resolution_notes && <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1 italic">Resolución: {inc.resolution_notes}</p>}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <div className="text-center py-12"><ShieldAlert className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" /><p className="text-sm text-slate-500">No hay reportes de disciplina. ¡Excelente!</p></div>
                                        )}
                                    </div>
                                )}

                                {/* ── PAGOS ── */}
                                {activeTab === 'finance' && (
                                    <div className="space-y-5 animate-in fade-in duration-300">
                                        {/* Course Breakdown */}
                                        {info.course_breakdown && info.course_breakdown.length > 0 && (
                                            <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 overflow-hidden">
                                                <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2">
                                                    <DollarSign className="w-4 h-4 text-brand-blue" />
                                                    <h4 className="font-bold text-sm text-slate-900 dark:text-white">Desglose por Curso</h4>
                                                </div>
                                                {/* Mobile Course Breakdown Cards */}
                                                <div className="sm:hidden p-3 space-y-2.5">
                                                    {info.course_breakdown.map((course, i) => (
                                                        <div key={i} className="p-3.5 bg-white dark:bg-slate-700/40 rounded-xl border border-slate-200/80 dark:border-slate-700 shadow-sm space-y-2">
                                                            <div className="flex items-center justify-between">
                                                                <span className="font-bold text-slate-900 dark:text-white text-sm">{course.course_name}</span>
                                                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${course.pending_amount > 0 ? 'bg-amber-50 text-amber-600 dark:bg-amber-900/30' : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30'}`}>
                                                                    {course.pending_amount > 0 ? `Pendiente: Q${course.pending_amount.toFixed(2)}` : 'Al día'}
                                                                </span>
                                                            </div>
                                                            <div className="grid grid-cols-3 gap-2 text-xs pt-1 border-t border-slate-100 dark:border-slate-700/50">
                                                                <div><span className="text-slate-400 block text-[10px]">Cuota</span><span className="font-semibold text-slate-700 dark:text-slate-300">Q{course.monthly_fee.toFixed(2)}</span></div>
                                                                <div><span className="text-slate-400 block text-[10px]">Total Pagado</span><span className="font-bold text-emerald-600">Q{course.total_paid.toFixed(2)}</span></div>
                                                                <div><span className="text-slate-400 block text-[10px]">Meses</span><span className="font-semibold text-slate-700 dark:text-slate-300">{course.months_charged}</span></div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                                {/* Desktop Course Breakdown Table */}
                                                <div className="hidden sm:block overflow-x-auto">
                                                    <table className="w-full text-sm">
                                                        <thead>
                                                            <tr className="bg-slate-100/50 dark:bg-slate-700/30 text-slate-500 text-xs uppercase tracking-wider">
                                                                <th className="px-5 py-2.5 text-left font-bold">Curso</th>
                                                                <th className="px-5 py-2.5 text-right font-bold">Cuota</th>
                                                                <th className="px-5 py-2.5 text-right font-bold">Meses</th>
                                                                <th className="px-5 py-2.5 text-right font-bold">Cobrado</th>
                                                                <th className="px-5 py-2.5 text-right font-bold">Pagado</th>
                                                                <th className="px-5 py-2.5 text-right font-bold">Pendiente</th>
                                                                <th className="px-5 py-2.5 text-right font-bold">A Favor</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                                                            {info.course_breakdown.map((course, i) => (
                                                                <tr key={i} className="hover:bg-white/50 dark:hover:bg-white/[0.02]">
                                                                    <td className="px-5 py-2.5 font-medium text-slate-900 dark:text-white">{course.course_name}</td>
                                                                    <td className="px-5 py-2.5 text-right text-slate-600 dark:text-slate-300">Q{course.monthly_fee.toFixed(2)}</td>
                                                                    <td className="px-5 py-2.5 text-right text-slate-600 dark:text-slate-300">{course.months_charged}</td>
                                                                    <td className="px-5 py-2.5 text-right text-slate-600 dark:text-slate-300">Q{course.total_due.toFixed(2)}</td>
                                                                    <td className="px-5 py-2.5 text-right text-emerald-600 font-medium">Q{course.total_paid.toFixed(2)}</td>
                                                                    <td className={`px-5 py-2.5 text-right font-bold ${course.pending_amount > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>Q{course.pending_amount.toFixed(2)}</td>
                                                                    <td className={`px-5 py-2.5 text-right font-bold ${course.saldo_a_favor > 0 ? 'text-emerald-500' : 'text-slate-400'}`}>{course.saldo_a_favor > 0 ? `Q${course.saldo_a_favor.toFixed(2)}` : '—'}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        )}
                                        {/* Payment History */}
                                        <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 overflow-hidden">
                                            <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2">
                                                <Receipt className="w-4 h-4 text-emerald-500" />
                                                <h4 className="font-bold text-sm text-slate-900 dark:text-white">Historial de Pagos</h4>
                                                <span className="ml-auto text-xs font-bold text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-lg">{info.payment_history?.length || 0} registros</span>
                                            </div>
                                            {info.payment_history && info.payment_history.length > 0 ? (
                                                <>
                                                    {/* Mobile Payment Cards */}
                                                    <div className="sm:hidden p-3 space-y-2.5">
                                                        {info.payment_history.map((payment) => (
                                                            <div key={payment.id} className="p-3.5 bg-white dark:bg-slate-700/40 rounded-xl border border-slate-200/80 dark:border-slate-700 shadow-sm flex flex-col gap-2">
                                                                <div className="flex items-start justify-between gap-2">
                                                                    <div className="min-w-0">
                                                                        <span className={`inline-flex text-[10px] font-bold px-2 py-0.5 rounded-full ${payment.payment_type === 'TUITION' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300' : payment.payment_type === 'ENROLLMENT' ? 'bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-700'}`}>
                                                                            {paymentTypeLabel(payment.payment_type)}
                                                                        </span>
                                                                        <h5 className="font-bold text-slate-900 dark:text-white text-sm mt-1 truncate">{payment.description || payment.course_name || 'Pago'}</h5>
                                                                        <p className="text-xs text-slate-500 dark:text-slate-400">{payment.course_name} • {formatDate(payment.payment_date)}</p>
                                                                    </div>
                                                                    <div className="text-right shrink-0">
                                                                        <p className="text-base font-black text-emerald-600 dark:text-emerald-400">Q{Number(payment.amount).toFixed(2)}</p>
                                                                        {Number(payment.discount) > 0 && <span className="text-[10px] text-amber-500 block">-Q{Number(payment.discount).toFixed(2)}</span>}
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-700 text-xs">
                                                                    <span className="text-slate-500 dark:text-slate-400 text-xs flex items-center gap-1">
                                                                        <CreditCard className="w-3 h-3 text-slate-400" />
                                                                        {methodLabel(payment.method)}
                                                                    </span>
                                                                    {payment.receipt_number ? (
                                                                        <Link
                                                                            to={`/verify-receipt/${payment.receipt_number}`}
                                                                            className="inline-flex items-center gap-1 font-mono text-brand-blue font-bold text-xs hover:underline bg-brand-blue/5 dark:bg-brand-blue/15 px-2 py-0.5 rounded-lg"
                                                                        >
                                                                            <Receipt className="w-3 h-3" />
                                                                            #{payment.receipt_number}
                                                                        </Link>
                                                                    ) : (
                                                                        <span className="text-slate-400 font-mono text-xs">—</span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>

                                                    {/* Desktop Table */}
                                                    <div className="hidden sm:block overflow-x-auto max-h-[400px] overflow-y-auto">
                                                        <table className="w-full text-sm">
                                                            <thead className="sticky top-0 z-10">
                                                                <tr className="bg-slate-100/50 dark:bg-slate-700/30 text-slate-500 text-xs uppercase tracking-wider">
                                                                    <th className="px-5 py-2.5 text-left font-bold">Fecha</th>
                                                                    <th className="px-5 py-2.5 text-left font-bold">Descripción</th>
                                                                    <th className="px-5 py-2.5 text-left font-bold">Curso</th>
                                                                    <th className="px-5 py-2.5 text-left font-bold">Tipo</th>
                                                                    <th className="px-5 py-2.5 text-left font-bold">Método</th>
                                                                    <th className="px-5 py-2.5 text-right font-bold">Monto</th>
                                                                    <th className="px-5 py-2.5 text-right font-bold">Recibo</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                                                                {info.payment_history.map((payment) => (
                                                                    <tr key={payment.id} className="hover:bg-white/50 dark:hover:bg-white/[0.02]">
                                                                        <td className="px-5 py-2.5 text-slate-600 whitespace-nowrap">{formatDate(payment.payment_date)}</td>
                                                                        <td className="px-5 py-2.5 text-slate-900 dark:text-white font-medium max-w-[200px] truncate" title={payment.description}>{payment.description || payment.tuition_month || '—'}</td>
                                                                        <td className="px-5 py-2.5 text-slate-600">{payment.course_name}</td>
                                                                        <td className="px-5 py-2.5">
                                                                            <span className={`inline-flex text-xs font-bold px-2 py-1 rounded-lg ${payment.payment_type === 'TUITION' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20' : payment.payment_type === 'ENROLLMENT' ? 'bg-purple-50 text-purple-600 dark:bg-purple-900/20' : 'bg-slate-100 text-slate-600 dark:bg-slate-700'}`}>
                                                                                {paymentTypeLabel(payment.payment_type)}
                                                                            </span>
                                                                        </td>
                                                                        <td className="px-5 py-2.5 text-slate-600"><span className="inline-flex items-center gap-1 text-xs"><CreditCard className="w-3 h-3" />{methodLabel(payment.method)}</span></td>
                                                                        <td className="px-5 py-2.5 text-right font-bold text-emerald-600 whitespace-nowrap">
                                                                            Q{Number(payment.amount).toFixed(2)}
                                                                            {Number(payment.discount) > 0 && <span className="block text-xs text-amber-500 font-medium">-Q{Number(payment.discount).toFixed(2)} desc.</span>}
                                                                        </td>
                                                                        <td className="px-5 py-2.5 text-right font-mono text-xs">
                                                                            {payment.receipt_number ? (
                                                                                <Link to={`/verify-receipt/${payment.receipt_number}`} className="text-brand-blue hover:underline font-bold">
                                                                                    #{payment.receipt_number}
                                                                                </Link>
                                                                            ) : (
                                                                                <span className="text-slate-400">—</span>
                                                                            )}
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="text-center py-10"><Receipt className="w-10 h-10 text-slate-300 mx-auto mb-2" /><p className="text-sm text-slate-500">No hay pagos registrados aún.</p></div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="text-center py-4 text-slate-500">No se pudo cargar la información.</div>
                    )}
                </div>
            )}
        </div>
    );
};

/* ──── Main Page ──── */
const ParentDashboard = () => {
    const { data: students, isLoading } = useQuery({ queryKey: ['my-students'], queryFn: fetchMyStudents });
    const [searchParams, setSearchParams] = useSearchParams();
    const queryTab = searchParams.get('tab') as TabKey | null;

    const [activeTab, setActiveTab] = useState<TabKey>(
        queryTab && ['summary', 'grades', 'assignments', 'attendance', 'finance', 'discipline'].includes(queryTab)
            ? queryTab
            : 'summary'
    );
    const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

    useEffect(() => {
        if (queryTab && ['summary', 'grades', 'assignments', 'attendance', 'finance', 'discipline'].includes(queryTab)) {
            setActiveTab(queryTab);
        }
    }, [queryTab]);

    useEffect(() => {
        if (students && students.length > 0 && !selectedStudentId) {
            setSelectedStudentId(students[0].student_id);
        }
    }, [students, selectedStudentId]);

    const handleTabChange = (newTab: TabKey) => {
        setActiveTab(newTab);
        setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            next.set('tab', newTab);
            return next;
        });
    };

    if (isLoading) return (
        <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
            <Loader2 className="animate-spin h-12 w-12 text-blue-500/50" />
            <p className="text-slate-400 font-medium animate-pulse">Cargando información...</p>
        </div>
    );

    return (
        <div className="max-w-6xl mx-auto pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-12 animate-in fade-in duration-500 space-y-5">
            {/* Warm Header with Campus Conectado and Support Calling */}
            <div className="flex flex-col gap-2 pt-1">
                <div className="flex items-center justify-between">
                    <div>
                        <span className="text-xs font-bold text-brand-teal uppercase tracking-widest">
                            Panel Familiar Ultra
                        </span>
                        <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                            Portal de Padres
                        </h1>
                    </div>
                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                        <span className="text-xs font-bold">Campus Conectado</span>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                        Supervisa en tiempo real el ingreso a sede, notas y estado administrativo de tus hijos.
                    </p>
                    <a
                        href="tel:+50223456789"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-brand-teal hover:text-white hover:bg-brand-teal font-bold text-xs transition-colors self-start sm:self-auto border border-slate-200 dark:border-white/5"
                    >
                        <Phone className="w-3.5 h-3.5" />
                        <span>Secretaría: +502 2345-6789</span>
                    </a>
                </div>
            </div>

            {/* Child Selector Pills for Multi-Child Parents */}
            {students && students.length > 1 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
                    <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" /> Hijos:
                    </span>
                    {students.map((s) => {
                        const isSelected = (selectedStudentId || students[0].student_id) === s.student_id;
                        return (
                            <button
                                key={s.student_id}
                                onClick={() => setSelectedStudentId(s.student_id)}
                                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 border ${
                                    isSelected
                                        ? 'bg-brand-blue text-white border-brand-blue shadow-md shadow-brand-blue/20 scale-[1.02]'
                                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-brand-blue/40'
                                }`}
                            >
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black ${
                                    isSelected ? 'bg-white/20 text-white' : 'bg-brand-blue/10 text-brand-blue'
                                }`}>
                                    {s.students?.full_name?.charAt(0) || 'E'}
                                </div>
                                <span className="truncate max-w-[140px] sm:max-w-none">{s.students?.full_name || 'Estudiante'}</span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                                    isSelected ? 'bg-white/25 text-white' : 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                                }`}>
                                    En Campus
                                </span>
                            </button>
                        );
                    })}
                </div>
            )}

            {!students || students.length === 0 ? (
                <div className="text-center py-20 glass-card rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
                    <Users className="mx-auto h-16 w-16 text-slate-300 dark:text-slate-600 mb-4" />
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Aún no tienes estudiantes vinculados</h3>
                    <p className="text-slate-500 dark:text-slate-400 mt-2 max-w-md mx-auto text-xs">
                        Comunícate con la administración de la academia para que vinculen tu cuenta con la de tus hijos.
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {students.map((s) => {
                        const isSelected = (selectedStudentId || students[0].student_id) === s.student_id;
                        return (
                            <ChildView
                                key={s.student_id}
                                student={s}
                                autoExpand={students.length === 1 ? true : isSelected}
                                activeTab={activeTab}
                                onTabChange={handleTabChange}
                            />
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default ParentDashboard;
