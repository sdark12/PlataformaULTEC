import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getCourses, getCourseSchedules } from './academicService';
import { getAttendance, markAttendance, getJustifications } from './attendanceService';
import type { AttendanceRecord } from './attendanceService';
import { 
    Loader2, Save, Users, CheckCircle2, XCircle, Clock, Download, FileSpreadsheet, 
    ChevronLeft, ChevronRight, Calendar, Search, CheckCheck, Check, X, ShieldCheck, 
    BookOpen, QrCode, MessageSquare, Grid, WifiOff, Database
} from 'lucide-react';
import ConfirmModal from '../../components/ui/ConfirmModal';
import { exportToExcel, exportToPDF } from '../../utils/exportUtils';
import QrAttendanceScannerModal from './components/QrAttendanceScannerModal';
import AttendanceMatrixView from './components/AttendanceMatrixView';
import JustificationReviewModal from './components/JustificationReviewModal';
import { offlineStorage } from '../../services/offlineStorage';
import { offlineSyncService } from '../../services/offlineSyncService';

const STATUS_CONFIG = {
    PRESENT: {
        label: 'Presente',
        shortLabel: 'Presente',
        activeBtn: 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30 ring-1 ring-emerald-400',
        badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
        icon: Check,
    },
    ABSENT: {
        label: 'Ausente',
        shortLabel: 'Ausente',
        activeBtn: 'bg-rose-600 text-white shadow-md shadow-rose-600/30 ring-1 ring-rose-400',
        badge: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
        icon: X,
    },
    LATE: {
        label: 'Tarde',
        shortLabel: 'Tarde',
        activeBtn: 'bg-amber-600 text-white shadow-md shadow-amber-600/30 ring-1 ring-amber-400',
        badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
        icon: Clock,
    },
    EXCUSED: {
        label: 'Excusado',
        shortLabel: 'Excusa',
        activeBtn: 'bg-blue-600 text-white shadow-md shadow-blue-600/30 ring-1 ring-blue-400',
        badge: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
        icon: ShieldCheck,
    },
};

