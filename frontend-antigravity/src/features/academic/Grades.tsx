import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getCourses, getCourseSchedules } from './academicService';
import { getGrades, saveGrades } from './gradeService';
import { getSettings } from '../settings/settingsService';
import { 
    Loader2, Save, Users, Award, TrendingUp, TrendingDown, AlignJustify, ListChecks, 
    Download, FileSpreadsheet, Search, CheckCircle2, BookOpen, Clock, ShieldCheck, Check,
    WifiOff, Database
} from 'lucide-react';
import SubGrades from './SubGrades';
import { exportToExcel, exportToPDF } from '../../utils/exportUtils';
import SearchableSelect, { type SearchableOption } from '../../components/ui/SearchableSelect';
import { offlineStorage } from '../../services/offlineStorage';
import { offlineSyncService } from '../../services/offlineSyncService';
import { CycleSelectorPills } from '../../components/common/CycleSelectorPills';

const DEFAULT_SPECIAL_UNITS = ['Recuperación'];

const Grades = () => {
    const queryClient = useQueryClient();
    const [selectedCourse, setSelectedCourse] = useState<string>('');
    const [selectedYearFilter, setSelectedYearFilter] = useState<'ALL' | number>('ALL');
    const [selectedSchedule, setSelectedSchedule] = useState<string>('');
    const [activeTab, setActiveTab] = useState<'general' | 'detailed'>('general');
    const [gradesData, setGradesData] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const [showConfirmModal, setShowConfirmModal] = useState(false);

    // Fetch system settings to dynamically load unit names configured in Academic Settings
    const { data: settings } = useQuery({
        queryKey: ['system_settings'],
        queryFn: getSettings,
    });

    const evaluationUnits = useMemo(() => {
        const rawNames = settings?.grade_unit_names || 'Bimestre 1,Bimestre 2,Bimestre 3,Bimestre 4';
        const parsed = rawNames.split(',').map((u: string) => u.trim()).filter(Boolean);
        return [...parsed, ...DEFAULT_SPECIAL_UNITS.filter(u => !parsed.includes(u))];
    }, [settings?.grade_unit_names]);

    const [selectedUnit, setSelectedUnit] = useState<string>('');

    useEffect(() => {
        if (evaluationUnits.length > 0 && (!selectedUnit || !evaluationUnits.includes(selectedUnit))) {
            setSelectedUnit(evaluationUnits[0]);
        }
    }, [evaluationUnits, selectedUnit]);

    // Recuperación is a direct exam, not split into subgrades
    useEffect(() => {
        if (selectedUnit === 'Recuperación' && activeTab === 'detailed') {
            setActiveTab('general');
        }
    }, [selectedUnit, activeTab]);

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

    useEffect(() => {
        if (courses && courses.length > 0) {
            localStorage.setItem('ultec_cached_courses_catalog', JSON.stringify(courses));
        }
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

    const courseOptions = useMemo<SearchableOption[]>(() => {
        if (!filteredCourses) return [];
        return filteredCourses.map((c: any) => ({
            value: c.id,
            label: c.name,
            subLabel: `Ciclo ${c.academic_year || 2026}${c.monthly_fee ? ` • Q${c.monthly_fee}/mes` : ''}`,
            badge: `Ciclo ${c.academic_year || 2026}`,
        }));
    }, [filteredCourses]);

    // Auto-seleccionar primer curso cuando esté disponible o cambie el filtro de ciclo
    useEffect(() => {
        if (filteredCourses && filteredCourses.length > 0) {
            const currentValid = filteredCourses.some((c: any) => c.id === selectedCourse);
            if (!currentValid) {
                setSelectedCourse(filteredCourses[0].id);
                setSelectedSchedule('');
            }
        } else if (filteredCourses && filteredCourses.length === 0 && selectedCourse) {
            setSelectedCourse('');
            setSelectedSchedule('');
        }
    }, [filteredCourses, selectedCourse]);

    const { data: schedules } = useQuery({
        queryKey: ['course_schedules', selectedCourse],
        queryFn: () => getCourseSchedules(selectedCourse),
        enabled: !!selectedCourse,
    });

    const { data: fetchedGrades, isLoading, isFetching } = useQuery({
        queryKey: ['grades', selectedCourse, selectedUnit, selectedSchedule],
        queryFn: () => getGrades(selectedCourse, selectedUnit, selectedSchedule),
        enabled: !!selectedCourse && !!selectedUnit,
    });

    // Sincronizar calificaciones online con IndexedDB
    useEffect(() => {
        if (fetchedGrades && fetchedGrades.length > 0) {
            setGradesData(fetchedGrades);
            setIsFromCache(false);
            if (selectedCourse) {
                const currentCourseName = effectiveCourses.find((c: any) => c.id === selectedCourse)?.name || 'Curso';
                offlineStorage.saveRoster(selectedCourse, currentCourseName, fetchedGrades).catch(console.error);
                if (selectedUnit) {
                    offlineStorage.saveLocalGrades(selectedCourse, selectedUnit, fetchedGrades).catch(console.error);
                }
            }
        }
    }, [fetchedGrades, selectedCourse, selectedUnit, effectiveCourses]);

    // Si estamos sin conexión o falla la red, cargar desde IndexedDB
    useEffect(() => {
        if ((isOffline || !navigator.onLine) && selectedCourse && selectedUnit) {
            const loadOfflineGrades = async () => {
                try {
                    const localGrades = await offlineStorage.getLocalGrades(selectedCourse, selectedUnit);
                    if (localGrades && localGrades.students && localGrades.students.length > 0) {
                        setGradesData(localGrades.students);
                        setIsFromCache(true);
                        return;
                    }
                    const cachedRoster = await offlineStorage.getRoster(selectedCourse);
                    if (cachedRoster && cachedRoster.students && cachedRoster.students.length > 0) {
                        setGradesData(cachedRoster.students.map((s: any) => ({
                            student_id: s.student_id,
                            student_name: s.student_name,
                            score: '',
                            remarks: ''
                        })));
                        setIsFromCache(true);
                    }
                } catch (e) {
                    console.error('Error cargando calificaciones offline:', e);
                }
            };
            loadOfflineGrades();
        }
    }, [isOffline, selectedCourse, selectedUnit]);

    const mutation = useMutation({
        mutationFn: saveGrades,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['grades'] });
            setToastMessage(`¡Calificaciones guardadas exitosamente! (${gradesData.length} alumnos)`);
            setTimeout(() => setToastMessage(null), 3500);
        },
        onError: (err: any) => {
            alert(err.response?.data?.message || 'Error al guardar calificaciones');
        }
    });

    const handleScoreChange = (studentId: string, scoreStr: string) => {
        let val: string | number = scoreStr;
        if (scoreStr !== '') {
            const num = Number(scoreStr);
            if (num < 0) val = 0;
            else if (num > 100) val = 100;
            else val = num;
        }

        setGradesData(prev => prev.map(p => p.student_id === studentId ? { ...p, score: val } : p));
    };

    const handleQuickScore = (studentId: string, delta: number) => {
        setGradesData(prev => prev.map(p => {
            if (p.student_id === studentId) {
                const current = p.score === '' ? 60 : Number(p.score);
                const next = Math.max(0, Math.min(100, current + delta));
                return { ...p, score: next };
            }
            return p;
        }));
    };

    const handleSetScorePreset = (studentId: string, score: number) => {
        setGradesData(prev => prev.map(p => p.student_id === studentId ? { ...p, score } : p));
    };

    const handleSave = async () => {
        if (!selectedCourse || !selectedUnit) return;
        const currentCourseName = effectiveCourses?.find((c: any) => c.id === selectedCourse)?.name || 'Curso';
        const payloadStudents = gradesData.map(g => ({
            student_id: g.student_id,
            score: g.score,
            remarks: g.remarks
        }));

        if (!navigator.onLine || isOffline) {
            try {
                await offlineSyncService.queueGrades(selectedCourse, currentCourseName, selectedUnit, payloadStudents);
                setToastMessage(`💾 Calificaciones guardadas en tu equipo (${payloadStudents.length} alumnos). Se sincronizarán al reconectar.`);
                setTimeout(() => setToastMessage(null), 4500);
            } catch (err: any) {
                alert('Error al guardar localmente: ' + err.message);
            }
            return;
        }

        mutation.mutate({
            course_id: selectedCourse,
            unit_name: selectedUnit,
            students: payloadStudents
        }, {
            onError: async (err: any) => {
                const isNetworkError = !err.response || err.code === 'ERR_NETWORK' || err.message?.includes('Network');
                if (isNetworkError) {
                    try {
                        await offlineSyncService.queueGrades(selectedCourse, currentCourseName, selectedUnit, payloadStudents);
                        setToastMessage(`💾 Red inestable. Calificaciones guardadas localmente. Se sincronizarán al reconectar.`);
                        setTimeout(() => setToastMessage(null), 4500);
                    } catch (qErr: any) {
                        alert('Error al guardar en cola offline: ' + qErr.message);
                    }
                } else {
                    alert(err.response?.data?.message || 'Error al guardar calificaciones');
                }
            }
        });
    };

    const requestSave = () => {
        if (!selectedCourse || !selectedUnit) return;
        setShowConfirmModal(true);
    };

    const confirmAndSave = () => {
        setShowConfirmModal(false);
        handleSave();
    };

    // Stats calculations
    const validScores = gradesData.filter(g => g.score !== '' && g.score !== null && g.score !== undefined).map(g => Number(g.score));
    const stats = {
        total: gradesData.length,
        evaluated: validScores.length,
        average: validScores.length > 0 ? (validScores.reduce((a, b) => a + b, 0) / validScores.length).toFixed(1) : '0.0',
        highest: validScores.length > 0 ? Math.max(...validScores) : 0,
        lowest: validScores.length > 0 ? Math.min(...validScores) : 0,
    };

    const handleExportExcel = () => {
        if (!gradesData || gradesData.length === 0) return;
        const courseName = courses?.find((c: any) => c.id === selectedCourse)?.name || 'Curso';
        exportToExcel(
            gradesData.map(g => ({ 
                Estudiante: g.student_name, 
                Calificación: g.score !== '' ? Number(g.score) : 'Pendiente', 
                Unidad: selectedUnit, 
                Comentario: g.remarks || '' 
            })),
            `Calificaciones_${courseName}_${selectedUnit}`,
            'Calificaciones'
        );
    };

    const handleExportPDF = () => {
        if (!gradesData || gradesData.length === 0) return;
        const courseName = courses?.find((c: any) => c.id === selectedCourse)?.name || 'Curso';
        exportToPDF(
            [
                { header: 'Estudiante', dataKey: 'student_name' }, 
                { header: 'Nota', dataKey: 'score' }, 
                { header: 'Comentario', dataKey: 'remarks' }
            ],
            gradesData,
            `Calificaciones — ${courseName} — ${selectedUnit}`,
            `Calificaciones_${courseName}_${selectedUnit}`
        );
    };

    const filteredGrades = gradesData.filter(record =>
        record.student_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

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
                                Puedes calificar a tus estudiantes normalmente. Las notas se guardarán en este equipo y se subirán al servidor en cuanto se restablezca la conexión.
                            </p>
                        </div>
                    </div>
                    {isFromCache && (
                        <span className="shrink-0 px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold text-[10px] flex items-center gap-1.5 self-end sm:self-center">
                            <Database className="w-3 h-3" /> Datos Locales
                        </span>
                    )}
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-5">
                <div>
                    <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
                        Registro de Calificaciones
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-0.5">
                        Ingresa y administra las notas de los estudiantes por curso y unidad.
                    </p>
                </div>
                {selectedCourse && gradesData.length > 0 && activeTab === 'general' && (
                    <div className="flex items-center gap-2 self-end sm:self-auto">
                        <button
                            onClick={handleExportExcel}
                            className="flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-semibold rounded-xl border border-emerald-500/30 transition-all active:scale-95 text-xs"
                            title="Exportar a Excel"
                        >
                            <FileSpreadsheet className="w-4 h-4" />
                            <span>Excel</span>
                        </button>
                        <button
                            onClick={handleExportPDF}
                            className="flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-semibold rounded-xl border border-rose-500/30 transition-all active:scale-95 text-xs"
                            title="Exportar a PDF"
                        >
                            <Download className="w-4 h-4" />
                            <span>PDF</span>
                        </button>
                    </div>
                )}
            </div>

            {/* Config & Filters Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-xl mb-5 space-y-4 relative z-30 overflow-visible">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 relative z-40 overflow-visible">
                    {/* Selector de Curso */}
                    <div className="relative z-50 overflow-visible">
                        <div className="flex items-center justify-between mb-1.5">
                            <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                            <BookOpen className="w-3.5 h-3.5 text-blue-400" />
                            <span>Curso / Asignatura</span>
                            </label>
                            <CycleSelectorPills
                                cycles={distinctCycles}
                                selectedYear={selectedYearFilter}
                                onSelectYear={setSelectedYearFilter}
                                maxVisiblePills={1}
                                showLabelPrefix={false}
                                className="!bg-slate-800/80 !border-slate-700/60"
                            />
                        </div>
                        <SearchableSelect
                            options={courseOptions}
                            value={selectedCourse}
                            onChange={(val) => {
                                setSelectedCourse(val);
                                setSelectedSchedule('');
                            }}
                            placeholder="-- Elige un curso --"
                            searchPlaceholder="Buscar curso o año..."
                            disabled={isLoadingCourses}
                        />
                    </div>

                    {/* Selector de Horario / Grado */}
                    <div className="relative z-20">
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

                    {/* Selector de Unidad */}
                    <div className="relative z-20">
                        <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
                            <Award className="w-3.5 h-3.5 text-purple-400" />
                            <span>Unidad a Evaluar</span>
                        </label>
                        <div className="relative">
                            <select
                                className="w-full pl-3.5 pr-10 py-2.5 bg-slate-800/90 border border-slate-700 text-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all appearance-none outline-none font-medium text-xs sm:text-sm cursor-pointer"
                                value={selectedUnit}
                                onChange={(e) => setSelectedUnit(e.target.value)}
                            >
                                {evaluationUnits.map(unit => (
                                    <option key={unit} value={unit} className="bg-slate-900 text-slate-100">
                                        {unit}
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
                </div>

                {/* Barra de Unidades Táctiles (Pills scrolleables en móvil) */}
                {evaluationUnits.length > 0 && (
                    <div className="pt-2 border-t border-slate-800/80 relative z-10">
                        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
                            {evaluationUnits.map(unit => {
                                const isRecup = unit === 'Recuperación';
                                const isSelected = selectedUnit === unit;
                                return (
                                    <button
                                        key={unit}
                                        type="button"
                                        onClick={() => setSelectedUnit(unit)}
                                        className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all shrink-0 flex items-center gap-1.5 ${
                                            isSelected
                                                ? isRecup
                                                    ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30'
                                                    : 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                                                : isRecup
                                                    ? 'bg-amber-500/10 text-amber-400 hover:text-amber-200 border border-amber-500/30'
                                                    : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 border border-slate-700/60'
                                        }`}
                                    >
                                        {isRecup && <Award className="w-3.5 h-3.5 text-amber-300" />}
                                        <span>{unit}</span>
                                        {isRecup && (
                                            <span className="text-[10px] px-1.5 py-0.5 bg-amber-400/20 text-amber-200 rounded-md font-medium">
                                                Extraordinario
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Selector de Modo / Pestañas */}
            {selectedUnit === 'Recuperación' ? (
                <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-2xl mb-5 text-amber-300 text-xs flex items-start gap-3 shadow-sm relative z-10">
                    <Award className="w-5 h-5 shrink-0 text-amber-400 mt-0.5" />
                    <div>
                        <p className="font-bold text-sm text-amber-200">Evaluación de Recuperación Extraordinaria</p>
                        <p className="text-amber-300/80 mt-0.5 leading-relaxed">
                            Esta evaluación es un examen directo (0 - 100 pts) para alumnos con promedio ordinario menor a 60. Si el alumno obtiene 60 o más puntos en recuperación, aprueba el curso con nota oficial de 60. Las subcalificaciones no aplican para esta unidad.
                        </p>
                    </div>
                </div>
            ) : (
                <div className="flex p-1 bg-slate-900/90 border border-slate-800 rounded-2xl mb-5 shadow-sm max-w-lg relative z-10">
                    <button
                        className={`flex-1 py-2 px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                            activeTab === 'general'
                                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                                : 'text-slate-400 hover:text-slate-200'
                        }`}
                        onClick={() => setActiveTab('general')}
                    >
                        <AlignJustify className="w-4 h-4" />
                        <span>Calificación Bimestral</span>
                    </button>
                    <button
                        className={`flex-1 py-2 px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                            activeTab === 'detailed'
                                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                                : 'text-slate-400 hover:text-slate-200'
                        }`}
                        onClick={() => setActiveTab('detailed')}
                    >
                        <ListChecks className="w-4 h-4" />
                        <span>Subcalificaciones</span>
                    </button>
                </div>
            )}

            {selectedCourse ? (
                <>
                    {activeTab === 'detailed' ? (
                        <SubGrades 
                            selectedCourse={selectedCourse} 
                            selectedUnit={selectedUnit} 
                            evaluationUnits={evaluationUnits}
                        />
                    ) : (
                        <>
                            {/* Estadísticas de Calificaciones */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-4 mb-5">
                                {/* Evaluados */}
                                <div className="bg-slate-900/90 border border-slate-800 p-3 sm:p-4 rounded-2xl shadow-sm flex items-center space-x-3">
                                    <div className="p-2 sm:p-2.5 bg-blue-500/15 text-blue-400 border border-blue-500/30 rounded-xl shrink-0">
                                        <Users className="w-4 h-4 sm:w-5 sm:h-5" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Evaluados</p>
                                        <p className="text-xl sm:text-2xl font-black text-slate-100">
                                            {stats.evaluated} <span className="text-xs text-slate-500 font-normal">/ {stats.total}</span>
                                        </p>
                                    </div>
                                </div>

                                {/* Promedio */}
                                <div className="bg-slate-900/90 border border-slate-800 p-3 sm:p-4 rounded-2xl shadow-sm flex items-center space-x-3">
                                    <div className="p-2 sm:p-2.5 bg-purple-500/15 text-purple-400 border border-purple-500/30 rounded-xl shrink-0">
                                        <Award className="w-4 h-4 sm:w-5 sm:h-5" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[11px] font-medium text-purple-400 uppercase tracking-wider">Promedio</p>
                                        <p className="text-xl sm:text-2xl font-black text-purple-300">
                                            {Number(stats.average) > 0 ? stats.average : '--'}
                                        </p>
                                    </div>
                                </div>

                                {/* Nota Más Alta */}
                                <div className="bg-slate-900/90 border border-slate-800 p-3 sm:p-4 rounded-2xl shadow-sm flex items-center space-x-3">
                                    <div className="p-2 sm:p-2.5 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded-xl shrink-0">
                                        <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[11px] font-medium text-emerald-400 uppercase tracking-wider">Más Alta</p>
                                        <p className="text-xl sm:text-2xl font-black text-emerald-300">
                                            {stats.highest > 0 ? stats.highest : '--'}
                                        </p>
                                    </div>
                                </div>

                                {/* Nota Más Baja */}
                                <div className="bg-slate-900/90 border border-slate-800 p-3 sm:p-4 rounded-2xl shadow-sm flex items-center space-x-3">
                                    <div className="p-2 sm:p-2.5 bg-rose-500/15 text-rose-400 border border-rose-500/30 rounded-xl shrink-0">
                                        <TrendingDown className="w-4 h-4 sm:w-5 sm:h-5" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[11px] font-medium text-rose-400 uppercase tracking-wider">Más Baja</p>
                                        <p className="text-xl sm:text-2xl font-black text-rose-300">
                                            {validScores.length > 0 ? stats.lowest : '--'}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Búsqueda rápida de alumno y Guardado Rápido */}
                            {gradesData.length > 0 && (
                                <div className="mb-4 flex items-center justify-between gap-2.5">
                                    <div className="relative flex-1 max-w-xs">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                        <input
                                            type="text"
                                            placeholder="Buscar alumno en la lista..."
                                            className="w-full pl-9 pr-3 py-2 bg-slate-900/90 border border-slate-800 text-slate-200 text-xs rounded-xl outline-none focus:border-blue-500 transition-all placeholder:text-slate-500"
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                        />
                                    </div>
                                    <button
                                        onClick={requestSave}
                                        disabled={mutation.isPending}
                                        className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold rounded-xl text-xs shadow-md shadow-blue-600/30 transition-all shrink-0"
                                        title="Guardar calificaciones"
                                    >
                                        <Save className="w-3.5 h-3.5" />
                                        <span>Guardar</span>
                                    </button>
                                </div>
                            )}

                            {/* Contenido de Calificaciones */}
                            {isLoading || isFetching ? (
                                <div className="flex flex-col items-center justify-center p-12 bg-slate-900/60 rounded-3xl border border-slate-800 text-slate-400">
                                    <Loader2 className="animate-spin h-8 w-8 text-blue-500 mb-3" />
                                    <p className="text-sm font-medium">Cargando libreta de calificaciones...</p>
                                </div>
                            ) : (
                                stats.total > 0 ? (
                                    <>
                                        {/* VISTA MÓVIL: Tarjetas de Estudiantes con Calificación Táctil */}
                                        <div className="block md:hidden space-y-3">
                                            {filteredGrades.map((record) => {
                                                const scoreNum = record.score === '' || record.score === null || record.score === undefined ? null : Number(record.score);
                                                const isPassed = scoreNum !== null && scoreNum >= 60;
                                                const isFailed = scoreNum !== null && scoreNum < 60;

                                                return (
                                                    <div
                                                        key={record.student_id}
                                                        className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-4 shadow-md space-y-3 backdrop-blur-sm"
                                                    >
                                                        {/* Header: Nombre + Estado */}
                                                        <div className="flex items-center justify-between gap-2">
                                                            <div className="flex items-center space-x-3 min-w-0">
                                                                <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shrink-0 border ${
                                                                    isPassed ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' :
                                                                    isFailed ? 'bg-rose-500/20 text-rose-300 border-rose-500/40' :
                                                                    'bg-slate-800 text-slate-400 border-slate-700'
                                                                }`}>
                                                                    {record.student_name.charAt(0)}{record.student_name.split(' ')[1]?.[0] || ''}
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                                        <p className="font-bold text-slate-100 text-sm truncate leading-tight">
                                                                            {record.student_name}
                                                                        </p>
                                                                        {record.remarks?.startsWith('Sincronizado de') && (
                                                                            <span className="px-1.5 py-0.5 rounded-md text-[9px] font-semibold bg-blue-500/15 text-blue-300 border border-blue-500/30">
                                                                                🔗 Subcalif.
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <p className="text-[11px] text-slate-400 mt-0.5">
                                                                        {isPassed && <span className="text-emerald-400 font-semibold">● Aprobado</span>}
                                                                        {isFailed && <span className="text-rose-400 font-semibold">● Reprobado</span>}
                                                                        {scoreNum === null && <span className="text-slate-500">● Pendiente</span>}
                                                                    </p>
                                                                    {selectedUnit === 'Recuperación' && record.ordinary_average !== null && (
                                                                        <div className="mt-1">
                                                                            {record.is_eligible_recovery === false ? (
                                                                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                                                                                    ✓ Prom. Ordinario: {record.ordinary_average} pts (Aprobado)
                                                                                </span>
                                                                            ) : (
                                                                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                                                                                    ⚠️ Prom. Ordinario: {record.ordinary_average} pts (Requiere Recup.)
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            {/* Pill de Estado */}
                                                            <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border uppercase tracking-wider shrink-0 ${
                                                                isPassed ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
                                                                isFailed ? 'bg-rose-500/10 text-rose-400 border-rose-500/30' :
                                                                'bg-slate-800 text-slate-400 border-slate-700'
                                                            }`}>
                                                                {scoreNum !== null ? `${scoreNum} pts` : '--'}
                                                            </span>
                                                        </div>

                                                        {/* Zona de Calificación Táctil */}
                                                        <div className="p-2.5 bg-slate-950/70 rounded-xl border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
                                                            {/* Input Numérico Grande */}
                                                            <div className="flex items-center gap-2">
                                                                <label className="text-xs text-slate-400 font-medium">Nota:</label>
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    max="100"
                                                                    className={`w-20 py-1.5 px-2 rounded-xl text-center font-black text-xl border outline-none transition-all ${
                                                                        scoreNum === null ? 'border-slate-700 bg-slate-900 text-slate-300' :
                                                                        isPassed ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400 ring-2 ring-emerald-500/20' :
                                                                        'border-rose-500/50 bg-rose-500/10 text-rose-400 ring-2 ring-rose-500/20'
                                                                    }`}
                                                                    placeholder="--"
                                                                    value={record.score}
                                                                    onChange={(e) => handleScoreChange(record.student_id, e.target.value)}
                                                                />
                                                            </div>

                                                            {/* Botones de Ajuste Rápido */}
                                                            <div className="flex items-center gap-1.5 flex-wrap justify-end">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleQuickScore(record.student_id, -5)}
                                                                    className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold border border-slate-700 transition-colors"
                                                                    title="Restar 5 puntos"
                                                                >
                                                                    -5
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleQuickScore(record.student_id, +5)}
                                                                    className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold border border-slate-700 transition-colors"
                                                                    title="Sumar 5 puntos"
                                                                >
                                                                    +5
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleSetScorePreset(record.student_id, 60)}
                                                                    className="px-2 py-1 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 rounded-lg text-xs font-bold border border-amber-500/30 transition-colors"
                                                                    title="Nota mínima (60)"
                                                                >
                                                                    60
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleSetScorePreset(record.student_id, 80)}
                                                                    className="px-2 py-1 bg-blue-500/15 hover:bg-blue-500/25 text-blue-300 rounded-lg text-xs font-bold border border-blue-500/30 transition-colors"
                                                                    title="Buena nota (80)"
                                                                >
                                                                    80
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleSetScorePreset(record.student_id, 100)}
                                                                    className="px-2 py-1 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 rounded-lg text-xs font-bold border border-emerald-500/30 transition-colors"
                                                                    title="Nota máxima (100)"
                                                                >
                                                                    100
                                                                </button>
                                                            </div>
                                                        </div>

                                                        {/* Campo de Retroalimentación */}
                                                        <div>
                                                            <input
                                                                type="text"
                                                                className="w-full bg-slate-950/50 border border-slate-800 text-slate-200 rounded-xl px-3 py-1.5 text-xs placeholder:text-slate-500 focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/20 outline-none transition-all"
                                                                placeholder="Retroalimentación / comentario al alumno..."
                                                                value={record.remarks || ''}
                                                                onChange={(e) => {
                                                                    const val = e.target.value;
                                                                    setGradesData(prev => prev.map(p => p.student_id === record.student_id ? { ...p, remarks: val } : p));
                                                                }}
                                                            />
                                                        </div>
                                                    </div>
                                                );
                                            })}

                                            {filteredGrades.length === 0 && (
                                                <div className="p-8 text-center bg-slate-900/60 border border-slate-800 rounded-2xl text-slate-400 text-xs">
                                                    No se encontraron estudiantes con ese nombre.
                                                </div>
                                            )}
                                        </div>

                                        {/* VISTA ESCRITORIO: Tabla Dark Elegante */}
                                        <div className="hidden md:block bg-slate-900/90 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
                                            <table className="w-full text-left">
                                                <thead className="bg-slate-950/80 border-b border-slate-800 uppercase text-xs font-bold text-slate-400 tracking-wider">
                                                    <tr>
                                                        <th className="px-6 py-4">Estudiante</th>
                                                        <th className="px-6 py-4 w-52 text-center">Calificación (0 - 100)</th>
                                                        <th className="px-6 py-4">Retroalimentación / Notas</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-800/80">
                                                    {filteredGrades.map((record) => {
                                                        const scoreNum = record.score === '' || record.score === null ? null : Number(record.score);
                                                        const isPassed = scoreNum !== null && scoreNum >= 60;
                                                        const isFailed = scoreNum !== null && scoreNum < 60;

                                                        return (
                                                            <tr key={record.student_id} className="hover:bg-slate-800/40 transition-colors">
                                                                <td className="px-6 py-4 font-medium text-slate-100">
                                                                    <div className="flex items-center space-x-3">
                                                                        <div className="w-9 h-9 rounded-full bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold text-xs uppercase shrink-0">
                                                                            {record.student_name.charAt(0)}{record.student_name.split(' ')[1]?.[0] || ''}
                                                                        </div>
                                                                        <div>
                                                                            <div className="flex items-center gap-2">
                                                                                <span className="font-bold">{record.student_name}</span>
                                                                                {record.remarks?.startsWith('Sincronizado de') && (
                                                                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/15 text-blue-300 border border-blue-500/30">
                                                                                        🔗 Subcalif.
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                            {selectedUnit === 'Recuperación' && record.ordinary_average !== null && (
                                                                                <div className="flex items-center gap-2 mt-1">
                                                                                    <span className="text-[11px] text-slate-400">
                                                                                        Prom. Ordinario: <strong className="text-slate-200">{record.ordinary_average} pts</strong>
                                                                                    </span>
                                                                                    {record.is_eligible_recovery === false ? (
                                                                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                                                                            ✓ Aprobado Ordinario
                                                                                        </span>
                                                                                    ) : (
                                                                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                                                                                            ⚠️ Requiere Recuperación
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                                <td className="px-6 py-4">
                                                                    <div className="flex items-center justify-center gap-2">
                                                                        <input
                                                                            type="number"
                                                                            min="0"
                                                                            max="100"
                                                                            className={`w-24 px-3 py-2 border rounded-xl focus:ring-2 outline-none text-center font-bold text-lg transition-all ${
                                                                                scoreNum === null ? 'border-slate-700 bg-slate-950/60 text-slate-200 focus:border-blue-500' :
                                                                                isPassed ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400 shadow-[0_0_10px_rgba(34,197,94,0.15)] focus:border-emerald-500' :
                                                                                isFailed ? 'border-rose-500/50 bg-rose-500/10 text-rose-400 shadow-[0_0_10px_rgba(239,68,68,0.15)] focus:border-rose-500' :
                                                                                'border-slate-700 bg-slate-900 text-slate-200'
                                                                            }`}
                                                                            placeholder="--"
                                                                            value={record.score}
                                                                            onChange={(e) => handleScoreChange(record.student_id, e.target.value)}
                                                                        />
                                                                    </div>
                                                                </td>
                                                                <td className="px-6 py-4">
                                                                    <input
                                                                        type="text"
                                                                        className="w-full bg-slate-950/40 border border-slate-800 text-slate-200 rounded-xl px-3 py-2 text-xs placeholder:text-slate-600 focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/20 outline-none transition-all"
                                                                        placeholder="Añadir comentario o recomendación..."
                                                                        value={record.remarks || ''}
                                                                        onChange={(e) => {
                                                                            const val = e.target.value;
                                                                            setGradesData(prev => prev.map(p => p.student_id === record.student_id ? { ...p, remarks: val } : p));
                                                                        }}
                                                                    />
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>

                                        {/* Barra Inferior Estática para Guardar (Sin flotar sobre las tarjetas al deslizar) */}
                                        <div className="mt-8 p-4 bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl flex flex-col sm:flex-row items-center justify-between gap-3">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <div className={`w-2 h-2 rounded-full shrink-0 ${stats.evaluated === stats.total ? 'bg-emerald-400 shadow-[0_0_8px_rgba(34,197,94,0.8)]' : 'bg-amber-400 animate-pulse'}`} />
                                                <p className="text-xs text-slate-300 truncate">
                                                    <span className="font-bold text-white">{stats.evaluated}</span> de <span className="font-bold text-white">{stats.total}</span> evaluados
                                                    {Number(stats.average) > 0 && <span className="text-slate-400 hidden sm:inline"> • Promedio: <strong className="text-purple-300">{stats.average}</strong></span>}
                                                </p>
                                            </div>

                                            <button
                                                onClick={requestSave}
                                                disabled={mutation.isPending}
                                                className="w-full sm:w-auto flex items-center justify-center space-x-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg shadow-blue-600/30 active:scale-95 disabled:opacity-50 transition-all text-xs sm:text-sm shrink-0"
                                            >
                                                {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                                <span>{mutation.isPending ? 'Guardando...' : 'Guardar Calificaciones'}</span>
                                            </button>
                                        </div>
                                    </>
                                ) : (
                                    <div className="text-center py-16 bg-slate-900/60 rounded-3xl border border-dashed border-slate-800">
                                        <Award className="mx-auto h-12 w-12 text-slate-600 mb-3" />
                                        <h3 className="text-base font-bold text-slate-200">No hay estudiantes matriculados</h3>
                                        <p className="text-slate-400 text-xs mt-1">Este curso actualmente no tiene estudiantes activos para evaluar.</p>
                                    </div>
                                )
                            )}
                        </>
                    )}
                </>
            ) : (
                <div className="text-center py-16 bg-slate-900/60 rounded-3xl border border-dashed border-slate-800">
                    <BookOpen className="mx-auto h-12 w-12 text-slate-600 mb-3" />
                    <h3 className="text-base font-bold text-slate-200">Selecciona un curso</h3>
                    <p className="text-slate-400 text-xs mt-1">Elige un curso en la parte superior para cargar la lista de calificaciones.</p>
                </div>
            )}

            {/* Modal de Confirmación de Seguridad para Calificaciones */}
            {showConfirmModal && createPortal(
                <div 
                    className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200"
                    onClick={() => setShowConfirmModal(false)}
                >
                    <div 
                        className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-start gap-3.5">
                            <div className="w-11 h-11 rounded-2xl bg-blue-600/20 border border-blue-500/30 text-blue-400 flex items-center justify-center shrink-0">
                                <Save className="w-5 h-5" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <h3 className="text-base sm:text-lg font-bold text-slate-100">
                                    ¿Guardar Calificaciones?
                                </h3>
                                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                                    ¿Confirmas que deseas guardar las calificaciones de <strong className="text-slate-200">{stats.total} estudiantes</strong> para la unidad <strong className="text-blue-400">{selectedUnit}</strong>?
                                </p>
                            </div>
                        </div>

                        <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-3.5 text-xs text-slate-300 flex items-center gap-2.5">
                            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                            <span>Las notas oficiales y observaciones quedarán registradas en el servidor.</span>
                        </div>

                        <div className="flex items-center gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => setShowConfirmModal(false)}
                                className="flex-1 py-2.5 px-4 bg-slate-800 hover:bg-slate-700 active:bg-slate-750 text-slate-300 text-xs font-bold rounded-xl border border-slate-700 transition-all text-center"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={confirmAndSave}
                                disabled={mutation.isPending}
                                className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white text-xs font-bold rounded-xl shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2"
                            >
                                {mutation.isPending ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Check className="w-4 h-4" />
                                )}
                                <span>Sí, Guardar</span>
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default Grades;
