import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getCourses, getCourseSchedules } from '../academicService';
import { getSubgradeCategories } from '../subgradeService';
import { assignmentsService, type Assignment } from '../../../services/assignmentsService';
import SearchableSelect, { type SearchableOption } from '../../../components/ui/SearchableSelect';
import { 
    Plus, Loader2, ClipboardList, Calendar, CheckCircle2, Clock, 
    Paperclip, Printer, FileBarChart, AlertCircle, X, BookOpen, 
    Check, ArrowRight, ExternalLink, Layers, Sparkles, Pencil, Trash2, FileUp
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { savePdfDoc } from '../../../utils/fileDownloader';
import ConfirmModal from '../../../components/ui/ConfirmModal';


const TYPE_CONFIG: Record<string, { label: string; color: string; badge: string }> = {
    HOMEWORK: {
        label: 'Tarea',
        color: 'from-blue-600 to-indigo-600',
        badge: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    },
    EXAM: {
        label: 'Examen',
        color: 'from-purple-600 to-pink-600',
        badge: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    },
    LAB: {
        label: 'Laboratorio',
        color: 'from-amber-600 to-orange-600',
        badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    },
    ACTIVITY: {
        label: 'Actividad',
        color: 'from-emerald-600 to-teal-600',
        badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    },
};

const AssignmentsModule: React.FC = () => {
    const queryClient = useQueryClient();
    const [selectedCourse, setSelectedCourse] = useState<number | string | null>(null);
    const [selectedSchedule, setSelectedSchedule] = useState<string>('');
    const [selectedUnit, setSelectedUnit] = useState<string>('ALL');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [reviewAssignment, setReviewAssignment] = useState<Assignment | null>(null);
    const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);
    const [deletingAssignment, setDeletingAssignment] = useState<Assignment | null>(null);
    const [activeTab, setActiveTab] = useState<'all' | 'active' | 'history' | 'report'>('all');

    // Filters for review modal
    const [filterStatus, setFilterStatus] = useState<'ALL' | 'PENDING' | 'SUBMITTED' | 'GRADED'>('ALL');

    const [newAssignment, setNewAssignment] = useState<Partial<Assignment>>({
        title: '',
        description: '',
        assignment_type: 'HOMEWORK',
        due_date: '',
        weight_points: 1.0,
        merit_points: 0,
        unit_name: 'Bimestre 1',
        max_score: 100.0,
        schedule_id: '',
        category_id: '',
        attachment_url: null,
    });
    const [isUploadingGuide, setIsUploadingGuide] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    const handleGuideFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 15 * 1024 * 1024) {
            alert('El archivo supera el tamaño máximo permitido de 15 MB.');
            return;
        }

        try {
            setIsUploadingGuide(true);
            const uploadedUrl = await assignmentsService.uploadAssignmentFile(file);
            setNewAssignment(prev => ({ ...prev, attachment_url: uploadedUrl }));
        } catch (err: any) {
            console.error('Error uploading guide file:', err);
            alert(err?.response?.data?.message || 'Error al subir la guía digital.');
        } finally {
            setIsUploadingGuide(false);
        }
    };

    // Fetch courses for the dropdown
    const { data: courses, isLoading: isLoadingCourses } = useQuery({
        queryKey: ['courses'],
        queryFn: getCourses,
    });

    const courseOptions = useMemo<SearchableOption[]>(() => {
        if (!courses) return [];
        return courses.map((c: any) => ({
            value: c.id,
            label: c.name,
            subLabel: c.monthly_fee ? `Q${c.monthly_fee}/mes` : undefined,
        }));
    }, [courses]);

    // Auto-select first course when available
    useEffect(() => {
        if (courses && courses.length > 0 && !selectedCourse) {
            setSelectedCourse(courses[0].id);
        }
    }, [courses, selectedCourse]);

    // Fetch schedules for the selected course
    const { data: schedules, isLoading: isLoadingSchedules } = useQuery({
        queryKey: ['courseSchedules', selectedCourse],
        queryFn: () => getCourseSchedules(selectedCourse as string),
        enabled: !!selectedCourse
    });

    // Fetch subgrade categories for selected course and current modal/selected unit
    const activeUnitForCategories = newAssignment.unit_name || (selectedUnit !== 'ALL' ? selectedUnit : 'Bimestre 1');
    const { data: subgradeCategories } = useQuery({
        queryKey: ['subgradeCategories', selectedCourse, activeUnitForCategories],
        queryFn: () => getSubgradeCategories(selectedCourse as string, activeUnitForCategories),
        enabled: !!selectedCourse
    });

    // Fetch assignments when a course is selected
    const { data: assignments, isLoading: isLoadingAssignments } = useQuery({
        queryKey: ['assignments', selectedCourse, selectedSchedule, selectedUnit],
        queryFn: () => assignmentsService.getCourseAssignments(selectedCourse!, selectedSchedule, selectedUnit === 'ALL' ? undefined : selectedUnit),
        enabled: !!selectedCourse,
    });

    // Fetch submissions for review modal
    const { data: submissions, isLoading: isLoadingSubmissions } = useQuery({
        queryKey: ['submissions', reviewAssignment?.id],
        queryFn: () => assignmentsService.getAssignmentSubmissions(reviewAssignment!.id),
        enabled: !!reviewAssignment,
    });

    // Fetch reports for gradebook printing
    const { data: reportData, isLoading: isLoadingReport } = useQuery({
        queryKey: ['courseReport', selectedCourse, selectedSchedule],
        queryFn: () => assignmentsService.getCourseAssignmentReport(selectedCourse!, selectedSchedule),
        enabled: !!selectedCourse && activeTab === 'report',
    });

    // Track points assigned per category in current view
    const categoryUsage = useMemo(() => {
        const map: Record<string, { count: number; totalPoints: number }> = {};
        (assignments || []).forEach((a: any) => {
            const catId = a.category_id || a.subgrade_categories?.id;
            if (catId) {
                if (!map[catId]) map[catId] = { count: 0, totalPoints: 0 };
                map[catId].count += 1;
                map[catId].totalPoints += Number(a.max_score) || 0;
            }
        });
        return map;
    }, [assignments]);

    const resetNewAssignment = () => {
        setNewAssignment({
            title: '',
            description: '',
            assignment_type: 'HOMEWORK',
            due_date: '',
            weight_points: 1.0,
            merit_points: 0,
            unit_name: selectedUnit !== 'ALL' ? selectedUnit : 'Bimestre 1',
            max_score: 100.0,
            schedule_id: selectedSchedule || '',
            category_id: '',
            attachment_url: null,
        });
        setEditingAssignment(null);
        setErrorMsg('');
    };

    const createMutation = useMutation({
        mutationFn: assignmentsService.createAssignment,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['assignments'] });
            queryClient.invalidateQueries({ queryKey: ['subgrades'] });
            queryClient.invalidateQueries({ queryKey: ['grades'] });
            setIsModalOpen(false);
            resetNewAssignment();
        },
        onError: (err: any) => {
            console.error('Error creating assignment:', err);
            setErrorMsg(err.response?.data?.message || 'Error al crear la tarea.');
        }
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: Partial<Assignment> }) =>
            assignmentsService.updateAssignment(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['assignments'] });
            queryClient.invalidateQueries({ queryKey: ['subgrades'] });
            queryClient.invalidateQueries({ queryKey: ['grades'] });
            setIsModalOpen(false);
            resetNewAssignment();
        },
        onError: (err: any) => {
            console.error('Error updating assignment:', err);
            setErrorMsg(err.response?.data?.message || 'Error al actualizar la tarea.');
        }
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => assignmentsService.deleteAssignment(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['assignments'] });
            queryClient.invalidateQueries({ queryKey: ['subgrades'] });
            queryClient.invalidateQueries({ queryKey: ['grades'] });
            queryClient.invalidateQueries({ queryKey: ['submissions'] });
            queryClient.invalidateQueries({ queryKey: ['courseReport'] });
            setDeletingAssignment(null);
        },
        onError: (err: any) => {
            console.error('Error deleting assignment:', err);
            alert('Error al eliminar la tarea: ' + (err.response?.data?.message || err.message));
            setDeletingAssignment(null);
        }
    });

    const gradeMutation = useMutation({
        mutationFn: ({ submissionId, score, feedback, customMeritPoints }: { submissionId: string, score: number, feedback: string, customMeritPoints?: number }) =>
            assignmentsService.gradeSubmission(submissionId, score, feedback, customMeritPoints),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['submissions', reviewAssignment?.id] });
            queryClient.invalidateQueries({ queryKey: ['subgrades'] });
            queryClient.invalidateQueries({ queryKey: ['grades'] });
        },
        onError: (err: any) => {
            console.error('Error grading:', err);
            alert('Error al calificar: ' + (err.response?.data?.message || err.message));
        }
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg('');
        if (!selectedCourse) {
            setErrorMsg('Debe seleccionar un curso primero');
            return;
        }
        if (!newAssignment.title || !newAssignment.due_date) {
            setErrorMsg('El título y la fecha de entrega son obligatorios');
            return;
        }

        // Budget check if linked to category (Enfoque 1: Suma directa con presupuesto)
        if (newAssignment.category_id) {
            const selectedCat = subgradeCategories?.find((c: any) => c.id === newAssignment.category_id);
            if (selectedCat) {
                const isCurrentCatOfEditing = editingAssignment && (editingAssignment.category_id || editingAssignment.subgrade_categories?.id) === selectedCat.id;
                const usedInOther = (categoryUsage[selectedCat.id]?.totalPoints || 0) - (isCurrentCatOfEditing ? Number(editingAssignment.max_score) : 0);
                const catMax = Number(selectedCat.max_score) || 0;
                const rem = Math.max(0, catMax - usedInOther);
                const reqScore = Number(newAssignment.max_score) || 0;

                if (rem <= 0) {
                    setErrorMsg(`La categoría "${selectedCat.name}" ya tiene asignados todos sus puntos (${catMax} pts). No se pueden agregar más tareas.`);
                    return;
                }
                if (reqScore > rem + 0.01) {
                    setErrorMsg(`El punteo asignado (${reqScore} pts) supera los puntos disponibles (${rem} pts) de la categoría "${selectedCat.name}".`);
                    return;
                }
            }
        }

        if (editingAssignment) {
            updateMutation.mutate({
                id: editingAssignment.id,
                data: {
                    ...newAssignment,
                    merit_points: Number(newAssignment.merit_points) || 0,
                    unit_name: newAssignment.unit_name || 'Bimestre 1',
                    course_id: selectedCourse as string,
                    schedule_id: newAssignment.schedule_id || selectedSchedule || undefined,
                    category_id: newAssignment.category_id || null,
                    attachment_url: newAssignment.attachment_url || null,
                }
            });
        } else {
            createMutation.mutate({
                ...newAssignment,
                merit_points: Number(newAssignment.merit_points) || 0,
                unit_name: newAssignment.unit_name || 'Bimestre 1',
                course_id: selectedCourse as string,
                schedule_id: newAssignment.schedule_id || selectedSchedule || undefined,
                category_id: newAssignment.category_id || undefined,
                attachment_url: newAssignment.attachment_url || null,
            });
        }
    };

    const handleNewAssignment = () => {
        if (!selectedCourse) {
            alert('Por favor, seleccione un curso primero en el menú superior.');
            return;
        }
        resetNewAssignment();
        setIsModalOpen(true);
    };

    const handleEditAssignment = (assignment: any) => {
        setEditingAssignment(assignment);
        setNewAssignment({
            title: assignment.title,
            description: assignment.description || '',
            assignment_type: assignment.assignment_type || 'HOMEWORK',
            due_date: assignment.due_date ? assignment.due_date.slice(0, 16) : '',
            weight_points: assignment.weight_points || 1.0,
            merit_points: assignment.merit_points || 0,
            unit_name: assignment.unit_name || 'Bimestre 1',
            max_score: assignment.max_score,
            schedule_id: assignment.schedule_id || '',
            category_id: assignment.category_id || assignment.subgrade_categories?.id || '',
            attachment_url: assignment.attachment_url || null,
        });
        setErrorMsg('');
        setIsModalOpen(true);
    };

    const handleGradeSubmit = (submissionId: string, e: React.FormEvent) => {
        e.preventDefault();
        const form = e.target as HTMLFormElement;
        const score = Number((form.elements.namedItem('score') as HTMLInputElement).value);
        const feedback = (form.elements.namedItem('feedback') as HTMLInputElement).value;
        const customMeritInput = form.elements.namedItem('custom_merit') as HTMLInputElement | null;
        const customMeritPoints = customMeritInput && customMeritInput.value !== '' ? Number(customMeritInput.value) : undefined;
        gradeMutation.mutate({ submissionId, score, feedback, customMeritPoints });
    };

    const formatDate = (dateString: string) => {
        if (!dateString) return '';
        const d = new Date(dateString);
        return d.toLocaleDateString('es-ES', { 
            day: '2-digit', 
            month: 'short', 
            year: 'numeric', 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    };

    const now = new Date();
    const activeAssignments = assignments?.filter(a => new Date(a.due_date) > now) || [];
    const historyAssignments = assignments?.filter(a => new Date(a.due_date) <= now) || [];
    const allAssignments = assignments || [];
    const displayedAssignments = activeTab === 'all' 
        ? allAssignments 
        : activeTab === 'active' 
            ? activeAssignments 
            : historyAssignments;

    // Auto-switch to 'all' if currently on 'active' but 'active' is empty and history has items
    useEffect(() => {
        if (assignments && assignments.length > 0) {
            const hasActive = assignments.some(a => new Date(a.due_date) > now);
            if (!hasActive && activeTab === 'active') {
                setActiveTab('all');
            }
        }
    }, [assignments]);

    const filteredSubmissions = submissions?.filter(s => filterStatus === 'ALL' || s.status === filterStatus) || [];

    const generatePDF = async () => {
        if (!reportData) return;

        const courseName = courses?.find((c: any) => c.id.toString() === selectedCourse?.toString())?.name || 'Desconocido';
        const doc = new jsPDF({ orientation: 'landscape', format: 'letter' });

        // Headers & Title
        doc.setFontSize(18);
        doc.text('REPORTE DE CALIFICACIONES', 14, 22);

        doc.setFontSize(11);
        doc.text(`Curso: ${courseName}`, 14, 30);
        doc.text(`Generado el: ${new Date().toLocaleDateString('es-ES')}`, 14, 36);

        // Map Table Columns
        const tableHeaders = [
            'Alumno',
            ...reportData.assignments.map(a => `${a.title}\n(${a.max_score} pts)`),
            'Nota Acumulada'
        ];

        // Map Table Rows
        const tableData = reportData.students.map(student => {
            const row = [student.student_name];

            student.grades.forEach(grade => {
                if (grade.status === 'PENDING') row.push('-');
                else if (grade.status === 'SUBMITTED') row.push('S/C');
                else row.push(`${grade.score} / ${grade.max_score}`);
            });

            row.push(`${student.total_score}/${student.max_possible_score} (${student.percentage}%)`);
            return row;
        });

        // Inject AutoTable
        autoTable(doc, {
            startY: 40,
            head: [tableHeaders],
            body: tableData,
            theme: 'grid',
            headStyles: {
                fillColor: [127, 13, 242],
                fontSize: 7.5,
                halign: 'center',
                valign: 'middle',
                cellPadding: 1.5
            },
            bodyStyles: {
                fontSize: 7,
                halign: 'center',
                textColor: [40, 40, 40],
                cellPadding: 1
            },
            columnStyles: {
                0: { halign: 'left', fontStyle: 'bold', minCellWidth: 45 }
            },
            styles: {
                overflow: 'linebreak',
                lineColor: [220, 220, 220],
                lineWidth: 0.1
            },
        });

        await savePdfDoc(doc, `Reporte_${courseName.replace(/\s+/g, '_')}_Calificaciones.pdf`);
    };

    return (
        <div className="space-y-5 sm:space-y-6 animate-in fade-in duration-300">
            {/* Header section */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:hidden">
                <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center shrink-0 shadow-inner">
                        <ClipboardList className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="text-xl sm:text-2xl font-bold text-slate-100 tracking-tight">
                            Gestión de Tareas
                        </h2>
                        <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                            Crea tareas, asigna exámenes y revisa entregas de los estudiantes
                        </p>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2.5 w-full sm:w-auto">
                    <button
                        onClick={handleNewAssignment}
                        className="flex-1 sm:flex-initial flex items-center justify-center space-x-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl transition-all shadow-lg shadow-blue-600/30 active:scale-95 font-bold text-xs sm:text-sm shrink-0"
                    >
                        <Plus className="h-4 w-4" />
                        <span>Nueva Tarea</span>
                    </button>
                    {activeTab === 'report' && (
                        <button
                            onClick={generatePDF}
                            className="flex-1 sm:flex-initial flex items-center justify-center space-x-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white transition-all shadow-lg shadow-purple-600/30 rounded-2xl font-bold text-xs sm:text-sm whitespace-nowrap active:scale-95 shrink-0"
                        >
                            <Printer className="h-4 w-4" />
                            <span className="hidden sm:inline">Exportar PDF</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Filter and Selection Card */}
            <div className="glass-card p-4 sm:p-5 rounded-3xl border border-slate-800 bg-slate-900/60 shadow-sm print:hidden">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                    {/* Course Selector */}
                    <div className="md:col-span-5">
                        <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
                            <BookOpen className="w-3.5 h-3.5 text-blue-400" />
                            <span>Curso / Asignatura</span>
                        </label>
                        <SearchableSelect
                            options={courseOptions}
                            value={selectedCourse as string || ''}
                            onChange={(val) => {
                                setSelectedCourse(val);
                                setSelectedSchedule('');
                                setReviewAssignment(null);
                            }}
                            placeholder="-- Selecciona un curso --"
                            searchPlaceholder="Buscar curso o asignatura..."
                            disabled={isLoadingCourses}
                        />
                    </div>

                    {/* Schedule Selector */}
                    <div className="md:col-span-4">
                        <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-amber-400" />
                            <span>Horario / Grado (Opcional)</span>
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
                                        {s.grade} - {s.day_of_week} {s.start_time ? `(${s.start_time.substring(0, 5)}${s.end_time ? ' - ' + s.end_time.substring(0, 5) : ''})` : ''}
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

                    {/* Unit / Bimestre Selector */}
                    <div className="md:col-span-3">
                        <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
                            <Layers className="w-3.5 h-3.5 text-purple-400" />
                            <span>Bimestre / Unidad</span>
                        </label>
                        <div className="relative">
                            <select
                                className="w-full pl-3.5 pr-10 py-2.5 bg-slate-800/90 border border-slate-700 text-slate-100 rounded-xl focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 transition-all appearance-none outline-none font-medium text-xs sm:text-sm cursor-pointer disabled:opacity-50"
                                value={selectedUnit}
                                onChange={(e) => setSelectedUnit(e.target.value)}
                                disabled={!selectedCourse}
                            >
                                <option value="ALL" className="bg-slate-900 text-slate-400">Todos los Bimestres</option>
                                <option value="Bimestre 1" className="bg-slate-900 text-slate-100">Bimestre 1</option>
                                <option value="Bimestre 2" className="bg-slate-900 text-slate-100">Bimestre 2</option>
                                <option value="Bimestre 3" className="bg-slate-900 text-slate-100">Bimestre 3</option>
                                <option value="Bimestre 4" className="bg-slate-900 text-slate-100">Bimestre 4</option>
                            </select>
                            <div className="absolute inset-y-0 right-3.5 flex items-center pointer-events-none text-slate-400">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                </svg>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Print Only Header */}
            <div className="hidden print:block mb-8 text-center pb-6 border-b-2 border-slate-200">
                <h1 className="text-2xl font-bold text-slate-900 uppercase tracking-wider">
                    Reporte de Calificaciones
                </h1>
                <p className="text-slate-600 mt-2 text-lg">
                    Curso: {courses?.find((c: any) => c.id.toString() === selectedCourse?.toString())?.name || 'Desconocido'}
                    {selectedSchedule && (
                        <span>{' - '}{(schedules?.find((s) => s.id === selectedSchedule) as any)?.name || 'Horario Específico'}</span>
                    )}
                </p>
                <p className="text-slate-500 mt-1">Generado el: {new Date().toLocaleDateString('es-ES')}</p>
            </div>

            {/* Tabs (Mobile-Friendly Pill Style) */}
            {selectedCourse && (
                <div className="bg-slate-900/90 border border-slate-800 p-1.5 rounded-2xl flex gap-1.5 overflow-x-auto no-scrollbar print:hidden">
                    <button
                        onClick={() => setActiveTab('all')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all ${
                            activeTab === 'all' 
                                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30' 
                                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                        }`}
                    >
                        <Layers className="w-3.5 h-3.5" />
                        <span>Todas</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${
                            activeTab === 'all' ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400'
                        }`}>
                            {allAssignments.length}
                        </span>
                    </button>
                    <button
                        onClick={() => setActiveTab('active')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all ${
                            activeTab === 'active' 
                                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30' 
                                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                        }`}
                    >
                        <Clock className="w-3.5 h-3.5" />
                        <span>Tareas Activas</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${
                            activeTab === 'active' ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400'
                        }`}>
                            {activeAssignments.length}
                        </span>
                    </button>
                    <button
                        onClick={() => setActiveTab('history')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all ${
                            activeTab === 'history' 
                                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30' 
                                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                        }`}
                    >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Historial / Pasadas</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${
                            activeTab === 'history' ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400'
                        }`}>
                            {historyAssignments.length}
                        </span>
                    </button>
                    <button
                        onClick={() => setActiveTab('report')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all ${
                            activeTab === 'report' 
                                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30' 
                                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                        }`}
                    >
                        <FileBarChart className="w-3.5 h-3.5" />
                        <span>Reporte de Notas</span>
                    </button>
                </div>
            )}

            {/* Loading States */}
            {(isLoadingCourses || (selectedCourse && isLoadingSchedules) || (selectedCourse && isLoadingAssignments) || (activeTab === 'report' && isLoadingReport)) ? (
                <div className="flex flex-col items-center justify-center min-h-[300px] space-y-4 bg-slate-900/40 border border-slate-800/60 rounded-3xl p-8">
                    <Loader2 className="animate-spin h-10 w-10 text-blue-500" />
                    <p className="text-slate-400 text-xs sm:text-sm font-medium animate-pulse">Cargando tareas...</p>
                </div>
            ) : !selectedCourse ? (
                /* Empty state when no course selected */
                <div className="bg-slate-900/60 border-2 border-dashed border-slate-800 rounded-3xl p-8 sm:p-14 text-center flex flex-col items-center justify-center space-y-3.5">
                    <div className="h-14 w-14 bg-slate-800/80 rounded-2xl flex items-center justify-center text-slate-400 border border-slate-700/50">
                        <ClipboardList className="h-7 w-7" />
                    </div>
                    <div className="max-w-xs">
                        <h3 className="text-base sm:text-lg font-bold text-slate-200">Selecciona un Curso</h3>
                        <p className="text-slate-400 text-xs mt-1 leading-relaxed">Elige un curso en el selector superior para ver o publicar tareas.</p>
                    </div>
                </div>
            ) : displayedAssignments?.length === 0 && activeTab !== 'report' ? (
                /* Empty state for course with no assignments */
                <div className="bg-slate-900/60 border-2 border-dashed border-slate-800 rounded-3xl p-8 sm:p-14 text-center flex flex-col items-center justify-center space-y-3.5">
                    <div className="h-14 w-14 bg-slate-800/80 rounded-2xl flex items-center justify-center text-slate-400 border border-slate-700/50">
                        {activeTab === 'active' ? <Clock className="h-7 w-7 text-blue-400" /> : <CheckCircle2 className="h-7 w-7 text-emerald-400" />}
                    </div>
                    <div className="max-w-xs">
                        <h3 className="text-base sm:text-lg font-bold text-slate-200">
                            No hay tareas {activeTab === 'active' ? 'activas' : activeTab === 'history' ? 'en el historial' : 'registradas'}
                        </h3>
                        <p className="text-slate-400 text-xs mt-1 leading-relaxed">
                            {activeTab === 'active' 
                                ? (historyAssignments.length > 0 
                                    ? `Hay ${historyAssignments.length} tarea(s) en el historial de este curso.` 
                                    : 'Aún no has publicado actividades vigentes para este curso.')
                                : activeTab === 'history'
                                    ? 'No se encontraron tareas vencidas en este curso.'
                                    : 'Este curso no tiene tareas registradas aún.'}
                        </p>
                        {activeTab === 'active' && historyAssignments.length > 0 && (
                            <button
                                onClick={() => setActiveTab('history')}
                                className="mt-3 px-4 py-2 bg-slate-800 hover:bg-slate-750 text-blue-400 rounded-xl text-xs font-bold transition-all border border-slate-700 active:scale-95"
                            >
                                Ver {historyAssignments.length} Tarea(s) del Historial
                            </button>
                        )}
                        <button
                            onClick={handleNewAssignment}
                            className="mt-3 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-600/30 active:scale-95"
                        >
                            + Publicar Nueva Tarea
                        </button>
                    </div>
                </div>
            ) : activeTab === 'report' ? (
                /* Report View: Cards on Mobile + Table on Desktop */
                <div className="space-y-4">
                    {/* Mobile Feed for Report (< md) */}
                    <div className="block md:hidden space-y-3">
                        {(!reportData?.students || reportData.students.length === 0) ? (
                            <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 text-center text-slate-400 text-xs">
                                No hay alumnos inscritos o datos que reportar.
                            </div>
                        ) : (
                            reportData.students.map((student) => (
                                <div 
                                    key={student.student_id} 
                                    className="bg-slate-900 border border-slate-800 rounded-3xl p-4 shadow-md space-y-3"
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <div className="h-8 w-8 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400 font-black text-xs flex items-center justify-center shrink-0">
                                                {student.student_name.charAt(0)}
                                            </div>
                                            <span className="font-bold text-slate-100 text-sm truncate">
                                                {student.student_name}
                                            </span>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <span className="font-black text-blue-400 text-sm">
                                                {student.total_score}
                                                <span className="text-[10px] text-slate-400 font-normal"> / {student.max_possible_score}</span>
                                            </span>
                                            <div className={`text-[10px] font-black uppercase ${
                                                student.percentage >= 60 ? 'text-emerald-400' : 'text-rose-400'
                                            }`}>
                                                {student.percentage}%
                                            </div>
                                        </div>
                                    </div>

                                    {/* Assignment breakdown pills */}
                                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80 text-[11px]">
                                        {student.grades.map((grade) => {
                                            const astMeta = reportData.assignments.find(a => a.id === grade.assignment_id);
                                            return (
                                                <div 
                                                    key={grade.assignment_id}
                                                    className="bg-slate-950/60 border border-slate-800/60 rounded-xl p-2 flex flex-col justify-between"
                                                >
                                                    <span className="text-slate-400 truncate font-medium text-[10px]" title={astMeta?.title}>
                                                        {astMeta?.title || 'Tarea'}
                                                    </span>
                                                    <span className="font-bold mt-1 text-slate-200">
                                                        {grade.status === 'PENDING' ? (
                                                            <span className="text-slate-500">- Pendiente</span>
                                                        ) : grade.status === 'SUBMITTED' ? (
                                                            <span className="text-amber-400">Sin calificar</span>
                                                        ) : (
                                                            <span className="text-blue-400">{grade.score} <span className="text-[9px] text-slate-500">/ {grade.max_score}</span></span>
                                                        )}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Desktop Matrix Table (>= md) */}
                    <div className="hidden md:block rounded-3xl overflow-hidden border border-slate-800 bg-slate-900/90 shadow-xl print:overflow-visible print:border-none print:shadow-none print:bg-transparent">
                        <div className="overflow-x-auto print:overflow-visible">
                            <table className="w-full text-left min-w-[700px] print:min-w-0">
                                <thead className="bg-slate-950/70 border-b border-slate-800 print:border-b-2">
                                    <tr>
                                        <th className="px-5 py-4 text-left text-xs font-bold text-slate-300 uppercase tracking-widest sticky left-0 bg-slate-950 shadow-[1px_0_0_rgba(30,41,59,1)] w-60 z-10 print:static print:shadow-none print:w-auto">
                                            Alumno
                                        </th>
                                        {reportData?.assignments.map(ast => (
                                            <th key={ast.id} className="px-4 py-4 text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider min-w-[110px] max-w-[180px]" title={ast.title}>
                                                <div className="truncate">{ast.title}</div>
                                                <div className="text-purple-400 mt-0.5 flex items-center justify-center space-x-1">
                                                    <span>{ast.max_score} pts</span>
                                                    <span className="text-slate-500 text-[9px]">({ast.weight_points}x)</span>
                                                </div>
                                            </th>
                                        ))}
                                        <th className="px-5 py-4 text-right text-xs font-black text-slate-100 uppercase tracking-wider bg-blue-500/10 min-w-[110px]">
                                            Acumulado
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
                                    {reportData?.students.map((student) => (
                                        <tr key={student.student_id} className="hover:bg-slate-800/40 transition">
                                            <td className="px-5 py-3.5 font-bold text-slate-100 sticky left-0 bg-slate-900 shadow-[1px_0_0_rgba(30,41,59,1)] z-10 text-xs">
                                                <div className="flex items-center space-x-2.5">
                                                    <div className="h-7 w-7 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center font-bold text-xs shrink-0 border border-blue-500/30">
                                                        {student.student_name.charAt(0)}
                                                    </div>
                                                    <span className="truncate">{student.student_name}</span>
                                                </div>
                                            </td>

                                            {student.grades.map((grade) => (
                                                <td key={grade.assignment_id} className="px-4 py-3.5 text-center text-xs">
                                                    {grade.status === 'PENDING' ? (
                                                        <span className="text-slate-600 font-medium">-</span>
                                                    ) : grade.status === 'SUBMITTED' ? (
                                                        <span className="inline-flex items-center text-amber-400 font-bold text-[11px] bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-lg">
                                                            S/C
                                                        </span>
                                                    ) : (
                                                        <span className="font-bold text-slate-200">
                                                            {grade.score} <span className="text-[10px] text-slate-500 font-normal">/ {grade.max_score}</span>
                                                        </span>
                                                    )}
                                                </td>
                                            ))}

                                            <td className="px-5 py-3.5 text-right bg-blue-500/10 font-black text-blue-400 text-sm">
                                                {student.total_score} <span className="text-[10px] font-bold text-slate-400">/ {student.max_possible_score}</span>
                                                <div className={`text-[10px] uppercase font-bold tracking-wider ${student.percentage >= 60 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                    {student.percentage}%
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {(!reportData?.students || reportData.students.length === 0) && (
                                        <tr>
                                            <td colSpan={2 + (reportData?.assignments.length || 0)} className="px-6 py-10 text-center text-slate-500 text-xs">
                                                No hay alumnos inscritos o datos que reportar.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            ) : (
                /* Assignments Feed Grid (Active & Past) */
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-5">
                    {displayedAssignments?.map((assignment: any) => {
                        const typeInfo = TYPE_CONFIG[assignment.assignment_type] || TYPE_CONFIG.HOMEWORK;
                        const isPast = new Date(assignment.due_date) <= now;

                        return (
                            <div
                                key={assignment.id}
                                className="group bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-3xl p-5 shadow-lg transition-all duration-200 flex flex-col justify-between"
                            >
                                <div>
                                    {/* Top badges */}
                                    <div className="flex items-center justify-between gap-2 flex-wrap">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className={`text-[10px] px-2.5 py-1 rounded-full font-extrabold uppercase tracking-wider border ${typeInfo.badge}`}>
                                                {typeInfo.label}
                                            </span>
                                            {assignment.unit_name && (
                                                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                                                    {assignment.unit_name}
                                                </span>
                                            )}
                                            {(assignment.subgrade_categories?.name || assignment.category_name) && (
                                                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center gap-1" title="Vinculada a subcalificaciones">
                                                    <Layers className="w-3 h-3 text-blue-400" />
                                                    {assignment.subgrade_categories?.name || assignment.category_name}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            {Number(assignment.merit_points) > 0 && (
                                                <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                                    <Sparkles className="w-3 h-3 text-amber-400" />
                                                    +{assignment.merit_points} mérito
                                                </span>
                                            )}
                                            <div className="text-[11px] font-bold text-slate-400 bg-slate-950/80 px-2.5 py-1 rounded-full border border-slate-800">
                                                <strong className="text-slate-200">{assignment.max_score}</strong> pts
                                            </div>
                                        </div>
                                    </div>

                                    {/* Title & Description */}
                                    <div className="mt-3">
                                        <h3 className="text-base sm:text-lg font-bold text-slate-100 line-clamp-2 leading-snug group-hover:text-blue-400 transition-colors">
                                            {assignment.title}
                                        </h3>
                                        <p className="text-slate-400 text-xs mt-1.5 line-clamp-2 leading-relaxed">
                                            {assignment.description || 'Sin instrucciones adicionales.'}
                                        </p>
                                        {assignment.attachment_url && (
                                            <div className="mt-2.5">
                                                <a
                                                    href={`${import.meta.env.VITE_API_URL || 'https://plataformaultec.duckdns.org'}${assignment.attachment_url}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-purple-400 bg-purple-950/40 hover:bg-purple-900/50 border border-purple-800/40 transition-colors"
                                                >
                                                    <Paperclip className="w-3.5 h-3.5 text-purple-400" />
                                                    <span>Guía de Trabajo Adjunta</span>
                                                    <ExternalLink className="w-3 h-3 text-purple-400/70" />
                                                </a>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Bottom Info & Action */}
                                <div className="mt-5 pt-3.5 border-t border-slate-800/80 space-y-3">
                                    <div className={`flex items-center text-xs font-semibold ${isPast ? 'text-rose-400' : 'text-blue-400'}`}>
                                        <Calendar className="h-3.5 w-3.5 mr-1.5 shrink-0" />
                                        <span className="truncate">
                                            {isPast ? 'Finalizó: ' : 'Vence: '}
                                            {formatDate(assignment.due_date)}
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => { setReviewAssignment(assignment); setFilterStatus('ALL'); }}
                                            className="flex-1 py-2.5 px-3 bg-slate-800 hover:bg-blue-600 active:bg-blue-700 hover:text-white text-slate-300 font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer border border-slate-700/60"
                                        >
                                            <span>Revisar Entregas</span>
                                            <ArrowRight className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleEditAssignment(assignment)}
                                            className="p-2.5 bg-slate-800 hover:bg-slate-750 text-slate-400 hover:text-blue-400 rounded-xl transition-all border border-slate-700/60 shadow-sm"
                                            title="Editar tarea y punteo"
                                        >
                                            <Pencil className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setDeletingAssignment(assignment)}
                                            className="p-2.5 bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded-xl transition-all border border-slate-700/60 shadow-sm"
                                            title="Eliminar tarea"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Creation Modal (Rendered with createPortal at Root Level) */}
            {isModalOpen && createPortal(
                <div 
                    className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200"
                    onClick={() => setIsModalOpen(false)}
                >
                    <div 
                        className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header with Close Button */}
                        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-5 sm:p-6 text-white shrink-0 flex items-start justify-between">
                            <div>
                                <h3 className="text-lg sm:text-xl font-bold">
                                    {editingAssignment ? 'Editar Tarea' : 'Crear Nueva Tarea'}
                                </h3>
                                <p className="text-blue-100 text-xs mt-1">
                                    {editingAssignment ? 'Modifica los parámetros, fecha o punteo de esta actividad.' : 'Configura la actividad académica para los alumnos.'}
                                </p>
                            </div>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Form Body */}
                        <div className="overflow-y-auto p-5 sm:p-6 custom-scrollbar">
                            <form onSubmit={handleSubmit} className="space-y-4">
                                {errorMsg && (
                                    <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 px-3.5 py-2.5 rounded-xl text-xs font-semibold">
                                        {errorMsg}
                                    </div>
                                )}

                                <div>
                                    <label className="text-xs font-bold text-slate-300 ml-1">Título de la Tarea</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full mt-1.5 px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:ring-2 focus:ring-blue-500/40 outline-none text-slate-100 text-xs sm:text-sm font-medium transition-all"
                                        placeholder="Ej: Ensayo sobre Historia o Proyecto Final"
                                        value={newAssignment.title}
                                        onChange={(e) => setNewAssignment({ ...newAssignment, title: e.target.value })}
                                    />
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-slate-300 ml-1">Descripción / Instrucciones</label>
                                    <textarea
                                        rows={3}
                                        className="w-full mt-1.5 px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:ring-2 focus:ring-blue-500/40 outline-none text-slate-100 text-xs sm:text-sm font-medium transition-all resize-none"
                                        placeholder="Detalla qué debe hacer el alumno, criterios de evaluación..."
                                        value={newAssignment.description}
                                        onChange={(e) => setNewAssignment({ ...newAssignment, description: e.target.value })}
                                    />
                                </div>

                                {schedules && schedules.length > 0 && (
                                    <div>
                                        <label className="text-xs font-bold text-slate-300 ml-1">Horario Asignado (Opcional)</label>
                                        <select
                                            className="w-full mt-1.5 px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:ring-2 focus:ring-blue-500/40 outline-none text-slate-100 text-xs sm:text-sm font-medium"
                                            value={newAssignment.schedule_id || ''}
                                            onChange={(e) => setNewAssignment({ ...newAssignment, schedule_id: e.target.value })}
                                        >
                                            <option value="">Todos los horarios del curso</option>
                                            {schedules.map((s: any) => (
                                                <option key={s.id} value={s.id}>
                                                    {s.grade ? `${s.grade} - ` : ''}{s.day_of_week} ({s.start_time?.slice(0, 5)} - {s.end_time?.slice(0, 5)})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                    <div>
                                        <label className="text-xs font-bold text-slate-300 ml-1">Bimestre / Unidad</label>
                                        <select
                                            className="w-full mt-1.5 px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:ring-2 focus:ring-blue-500/40 outline-none text-slate-100 text-xs sm:text-sm font-medium"
                                            value={newAssignment.unit_name || 'Bimestre 1'}
                                            onChange={(e) => setNewAssignment({ ...newAssignment, unit_name: e.target.value, category_id: '' })}
                                        >
                                            <option value="Bimestre 1">Bimestre 1</option>
                                            <option value="Bimestre 2">Bimestre 2</option>
                                            <option value="Bimestre 3">Bimestre 3</option>
                                            <option value="Bimestre 4">Bimestre 4</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-300 ml-1">Tipo de Actividad</label>
                                        <select
                                            className="w-full mt-1.5 px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:ring-2 focus:ring-blue-500/40 outline-none text-slate-100 text-xs sm:text-sm font-medium"
                                            value={newAssignment.assignment_type}
                                            onChange={(e) => setNewAssignment({ ...newAssignment, assignment_type: e.target.value as any })}
                                        >
                                            <option value="HOMEWORK">Tarea</option>
                                            <option value="EXAM">Examen</option>
                                            <option value="LAB">Laboratorio</option>
                                            <option value="ACTIVITY">Actividad</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Category Budget & Linking (Enfoque 1: Presupuesto y Puntos Netos) */}
                                {(() => {
                                    const selectedCat = subgradeCategories?.find((c: any) => c.id === newAssignment.category_id);
                                    const isCatOfEditing = editingAssignment && (editingAssignment.category_id || editingAssignment.subgrade_categories?.id) === newAssignment.category_id;
                                    const usedInOtherAssignments = (categoryUsage[newAssignment.category_id || '']?.totalPoints || 0) - (isCatOfEditing ? Number(editingAssignment.max_score) : 0);
                                    const catTotal = selectedCat ? Number(selectedCat.max_score) : 100;
                                    const remainingBudget = selectedCat ? Math.max(0, catTotal - usedInOtherAssignments) : 100;

                                    return (
                                        <>
                                            <div>
                                                <label className="text-xs font-bold text-slate-300 ml-1 flex items-center justify-between">
                                                    <span className="flex items-center gap-1.5">
                                                        <Layers className="w-3.5 h-3.5 text-blue-400" />
                                                        Vincular a Subcalificación (Opcional)
                                                    </span>
                                                    {newAssignment.category_id && (
                                                        <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                                                            Suma Directa
                                                        </span>
                                                    )}
                                                </label>
                                                <select
                                                    className="w-full mt-1.5 px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:ring-2 focus:ring-blue-500/40 outline-none text-slate-100 text-xs sm:text-sm font-medium"
                                                    value={newAssignment.category_id || ''}
                                                    onChange={(e) => {
                                                        const catId = e.target.value;
                                                        if (catId) {
                                                            const found = subgradeCategories?.find((c: any) => c.id === catId);
                                                            const isCatEditing = editingAssignment && (editingAssignment.category_id || editingAssignment.subgrade_categories?.id) === catId;
                                                            const used = (categoryUsage[catId]?.totalPoints || 0) - (isCatEditing ? Number(editingAssignment.max_score) : 0);
                                                            const rem = found ? Math.max(0, Number(found.max_score) - used) : 100;
                                                            setNewAssignment({
                                                                ...newAssignment,
                                                                category_id: catId,
                                                                max_score: rem
                                                            });
                                                        } else {
                                                            setNewAssignment({
                                                                ...newAssignment,
                                                                category_id: '',
                                                                max_score: 100
                                                            });
                                                        }
                                                    }}
                                                >
                                                    <option value="">(Ninguna) - Actividad Libre / Independiente</option>
                                                    {subgradeCategories?.map((cat: any) => {
                                                        const isCatEditing = editingAssignment && (editingAssignment.category_id || editingAssignment.subgrade_categories?.id) === cat.id;
                                                        const used = (categoryUsage[cat.id]?.totalPoints || 0) - (isCatEditing ? Number(editingAssignment.max_score) : 0);
                                                        const rem = Math.max(0, Number(cat.max_score) - used);
                                                        const isFull = rem <= 0;

                                                        return (
                                                            <option key={cat.id} value={cat.id} disabled={isFull}>
                                                                {cat.name} ({used}/{cat.max_score} pts {isFull ? '- COMPLETA 🔒' : `- Quedan ${rem} pts`})
                                                            </option>
                                                        );
                                                    })}
                                                </select>

                                                {/* Budget Progress Card */}
                                                {selectedCat ? (
                                                    <div className={`mt-2.5 p-3 rounded-2xl border text-xs space-y-1.5 ${
                                                        remainingBudget > 0 
                                                            ? 'bg-blue-500/10 border-blue-500/30 text-blue-200' 
                                                            : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                                                    }`}>
                                                        <div className="flex items-center justify-between font-bold">
                                                            <span>Presupuesto categoría "{selectedCat.name}":</span>
                                                            <span className="font-extrabold">{usedInOtherAssignments} / {catTotal} pts asignados</span>
                                                        </div>
                                                        <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                                                            <div 
                                                                className={`h-full transition-all duration-300 ${
                                                                    usedInOtherAssignments >= catTotal ? 'bg-amber-400' : 'bg-blue-500'
                                                                }`}
                                                                style={{ width: `${Math.min(100, (usedInOtherAssignments / catTotal) * 100)}%` }}
                                                            />
                                                        </div>
                                                        <p className="text-[11px] opacity-90 leading-tight">
                                                            {remainingBudget > 0 ? (
                                                                <>Puntos disponibles para esta tarea: <strong className="text-white font-bold">{remainingBudget} pts</strong>. Cada punto ganado sumará directamente al cuadro de notas.</>
                                                            ) : (
                                                                <>Esta categoría ya tiene todos sus puntos asignados ({catTotal} pts). No se pueden agregar más tareas.</>
                                                            )}
                                                        </p>
                                                    </div>
                                                ) : (
                                                    <span className="text-[10px] text-slate-400 ml-1 mt-1 block">
                                                        Si vinculas una categoría, el punteo se limita a los puntos disponibles de la categoría y sumará de forma directa.
                                                    </span>
                                                )}
                                            </div>

                                            <div>
                                                <label className="text-xs font-bold text-slate-300 ml-1">Fecha y Hora Límite</label>
                                                <input
                                                    type="datetime-local"
                                                    required
                                                    className="w-full mt-1.5 px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:ring-2 focus:ring-blue-500/40 outline-none text-slate-100 text-xs sm:text-sm font-medium"
                                                    value={newAssignment.due_date}
                                                    onChange={(e) => setNewAssignment({ ...newAssignment, due_date: e.target.value })}
                                                />
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                                <div>
                                                    <label className="text-xs font-bold text-slate-300 ml-1 flex items-center justify-between">
                                                        <span>Punteo Académico</span>
                                                        {selectedCat && (
                                                            <span className="text-[10px] text-blue-400 font-semibold">
                                                                Máx: {remainingBudget} pts
                                                            </span>
                                                        )}
                                                    </label>
                                                    <input
                                                        type="number"
                                                        min="0.1"
                                                        max={selectedCat ? remainingBudget : 100}
                                                        step="0.1"
                                                        required
                                                        className="w-full mt-1.5 px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:ring-2 focus:ring-blue-500/40 outline-none text-slate-100 text-xs sm:text-sm font-medium"
                                                        value={newAssignment.max_score}
                                                        onChange={(e) => setNewAssignment({ ...newAssignment, max_score: Number(e.target.value) })}
                                                        placeholder={selectedCat ? String(remainingBudget) : '100'}
                                                    />
                                                    <span className="text-[10px] text-slate-500 ml-1 mt-0.5 block">
                                                        {selectedCat ? `Máximo permitido: ${remainingBudget} pts disponibles` : 'Valor en puntos para el promedio'}
                                                    </span>
                                                </div>
                                                <div>
                                                    <label className="text-xs font-bold text-slate-300 ml-1 flex items-center justify-between">
                                                        <span className="flex items-center gap-1 text-amber-400">
                                                            <Sparkles className="w-3 h-3" />
                                                            Puntos de Mérito
                                                        </span>
                                                        <span className="text-[10px] text-amber-400/80 font-normal">Gamificación</span>
                                                    </label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="1"
                                                        className="w-full mt-1.5 px-3.5 py-2.5 bg-slate-950 border border-amber-500/30 rounded-xl focus:ring-2 focus:ring-amber-500/40 outline-none text-amber-300 text-xs sm:text-sm font-bold"
                                                        value={newAssignment.merit_points || 0}
                                                        onChange={(e) => setNewAssignment({ ...newAssignment, merit_points: Math.max(0, parseInt(e.target.value) || 0) })}
                                                        placeholder="0"
                                                    />
                                                    <span className="text-[10px] text-slate-500 ml-1 mt-0.5 block">Puntos para la tienda escolar / canje</span>
                                                </div>
                                            </div>

                                            {/* Digital Guide / Resource Attachment for Teacher */}
                                            <div>
                                                <label className="text-xs font-bold text-slate-300 ml-1 flex items-center justify-between">
                                                    <span className="flex items-center gap-1.5 text-purple-400">
                                                        <Paperclip className="w-3.5 h-3.5" />
                                                        Guía de Estudio o Material de Apoyo (Opcional)
                                                    </span>
                                                    <span className="text-[10px] text-slate-400">PDF, Word, Excel, ZIP, Img (Máx 15MB)</span>
                                                </label>
                                                
                                                <div className="mt-1.5 flex flex-col gap-2">
                                                    {newAssignment.attachment_url ? (
                                                        <div className="flex items-center justify-between p-2.5 bg-purple-950/30 border border-purple-800/50 rounded-xl text-xs">
                                                            <div className="flex items-center gap-2 truncate">
                                                                <Paperclip className="w-4 h-4 text-purple-400 shrink-0" />
                                                                <span className="text-purple-200 truncate font-mono text-[11px]">{newAssignment.attachment_url.split('/').pop()}</span>
                                                            </div>
                                                            <div className="flex items-center gap-2 shrink-0">
                                                                <a
                                                                    href={`${import.meta.env.VITE_API_URL || 'https://plataformaultec.duckdns.org'}${newAssignment.attachment_url}`}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="px-2 py-1 text-[10px] font-bold text-purple-400 hover:text-purple-300 bg-purple-900/40 rounded-lg border border-purple-700/40"
                                                                >
                                                                    Ver
                                                                </a>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setNewAssignment({ ...newAssignment, attachment_url: null })}
                                                                    className="p-1 text-rose-400 hover:text-rose-300 hover:bg-rose-900/20 rounded-lg"
                                                                    title="Quitar archivo"
                                                                >
                                                                    <X className="w-3.5 h-3.5" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-2">
                                                            <input
                                                                type="file"
                                                                id="teacher-guide-upload"
                                                                className="hidden"
                                                                onChange={handleGuideFileUpload}
                                                                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.png,.jpg,.jpeg,.webp"
                                                            />
                                                            <label
                                                                htmlFor="teacher-guide-upload"
                                                                className="flex-1 py-2 px-3 border border-dashed border-slate-700 hover:border-purple-500/50 bg-slate-950 hover:bg-purple-950/20 rounded-xl cursor-pointer text-center text-xs font-semibold text-slate-400 hover:text-purple-300 transition-all flex items-center justify-center gap-2"
                                                            >
                                                                {isUploadingGuide ? (
                                                                    <>
                                                                        <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-400" />
                                                                        <span>Subiendo guía digital...</span>
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <FileUp className="w-3.5 h-3.5 text-purple-400" />
                                                                        <span>Adjuntar archivo o guía de la tarea</span>
                                                                    </>
                                                                )}
                                                            </label>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-3 pt-3 border-t border-slate-800">
                                                <button
                                                    type="button"
                                                    onClick={() => setIsModalOpen(false)}
                                                    className="flex-1 py-2.5 px-4 bg-slate-800 hover:bg-slate-750 active:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl border border-slate-700 transition-all text-center"
                                                >
                                                    Cancelar
                                                </button>
                                                <button
                                                    type="submit"
                                                    disabled={createMutation.isPending || updateMutation.isPending || (Boolean(selectedCat) && remainingBudget <= 0 && (!editingAssignment || Number(newAssignment.max_score) <= 0))}
                                                    className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold rounded-xl shadow-lg shadow-blue-600/30 transition-all text-xs flex items-center justify-center space-x-2 disabled:opacity-50"
                                                >
                                                    {(createMutation.isPending || updateMutation.isPending) ? (
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                    ) : (
                                                        <Check className="h-4 w-4" />
                                                    )}
                                                    <span>{editingAssignment ? 'Guardar Cambios' : 'Guardar Tarea'}</span>
                                                </button>
                                            </div>
                                        </>
                                    );
                                })()}
                            </form>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Confirm Delete Modal */}
            {deletingAssignment && (
                <ConfirmModal
                    isOpen={!!deletingAssignment}
                    variant="danger"
                    title="¿Eliminar Tarea?"
                    description={
                        <div className="space-y-2">
                            <p>
                                ¿Estás seguro de que deseas eliminar la tarea <strong className="text-white">"{deletingAssignment.title}"</strong> ({deletingAssignment.max_score} pts)?
                            </p>
                            {deletingAssignment.category_id && (
                                <p className="text-amber-400 text-[11px] bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20 leading-relaxed">
                                    ⚠️ Al eliminarla, se liberarán {deletingAssignment.max_score} pts en la categoría de subcalificaciones y las notas bimestrales se recalcularán automáticamente.
                                </p>
                            )}
                        </div>
                    }
                    confirmText="Sí, Eliminar"
                    cancelText="Cancelar"
                    isLoading={deleteMutation.isPending}
                    onConfirm={() => deleteMutation.mutate(deletingAssignment.id)}
                    onClose={() => setDeletingAssignment(null)}
                />
            )}


            {/* Review / Grading Modal (Rendered with createPortal at Root Level) */}
            {reviewAssignment && createPortal(
                <div 
                    className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200"
                    onClick={() => setReviewAssignment(null)}
                >
                    <div 
                        className="relative w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col h-[94vh] sm:h-[88vh] animate-in zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="bg-slate-950/90 p-4 sm:p-5 border-b border-slate-800 flex flex-col gap-3 shrink-0">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                    <h3 className="text-base sm:text-lg font-bold text-slate-100 truncate">
                                        {reviewAssignment.title}
                                    </h3>
                                    <p className="text-xs text-slate-400 mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                        <span className="flex items-center text-blue-400 font-medium">
                                            <Calendar className="h-3 w-3 mr-1" />
                                            Vence: {formatDate(reviewAssignment.due_date)}
                                        </span>
                                        <span>&bull;</span>
                                        <span className="text-slate-300 font-bold">
                                            Nota Máx: {reviewAssignment.max_score} pts
                                        </span>
                                        {(reviewAssignment.subgrade_categories?.name || reviewAssignment.category_name) && (
                                            <>
                                                <span>&bull;</span>
                                                <span className="text-blue-400 font-bold flex items-center gap-1">
                                                    <Layers className="w-3 h-3" />
                                                    {reviewAssignment.subgrade_categories?.name || reviewAssignment.category_name}
                                                </span>
                                            </>
                                        )}
                                    </p>
                                    {(reviewAssignment.subgrade_categories?.name || reviewAssignment.category_name) && (
                                        <div className="mt-2 text-[11px] text-blue-300 bg-blue-500/10 border border-blue-500/20 px-2.5 py-1 rounded-lg flex items-center gap-1.5 w-fit">
                                            <Sparkles className="w-3 h-3 text-blue-400" />
                                            <span>Vinculada a subcalificaciones: las notas se sincronizan automáticamente con el cuadro bimestral.</span>
                                        </div>
                                    )}
                                    {reviewAssignment.attachment_url && (
                                        <div className="mt-2">
                                            <a
                                                href={`${import.meta.env.VITE_API_URL || 'https://plataformaultec.duckdns.org'}${reviewAssignment.attachment_url}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold text-purple-400 bg-purple-950/40 hover:bg-purple-900/50 border border-purple-800/40 transition-colors"
                                            >
                                                <Paperclip className="w-3.5 h-3.5" />
                                                <span>Ver Guía / Material de la Tarea</span>
                                                <ExternalLink className="w-3 h-3 text-purple-400/70" />
                                            </a>
                                        </div>
                                    )}
                                </div>
                                <button
                                    onClick={() => setReviewAssignment(null)}
                                    className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors shrink-0"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Filter Status Pills (Horizontal scroll on mobile) */}
                            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
                                {[
                                    { id: 'ALL', label: 'Todos' },
                                    { id: 'SUBMITTED', label: 'Entregados' },
                                    { id: 'PENDING', label: 'Faltantes' },
                                    { id: 'GRADED', label: 'Calificados' },
                                ].map((tab) => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setFilterStatus(tab.id as any)}
                                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                                            filterStatus === tab.id 
                                                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30' 
                                                : 'bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700/60'
                                        }`}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Submissions List */}
                        <div className="flex-1 overflow-y-auto p-3.5 sm:p-6 space-y-3.5 bg-slate-900/60 custom-scrollbar">
                            {isLoadingSubmissions ? (
                                <div className="flex flex-col items-center justify-center h-full space-y-3 py-16">
                                    <Loader2 className="animate-spin h-8 w-8 text-blue-500" />
                                    <p className="text-slate-400 text-xs font-medium">Cargando entregas de los estudiantes...</p>
                                </div>
                            ) : filteredSubmissions.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full space-y-3 py-16 text-center">
                                    <ClipboardList className="h-10 w-10 text-slate-600" />
                                    <p className="text-slate-400 text-xs font-medium">No hay entregas para mostrar en este filtro.</p>
                                </div>
                            ) : (
                                filteredSubmissions.map((sub) => (
                                    <div 
                                        key={sub.student_id} 
                                        className="p-4 sm:p-5 bg-slate-950/70 border border-slate-800/90 rounded-2xl flex flex-col lg:flex-row gap-4 lg:gap-6 items-start lg:items-center justify-between"
                                    >
                                        {/* Student Info */}
                                        <div className="w-full lg:w-5/12 space-y-2">
                                            <div className="flex items-center gap-2.5">
                                                <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 font-black text-xs flex items-center justify-center shrink-0">
                                                    {sub.student_name.charAt(0)}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <h4 className="font-bold text-slate-100 text-sm truncate">
                                                        {sub.student_name}
                                                    </h4>
                                                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold uppercase tracking-wider border ${
                                                            sub.status === 'GRADED' 
                                                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                                                                : sub.status === 'SUBMITTED' 
                                                                ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' 
                                                                : 'bg-slate-800 text-slate-400 border-slate-700'
                                                        }`}>
                                                            {sub.status === 'GRADED' ? 'Calificado' : sub.status === 'SUBMITTED' ? 'Entregado' : 'Pendiente'}
                                                        </span>
                                                        {sub.submission_date && (
                                                            <span className="text-[10px] text-slate-400">
                                                                {new Date(sub.submission_date).toLocaleDateString()}
                                                            </span>
                                                        )}
                                                        {Number(sub.merit_points_awarded) > 0 && (
                                                            <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                                                <Sparkles className="w-3 h-3 text-amber-400" />
                                                                +{sub.merit_points_awarded} mérito
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* File Evidence Button */}
                                            {sub.attachment_url ? (
                                                <a 
                                                    href={`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}${sub.attachment_url}`} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer" 
                                                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 text-xs font-bold transition-all active:scale-95"
                                                >
                                                    <Paperclip className="h-3.5 w-3.5" />
                                                    <span>Ver Evidencia / Comprobante</span>
                                                    <ExternalLink className="h-3 w-3 opacity-70" />
                                                </a>
                                            ) : sub.status !== 'PENDING' ? (
                                                <span className="inline-flex items-center gap-1.5 text-[10px] text-amber-400 font-bold bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg">
                                                    <AlertCircle className="w-3 h-3" />
                                                    Entregado sin archivo
                                                </span>
                                            ) : (
                                                <p className="text-[11px] text-slate-500 italic">
                                                    El alumno aún no ha entregado esta tarea.
                                                </p>
                                            )}
                                        </div>

                                        {/* Grading Form */}
                                        {(sub.status === 'SUBMITTED' || sub.status === 'GRADED') && (
                                            <form 
                                                onSubmit={(e) => handleGradeSubmit(sub.submission_id!, e)} 
                                                className="w-full lg:w-7/12 flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-end pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-800/80"
                                            >
                                                <div className="w-full sm:w-28 shrink-0">
                                                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                                                        Nota (/{reviewAssignment.max_score})
                                                    </label>
                                                    <input
                                                        type="number"
                                                        name="score"
                                                        step="0.1"
                                                        max={reviewAssignment.max_score}
                                                        required
                                                        defaultValue={sub.score || ''}
                                                        placeholder="0"
                                                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700/80 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-slate-100 text-xs font-bold text-center"
                                                    />
                                                </div>

                                                {Number(reviewAssignment.merit_points) > 0 && (
                                                    <div className="w-full sm:w-24 shrink-0">
                                                        <label className="text-[10px] font-bold uppercase tracking-wider text-amber-400 block mb-1 flex items-center gap-1">
                                                            <Sparkles className="w-2.5 h-2.5" />
                                                            <span>Mérito</span>
                                                        </label>
                                                        <input
                                                            type="number"
                                                            name="custom_merit"
                                                            min="0"
                                                            defaultValue={sub.merit_points_awarded !== undefined ? sub.merit_points_awarded : ''}
                                                            placeholder="Auto"
                                                            className="w-full px-3 py-2 bg-slate-900 border border-amber-500/40 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 text-amber-300 text-xs font-bold text-center"
                                                            title="Dejar en blanco para cálculo automático (>=60% otorga méritos)"
                                                        />
                                                    </div>
                                                )}

                                                <div className="flex-1">
                                                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                                                        Comentario / Feedback
                                                    </label>
                                                    <input
                                                        type="text"
                                                        name="feedback"
                                                        defaultValue={sub.feedback || ''}
                                                        placeholder="Observaciones para el alumno..."
                                                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700/80 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-slate-100 text-xs font-medium"
                                                    />
                                                </div>

                                                <div className="shrink-0">
                                                    <button
                                                        type="submit"
                                                        disabled={gradeMutation.isPending}
                                                        className="w-full sm:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold rounded-xl text-xs transition-all shadow-md shadow-emerald-600/20 disabled:opacity-50 flex items-center justify-center gap-1.5"
                                                    >
                                                        {gradeMutation.isPending ? (
                                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                        ) : (
                                                            <Check className="w-3.5 h-3.5" />
                                                        )}
                                                        <span>{sub.status === 'GRADED' ? 'Actualizar' : 'Calificar'}</span>
                                                    </button>
                                                </div>
                                            </form>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Print Styles */}
            <style dangerouslySetInnerHTML={{
                __html: `
                @media print {
                    @page { margin: 15mm; size: letter landscape; }
                    body { background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    #root { height: auto !important; overflow: visible !important; }
                    .print\\:hidden { display: none !important; }
                    .print\\:block { display: block !important; }
                    .print\\:border { border-width: 1px !important; }
                    .print\\:static { position: static !important; }
                    .print\\:shadow-none { box-shadow: none !important; }
                    .print\\:w-auto { width: auto !important; }
                    .print\\:bg-transparent { background-color: transparent !important; }
                    .print\\:bg-none { background-image: none !important; }
                }
            `}} />
        </div>
    );
};

export default AssignmentsModule;