const Attendance = () => {
    const queryClient = useQueryClient();
    const [viewMode, setViewMode] = useState<'daily' | 'matrix'>('daily');
    const [selectedYearFilter, setSelectedYearFilter] = useState<'ALL' | number>('ALL');
    const [selectedCourse, setSelectedCourse] = useState<string>(() => {
        return localStorage.getItem('last_attendance_course') || '';
    });
    const [selectedSchedule, setSelectedSchedule] = useState<string>('');
    const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().slice(0, 10));
    const [attendanceData, setAttendanceData] = useState<AttendanceRecord[]>([]);
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED'>('ALL');
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    
    // Estados Offline
    const [isOffline, setIsOffline] = useState(!navigator.onLine);
    const [isFromCache, setIsFromCache] = useState(false);

    useEffect(() => {
        const handleOnline = () => setIsOffline(false);
        const handleOffline = () => setIsOffline(true);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // Modales
    const [isQrModalOpen, setIsQrModalOpen] = useState(false);
    const [isJustificationModalOpen, setIsJustificationModalOpen] = useState(false);

    const { data: courses, isLoading: isLoadingCourses } = useQuery({ 
        queryKey: ['courses'], 
        queryFn: getCourses 
    });

    // Catálogo con fallback offline
    const effectiveCourses = useMemo(() => {
        if (courses && courses.length > 0) return courses;
        try {
            const cached = localStorage.getItem('ultec_cached_courses_catalog');
            if (cached) return JSON.parse(cached);
        } catch (e) {}
        return [];
    }, [courses]);

    // Extraer ciclos escolares únicos ordenados descendentemente
    const distinctCycles = useMemo(() => {
        const years = new Set<number>();
        effectiveCourses.forEach((c: any) => {
            const yr = c.academic_year || 2026;
            years.add(yr);
        });
        return Array.from(years).sort((a, b) => b - a);
    }, [effectiveCourses]);

    // Filtrar cursos por el ciclo escolar activo
    const filteredCourses = useMemo(() => {
        if (!effectiveCourses) return [];
        if (selectedYearFilter === 'ALL') return effectiveCourses;
        return effectiveCourses.filter((c: any) => (c.academic_year || 2026) === selectedYearFilter);
    }, [effectiveCourses, selectedYearFilter]);

    useEffect(() => {
        if (courses && courses.length > 0) {
            localStorage.setItem('ultec_cached_courses_catalog', JSON.stringify(courses));
        }
    }, [courses]);

    // Validar y sincronizar curso con el ciclo activo y localStorage
    useEffect(() => {
        if (filteredCourses && filteredCourses.length > 0) {
            const exists = filteredCourses.some((c: any) => c.id === selectedCourse);
            if (!exists) {
                const nextCourse = filteredCourses[0].id;
                setSelectedCourse(nextCourse);
                setSelectedSchedule('');
                localStorage.setItem('last_attendance_course', nextCourse);
            }
        } else if (filteredCourses && filteredCourses.length === 0 && selectedCourse) {
            setSelectedCourse('');
            setSelectedSchedule('');
            localStorage.removeItem('last_attendance_course');
        }
    }, [filteredCourses, selectedCourse]);

    const handleCourseChange = (courseId: string) => {
        setSelectedCourse(courseId);
        setSelectedSchedule('');
        if (courseId) {
            localStorage.setItem('last_attendance_course', courseId);
        } else {
            localStorage.removeItem('last_attendance_course');
        }
    };

    const { data: schedules } = useQuery({
        queryKey: ['course_schedules', selectedCourse],
        queryFn: () => getCourseSchedules(selectedCourse),
        enabled: !!selectedCourse,
    });

    const { data: fetchedAttendance, isLoading, isFetching } = useQuery({
        queryKey: ['attendance', selectedCourse, selectedDate, selectedSchedule],
        queryFn: () => getAttendance(selectedCourse, selectedDate, selectedSchedule),
        enabled: !!selectedCourse && !!selectedDate && viewMode === 'daily',
    });

    // Sincronizar datos de asistencia online con IndexedDB
    useEffect(() => {
        if (fetchedAttendance && fetchedAttendance.length > 0) {
            setAttendanceData(fetchedAttendance);
            setIsFromCache(false);
            if (selectedCourse) {
                const currentCourseName = effectiveCourses.find((c: any) => c.id === selectedCourse)?.name || 'Curso';
                offlineStorage.saveRoster(selectedCourse, currentCourseName, fetchedAttendance).catch(console.error);
                offlineStorage.saveLocalAttendance(selectedCourse, selectedDate, fetchedAttendance).catch(console.error);
            }
        }
    }, [fetchedAttendance, selectedCourse, selectedDate, effectiveCourses]);

    // Si no hay conexión o falla la red, cargar desde IndexedDB
    useEffect(() => {
        if ((isOffline || !navigator.onLine) && selectedCourse) {
            const loadOffline = async () => {
                try {
                    const localAtt = await offlineStorage.getLocalAttendance(selectedCourse, selectedDate);
                    if (localAtt && localAtt.students && localAtt.students.length > 0) {
                        setAttendanceData(localAtt.students);
                        setIsFromCache(true);
                        return;
                    }
                    const cachedRoster = await offlineStorage.getRoster(selectedCourse);
                    if (cachedRoster && cachedRoster.students && cachedRoster.students.length > 0) {
                        setAttendanceData(cachedRoster.students.map((s: any) => ({
                            student_id: s.student_id,
                            student_name: s.student_name,
                            student_code: s.student_code || '',
                            phone: s.phone || '',
                            guardian_phone: s.guardian_phone || '',
                            date: selectedDate,
                            status: 'PENDING',
                            remarks: '',
                            is_recorded: false
                        })));
                        setIsFromCache(true);
                    }
                } catch (e) {
                    console.error('Error cargando datos offline de asistencia:', e);
                }
            };
            loadOffline();
        }
    }, [isOffline, selectedCourse, selectedDate]);

    // Contador de justificaciones pendientes para este curso
    const { data: pendingJustifications } = useQuery({
        queryKey: ['pending_justifications_count', selectedCourse],
        queryFn: () => getJustifications({ course_id: selectedCourse, status: 'PENDING' }),
        enabled: !!selectedCourse,
    });
    const pendingCount = pendingJustifications?.length || 0;

    const mutation = useMutation({
        mutationFn: markAttendance,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['attendance'] });
            queryClient.invalidateQueries({ queryKey: ['attendance_matrix'] });
            setToastMessage(`¡Asistencia guardada correctamente! (${attendanceData.length} alumnos)`);
            setTimeout(() => setToastMessage(null), 3500);
        },
        onError: (err: any) => {
            alert(err.response?.data?.message || 'Error al guardar asistencia');
        }
    });

    const handleStatusChange = (studentId: string, status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED') => {
        setAttendanceData(prev => prev.map(p => p.student_id === studentId ? { ...p, status } : p));
    };

    const handleMarkAllPresent = () => {
        setAttendanceData(prev => prev.map(p => ({ ...p, status: 'PRESENT' })));
        setToastMessage('Todos los estudiantes marcados como Presentes');
        setTimeout(() => setToastMessage(null), 2500);
    };

    const handleMarkRemainingAbsent = () => {
        setAttendanceData(prev => prev.map(p => (p.status === 'PRESENT' || p.status === 'LATE' || p.status === 'EXCUSED') ? p : { ...p, status: 'ABSENT' }));
        setToastMessage('Alumnos pendientes marcados como Ausentes');
        setTimeout(() => setToastMessage(null), 2500);
    };

    // Callback al escanear QR de carnet (con status y observaciones de puntualidad)
    const handleStudentScanned = (studentId: string, status: 'PRESENT' | 'LATE' = 'PRESENT', remarks?: string) => {
        setAttendanceData(prev =>
            prev.map(p => {
                if (p.student_id !== studentId) return p;
                return {
                    ...p,
                    status,
                    remarks: remarks || p.remarks || `Registrado por QR (${new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })})`
                };
            })
        );
    };

    // Enviar WhatsApp a acudiente o alumno por inasistencia
    const handleSendWhatsApp = (record: AttendanceRecord) => {
        const rawPhone = record.guardian_phone || record.phone;
        let targetPhone = rawPhone ? rawPhone.replace(/\D/g, '') : '';

        if (!targetPhone) {
            const input = prompt(`El estudiante "${record.student_name}" no tiene número de teléfono registrado.\nIngresa el número de WhatsApp (con o sin código de país):`);
            if (!input) return;
            targetPhone = input.replace(/\D/g, '');
        }

        if (targetPhone.length === 8) {
            targetPhone = `502${targetPhone}`; // Prefijo Guatemala por defecto si son 8 dígitos
        }

        const currentCourseName = effectiveCourses?.find((c: any) => c.id === selectedCourse)?.name || 'su curso';
        const formattedDate = new Date(selectedDate + 'T00:00:00').toLocaleDateString('es-ES', {
            weekday: 'long',
            day: 'numeric',
            month: 'long'
        });

        const message = `Estimado(a) padre/tutor o estudiante:\nLe informamos que el día de hoy (${formattedDate}) se registró una inasistencia en el curso *${currentCourseName}* en ULTEC para *${record.student_name}*.\nSi se trata de un permiso o requiere justificar formalmente, favor de comunicarse con secretaría o el docente.`;

        const url = `https://api.whatsapp.com/send?phone=${targetPhone}&text=${encodeURIComponent(message)}`;
        window.open(url, '_blank');
    };

    const handleSave = async () => {
        if (!selectedCourse) return;
        const currentCourseName = effectiveCourses?.find((c: any) => c.id === selectedCourse)?.name || 'Curso';
        const payloadStudents = attendanceData.map(a => ({
            student_id: a.student_id,
            status: a.status === 'PENDING' ? 'ABSENT' : a.status,
            remarks: a.remarks || ''
        }));

        // Si estamos sin conexión a internet, encolar localmente
        if (!navigator.onLine || isOffline) {
            try {
                await offlineSyncService.queueAttendance(selectedCourse, currentCourseName, selectedDate, payloadStudents);
                setAttendanceData(prev => prev.map(p => ({
                    ...p,
                    status: p.status === 'PENDING' ? 'ABSENT' : p.status,
                    is_recorded: true
                })));
                setToastMessage(`💾 Guardado en tu dispositivo (${payloadStudents.length} alumnos). Se enviará al servidor al reconectar.`);
                setTimeout(() => setToastMessage(null), 4500);
            } catch (err: any) {
                alert('Error al guardar localmente: ' + err.message);
            }
            return;
        }

        // Si hay conexión, intentar enviar vía API
        mutation.mutate({
            course_id: selectedCourse,
            date: selectedDate,
            students: payloadStudents
        }, {
            onError: async (err: any) => {
                const isNetworkError = !err.response || err.code === 'ERR_NETWORK' || err.message?.includes('Network');
                if (isNetworkError) {
                    try {
                        await offlineSyncService.queueAttendance(selectedCourse, currentCourseName, selectedDate, payloadStudents);
                        setAttendanceData(prev => prev.map(p => ({
                            ...p,
                            status: p.status === 'PENDING' ? 'ABSENT' : p.status,
                            is_recorded: true
                        })));
                        setToastMessage(`💾 Red inestable. Guardado localmente (${payloadStudents.length} alumnos). Se enviará al reconectar.`);
                        setTimeout(() => setToastMessage(null), 4500);
                    } catch (qErr: any) {
                        alert('Error al guardar en cola offline: ' + qErr.message);
                    }
                } else {
                    alert(err.response?.data?.message || 'Error al guardar asistencia');
                }
            }
        });
    };

    const requestSave = () => {
        if (!selectedCourse || attendanceData.length === 0) return;
        setShowConfirmModal(true);
    };

    const confirmAndSave = () => {
        setShowConfirmModal(false);
        handleSave();
    };

    // Navegación de fechas
    const adjustDate = (days: number) => {
        const d = new Date(selectedDate + 'T00:00:00');
        d.setDate(d.getDate() + days);
        setSelectedDate(d.toISOString().slice(0, 10));
    };

    const setToToday = () => {
        setSelectedDate(new Date().toISOString().slice(0, 10));
    };

    const isToday = selectedDate === new Date().toISOString().slice(0, 10);

    const formattedDateHeader = new Date(selectedDate + 'T00:00:00').toLocaleDateString('es-ES', {
        weekday: 'short',
        day: 'numeric',
        month: 'short'
    });

    const isRecordedInDb = attendanceData.some(a => a.is_recorded);
    const stats = {
        total: attendanceData.length,
        pending: attendanceData.filter(a => a.status === 'PENDING').length,
        present: attendanceData.filter(a => a.status === 'PRESENT').length,
        absent: attendanceData.filter(a => a.status === 'ABSENT').length,
        late: attendanceData.filter(a => a.status === 'LATE').length,
        excused: attendanceData.filter(a => a.status === 'EXCUSED').length,
    };

    const attendanceRate = (stats.total - stats.pending) > 0
        ? Math.round(((stats.present + (stats.late * 0.9) + (stats.excused * 0.8)) / stats.total) * 100)
        : (isRecordedInDb ? 0 : 0);

    const filteredData = attendanceData.filter(record => {
        const matchesSearch = record.student_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            record.student_code?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === 'ALL' || record.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const currentCourseObj = effectiveCourses?.find((c: any) => c.id === selectedCourse);

    return (
        <div className="max-w-7xl mx-auto pb-28 md:pb-12 animate-in fade-in duration-300">
            {/* Toast Notification */}
            {toastMessage && (
                <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[110] px-4 py-3 bg-emerald-600 text-white text-sm font-bold rounded-2xl shadow-2xl shadow-emerald-950/60 border border-emerald-400/30 flex items-center gap-2 animate-in fade-in slide-in-from-top-4 duration-200">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{toastMessage}</span>
                </div>
            )}

            {/* Banner Informativo Offline */}
            {isOffline && (
                <div className="mb-5 p-3.5 sm:p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-amber-200 animate-in fade-in duration-200">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 shrink-0">
                            <WifiOff className="w-4 h-4" />
                        </div>
                        <div>
                            <p className="font-bold text-amber-300">Modo Sin Conexión Activo</p>
                            <p className="text-[11px] text-amber-400/90 mt-0.5">
                                Puedes tomar asistencia con total normalidad. Se guardará de forma segura en este equipo y se sincronizará automáticamente al volver el internet.
                            </p>
                        </div>
                    </div>
                    {isFromCache && (
                        <span className="shrink-0 px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold text-[10px] flex items-center gap-1.5 self-end sm:self-center">
                            <Database className="w-3 h-3" /> Nómina Local
                        </span>
                    )}
                </div>
            )}

            {/* Header Principal con Selector de Modo (Diario / Sábana) */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <div>
                    <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                        <span>Control de Asistencia</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-bold">
                            Académico
                        </span>
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-0.5">
                        Toma rápida diaria, escaneo de carnets QR y sábana mensual consolidada.
                    </p>
                </div>

                {/* Alternador de Modo de Vista */}
                <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-800 p-1.5 rounded-2xl self-stretch md:self-auto shadow-sm">
                    <button
                        type="button"
                        onClick={() => setViewMode('daily')}
                        className={`flex-1 md:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                            viewMode === 'daily'
                                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                        }`}
                    >
                        <Calendar className="w-3.5 h-3.5" />
                        <span>Pase Diario</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setViewMode('matrix')}
                        className={`flex-1 md:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                            viewMode === 'matrix'
                                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                        }`}
                    >
                        <Grid className="w-3.5 h-3.5" />
                        <span>Sábana Mensual</span>
                    </button>
                </div>
            </div>

            {/* Config & Filters Card */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-xl backdrop-blur-sm mb-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                    {/* Selector de Curso */}
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                            <BookOpen className="w-3.5 h-3.5 text-blue-400" />
                            <span>Curso / Asignatura</span>
                            </label>
                            {distinctCycles.length > 1 && (
                                <div className="flex items-center gap-1">
                                    <button
                                        type="button"
                                        onClick={() => setSelectedYearFilter('ALL')}
                                        className={`text-[10px] px-2 py-0.5 rounded-md font-bold transition-all ${
                                            selectedYearFilter === 'ALL'
                                                ? 'bg-blue-600 text-white shadow-xs'
                                                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                                        }`}
                                    >
                                        Todos
                                    </button>
                                    {distinctCycles.map((year) => (
                                        <button
                                            key={year}
                                            type="button"
                                            onClick={() => setSelectedYearFilter(year)}
                                            className={`text-[10px] px-2 py-0.5 rounded-md font-bold transition-all ${
                                                selectedYearFilter === year
                                                    ? 'bg-blue-600 text-white shadow-xs'
                                                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                                            }`}
                                        >
                                            {year}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="relative">
                            <select
                                className="w-full pl-3.5 pr-10 py-2.5 bg-slate-800/90 border border-slate-700 text-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all appearance-none outline-none font-medium text-xs sm:text-sm cursor-pointer"
                                value={selectedCourse}
                                onChange={(e) => handleCourseChange(e.target.value)}
                                disabled={isLoadingCourses}
                            >
                                <option value="" className="bg-slate-900 text-slate-400">-- Selecciona un curso --</option>
                                {filteredCourses?.map((c: any) => (
                                    <option key={c.id} value={c.id} className="bg-slate-900 text-slate-100">
                                        [Ciclo {c.academic_year || 2026}] {c.name}
                                    </option>
                                ))}
                            </select>
                            <div className="absolute inset-y-0 right-3.5 flex items-center pointer-events-none text-slate-400">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                </svg>
                            </div>
                        </div>
                    </div>

                    {/* Selector de Horario / Grado */}
                    <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-amber-400" />
                            <span>Horario / Grado</span>
                        </label>
                        <div className="relative">
                            <select
                                className="w-full pl-3.5 pr-10 py-2.5 bg-slate-800/90 border border-slate-700 text-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all appearance-none outline-none font-medium text-xs sm:text-sm cursor-pointer disabled:opacity-50"
                                value={selectedSchedule}
                                onChange={(e) => setSelectedSchedule(e.target.value)}
                                disabled={!selectedCourse}
                            >
                                <option value="" className="bg-slate-900 text-slate-400">Todos los Horarios</option>
                                {schedules?.map((s: any) => (
                                    <option key={s.id} value={s.id} className="bg-slate-900 text-slate-100">
                                        {s.grade} - {s.day_of_week} {s.start_time ? `(${s.start_time.substring(0, 5)})` : ''}
                                    </option>
                                ))}
                            </select>
                            <div className="absolute inset-y-0 right-3.5 flex items-center pointer-events-none text-slate-400">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                </svg>
                            </div>
                        </div>
                    </div>

                    {/* Selector de Fecha con Controles Rápidos (Solo en Vista Diaria) */}
                    {viewMode === 'daily' ? (
                        <div>
                            <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center justify-between">
                                <span className="flex items-center gap-1.5">
                                    <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                                    <span>Fecha ({formattedDateHeader})</span>
                                </span>
                                {!isToday && (
                                    <button
                                        onClick={setToToday}
                                        className="text-[10px] text-blue-400 hover:text-blue-300 font-bold uppercase underline"
                                    >
                                        Ir a Hoy
                                    </button>
                                )}
                            </label>
                            <div className="flex items-center gap-1.5">
                                <button
                                    onClick={() => adjustDate(-1)}
                                    className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition-colors"
                                    title="Día anterior"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                <input
                                    type="date"
                                    className="flex-1 px-3 py-2 bg-slate-800/90 border border-slate-700 text-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all outline-none font-medium text-xs sm:text-sm text-center"
                                    value={selectedDate}
                                    onChange={(e) => setSelectedDate(e.target.value)}
                                />
                                <button
                                    onClick={() => adjustDate(1)}
                                    className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition-colors"
                                    title="Día siguiente"
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col justify-center">
                            <span className="text-xs font-bold text-slate-400 mb-1.5">Vista Activa</span>
                            <div className="px-3 py-2.5 bg-blue-500/10 border border-blue-500/20 text-blue-300 rounded-xl text-xs font-semibold flex items-center gap-2">
                                <Grid className="w-4 h-4 text-blue-400" />
                                <span>Modo Matriz Mensual en Cuadrícula</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Barra de Acciones Rápidas (Solo en Vista Diaria) */}
                {viewMode === 'daily' && attendanceData.length > 0 && (
                    <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
                        {/* Botones de Acción en Aula */}
                        <div className="flex flex-wrap items-center gap-2">
                            {/* Botón Escáner QR */}
                            <button
                                type="button"
                                onClick={() => setIsQrModalOpen(true)}
                                className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl text-xs shadow-md shadow-blue-600/30 transition-all active:scale-95"
                                title="Abrir escáner de cámara para carnets QR"
                            >
                                <QrCode className="w-4 h-4" />
                                <span>Escanear QR</span>
                            </button>

                            {/* Marcar Todos Presentes */}
                            <button
                                type="button"
                                onClick={handleMarkAllPresent}
                                className="flex items-center gap-1.5 px-3 py-2 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-bold transition-all active:scale-95"
                                title="Marcar a todos como presentes"
                            >
                                <CheckCheck className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Todos</span> Presentes
                            </button>

                            {/* Marcar Restantes como Ausentes */}
                            <button
                                type="button"
                                onClick={handleMarkRemainingAbsent}
                                className="flex items-center gap-1.5 px-3 py-2 bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30 rounded-xl text-xs font-bold transition-all active:scale-95"
                                title="Marcar los que no están presentes como ausentes"
                            >
                                <XCircle className="w-3.5 h-3.5" />
                                <span>Restantes Ausentes</span>
                            </button>

                            {/* Bandeja de Justificaciones */}
                            <button
                                type="button"
                                onClick={() => setIsJustificationModalOpen(true)}
                                className="relative flex items-center gap-1.5 px-3 py-2 bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/30 rounded-xl text-xs font-bold transition-all active:scale-95"
                                title="Ver y revisar solicitudes de justificación"
                            >
                                <ShieldCheck className="w-3.5 h-3.5" />
                                <span>Justificaciones</span>
                                {pendingCount > 0 && (
                                    <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-black bg-purple-500 text-white animate-pulse">
                                        {pendingCount}
                                    </span>
                                )}
                            </button>
                        </div>

                        {/* Guardar y Exportar */}
                        <div className="flex items-center gap-2">
                            <button
                                onClick={requestSave}
                                disabled={mutation.isPending}
                                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold rounded-xl shadow-md shadow-blue-600/30 transition-all text-xs shrink-0"
                                title="Guardar cambios de asistencia"
                            >
                                <Save className="w-3.5 h-3.5" />
                                <span>Guardar</span>
                            </button>

                            <button
                                onClick={() => exportToExcel(
                                    attendanceData.map(a => ({ 
                                        Código: a.student_code,
                                        Estudiante: a.student_name, 
                                        Estado: a.status, 
                                        Observaciones: a.remarks || '' 
                                    })),
                                    `asistencia_${selectedDate}`
                                )}
                                className="flex items-center gap-1.5 px-3 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-semibold rounded-xl border border-emerald-500/30 transition-colors text-xs"
                                title="Descargar Excel del día"
                            >
                                <FileSpreadsheet className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Excel</span>
                            </button>

                            <button
                                onClick={() => exportToPDF(
                                    [
                                        { header: 'Código', dataKey: 'student_code' },
                                        { header: 'Estudiante', dataKey: 'student_name' }, 
                                        { header: 'Estado', dataKey: 'status' }, 
                                        { header: 'Observaciones', dataKey: 'remarks' }
                                    ],
                                    attendanceData,
                                    `Asistencia — ${currentCourseObj?.name || 'Curso'} (${selectedDate})`,
                                    `asistencia_${selectedDate}`
                                )}
                                className="flex items-center gap-1.5 px-3 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-semibold rounded-xl border border-rose-500/30 transition-colors text-xs"
                                title="Descargar PDF del día"
                            >
                                <Download className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">PDF</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* CONTENIDO SEGÚN MODO DE VISTA */}
            {viewMode === 'matrix' ? (
                /* Vista Sábana Mensual */
                selectedCourse ? (
                    <AttendanceMatrixView 
                        courseId={selectedCourse} 
                        courseName={currentCourseObj?.name}
                        scheduleId={selectedSchedule}
                    />
                ) : (
                    <div className="text-center py-16 bg-slate-900/60 rounded-3xl border border-dashed border-slate-800">
                        <BookOpen className="mx-auto h-12 w-12 text-slate-600 mb-3" />
                        <h3 className="text-base font-bold text-slate-200">Selecciona un curso</h3>
                        <p className="text-slate-400 text-xs mt-1">Elige un curso en la parte superior para cargar la sábana de asistencia.</p>
                    </div>
                )
            ) : (
                /* Vista Diaria */
                selectedCourse ? (
                    <>
                        {/* Métricas del Día: Tarjetas Adaptativas */}
                        <div className={`grid gap-2.5 sm:gap-3.5 mb-4 ${stats.pending > 0 ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6' : 'grid-cols-2 sm:grid-cols-5'}`}>
                            {/* Total */}
                            <div className="bg-slate-900/90 border border-slate-800 p-3 sm:p-4 rounded-2xl shadow-sm flex items-center space-x-3">
                                <div className="p-2 sm:p-2.5 bg-blue-500/15 text-blue-400 border border-blue-500/30 rounded-xl shrink-0">
                                    <Users className="w-4 h-4 sm:w-5 sm:h-5" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total</p>
                                    <p className="text-lg sm:text-2xl font-black text-slate-100">{stats.total}</p>
                                </div>
                            </div>

                            {/* Pendientes (si hay) */}
                            {stats.pending > 0 && (
                                <div className="bg-slate-900/90 border border-amber-500/40 p-3 sm:p-4 rounded-2xl shadow-sm flex items-center space-x-3 bg-amber-500/5">
                                    <div className="p-2 sm:p-2.5 bg-amber-500/15 text-amber-400 border border-amber-500/30 rounded-xl shrink-0">
                                        <Clock className="w-4 h-4 sm:w-5 sm:h-5 animate-pulse" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Sin marcar</p>
                                        <p className="text-lg sm:text-2xl font-black text-amber-300">{stats.pending}</p>
                                    </div>
                                </div>
                            )}

                            {/* Presentes */}
                            <div className="bg-slate-900/90 border border-slate-800 p-3 sm:p-4 rounded-2xl shadow-sm flex items-center space-x-3">
                                <div className="p-2 sm:p-2.5 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded-xl shrink-0">
                                    <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Presentes</p>
                                    <p className="text-lg sm:text-2xl font-black text-emerald-300">{stats.present}</p>
                                </div>
                            </div>

                            {/* Ausentes */}
                            <div className="bg-slate-900/90 border border-slate-800 p-3 sm:p-4 rounded-2xl shadow-sm flex items-center space-x-3">
                                <div className="p-2 sm:p-2.5 bg-rose-500/15 text-rose-400 border border-rose-500/30 rounded-xl shrink-0">
                                    <XCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[10px] font-bold text-rose-400 uppercase tracking-wider">Ausentes</p>
                                    <p className="text-lg sm:text-2xl font-black text-rose-300">{stats.absent}</p>
                                </div>
                            </div>

                            {/* Tardes */}
                            <div className="bg-slate-900/90 border border-slate-800 p-3 sm:p-4 rounded-2xl shadow-sm flex items-center space-x-3">
                                <div className="p-2 sm:p-2.5 bg-amber-500/15 text-amber-400 border border-amber-500/30 rounded-xl shrink-0">
                                    <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Tardes</p>
                                    <p className="text-lg sm:text-2xl font-black text-amber-300">{stats.late}</p>
                                </div>
                            </div>

                            {/* Excusados + Tasa */}
                            <div className="col-span-2 sm:col-span-1 bg-slate-900/90 border border-slate-800 p-3 sm:p-4 rounded-2xl shadow-sm flex items-center justify-between space-x-3">
                                <div className="flex items-center space-x-3 min-w-0">
                                    <div className="p-2 sm:p-2.5 bg-blue-500/15 text-blue-400 border border-blue-500/30 rounded-xl shrink-0">
                                        <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">Excusas</p>
                                        <p className="text-lg sm:text-2xl font-black text-blue-300">{stats.excused}</p>
                                    </div>
                                </div>
                                <span className={`px-2 py-1 rounded-xl text-xs font-black border ${
                                    attendanceRate >= 80 ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                                }`}>
                                    {attendanceRate}%
                                </span>
                            </div>
                        </div>

                        {/* Banner Informativo y Acciones Rápidas si hay Alumnos Sin Marcar */}
                        {stats.pending > 0 && (
                            <div className="mb-5 p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 backdrop-blur-sm">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping shrink-0" />
                                    <p className="text-xs text-amber-200">
                                        <strong>{stats.pending} alumno(s)</strong> pendientes de registrar hoy. Escanea su carnet con QR o márcalos con las opciones rápidas:
                                    </p>
                                </div>
                                <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
                                    <button
                                        type="button"
                                        onClick={handleMarkAllPresent}
                                        className="px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95"
                                    >
                                        <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
                                        <span>Todos Presentes</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleMarkRemainingAbsent}
                                        className="px-3 py-1.5 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95"
                                        title="Marca los alumnos no escaneados como Ausentes"
                                    >
                                        <XCircle className="w-3.5 h-3.5 text-rose-400" />
                                        <span>Pendientes Ausentes</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setIsQrModalOpen(true)}
                                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-600/30 flex items-center gap-1.5 active:scale-95"
                                    >
                                        <QrCode className="w-3.5 h-3.5" />
                                        <span>Escanear QR</span>
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Barra de Filtros Rápidos y Búsqueda */}
                        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3 mb-5 flex flex-col sm:flex-row items-center justify-between gap-3">
                            {/* Pestañas de Filtro por Estado */}
                            <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
                                {[
                                    { key: 'ALL', label: 'Todos', count: stats.total },
                                    ...(stats.pending > 0 ? [{ key: 'PENDING', label: 'Sin marcar', count: stats.pending }] : []),
                                    { key: 'PRESENT', label: 'Presentes', count: stats.present },
                                    { key: 'ABSENT', label: 'Ausentes', count: stats.absent },
                                    { key: 'LATE', label: 'Tardes', count: stats.late },
                                    { key: 'EXCUSED', label: 'Excusas', count: stats.excused },
                                ].map((tab) => (
                                    <button
                                        key={tab.key}
                                        type="button"
                                        onClick={() => setStatusFilter(tab.key as any)}
                                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                                            statusFilter === tab.key
                                                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                                                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                                        }`}
                                    >
                                        <span>{tab.label}</span>
                                        <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                                            statusFilter === tab.key ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-300'
                                        }`}>
                                            {tab.count}
                                        </span>
                                    </button>
                                ))}
                            </div>

                            {/* Búsqueda por Nombre o Código */}
                            <div className="relative w-full sm:max-w-xs">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                <input
                                    type="text"
                                    placeholder="Buscar alumno o código..."
                                    className="w-full pl-9 pr-3 py-2 bg-slate-950/60 border border-slate-700/80 text-slate-200 text-xs rounded-xl outline-none focus:border-blue-500 transition-all placeholder:text-slate-500"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Attendance Content */}
                        {isLoading || isFetching ? (
                            <div className="flex flex-col items-center justify-center p-12 bg-slate-900/60 rounded-3xl border border-slate-800 text-slate-400">
                                <Loader2 className="animate-spin h-8 w-8 text-blue-500 mb-3" />
                                <p className="text-sm font-medium">Cargando lista de estudiantes...</p>
                            </div>
                        ) : stats.total > 0 ? (
                            <>
                                {/* VISTA MÓVIL: Feed de Tarjetas Táctiles */}
                                <div className="block md:hidden space-y-3">
                                    {filteredData.map((record) => {
                                        const currentConfig = STATUS_CONFIG[record.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.PRESENT;
                                        const isAbsent = record.status === 'ABSENT';

                                        return (
                                            <div 
                                                key={record.student_id} 
                                                className={`bg-slate-900/90 border rounded-2xl p-3.5 shadow-md space-y-3 backdrop-blur-sm transition-all ${
                                                    isAbsent ? 'border-rose-500/30 bg-rose-500/5' : 'border-slate-800/90'
                                                }`}
                                            >
                                                {/* Header del Estudiante */}
                                                <div className="flex items-center justify-between gap-2">
                                                    <div className="flex items-center space-x-3 min-w-0">
                                                        <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shrink-0 border ${
                                                            record.status === 'PRESENT' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' :
                                                            record.status === 'ABSENT' ? 'bg-rose-500/20 text-rose-300 border-rose-500/40' :
                                                            record.status === 'LATE' ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' :
                                                            record.status === 'EXCUSED' ? 'bg-blue-500/20 text-blue-300 border-blue-500/40' :
                                                            'bg-slate-800 text-slate-400 border-slate-700'
                                                        }`}>
                                                            {record.student_name.charAt(0)}{record.student_name.split(' ')[1]?.[0] || ''}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="font-bold text-slate-100 text-sm truncate leading-tight">
                                                                {record.student_name}
                                                            </p>
                                                            <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1.5 font-mono">
                                                                <span>{record.student_code}</span>
                                                                {record.justification && (
                                                                    <span className="text-[10px] text-purple-300 bg-purple-500/20 px-1.5 rounded border border-purple-500/30">
                                                                        {record.justification.status === 'PENDING' ? 'Excusa Pendiente' : 'Excusa Aprobada'}
                                                                    </span>
                                                                )}
                                                            </p>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-1.5 shrink-0">
                                                        {/* Botón WhatsApp si está Ausente */}
                                                        {isAbsent && (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleSendWhatsApp(record)}
                                                                className="p-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/40 rounded-xl transition-all active:scale-95 shadow-sm"
                                                                title="Enviar aviso de inasistencia por WhatsApp"
                                                            >
                                                                <MessageSquare className="w-4 h-4 text-emerald-400" />
                                                            </button>
                                                        )}

                                                        {record.status === 'PENDING' ? (
                                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider bg-slate-800 text-amber-400 border-amber-500/30">
                                                                Sin marcar
                                                            </span>
                                                        ) : (
                                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${currentConfig.badge}`}>
                                                                {currentConfig.shortLabel}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Selector Horizontal Segmentado (4 Columnas Táctiles) */}
                                                <div className="grid grid-cols-4 gap-1 p-1 bg-slate-950/70 rounded-xl border border-slate-800">
                                                    {(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'] as const).map((statusOption) => {
                                                        const conf = STATUS_CONFIG[statusOption];
                                                        const IconComponent = conf.icon;
                                                        const isSelected = record.status === statusOption;

                                                        return (
                                                            <button
                                                                key={statusOption}
                                                                type="button"
                                                                onClick={() => handleStatusChange(record.student_id, statusOption)}
                                                                className={`py-2 px-1 rounded-lg text-xs font-bold transition-all flex flex-col items-center justify-center gap-0.5 active:scale-95 ${
                                                                    isSelected
                                                                        ? conf.activeBtn
                                                                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                                                                }`}
                                                            >
                                                                <IconComponent className="w-3.5 h-3.5" />
                                                                <span className="text-[10px]">{conf.shortLabel}</span>
                                                            </button>
                                                        );
                                                    })}
                                                </div>

                                                {/* Campo de Observación */}
                                                <div className="pt-0.5">
                                                    <input
                                                        type="text"
                                                        className="w-full bg-slate-950/50 border border-slate-800 text-slate-200 rounded-xl px-3 py-1.5 text-xs placeholder:text-slate-500 focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/20 outline-none transition-all"
                                                        placeholder="Añadir nota u observación..."
                                                        value={record.remarks || ''}
                                                        onChange={(e) => {
                                                            const val = e.target.value;
                                                            setAttendanceData(prev => prev.map(p => p.student_id === record.student_id ? { ...p, remarks: val } : p));
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}

                                    {filteredData.length === 0 && (
                                        <div className="p-8 text-center bg-slate-900/60 border border-slate-800 rounded-2xl text-slate-400 text-xs">
                                            No se encontraron estudiantes para este filtro.
                                        </div>
                                    )}
                                </div>

                                {/* VISTA ESCRITORIO: Tabla Dark Elegante */}
                                <div className="hidden md:block bg-slate-900/90 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
                                    <table className="w-full text-left">
                                        <thead className="bg-slate-950/80 border-b border-slate-800 uppercase text-xs font-bold text-slate-400 tracking-wider">
                                            <tr>
                                                <th className="px-6 py-4">Estudiante</th>
                                                <th className="px-6 py-4">Estado de Asistencia</th>
                                                <th className="px-6 py-4">Notas / Observaciones</th>
                                                <th className="px-4 py-4 text-center">Acciones</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-800/80">
                                            {filteredData.map((record) => {
                                                const isAbsent = record.status === 'ABSENT';

                                                return (
                                                    <tr 
                                                        key={record.student_id} 
                                                        className={`hover:bg-slate-800/40 transition-colors ${
                                                            isAbsent ? 'bg-rose-500/5' : ''
                                                        }`}
                                                    >
                                                        <td className="px-6 py-4 font-medium text-slate-100">
                                                            <div className="flex items-center space-x-3">
                                                                <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs uppercase shrink-0 border ${
                                                                    record.status === 'PRESENT' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' :
                                                                    record.status === 'ABSENT' ? 'bg-rose-500/20 text-rose-300 border-rose-500/40' :
                                                                    record.status === 'LATE' ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' :
                                                                    record.status === 'EXCUSED' ? 'bg-blue-500/20 text-blue-300 border-blue-500/40' :
                                                                    'bg-slate-800 text-slate-400 border-slate-700'
                                                                }`}>
                                                                    {record.student_name.charAt(0)}{record.student_name.split(' ')[1]?.[0] || ''}
                                                                </div>
                                                                <div>
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="font-bold text-slate-100">{record.student_name}</span>
                                                                        {record.justification && (
                                                                            <span className="text-[10px] text-purple-300 bg-purple-500/20 px-1.5 py-0.5 rounded border border-purple-500/30 font-semibold">
                                                                                {record.justification.status === 'PENDING' ? 'Excusa Pendiente' : 'Excusa Aprobada'}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                                                                        {record.student_code}
                                                                        {record.guardian_phone && ` • Acudiente: ${record.guardian_phone}`}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="inline-flex items-center p-1 bg-slate-950/60 rounded-xl border border-slate-800 gap-1">
                                                                {record.status === 'PENDING' && (
                                                                    <span className="px-2.5 py-1 text-[11px] font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg mr-1">
                                                                        Sin marcar
                                                                    </span>
                                                                )}
                                                                {(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'] as const).map((statusOption) => {
                                                                    const conf = STATUS_CONFIG[statusOption];
                                                                    const IconComponent = conf.icon;
                                                                    const isSelected = record.status === statusOption;

                                                                    return (
                                                                        <button
                                                                            key={statusOption}
                                                                            onClick={() => handleStatusChange(record.student_id, statusOption)}
                                                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all inline-flex items-center gap-1.5 active:scale-95 ${
                                                                                isSelected
                                                                                    ? conf.activeBtn
                                                                                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                                                                            }`}
                                                                        >
                                                                            <IconComponent className="w-3.5 h-3.5" />
                                                                            <span>{conf.label}</span>
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <input
                                                                type="text"
                                                                className="w-full bg-slate-950/40 border border-slate-800 text-slate-200 rounded-xl px-3 py-1.5 text-xs placeholder:text-slate-600 focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/20 outline-none transition-all"
                                                                placeholder="Añadir nota u observación..."
                                                                value={record.remarks || ''}
                                                                onChange={(e) => {
                                                                    const val = e.target.value;
                                                                    setAttendanceData(prev => prev.map(p => p.student_id === record.student_id ? { ...p, remarks: val } : p));
                                                                }}
                                                            />
                                                        </td>
                                                        <td className="px-4 py-4 text-center">
                                                            {isAbsent ? (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleSendWhatsApp(record)}
                                                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-bold transition-all active:scale-95"
                                                                    title="Avisar a WhatsApp"
                                                                >
                                                                    <MessageSquare className="w-3.5 h-3.5" />
                                                                    <span>Avisar</span>
                                                                </button>
                                                            ) : (
                                                                <span className="text-slate-600 text-xs">-</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Barra Inferior para Guardar */}
                                <div className="mt-8 p-4 bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl flex flex-col sm:flex-row items-center justify-between gap-3">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                        <p className="text-xs text-slate-300 truncate">
                                            <span className="font-bold text-white">{stats.present + stats.absent + stats.late + stats.excused}</span> de <span className="font-bold text-white">{stats.total}</span> alumnos registrados en el día
                                        </p>
                                    </div>

                                    <button
                                        onClick={requestSave}
                                        disabled={mutation.isPending}
                                        className="w-full sm:w-auto flex items-center justify-center space-x-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg shadow-blue-600/30 active:scale-95 disabled:opacity-50 transition-all text-xs sm:text-sm shrink-0"
                                    >
                                        {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                        <span>{mutation.isPending ? 'Guardando...' : 'Guardar Asistencia'}</span>
                                    </button>
                                </div>
                            </>
                        ) : (
                            <div className="text-center py-16 bg-slate-900/60 rounded-3xl border border-dashed border-slate-800">
                                <Users className="mx-auto h-12 w-12 text-slate-600 mb-3" />
                                <h3 className="text-base font-bold text-slate-200">No hay estudiantes matriculados</h3>
                                <p className="text-slate-400 text-xs mt-1">Este curso actualmente no tiene estudiantes activos asignados.</p>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="text-center py-16 bg-slate-900/60 rounded-3xl border border-dashed border-slate-800">
                        <BookOpen className="mx-auto h-12 w-12 text-slate-600 mb-3" />
                        <h3 className="text-base font-bold text-slate-200">Selecciona un curso</h3>
                        <p className="text-slate-400 text-xs mt-1">Elige un curso en la parte superior para cargar la lista de alumnos.</p>
                    </div>
                )
            )}

            {/* Modal de Escáner QR de Carnets */}
            <QrAttendanceScannerModal
                isOpen={isQrModalOpen}
                onClose={() => setIsQrModalOpen(false)}
                students={attendanceData}
                onStudentScanned={handleStudentScanned}
                courseName={currentCourseObj?.name}
                selectedDate={selectedDate}
                schedules={schedules}
                selectedScheduleId={selectedSchedule}
            />

            {/* Modal de Revisión de Justificaciones */}
            <JustificationReviewModal
                isOpen={isJustificationModalOpen}
                onClose={() => setIsJustificationModalOpen(false)}
                courseId={selectedCourse}
                onJustificationReviewed={() => {
                    queryClient.invalidateQueries({ queryKey: ['attendance'] });
                    queryClient.invalidateQueries({ queryKey: ['attendance_matrix'] });
                }}
            />

            {/* Modal de Confirmación de Guardado */}
            <ConfirmModal
                isOpen={showConfirmModal}
                title="¿Guardar Asistencia?"
                description={
                    <div className="space-y-2">
                        <p>
                            ¿Estás seguro de registrar la asistencia de <strong className="text-slate-200">{stats.total} estudiantes</strong> para el <strong className="text-blue-400">{formattedDateHeader}</strong>?
                        </p>
                        <div className="flex items-center gap-2 text-[11px] text-slate-400 pt-1 border-t border-slate-800">
                            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                            <span>{stats.present} presentes, {stats.absent} ausentes, {stats.late} tardes, {stats.excused} excusas ({attendanceRate}% concurrencia).</span>
                        </div>
                    </div>
                }
                confirmText="Sí, Guardar"
                cancelText="Cancelar"
                variant="primary"
                isLoading={mutation.isPending}
                onConfirm={confirmAndSave}
                onClose={() => setShowConfirmModal(false)}
            />
        </div>
    );
};

export default Attendance;
