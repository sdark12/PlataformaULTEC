import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getCurrentUser } from '../../features/auth/authService';
import { getCourses, getCourseSchedules } from './academicService';
import { 
    getCandidatesForPromotion, 
    executePromotion, 
    getPromotionHistory
} from './promotionService';
import { 
    GraduationCap, 
    Loader2, 
    History, 
    Search, 
    Sparkles, 
    BookOpen,
    ShieldAlert,
    Lock
} from 'lucide-react';
import ConfirmModal from '../../components/ui/ConfirmModal';
import SearchableSelect, { type SearchableOption } from '../../components/ui/SearchableSelect';

const PromotionsManager = () => {
    const user = getCurrentUser();
    const isAdmin = ['admin', 'superadmin'].includes(user?.role || '');
    const isSecretary = user?.role === 'secretary';

    const queryClient = useQueryClient();
    const [subTab, setSubTab] = useState<'wizard' | 'history'>('wizard');

    // Selection states
    const [sourceCourseId, setSourceCourseId] = useState<string>('');
    const [targetCourseId, setTargetCourseId] = useState<string>('');
    const [targetScheduleId, setTargetScheduleId] = useState<string>('');
    const currentYear = new Date().getFullYear();
    const [schoolCycle, setSchoolCycle] = useState<string>(`${currentYear} -> ${currentYear + 1}`);

    // Selection of candidates
    const [selectedStudents, setSelectedStudents] = useState<Record<string, {
        selected: boolean;
        status: 'APPROVED' | 'CONDITIONAL' | 'RETAINED';
        notes: string;
    }>>({});

    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [candidateSearch, setCandidateSearch] = useState('');
    const [historySearch, setHistorySearch] = useState('');

    // Fetch courses list
    const { data: courses = [] } = useQuery({
        queryKey: ['courses'],
        queryFn: getCourses
    });

    const sourceCourseOptions: SearchableOption[] = useMemo(() => {
        return courses.map((c: any) => ({
            value: c.id,
            label: c.name,
            badge: c.code || undefined,
            subLabel: c.monthly_fee ? `Q${c.monthly_fee}/mes` : undefined
        }));
    }, [courses]);

    const targetCourseOptions: SearchableOption[] = useMemo(() => {
        return courses
            .filter((c: any) => c.id !== sourceCourseId)
            .map((c: any) => ({
                value: c.id,
                label: c.name,
                badge: c.code || undefined,
                subLabel: c.monthly_fee ? `Q${c.monthly_fee}/mes` : undefined
            }));
    }, [courses, sourceCourseId]);

    // Fetch schedules for target course
    const { data: targetSchedules = [] } = useQuery({
        queryKey: ['course_schedules', targetCourseId],
        queryFn: () => getCourseSchedules(targetCourseId),
        enabled: !!targetCourseId
    });

    // Fetch promotion candidates when source and target courses are selected
    const { data: candidatesData, isLoading: loadingCandidates } = useQuery({
        queryKey: ['promotion-candidates', sourceCourseId, targetCourseId],
        queryFn: () => getCandidatesForPromotion(sourceCourseId, targetCourseId),
        enabled: !!sourceCourseId
    });

    // Fetch promotion history
    const { data: history = [], isLoading: loadingHistory } = useQuery({
        queryKey: ['promotion-history'],
        queryFn: () => getPromotionHistory(),
        enabled: subTab === 'history'
    });

    // Update candidate selections when candidates load
    const candidates = candidatesData?.candidates || [];
    const minGrade = candidatesData?.minimum_passing_grade ?? 60;

    React.useEffect(() => {
        if (candidates.length > 0) {
            const initialMap: Record<string, { selected: boolean; status: 'APPROVED' | 'CONDITIONAL' | 'RETAINED'; notes: string }> = {};
            candidates.forEach(c => {
                const autoSelect = c.is_eligible && !c.already_enrolled_in_target;
                initialMap[c.student_id] = {
                    selected: autoSelect,
                    status: c.suggested_status,
                    notes: autoSelect ? 'Aprobado por promedio académico' : ''
                };
            });
            setSelectedStudents(initialMap);
        } else {
            setSelectedStudents({});
        }
    }, [candidatesData]);

    const toggleSelectStudent = (studentId: string) => {
        setSelectedStudents(prev => ({
            ...prev,
            [studentId]: {
                ...prev[studentId],
                selected: !prev[studentId]?.selected
            }
        }));
    };

    const updateStudentStatus = (studentId: string, status: 'APPROVED' | 'CONDITIONAL' | 'RETAINED') => {
        setSelectedStudents(prev => ({
            ...prev,
            [studentId]: {
                ...prev[studentId],
                status,
                selected: status !== 'RETAINED'
            }
        }));
    };

    const updateStudentNotes = (studentId: string, notes: string) => {
        setSelectedStudents(prev => ({
            ...prev,
            [studentId]: {
                ...prev[studentId],
                notes
            }
        }));
    };

    const selectAllEligible = () => {
        const updated: typeof selectedStudents = { ...selectedStudents };
        candidates.forEach(c => {
            if (c.is_eligible && !c.already_enrolled_in_target) {
                updated[c.student_id] = {
                    selected: true,
                    status: 'APPROVED',
                    notes: 'Aprobado por promedio académico'
                };
            }
        });
        setSelectedStudents(updated);
    };

    const deselectAll = () => {
        const updated: typeof selectedStudents = { ...selectedStudents };
        Object.keys(updated).forEach(id => {
            updated[id].selected = false;
        });
        setSelectedStudents(updated);
    };

    // Filtered candidates
    const filteredCandidates = useMemo(() => {
        if (!candidateSearch.trim()) return candidates;
        const q = candidateSearch.toLowerCase();
        return candidates.filter(c => 
            c.full_name.toLowerCase().includes(q) ||
            c.personal_code?.toLowerCase().includes(q) ||
            c.identification_document?.toLowerCase().includes(q)
        );
    }, [candidates, candidateSearch]);

    // Mutation to execute promotion
    const executeMutation = useMutation({
        mutationFn: executePromotion,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['promotion-candidates'] });
            queryClient.invalidateQueries({ queryKey: ['promotion-history'] });
            queryClient.invalidateQueries({ queryKey: ['enrollments'] });
            queryClient.invalidateQueries({ queryKey: ['courses'] });
            setIsConfirmOpen(false);
            setSubTab('history');
            alert('¡Promoción escolar ejecutada con éxito! Los alumnos han sido promovidos e inscritos en el nuevo ciclo.');
        },
        onError: (err: any) => {
            alert(err?.response?.data?.message || 'Error al ejecutar la promoción escolar');
        }
    });

    const selectedCount = Object.values(selectedStudents).filter(s => s.selected).length;

    const handleConfirmPromotion = () => {
        if (!isAdmin) {
            alert('Solo la Dirección o Administración tiene autorización para ejecutar promociones de ciclo escolar.');
            setIsConfirmOpen(false);
            return;
        }
        if (!sourceCourseId || !targetCourseId) {
            alert('Por favor selecciona tanto el curso origen como el curso destino');
            return;
        }
        if (selectedCount === 0) {
            alert('Debes seleccionar al menos un alumno para promover');
            return;
        }

        const payloadPromotions = candidates
            .filter(c => selectedStudents[c.student_id]?.selected)
            .map(c => ({
                student_id: c.student_id,
                status: selectedStudents[c.student_id].status,
                final_grade: c.average,
                notes: selectedStudents[c.student_id].notes || `Promovido con promedio ${c.average}`
            }));

        executeMutation.mutate({
            source_course_id: sourceCourseId,
            target_course_id: targetCourseId,
            target_schedule_id: targetScheduleId || undefined,
            school_cycle: schoolCycle,
            promotions: payloadPromotions
        });
    };

    // Metrics summary
    const eligibleCount = candidates.filter(c => c.is_eligible && !c.already_enrolled_in_target).length;
    const conditionalCount = candidates.filter(c => c.suggested_status === 'CONDITIONAL').length;
    const retainedCount = candidates.filter(c => c.suggested_status === 'RETAINED').length;

    return (
        <div className="space-y-6">
            {/* Header with Sub-tab switcher */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900/90 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
                <div className="flex items-center gap-3.5">
                    <div className="p-3 bg-gradient-to-tr from-brand-blue/15 to-emerald-500/15 border border-brand-blue/20 rounded-2xl shadow-sm">
                        <GraduationCap className="h-6 w-6 sm:h-7 sm:w-7 text-brand-blue dark:text-blue-400" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                                Promoción de Ciclo Escolar
                            </h2>
                            <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-brand-blue/10 dark:bg-brand-blue/20 text-brand-blue dark:text-blue-400 border border-brand-blue/20">
                                AVANCE ACADÉMICO
                            </span>
                        </div>
                        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                            Promueve a los alumnos al siguiente nivel al finalizar el ciclo escolar con preservación histórica.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                    <button
                        onClick={() => setSubTab('wizard')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            subTab === 'wizard'
                                ? 'bg-white dark:bg-slate-900 text-brand-blue dark:text-blue-400 shadow-sm'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                    >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Promover Alumnos</span>
                    </button>
                    <button
                        onClick={() => setSubTab('history')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            subTab === 'history'
                                ? 'bg-white dark:bg-slate-900 text-brand-blue dark:text-blue-400 shadow-sm'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                    >
                        <History className="w-3.5 h-3.5" />
                        <span>Historial</span>
                    </button>
                </div>
            </div>

            {subTab === 'wizard' ? (
                <>
                    {/* Secretary Security Warning Banner */}
                    {isSecretary && (
                        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-start gap-3 text-amber-800 dark:text-amber-300">
                            <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                            <div className="text-xs sm:text-sm">
                                <p className="font-bold">Modo de Consulta y Preparación (Rol Secretaría)</p>
                                <p className="text-xs text-amber-700/90 dark:text-amber-300/90 mt-0.5">
                                    Tienes acceso para revisar los promedios y seleccionar los candidatos a promoción de curso. 
                                    Por políticas de seguridad y control académico, la ejecución y pase definitivo de alumnos entre ciclos está reservada exclusivamente a la Dirección y Administración.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Course Selection Step */}
                    <div className="bg-white dark:bg-slate-900/90 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
                        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
                            <BookOpen className="w-4 h-4 text-brand-blue" />
                            Paso 1: Configurar Cursos y Ciclo Escolar
                        </h3>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            {/* Source Course */}
                            <div>
                                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">
                                    Curso Actual (Origen) *
                                </label>
                                <SearchableSelect
                                    options={sourceCourseOptions}
                                    value={sourceCourseId}
                                    onChange={(val) => setSourceCourseId(val)}
                                    placeholder="Buscar curso origen..."
                                    searchPlaceholder="Escribe para buscar curso origen..."
                                />
                            </div>

                            {/* Target Course */}
                            <div>
                                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">
                                    Curso Siguiente (Destino) *
                                </label>
                                <SearchableSelect
                                    options={targetCourseOptions}
                                    value={targetCourseId}
                                    onChange={(val) => setTargetCourseId(val)}
                                    placeholder="Buscar curso destino..."
                                    searchPlaceholder="Escribe para buscar curso destino..."
                                />
                            </div>

                            {/* Target Schedule */}
                            <div>
                                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">
                                    Horario Destino (Opcional)
                                </label>
                                <select
                                    value={targetScheduleId}
                                    onChange={(e) => setTargetScheduleId(e.target.value)}
                                    disabled={!targetCourseId || targetSchedules.length === 0}
                                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-medium text-slate-800 dark:text-white focus:ring-2 focus:ring-brand-blue outline-none disabled:opacity-50"
                                >
                                    <option value="">-- Asignar horario --</option>
                                    {targetSchedules.map((s: any) => (
                                        <option key={s.id} value={s.id}>
                                            {s.grade} - {s.day_of_week} ({s.start_time} - {s.end_time})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* School Cycle */}
                            <div>
                                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">
                                    Etiqueta de Ciclo *
                                </label>
                                <input
                                    type="text"
                                    value={schoolCycle}
                                    onChange={(e) => setSchoolCycle(e.target.value)}
                                    placeholder="ej. 2026 -> 2027"
                                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-medium text-slate-800 dark:text-white focus:ring-2 focus:ring-brand-blue outline-none"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Candidates Overview & Metrics */}
                    {sourceCourseId && (
                        <div className="space-y-4">
                            {/* Metrics Strip */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 shadow-sm">
                                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Alumnos en Curso</span>
                                    <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                                        {candidates.length}
                                    </div>
                                    <span className="text-[11px] text-slate-400">Total inscritos activos</span>
                                </div>

                                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 shadow-sm">
                                    <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider block">Aptos (Promedio ≥ {minGrade})</span>
                                    <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                                        {eligibleCount}
                                    </div>
                                    <span className="text-[11px] text-emerald-700/80 dark:text-emerald-300/80">Recomendados para promover</span>
                                </div>

                                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 shadow-sm">
                                    <span className="text-xs font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wider block">Condicionales (50 - {minGrade - 1})</span>
                                    <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
                                        {conditionalCount}
                                    </div>
                                    <span className="text-[11px] text-amber-700/80 dark:text-amber-300/80">En zona de recuperación</span>
                                </div>

                                <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 shadow-sm">
                                    <span className="text-xs font-bold text-rose-700 dark:text-rose-300 uppercase tracking-wider block">Reprobados (&lt; 50)</span>
                                    <div className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">
                                        {retainedCount}
                                    </div>
                                    <span className="text-[11px] text-rose-700/80 dark:text-rose-300/80">Requieren repetir curso</span>
                                </div>
                            </div>

                            {/* Candidates List and Table */}
                            <div className="bg-white dark:bg-slate-900/90 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
                                <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <div className="flex items-center gap-2">
                                        <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                                            Alumnos Evaluados para Promoción
                                        </h4>
                                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-mono">
                                            {selectedCount} seleccionados
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-2 flex-wrap">
                                        <div className="relative">
                                            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                            <input
                                                type="text"
                                                value={candidateSearch}
                                                onChange={(e) => setCandidateSearch(e.target.value)}
                                                placeholder="Buscar alumno..."
                                                className="pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium outline-none"
                                            />
                                        </div>
                                        <button
                                            onClick={selectAllEligible}
                                            className="px-2.5 py-1.5 text-xs font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 rounded-lg transition-colors"
                                        >
                                            Seleccionar Aptos
                                        </button>
                                        <button
                                            onClick={deselectAll}
                                            className="px-2.5 py-1.5 text-xs font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 transition-colors"
                                        >
                                            Desmarcar Todos
                                        </button>
                                    </div>
                                </div>

                                {loadingCandidates ? (
                                    <div className="p-12 text-center text-slate-500">
                                        <Loader2 className="w-6 h-6 animate-spin mx-auto text-brand-blue mb-2" />
                                        <span>Calculando notas y elegibilidad de los alumnos...</span>
                                    </div>
                                ) : filteredCandidates.length === 0 ? (
                                    <div className="p-12 text-center text-slate-400 text-sm">
                                        No hay estudiantes inscritos activos en el curso origen seleccionado.
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left text-xs sm:text-sm">
                                            <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                                                <tr>
                                                    <th className="py-3 px-4 w-12 text-center">Promover</th>
                                                    <th className="py-3 px-4">Estudiante</th>
                                                    <th className="py-3 px-4">Código / DPI</th>
                                                    <th className="py-3 px-4">Unidades / Bimestres</th>
                                                    <th className="py-3 px-4 text-center">Promedio</th>
                                                    <th className="py-3 px-4">Aprobación de Dirección</th>
                                                    <th className="py-3 px-4">Observaciones</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                                                {filteredCandidates.map(c => {
                                                    const sel = selectedStudents[c.student_id] || { selected: false, status: c.suggested_status, notes: '' };
                                                    return (
                                                        <tr 
                                                            key={c.student_id} 
                                                            className={`transition-colors ${
                                                                sel.selected 
                                                                    ? 'bg-emerald-500/5 dark:bg-emerald-500/10' 
                                                                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                                                            }`}
                                                        >
                                                            <td className="py-3 px-4 text-center">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={sel.selected}
                                                                    onChange={() => toggleSelectStudent(c.student_id)}
                                                                    disabled={c.already_enrolled_in_target}
                                                                    className="w-4 h-4 rounded text-brand-blue focus:ring-brand-blue cursor-pointer disabled:opacity-40"
                                                                />
                                                            </td>
                                                            <td className="py-3 px-4">
                                                                <div className="font-bold text-slate-900 dark:text-white">
                                                                    {c.full_name}
                                                                </div>
                                                                {c.already_enrolled_in_target && (
                                                                    <span className="text-[10px] text-amber-500 font-bold block mt-0.5">
                                                                        Ya inscrito en curso destino
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td className="py-3 px-4 text-xs text-slate-500 dark:text-slate-400">
                                                                <div>Cód: {c.personal_code || 'N/A'}</div>
                                                                <div>DPI: {c.identification_document || 'N/A'}</div>
                                                            </td>
                                                            <td className="py-3 px-4">
                                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                                    {c.grades.length > 0 ? (
                                                                        c.grades.map((g, idx) => (
                                                                            <span key={idx} className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-mono text-slate-700 dark:text-slate-300">
                                                                                {g.unit_name.substring(0, 2)}: <b>{g.score}</b>
                                                                            </span>
                                                                        ))
                                                                    ) : (
                                                                        <span className="text-slate-400 text-xs italic">Sin notas</span>
                                                                    )}
                                                                </div>
                                                            </td>
                                                            <td className="py-3 px-4 text-center">
                                                                <span className={`text-sm font-black ${
                                                                    c.average >= minGrade 
                                                                        ? 'text-emerald-600 dark:text-emerald-400' 
                                                                        : c.average >= minGrade - 10 
                                                                        ? 'text-amber-600 dark:text-amber-400' 
                                                                        : 'text-rose-600 dark:text-rose-400'
                                                                }`}>
                                                                    {c.average} pts
                                                                </span>
                                                            </td>
                                                            <td className="py-3 px-4">
                                                                <select
                                                                    value={sel.status}
                                                                    onChange={(e) => updateStudentStatus(c.student_id, e.target.value as any)}
                                                                    disabled={c.already_enrolled_in_target}
                                                                    className="px-2.5 py-1 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white outline-none"
                                                                >
                                                                    <option value="APPROVED">Aprobado / Promover</option>
                                                                    <option value="CONDITIONAL">Condicional</option>
                                                                    <option value="RETAINED">No Promover / Retenido</option>
                                                                </select>
                                                            </td>
                                                            <td className="py-3 px-4">
                                                                <input
                                                                    type="text"
                                                                    value={sel.notes}
                                                                    onChange={(e) => updateStudentNotes(c.student_id, e.target.value)}
                                                                    placeholder="Comentarios..."
                                                                    className="w-full px-2.5 py-1 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none"
                                                                />
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>

                            {/* Bottom Floating/Fixed Action Bar */}
                            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                                    Candidatos seleccionados: <b>{selectedCount}</b> alumno(s) hacia{' '}
                                    <span className="font-bold text-brand-blue">
                                        {courses.find((c: any) => c.id === targetCourseId)?.name || 'curso destino'}
                                    </span>
                                </div>

                                {isAdmin ? (
                                    <button
                                        onClick={() => setIsConfirmOpen(true)}
                                        disabled={selectedCount === 0 || !targetCourseId || executeMutation.isPending}
                                        className="px-5 py-2.5 bg-gradient-to-r from-brand-blue to-emerald-600 hover:from-blue-600 hover:to-emerald-700 text-white font-bold rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
                                    >
                                        {executeMutation.isPending ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <GraduationCap className="w-4 h-4" />
                                        )}
                                        <span>Ejecutar Promoción Escolar ({selectedCount})</span>
                                    </button>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            disabled
                                            className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-400 font-bold rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center gap-2 text-xs sm:text-sm cursor-not-allowed"
                                            title="La ejecución formal de la promoción entre ciclos lectivos está reservada a la Dirección"
                                        >
                                            <Lock className="w-4 h-4 text-amber-500" />
                                            <span>Ejecución Reservada a Dirección</span>
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </>
            ) : (
                /* History Tab */
                <div className="bg-white dark:bg-slate-900/90 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
                        <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                            Registro Histórico de Promociones
                        </h4>
                        <div className="relative">
                            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                value={historySearch}
                                onChange={(e) => setHistorySearch(e.target.value)}
                                placeholder="Buscar en historial..."
                                className="pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium outline-none"
                            />
                        </div>
                    </div>

                    {loadingHistory ? (
                        <div className="p-12 text-center text-slate-500">
                            <Loader2 className="w-6 h-6 animate-spin mx-auto text-brand-blue mb-2" />
                            <span>Cargando historial de promociones...</span>
                        </div>
                    ) : history.length === 0 ? (
                        <div className="p-12 text-center text-slate-400 text-sm">
                            Aún no se han registrado promociones escolares en el sistema.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs sm:text-sm">
                                <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                                    <tr>
                                        <th className="py-3 px-4">Estudiante</th>
                                        <th className="py-3 px-4">Curso Anterior</th>
                                        <th className="py-3 px-4">Curso Siguiente</th>
                                        <th className="py-3 px-4 text-center">Nota Final</th>
                                        <th className="py-3 px-4">Ciclo</th>
                                        <th className="py-3 px-4">Fecha de Promoción</th>
                                        <th className="py-3 px-4">Estado</th>
                                        <th className="py-3 px-4">Observaciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                                    {history
                                        .filter(h => {
                                            if (!historySearch.trim()) return true;
                                            const q = historySearch.toLowerCase();
                                            return (
                                                h.students?.full_name.toLowerCase().includes(q) ||
                                                h.from_course?.name.toLowerCase().includes(q) ||
                                                h.to_course?.name.toLowerCase().includes(q)
                                            );
                                        })
                                        .map(h => (
                                            <tr key={h.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                                                <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                                                    {h.students?.full_name || 'Estudiante'}
                                                </td>
                                                <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                                                    {h.from_course?.name}
                                                </td>
                                                <td className="py-3 px-4 text-brand-blue font-bold">
                                                    {h.to_course?.name}
                                                </td>
                                                <td className="py-3 px-4 text-center font-bold">
                                                    {h.final_grade} pts
                                                </td>
                                                <td className="py-3 px-4 text-slate-500">
                                                    {h.school_cycle}
                                                </td>
                                                <td className="py-3 px-4 text-slate-500">
                                                    {h.promoted_at ? new Date(h.promoted_at).toLocaleDateString('es-GT', {
                                                        day: '2-digit',
                                                        month: 'short',
                                                        year: 'numeric'
                                                    }) : 'N/A'}
                                                </td>
                                                <td className="py-3 px-4">
                                                    {h.status === 'APPROVED' ? (
                                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                                                            Aprobado
                                                        </span>
                                                    ) : h.status === 'CONDITIONAL' ? (
                                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20">
                                                            Condicional
                                                        </span>
                                                    ) : (
                                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 border border-rose-500/20">
                                                            Retenido
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="py-3 px-4 text-xs text-slate-500">
                                                    {h.notes || '—'}
                                                </td>
                                            </tr>
                                        ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* Confirmation Modal */}
            <ConfirmModal
                isOpen={isConfirmOpen}
                title="Confirmar Promoción Escolar"
                message={`¿Estás seguro de promover a los ${selectedCount} alumnos seleccionados hacia el siguiente curso? Esta acción registrará formalmente la aprobación, creará las inscripciones en el nuevo ciclo y archivará las inscripciones anteriores como promovidas con su historial intacto.`}
                confirmText="Sí, Promover Alumnos"
                cancelText="Cancelar"
                variant="primary"
                isLoading={executeMutation.isPending}
                onConfirm={handleConfirmPromotion}
                onClose={() => setIsConfirmOpen(false)}
            />
        </div>
    );
};

export default PromotionsManager;
