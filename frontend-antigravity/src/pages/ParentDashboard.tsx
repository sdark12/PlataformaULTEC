import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Users, CalendarCheck, BookOpen, AlertCircle, ChevronDown, ChevronUp, Receipt, CreditCard, DollarSign, CheckCircle2, XCircle, ChevronLeft, ChevronRight, Clock, ClipboardCheck, GraduationCap, FileCheck, ShieldAlert, AlertTriangle } from 'lucide-react';
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
interface AssignmentInfo { assignment_id: string; title: string; description: string; assignment_type: string; due_date: string; max_score: number; course_name: string; status: string; submission_date: string | null; score: number | null; feedback: string; }
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
                <div key={dateStr} className={`relative flex flex-col items-center justify-center py-2 rounded-lg transition-colors ${isToday ? 'ring-2 ring-brand-blue/50' : ''} ${status ? 'cursor-default' : 'opacity-60'}`} title={status ? statusLabel[status.toLowerCase()] || status : ''}>
                            <span className={`text-xs font-medium ${isToday ? 'text-brand-blue font-bold' : 'text-slate-600 dark:text-slate-400'}`}>{day}</span>
                            {status && <span className={`w-2 h-2 rounded-full mt-0.5 ${statusColor[status.toLowerCase()] || 'bg-slate-300'}`} />}
                        </div>
                    );
                })}
            </div>
            <div className="flex flex-wrap gap-3 mt-4 pt-3 border-t border-slate-100 dark:border-slate-700">
                {Object.entries(statusLabel).map(([key, label]) => (
                    <div key={key} className="flex items-center gap-1.5">
                        <span className={`w-3 h-3 rounded-full ${statusColor[key]}`} />
                        <span className="text-xs text-slate-500 font-medium">{label}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

/* ──── Tab definitions ──── */
type TabKey = 'summary' | 'grades' | 'assignments' | 'attendance' | 'discipline' | 'payments';
const TABS: { key: TabKey; label: string; icon: any }[] = [
    { key: 'summary', label: 'Resumen', icon: BookOpen },
    { key: 'grades', label: 'Calificaciones', icon: GraduationCap },
    { key: 'assignments', label: 'Tareas', icon: ClipboardCheck },
    { key: 'attendance', label: 'Asistencia', icon: CalendarCheck },
    { key: 'discipline', label: 'Disciplina', icon: ShieldAlert },
    { key: 'payments', label: 'Pagos', icon: Receipt },
];

/* ──── Child View Component ──── */
const ChildView = ({ student, autoExpand }: { student: StudentLink; autoExpand?: boolean }) => {
    const [expanded, setExpanded] = useState(autoExpand || false);
    const [activeTab, setActiveTab] = useState<TabKey>('summary');

    const { data: info, isLoading } = useQuery({ queryKey: ['childDashboard', student.student_id], queryFn: () => fetchChildDashboard(student.student_id), enabled: expanded });
    const { data: gradesData } = useQuery({ queryKey: ['childGrades', student.student_id], queryFn: () => fetchChildGrades(student.student_id), enabled: expanded });
    const { data: assignmentsData } = useQuery({ queryKey: ['childAssignments', student.student_id], queryFn: () => fetchChildAssignments(student.student_id), enabled: expanded });
    const { data: disciplineData } = useQuery({ queryKey: ['childDiscipline', student.student_id], queryFn: () => fetchChildDiscipline(student.student_id), enabled: expanded });

    return (
        <div className="glass-card mb-4 overflow-hidden animate-in fade-in">
            {/* Header */}
            <div className="p-5 flex items-center justify-between cursor-pointer hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors" onClick={() => setExpanded(!expanded)}>
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-brand-blue to-brand-purple flex items-center justify-center text-white font-bold text-lg shadow-sm">
                        {student.students?.full_name?.charAt(0) || 'E'}
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">{student.students?.full_name}</h3>
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-sm text-slate-500">{student.students?.personal_code || 'Sin código'}</span>
                            <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
                            <span className="text-xs font-bold text-brand-blue capitalize px-2 py-0.5 bg-brand-blue/10 rounded-md">{student.relationship}</span>
                        </div>
                    </div>
                </div>
                <div className="p-2 text-slate-400 hover:text-brand-blue transition-colors">
                    {expanded ? <ChevronUp className="w-6 h-6" /> : <ChevronDown className="w-6 h-6" />}
                </div>
            </div>

            {expanded && (
                <div className="border-t border-slate-100 dark:border-white/5">
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
                                                onClick={() => setActiveTab(tab.key)}
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
                                                <div className="flex items-center justify-between mb-2">
                                                    <h4 className="font-bold text-slate-900 dark:text-white">Boleta de Calificaciones</h4>
                                                    <span className={`text-sm font-black px-3 py-1 rounded-lg ${gradesData.general_average >= 60 ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20' : 'bg-rose-50 text-rose-600 dark:bg-rose-900/20'}`}>
                                                        Promedio General: {gradesData.general_average}
                                                    </span>
                                                </div>
                                                {gradesData.courses.map((course: any, ci: number) => (
                                                    <div key={ci} className="bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-5">
                                                        <div className="flex items-center justify-between mb-3">
                                                            <h5 className="font-bold text-slate-800 dark:text-slate-200">{course.course_name}</h5>
                                                            <span className={`text-xs font-black px-2.5 py-1 rounded-lg ${course.average >= 60 ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20' : 'bg-rose-50 text-rose-600 dark:bg-rose-900/20'}`}>Promedio: {course.average}</span>
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
                                {activeTab === 'payments' && (
                                    <div className="space-y-5 animate-in fade-in duration-300">
                                        {/* Course Breakdown */}
                                        {info.course_breakdown && info.course_breakdown.length > 0 && (
                                            <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 overflow-hidden">
                                                <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2">
                                                    <DollarSign className="w-4 h-4 text-brand-blue" />
                                                    <h4 className="font-bold text-sm text-slate-900 dark:text-white">Desglose por Curso</h4>
                                                </div>
                                                <div className="overflow-x-auto">
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
                                                <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
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
                                                                    <td className="px-5 py-2.5 text-right text-slate-500 font-mono text-xs">{payment.receipt_number || '—'}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
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

    if (isLoading) return (
        <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
            <Loader2 className="animate-spin h-12 w-12 text-blue-500/50" />
            <p className="text-slate-400 font-medium animate-pulse">Cargando información...</p>
        </div>
    );

    return (
        <div className="max-w-6xl mx-auto pb-12 animate-in fade-in duration-500">
            <header className="mb-8">
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Portal de Padres</h1>
                <p className="text-slate-500 dark:text-slate-400 mt-1">Supervisa el progreso académico y administrativo de tus hijos.</p>
            </header>
            {!students || students.length === 0 ? (
                <div className="text-center py-20 glass-card">
                    <Users className="mx-auto h-16 w-16 text-slate-300 dark:text-slate-600 mb-4" />
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Aún no tienes estudiantes vinculados</h3>
                    <p className="text-slate-500 dark:text-slate-400 mt-2 max-w-md mx-auto">Comunícate con la administración de la academia para que vinculen tu cuenta con la de tus hijos.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {students.map(s => <ChildView key={s.student_id} student={s} autoExpand={students.length === 1} />)}
                </div>
            )}
        </div>
    );
};

export default ParentDashboard;
