import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getStudentAttendance } from './academicService';
import { 
    Loader2, 
    Users, 
    Calendar, 
    AlertCircle, 
    CheckCircle2, 
    Clock, 
    FileText, 
    Sparkles, 
    Check, 
    ShieldCheck, 
    BookOpen,
    Layers
} from 'lucide-react';
import { getCurrentUser } from '../auth/authService';
import StudentJustificationModal from './components/StudentJustificationModal';

const StudentAttendance = () => {
    const user = getCurrentUser();
    const [selectedYearFilter, setSelectedYearFilter] = useState<string>('ALL');
    const [selectedCourseFilter, setSelectedCourseFilter] = useState<string>('ALL');
    const [selectedStatusFilter, setSelectedStatusFilter] = useState<'ALL' | 'PRESENT' | 'LATE' | 'ABSENT' | 'EXCUSED'>('ALL');
    const [selectedAbsentRecord, setSelectedAbsentRecord] = useState<any | null>(null);
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    const { data: attendanceHistory, isLoading, error } = useQuery({
        queryKey: ['my_attendance'],
        queryFn: getStudentAttendance,
    });

    // 1. Extraer años lectivos disponibles a partir de las fechas registradas
    const availableYears = useMemo(() => {
        if (!attendanceHistory || attendanceHistory.length === 0) return [];
        const years = new Set<string>();
        attendanceHistory.forEach((r: any) => {
            if (r.date) {
                const y = r.date.split('-')[0];
                if (y && y.length === 4) years.add(y);
            }
        });
        return Array.from(years).sort().reverse();
    }, [attendanceHistory]);

    // 2. Filtrar registros por el año seleccionado (o todos)
    const recordsInSelectedYear = useMemo(() => {
        if (!attendanceHistory) return [];
        if (selectedYearFilter === 'ALL') return attendanceHistory;
        return attendanceHistory.filter((r: any) => {
            const y = r.date ? r.date.split('-')[0] : '';
            return y === selectedYearFilter;
        });
    }, [attendanceHistory, selectedYearFilter]);

    // 3. Calcular desglose y métricas individuales por cada curso dentro del año/alcance activo
    const coursesInScope = useMemo(() => {
        const map = new Map<string, {
            course_id: string;
            course_name: string;
            total: number;
            present: number;
            late: number;
            absent: number;
            excused: number;
            percentage: number;
        }>();

        recordsInSelectedYear.forEach((r: any) => {
            const cName = r.course_name || 'Curso Desconocido';
            if (!map.has(cName)) {
                map.set(cName, {
                    course_id: r.course_id,
                    course_name: cName,
                    total: 0,
                    present: 0,
                    late: 0,
                    absent: 0,
                    excused: 0,
                    percentage: 100
                });
            }
            const item = map.get(cName)!;
            item.total += 1;
            if (r.status === 'PRESENT') item.present += 1;
            else if (r.status === 'LATE') item.late += 1;
            else if (r.status === 'ABSENT') item.absent += 1;
            else if (r.status === 'EXCUSED') item.excused += 1;
        });

        // Calcular porcentaje individual de asistencia por curso
        map.forEach(item => {
            item.percentage = item.total > 0
                ? Math.round(((item.present + (item.late * 0.9) + (item.excused * 0.8)) / item.total) * 100)
                : 100;
        });

        return Array.from(map.values()).sort((a, b) => a.course_name.localeCompare(b.course_name));
    }, [recordsInSelectedYear]);

    // Si el curso seleccionado no existe en el año cambiado, regresar a 'ALL'
    useEffect(() => {
        if (selectedCourseFilter !== 'ALL') {
            const exists = coursesInScope.some(c => c.course_name === selectedCourseFilter);
            if (!exists) {
                setSelectedCourseFilter('ALL');
            }
        }
    }, [coursesInScope, selectedCourseFilter]);

    // 4. Registros correspondientes al curso seleccionado (o todos)
    const recordsInSelectedCourse = useMemo(() => {
        if (selectedCourseFilter === 'ALL') return recordsInSelectedYear;
        return recordsInSelectedYear.filter((r: any) => r.course_name === selectedCourseFilter);
    }, [recordsInSelectedYear, selectedCourseFilter]);

    // 5. Estadísticas activas para el velocímetro y las 4 tarjetas (100% sincronizadas)
    const activeStats = useMemo(() => {
        const total = recordsInSelectedCourse.length;
        const present = recordsInSelectedCourse.filter((r: any) => r.status === 'PRESENT').length;
        const late = recordsInSelectedCourse.filter((r: any) => r.status === 'LATE').length;
        const absent = recordsInSelectedCourse.filter((r: any) => r.status === 'ABSENT').length;
        const excused = recordsInSelectedCourse.filter((r: any) => r.status === 'EXCUSED').length;
        const percentage = total > 0
            ? Math.round(((present + (late * 0.9) + (excused * 0.8)) / total) * 100)
            : 100;

        return { total, present, late, absent, excused, percentage };
    }, [recordsInSelectedCourse]);

    // 6. Registros finales filtrados por estado para la lista de sesiones
    const filteredRecords = useMemo(() => {
        return recordsInSelectedCourse.filter((record: any) => {
            const matchesStatus = selectedStatusFilter === 'ALL' || record.status === selectedStatusFilter;
            return matchesStatus;
        });
    }, [recordsInSelectedCourse, selectedStatusFilter]);

    // Insignia de estado según rendimiento
    const getPerformanceBadge = (percentage: number, total: number) => {
        if (total === 0) {
            return { 
                label: 'Sin Clases Aún', 
                style: 'bg-slate-100 dark:bg-slate-800 text-slate-400 border border-slate-300 dark:border-slate-700' 
            };
        }
        if (percentage >= 80) {
            return { 
                label: 'Nivel Óptimo', 
                style: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' 
            };
        }
        if (percentage >= 70) {
            return { 
                label: 'En Observación', 
                style: 'bg-amber-500/15 text-amber-400 border border-amber-500/30' 
            };
        }
        return { 
            label: 'Atención Requerida', 
            style: 'bg-rose-500/15 text-rose-400 border border-rose-500/30' 
        };
    };

    const perfBadge = getPerformanceBadge(activeStats.percentage, activeStats.total);

    // Cálculos SVG para el indicador circular
    const radius = 68;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (activeStats.percentage / 100) * circumference;

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px]">
                <Loader2 className="animate-spin h-10 w-10 text-brand-blue mb-4" />
                <p className="text-slate-500 dark:text-slate-400 font-medium">Cargando métricas de concurrencia...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px]">
                <AlertCircle className="h-10 w-10 text-rose-500 mb-4" />
                <p className="text-slate-500 dark:text-slate-400 font-medium">Error al cargar el historial de asistencia.</p>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto pb-36 sm:pb-16 px-4 sm:px-6 animate-in fade-in duration-300">
            {/* Toast Notification */}
            {toastMessage && (
                <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[110] px-4 py-3 bg-emerald-600 text-white text-sm font-bold rounded-2xl shadow-2xl shadow-emerald-950/60 border border-emerald-400/30 flex items-center gap-2 animate-in fade-in slide-in-from-top-4 duration-200">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{toastMessage}</span>
                </div>
            )}

            {/* Top Student Executive Banner */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-950 p-4 sm:p-5 shadow-xl border border-white/10 mb-6 text-white">
                <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-brand-purple/20 blur-2xl pointer-events-none" />
                <div className="absolute -left-6 -bottom-6 w-28 h-28 rounded-full bg-brand-blue/20 blur-xl pointer-events-none" />
                
                <div className="relative flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="relative flex-shrink-0">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-brand-blue to-brand-purple flex items-center justify-center text-white font-black text-lg shadow-md border border-white/20">
                                {user?.name?.charAt(0)?.toUpperCase() || 'E'}
                            </div>
                            <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 ring-2 ring-slate-900 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                        </div>
                        <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-1.5">
                                <h2 className="font-bold text-base sm:text-lg text-white truncate">{user?.name || 'Estudiante'}</h2>
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                                    ALUMNO
                                </span>
                            </div>
                            <span className="text-xs text-slate-400 truncate">Control de Asistencia y Puntualidad Académica</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold shrink-0">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="hidden sm:inline">Estado:</span> Activo
                    </div>
                </div>
            </div>

            {/* Hero Attendance Gauge Section */}
            <div className="relative overflow-hidden rounded-3xl bg-white dark:bg-slate-900/90 p-5 sm:p-7 shadow-sm border border-slate-200/80 dark:border-slate-800 mb-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-brand-blue dark:text-blue-400">
                                {selectedCourseFilter === 'ALL' ? 'Rendimiento Global' : 'Rendimiento por Materia'}
                            </span>
                            {selectedYearFilter !== 'ALL' && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/25">
                                    Ciclo {selectedYearFilter}
                                </span>
                            )}
                        </div>
                        <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight truncate mt-0.5">
                            {selectedCourseFilter === 'ALL' ? 'Métricas Consolidadas' : selectedCourseFilter}
                        </h3>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap justify-between sm:justify-end">
                        {/* Selector de Año Lectivo (si hay registros de varios años) */}
                        {availableYears.length > 1 && (
                            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/60 text-xs">
                                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                <span className="text-[11px] font-semibold text-slate-400">Año:</span>
                                <select
                                    value={selectedYearFilter}
                                    onChange={(e) => setSelectedYearFilter(e.target.value)}
                                    className="bg-transparent text-slate-800 dark:text-slate-100 font-bold outline-none cursor-pointer pr-1 py-0.5 text-xs"
                                >
                                    <option value="ALL" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100">
                                        Todos los Años
                                    </option>
                                    {availableYears.map(y => (
                                        <option key={y} value={y} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100">
                                            Año {y}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <div className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 shrink-0 ${perfBadge.style}`}>
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>{perfBadge.label}</span>
                        </div>
                    </div>
                </div>

                {/* Central Gauge */}
                <div className="flex flex-col items-center justify-center py-2 relative">
                    <div className="relative w-44 h-44 flex items-center justify-center">
                        <svg className="w-full h-full -rotate-90" viewBox="0 0 160 160">
                            <circle
                                className="text-slate-100 dark:text-slate-800"
                                cx="80"
                                cy="80"
                                fill="transparent"
                                r={radius}
                                stroke="currentColor"
                                strokeWidth="12"
                            />
                            <circle
                                className="transition-all duration-1000 ease-out"
                                cx="80"
                                cy="80"
                                fill="transparent"
                                r={radius}
                                stroke="url(#attendanceGrad)"
                                strokeDasharray={circumference}
                                strokeDashoffset={strokeDashoffset}
                                strokeLinecap="round"
                                strokeWidth="12"
                            />
                            <defs>
                                <linearGradient id="attendanceGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                    <stop 
                                        offset="0%" 
                                        stopColor={activeStats.percentage >= 80 ? '#10b981' : activeStats.percentage >= 70 ? '#f59e0b' : '#f43f5e'} 
                                    />
                                    <stop 
                                        offset="100%" 
                                        stopColor={activeStats.percentage >= 80 ? '#0d59f2' : activeStats.percentage >= 70 ? '#3b82f6' : '#e11d48'} 
                                    />
                                </linearGradient>
                            </defs>
                        </svg>

                        <div className="absolute flex flex-col items-center justify-center text-center">
                            <span className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 dark:text-white">
                                {activeStats.percentage}%
                            </span>
                            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mt-0.5">
                                Asistencia
                            </span>
                        </div>
                    </div>
                </div>

                {/* Bottom 4 Counters Sincronizados con el Curso / Año Seleccionado */}
                <div className="grid grid-cols-4 gap-2 pt-4 border-t border-slate-100 dark:border-slate-800/80">
                    <div className="flex flex-col items-center p-2 rounded-2xl bg-slate-50 dark:bg-slate-800/50">
                        <div className="p-1.5 rounded-xl bg-slate-200 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 mb-1">
                            <Calendar className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 truncate">Total</span>
                        <span className="text-xl sm:text-2xl font-black text-slate-800 dark:text-slate-100 mt-0.5">
                            {activeStats.total}
                        </span>
                        <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 mt-1 bg-slate-200/60 dark:bg-slate-700/40 px-1.5 py-0.5 rounded-full">
                            Clases
                        </span>
                    </div>

                    <div className="flex flex-col items-center p-2 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/20">
                        <div className="p-1.5 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 mb-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 truncate">Presentes</span>
                        <span className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                            {activeStats.present}
                        </span>
                        <span className="text-[9px] font-bold text-emerald-700 dark:text-emerald-300 mt-1 bg-emerald-100 dark:bg-emerald-900/50 px-1.5 py-0.5 rounded-full">
                            A tiempo
                        </span>
                    </div>

                    <div className="flex flex-col items-center p-2 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20">
                        <div className="p-1.5 rounded-xl bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 mb-1">
                            <Clock className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 truncate">Tardanzas</span>
                        <span className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400 mt-0.5">
                            {activeStats.late}
                        </span>
                        <span className="text-[9px] font-bold text-amber-700 dark:text-amber-300 mt-1 bg-amber-100 dark:bg-amber-900/50 px-1.5 py-0.5 rounded-full">
                            Con retraso
                        </span>
                    </div>

                    <div className="flex flex-col items-center p-2 rounded-2xl bg-rose-50/60 dark:bg-rose-950/20">
                        <div className="p-1.5 rounded-xl bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400 mb-1">
                            <AlertCircle className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 truncate">Ausencias</span>
                        <span className="text-xl sm:text-2xl font-black text-rose-600 dark:text-rose-400 mt-0.5">
                            {activeStats.absent}
                        </span>
                        <span className="text-[9px] font-bold text-rose-700 dark:text-rose-300 mt-1 bg-rose-100 dark:bg-rose-900/50 px-1.5 py-0.5 rounded-full">
                            {activeStats.excused > 0 ? `${activeStats.excused} justif.` : 'Sin justificar'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Desglose Individual por Asignatura (Cards Interactivas) */}
            {coursesInScope.length > 1 && (
                <div className="mb-6">
                    <div className="flex items-center justify-between mb-3 px-1">
                        <div className="flex items-center gap-2">
                            <BookOpen className="w-4 h-4 text-blue-500" />
                            <h4 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                                Desglose por Asignatura
                            </h4>
                        </div>
                        {selectedCourseFilter !== 'ALL' && (
                            <button
                                type="button"
                                onClick={() => setSelectedCourseFilter('ALL')}
                                className="text-xs font-bold text-blue-500 hover:text-blue-400 transition-colors flex items-center gap-1 active:scale-95"
                            >
                                <Layers className="w-3.5 h-3.5" />
                                <span>Ver todas</span>
                            </button>
                        )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        {coursesInScope.map((c) => {
                            const isSelected = selectedCourseFilter === c.course_name;

                            return (
                                <div
                                    key={c.course_name}
                                    onClick={() => setSelectedCourseFilter(isSelected ? 'ALL' : c.course_name)}
                                    className={`p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden backdrop-blur-sm active:scale-[0.98] ${
                                        isSelected
                                            ? 'bg-blue-600/10 dark:bg-blue-900/25 border-blue-500 shadow-md shadow-blue-500/10 ring-2 ring-blue-500/40'
                                            : 'bg-white dark:bg-slate-900/80 border-slate-200/80 dark:border-slate-800 hover:border-blue-400/50 dark:hover:border-slate-700 hover:shadow-sm'
                                    }`}
                                >
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                        <div className="min-w-0">
                                            <h5 className="font-bold text-sm text-slate-900 dark:text-white truncate" title={c.course_name}>
                                                {c.course_name}
                                            </h5>
                                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                                {c.total} {c.total === 1 ? 'clase registrada' : 'clases registradas'}
                                            </p>
                                        </div>
                                        <span className={`text-base font-black shrink-0 ${
                                            c.percentage >= 80 ? 'text-emerald-500 dark:text-emerald-400' :
                                            c.percentage >= 70 ? 'text-amber-500 dark:text-amber-400' :
                                            'text-rose-500 dark:text-rose-400'
                                        }`}>
                                            {c.percentage}%
                                        </span>
                                    </div>

                                    {/* Barra de progreso de asistencia */}
                                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden mb-3">
                                        <div
                                            className={`h-full rounded-full transition-all duration-500 ${
                                                c.percentage >= 80 ? 'bg-gradient-to-r from-emerald-500 to-teal-400' :
                                                c.percentage >= 70 ? 'bg-gradient-to-r from-amber-500 to-yellow-400' :
                                                'bg-gradient-to-r from-rose-500 to-red-500'
                                            }`}
                                            style={{ width: `${Math.min(c.percentage, 100)}%` }}
                                        />
                                    </div>

                                    {/* Conteo rápido de sesiones */}
                                    <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                                        <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                                            <CheckCircle2 className="w-3 h-3" />
                                            {c.present} pres.
                                        </span>
                                        <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-semibold">
                                            <Clock className="w-3 h-3" />
                                            {c.late} tard.
                                        </span>
                                        <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400 font-semibold">
                                            <AlertCircle className="w-3 h-3" />
                                            {c.absent} {c.absent === 1 ? 'falta' : 'faltas'}
                                        </span>
                                    </div>

                                    {isSelected && (
                                        <div className="absolute top-0 right-0 w-2.5 h-2.5 bg-blue-500 rounded-bl-full" />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Quick Actions & Filters Bar */}
            <div className="flex flex-col gap-3 mb-6">
                {/* Course Filter Pills */}
                {coursesInScope.length > 1 && (
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                        <button
                            type="button"
                            onClick={() => setSelectedCourseFilter('ALL')}
                            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 active:scale-95 ${
                                selectedCourseFilter === 'ALL'
                                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                                    : 'bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                            }`}
                        >
                            <span>Todos los Cursos</span>
                            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                                selectedCourseFilter === 'ALL' ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                            }`}>
                                {recordsInSelectedYear.length}
                            </span>
                        </button>
                        {coursesInScope.map((c) => (
                            <button
                                key={c.course_name}
                                type="button"
                                onClick={() => setSelectedCourseFilter(c.course_name)}
                                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 active:scale-95 ${
                                    selectedCourseFilter === c.course_name
                                        ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                                        : 'bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                                }`}
                            >
                                <span>{c.course_name}</span>
                                <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                                    selectedCourseFilter === c.course_name ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                                }`}>
                                    {c.total}
                                </span>
                            </button>
                        ))}
                    </div>
                )}

                {/* Status Segmented Tabs (Con cantidades exactas del curso seleccionado) */}
                <div className="grid grid-cols-4 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/60 gap-1 text-center">
                    <button
                        type="button"
                        onClick={() => setSelectedStatusFilter('ALL')}
                        className={`py-2 px-1 rounded-xl text-xs font-bold transition-all ${
                            selectedStatusFilter === 'ALL'
                                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                        }`}
                    >
                        Todas ({activeStats.total})
                    </button>
                    <button
                        type="button"
                        onClick={() => setSelectedStatusFilter('PRESENT')}
                        className={`py-2 px-1 rounded-xl text-xs font-bold transition-all ${
                            selectedStatusFilter === 'PRESENT'
                                ? 'bg-emerald-500 text-white shadow-sm'
                                : 'text-slate-500 dark:text-slate-400 hover:text-emerald-500'
                        }`}
                    >
                        Presente ({activeStats.present})
                    </button>
                    <button
                        type="button"
                        onClick={() => setSelectedStatusFilter('LATE')}
                        className={`py-2 px-1 rounded-xl text-xs font-bold transition-all ${
                            selectedStatusFilter === 'LATE'
                                ? 'bg-amber-500 text-white shadow-sm'
                                : 'text-slate-500 dark:text-slate-400 hover:text-amber-500'
                        }`}
                    >
                        Tarde ({activeStats.late})
                    </button>
                    <button
                        type="button"
                        onClick={() => setSelectedStatusFilter('ABSENT')}
                        className={`py-2 px-1 rounded-xl text-xs font-bold transition-all ${
                            selectedStatusFilter === 'ABSENT'
                                ? 'bg-rose-500 text-white shadow-sm'
                                : 'text-slate-500 dark:text-slate-400 hover:text-rose-500'
                        }`}
                    >
                        Falta ({activeStats.absent})
                    </button>
                </div>
            </div>

            {/* Attendance History Timeline List */}
            <div className="bg-white dark:bg-slate-900/90 rounded-3xl shadow-sm border border-slate-200/80 dark:border-slate-800 overflow-hidden">
                <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-brand-blue dark:text-blue-400" />
                        <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">
                            Historial Detallado de Sesiones
                        </h3>
                    </div>
                    <span className="text-xs text-slate-400 font-semibold">
                        {filteredRecords.length} {filteredRecords.length === 1 ? 'sesión' : 'sesiones'}
                    </span>
                </div>

                {filteredRecords.length === 0 ? (
                    <div className="p-12 text-center text-slate-400 dark:text-slate-500">
                        <Users className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                            Sin registros para el filtro actual
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                            Prueba seleccionando otro estado, curso o año lectivo.
                        </p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                        {filteredRecords.map((record: any) => {
                            const dateObj = new Date(record.date + 'T00:00:00');
                            const formattedDate = dateObj.toLocaleDateString('es-GT', {
                                weekday: 'short',
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                            });

                            const isAbsent = record.status === 'ABSENT';

                            return (
                                <div
                                    key={record.id}
                                    className="p-4 sm:p-5 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors flex items-center justify-between gap-3"
                                >
                                    <div className="flex items-center gap-3.5 min-w-0">
                                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                                            record.status === 'PRESENT'
                                                ? 'bg-emerald-100/80 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
                                                : record.status === 'LATE'
                                                ? 'bg-amber-100/80 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400'
                                                : record.status === 'EXCUSED'
                                                ? 'bg-blue-100/80 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400'
                                                : 'bg-rose-100/80 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400'
                                        }`}>
                                            {record.status === 'PRESENT' && <Check className="w-5 h-5 stroke-[2.5]" />}
                                            {record.status === 'LATE' && <Clock className="w-5 h-5 stroke-[2.5]" />}
                                            {record.status === 'EXCUSED' && <FileText className="w-5 h-5" />}
                                            {record.status === 'ABSENT' && <AlertCircle className="w-5 h-5 stroke-[2.5]" />}
                                        </div>

                                        <div className="min-w-0">
                                            <p className="font-bold text-slate-900 dark:text-white text-sm sm:text-base truncate">
                                                {record.course_name}
                                            </p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 capitalize mt-0.5">
                                                {formattedDate}
                                            </p>
                                            {record.remarks && (
                                                <p className="text-[11px] text-slate-400 italic mt-1 truncate max-w-xs">
                                                    Nota: {record.remarks}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="shrink-0 flex flex-col items-end gap-1.5">
                                        {record.status === 'PRESENT' && (
                                            <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                                                Presente
                                            </span>
                                        )}
                                        {record.status === 'LATE' && (
                                            <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
                                                Tardanza
                                            </span>
                                        )}
                                        {record.status === 'EXCUSED' && (
                                            <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60">
                                                Justificado
                                            </span>
                                        )}
                                        {isAbsent && (
                                            <>
                                                <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60">
                                                    Ausente
                                                </span>
                                                {record.justification ? (
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${
                                                        record.justification.status === 'PENDING'
                                                            ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                                                            : record.justification.status === 'APPROVED'
                                                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                                                            : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                                                    }`}>
                                                        {record.justification.status === 'PENDING' && 'Justif. Pendiente'}
                                                        {record.justification.status === 'APPROVED' && 'Justif. Aprobada'}
                                                        {record.justification.status === 'REJECTED' && 'Justif. Rechazada'}
                                                    </span>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() => setSelectedAbsentRecord(record)}
                                                        className="flex items-center gap-1 px-2.5 py-1 bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/20 rounded-xl text-[11px] font-bold transition-all active:scale-95 shadow-sm"
                                                    >
                                                        <ShieldCheck className="w-3.5 h-3.5" />
                                                        <span>Justificar</span>
                                                    </button>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Modal de Solicitud de Justificación */}
            <StudentJustificationModal
                isOpen={!!selectedAbsentRecord}
                onClose={() => setSelectedAbsentRecord(null)}
                record={selectedAbsentRecord}
                onSuccess={() => {
                    setToastMessage('Solicitud de justificación enviada exitosamente.');
                    setTimeout(() => setToastMessage(null), 3500);
                }}
            />
        </div>
    );
};

export default StudentAttendance;
