import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getCourses, getCourseSchedules } from '../academicService';
import { assignmentsService, type Assignment } from '../../../services/assignmentsService';
import { Plus, Loader2, ClipboardList, Calendar, CheckCircle, CheckCircle2, Clock, Paperclip, Printer, FileBarChart, AlertCircle } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const AssignmentsModule = () => {
    const queryClient = useQueryClient();
    const [selectedCourse, setSelectedCourse] = useState<number | string | null>(null);
    const [selectedSchedule, setSelectedSchedule] = useState<string>('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [reviewAssignment, setReviewAssignment] = useState<Assignment | null>(null);
    const [activeTab, setActiveTab] = useState<'active' | 'history' | 'report'>('active');

    // Filters for review modal
    const [filterStatus, setFilterStatus] = useState<'ALL' | 'PENDING' | 'SUBMITTED' | 'GRADED'>('ALL');

    const [newAssignment, setNewAssignment] = useState<Partial<Assignment>>({
        title: '',
        description: '',
        assignment_type: 'HOMEWORK',
        due_date: '',
        weight_points: 1.0,
        max_score: 100.0,
    });
    const [errorMsg, setErrorMsg] = useState('');

    // Fetch courses for the dropdown
    const { data: courses, isLoading: isLoadingCourses } = useQuery({
        queryKey: ['courses'],
        queryFn: getCourses,
    });

    // Fetch schedules for the selected course
    const { data: schedules, isLoading: isLoadingSchedules } = useQuery({
        queryKey: ['courseSchedules', selectedCourse],
        queryFn: () => getCourseSchedules(selectedCourse as string),
        enabled: !!selectedCourse
    });

    // Fetch assignments when a course is selected
    const { data: assignments, isLoading: isLoadingAssignments } = useQuery({
        queryKey: ['assignments', selectedCourse, selectedSchedule],
        queryFn: () => assignmentsService.getCourseAssignments(selectedCourse!, selectedSchedule),
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

    const createMutation = useMutation({
        mutationFn: assignmentsService.createAssignment,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['assignments', selectedCourse, selectedSchedule] });
            setIsModalOpen(false);
            setNewAssignment({
                title: '',
                description: '',
                assignment_type: 'HOMEWORK',
                due_date: '',
                weight_points: 1.0,
                max_score: 100.0,
            });
            setErrorMsg('');
        },
        onError: (err: any) => {
            console.error('Error creating assignment:', err);
            setErrorMsg(err.response?.data?.message || 'Error al crear la tarea.');
        }
    });

    const gradeMutation = useMutation({
        mutationFn: ({ submissionId, score, feedback }: { submissionId: string, score: number, feedback: string }) =>
            assignmentsService.gradeSubmission(submissionId, score, feedback),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['submissions', reviewAssignment?.id] });
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

        createMutation.mutate({
            ...newAssignment,
            course_id: selectedCourse as string,
            schedule_id: selectedSchedule || undefined
        });
    };

    const handleNewAssignment = () => {
        if (!selectedCourse) {
            alert('Por favor, seleccione un curso primero en el menú superior.');
            return;
        }
        setNewAssignment({
            title: '',
            description: '',
            assignment_type: 'HOMEWORK',
            due_date: '',
            weight_points: 1.0,
            max_score: 100.0,
        });
        setErrorMsg('');
        setIsModalOpen(true);
    };

    const handleGradeSubmit = (submissionId: string, e: React.FormEvent) => {
        e.preventDefault();
        const form = e.target as HTMLFormElement;
        const score = Number((form.elements.namedItem('score') as HTMLInputElement).value);
        const feedback = (form.elements.namedItem('feedback') as HTMLInputElement).value;
        gradeMutation.mutate({ submissionId, score, feedback });
    };

    const formatDate = (dateString: string) => {
        const d = new Date(dateString);
        return d.toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    const now = new Date();
    const activeAssignments = assignments?.filter(a => new Date(a.due_date) > now) || [];
    const historyAssignments = assignments?.filter(a => new Date(a.due_date) <= now) || [];
    const displayedAssignments = activeTab === 'active' ? activeAssignments : historyAssignments;

    const filteredSubmissions = submissions?.filter(s => filterStatus === 'ALL' || s.status === filterStatus) || [];

    const generatePDF = () => {
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

            // Put note and percentage on same line to save height
            row.push(`${student.total_score}/${student.max_possible_score} (${student.percentage}%)`);
            return row;
        });

        // Inject AutoTable with high density
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
                cellPadding: 1 // High density padding
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

        // Trigger Download
        doc.save(`Reporte_${courseName.replace(/\s+/g, '_')}_Calificaciones.pdf`);
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden">
                <div>
                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Gestión de Tareas</h2>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">Crea y administra tareas, exámenes y revisa entregas.</p>
                </div>

                {/* Course Selector */}
                <div className="flex items-center space-x-4 w-full md:w-auto">
                    <select
                        className="flex-1 md:w-64 px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-4 focus:ring-brand-blue/10 outline-none text-slate-700 dark:text-slate-200"
                        value={selectedCourse || ''}
                        onChange={(e) => {
                            setSelectedCourse(e.target.value);
                            setSelectedSchedule('');
                            setReviewAssignment(null);
                        }}
                    >
                        <option value="" disabled>-- Selecciona un curso --</option>
                        {courses?.map((c: any) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>

                    <select
                        className="flex-1 md:w-48 px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-4 focus:ring-brand-blue/10 outline-none text-slate-700 dark:text-slate-200 disabled:opacity-50"
                        value={selectedSchedule}
                        onChange={(e) => setSelectedSchedule(e.target.value)}
                        disabled={!selectedCourse}
                    >
                        <option value="">Todos los Horarios</option>
                        {schedules?.map((s: any) => (
                            <option key={s.id} value={s.id}>{s.name || `Horario ${s.day_of_week}`}</option>
                        ))}
                    </select>

                    <button
                        onClick={handleNewAssignment}
                        className="flex items-center space-x-2 px-6 py-3 bg-brand-blue text-white rounded-xl hover:bg-blue-600 transition-all shadow-[0_0_15px_rgba(13,89,242,0.4)] active:scale-95 font-semibold"
                    >
                        <Plus className="h-5 w-5" />
                        <span className="hidden sm:inline">Nueva Tarea</span>
                    </button>
                    {activeTab === 'report' && (
                        <button
                            onClick={generatePDF}
                            className="flex items-center space-x-2 px-6 py-3 bg-brand-purple text-white transition-all shadow-[0_0_15px_rgba(127,13,242,0.4)] hover:bg-purple-700 rounded-xl font-semibold whitespace-nowrap active:scale-95"
                        >
                            <Printer className="h-5 w-5" />
                            <span className="hidden sm:inline">Exportar PDF</span>
                        </button>
                    )}
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

            {/* Tabs */}
            {selectedCourse && (
                <div className="flex border-b border-slate-200 dark:border-slate-700 space-x-8 print:hidden overflow-x-auto">
                    <button
                        onClick={() => setActiveTab('active')}
                        className={`pb-4 font-semibold transition-colors whitespace-nowrap ${activeTab === 'active' ? 'text-brand-blue border-b-2 border-brand-blue' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                    >
                        Tareas Activas
                    </button>
                    <button
                        onClick={() => setActiveTab('history')}
                        className={`pb-4 font-semibold transition-colors whitespace-nowrap ${activeTab === 'history' ? 'text-brand-blue border-b-2 border-brand-blue' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                    >
                        Historial / Finalizadas
                    </button>
                    <button
                        onClick={() => setActiveTab('report')}
                        className={`pb-4 font-semibold transition-colors whitespace-nowrap flex items-center gap-2 ${activeTab === 'report' ? 'text-brand-purple border-b-2 border-brand-purple' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                    >
                        <FileBarChart className="w-4 h-4" /> Reporte de Calificaciones
                    </button>
                </div>
            )}

            {/* Loading States */}
            {(isLoadingCourses || (selectedCourse && isLoadingSchedules) || (selectedCourse && isLoadingAssignments) || (activeTab === 'report' && isLoadingReport)) ? (
                <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
                    <Loader2 className="animate-spin h-12 w-12 text-brand-blue/50" />
                    <p className="text-slate-400 font-medium animate-pulse">Cargando datos...</p>
                </div>
            ) : !selectedCourse ? (
                /* Empty state when no course selected */
                <div className="col-span-full bg-white/50 dark:bg-slate-800/50 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-3xl py-20 text-center flex flex-col items-center justify-center space-y-4 backdrop-blur-sm">
                    <div className="h-16 w-16 bg-slate-100 dark:bg-slate-700/50 rounded-full flex items-center justify-center text-slate-400 dark:text-slate-500">
                        <ClipboardList className="h-8 w-8" />
                    </div>
                    <div className="max-w-xs">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Selecciona un Curso</h3>
                        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Elige un curso en el menú superior para ver o crear tareas.</p>
                    </div>
                </div>
            ) : displayedAssignments?.length === 0 ? (
                /* Empty state for course with no assignments in current tab */
                <div className="col-span-full bg-white/50 dark:bg-slate-800/50 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-3xl py-20 text-center flex flex-col items-center justify-center space-y-4 backdrop-blur-sm">
                    <div className="h-16 w-16 bg-slate-100 dark:bg-slate-700/50 rounded-full flex items-center justify-center text-slate-400 dark:text-slate-500">
                        {activeTab === 'active' ? <Clock className="h-8 w-8" /> : <CheckCircle className="h-8 w-8" />}
                    </div>
                    <div className="max-w-xs">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">No hay tareas {activeTab === 'active' ? 'activas' : 'finalizadas'}</h3>
                        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                            {activeTab === 'active' ? 'Aún no has asignado tareas futuras para este curso.' : 'No hay tareas pasadas en este curso.'}
                        </p>
                    </div>
                </div>
            ) : activeTab === 'report' ? (
                /* Report View */
                <div className="glass-card rounded-3xl overflow-hidden border border-slate-200 dark:border-white/10 dark:bg-slate-900/50 print:overflow-visible print:border-none print:shadow-none print:bg-transparent print:!backdrop-blur-none">
                    <div className="overflow-x-auto print:overflow-visible">
                        <table className="w-full text-left min-w-[800px] print:min-w-0">
                            <thead className="bg-slate-50/50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700/50 print:border-b-2">
                                <tr>
                                    <th className="px-6 py-5 text-left text-xs font-bold text-slate-500 dark:text-slate-300 uppercase tracking-widest sticky left-0 bg-slate-50 dark:bg-slate-800 shadow-[1px_0_0_rgba(226,232,240,1)] dark:shadow-[1px_0_0_rgba(51,65,85,1)] w-64 z-10 print:static print:shadow-none print:w-auto print:px-2 print:py-2 print:text-[10px]">
                                        Alumno
                                    </th>
                                    {reportData?.assignments.map(ast => (
                                        <th key={ast.id} className="px-6 py-5 text-center text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest min-w-[120px] max-w-[200px] truncate print:min-w-0 print:px-1 print:py-1 print:text-[8px] print:tracking-normal" title={ast.title}>
                                            <div className="truncate print:whitespace-normal print:leading-tight">{ast.title}</div>
                                            <div className="text-brand-purple mt-1 flex items-center justify-center space-x-1 print:text-slate-600 print:mt-0">
                                                <span>{ast.max_score} pts</span>
                                                <span className="text-slate-400 print:hidden">({ast.weight_points}x)</span>
                                            </div>
                                        </th>
                                    ))}
                                    <th className="px-6 py-5 text-right text-xs font-black text-slate-900 dark:text-white uppercase tracking-widest bg-brand-blue/5 dark:bg-brand-blue/10 min-w-[120px] print:min-w-0 print:bg-transparent print:px-2 print:py-2 print:text-[10px]">
                                        Nota Acumulada
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 bg-white/50 dark:bg-transparent print:divide-slate-300">
                                {reportData?.students.map((student) => (
                                    <tr key={student.student_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition group print:break-inside-avoid print:border-b print:border-slate-200/50">
                                        <td className="px-6 py-4 font-bold text-slate-900 dark:text-white sticky left-0 bg-white dark:bg-slate-900 group-hover:bg-slate-50 dark:group-hover:bg-slate-800 shadow-[1px_0_0_rgba(226,232,240,1)] dark:shadow-[1px_0_0_rgba(51,65,85,1)] z-10 print:static print:shadow-none print:bg-transparent print:px-2 print:py-1.5 print:text-[11px] print:font-semibold">
                                            <div className="flex items-center space-x-3 print:space-x-1">
                                                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-brand-blue to-brand-purple text-white flex items-center justify-center font-bold text-xs shrink-0 print:hidden">
                                                    {student.student_name.charAt(0)}
                                                </div>
                                                <span className="truncate print:whitespace-nowrap">{student.student_name}</span>
                                            </div>
                                        </td>

                                        {student.grades.map((grade) => (
                                            <td key={grade.assignment_id} className="px-6 py-4 text-center print:px-1 print:py-1.5 print:text-[10px]">
                                                {grade.status === 'PENDING' ? (
                                                    <span className="text-slate-400 font-medium">-</span>
                                                ) : grade.status === 'SUBMITTED' ? (
                                                    <span className="inline-flex items-center text-amber-500 font-bold text-sm bg-amber-500/10 px-2 py-1 rounded-lg print:border print:border-amber-200 print:text-[9px] print:px-1 print:py-0 print:bg-transparent">
                                                        S/C
                                                    </span>
                                                ) : (
                                                    <span className="font-bold text-slate-700 dark:text-slate-200 print:text-black">
                                                        {grade.score} <span className="text-xs text-slate-400 font-normal print:text-[8px] print:text-slate-500">/ {grade.max_score}</span>
                                                    </span>
                                                )}
                                            </td>
                                        ))}

                                        <td className="px-6 py-4 text-right bg-brand-blue/5 dark:bg-brand-blue/10 font-black text-brand-blue text-lg print:bg-transparent print:px-2 print:py-1.5 print:text-sm print:text-black">
                                            {student.total_score} <span className="text-xs font-bold text-slate-500 print:text-[9px]">/ {student.max_possible_score}</span>
                                            <div className={`text-[10px] uppercase font-bold tracking-widest mt-1 print:text-[8px] print:mt-0 ${student.percentage >= 60 ? 'text-brand-success print:text-black' : 'text-brand-danger print:text-black'}`}>
                                                {student.percentage}%
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {(!reportData?.students || reportData.students.length === 0) && (
                                    <tr>
                                        <td colSpan={2 + (reportData?.assignments.length || 0)} className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
                                            No hay alumnos inscritos o datos que reportar.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                /* Assignments Grid */
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {displayedAssignments?.map((assignment: any) => (
                        <div
                            key={assignment.id}
                            className="group glass-card p-6 border border-slate-200 dark:border-white/10 hover:border-brand-purple/50 dark:hover:border-brand-purple/50 transition-all duration-300 relative overflow-hidden flex flex-col cursor-pointer"
                            onClick={() => { setReviewAssignment(assignment); setFilterStatus('ALL'); }}
                        >
                            {/* Type Badge */}
                            <div className="absolute top-0 right-0 p-4">
                                <span className={`text-[10px] px-2 py-1 rounded-full font-bold uppercase tracking-wider border ${activeTab === 'history' ? 'bg-slate-200 text-slate-600 border-slate-300 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600' : 'bg-brand-purple/20 text-brand-purple border-brand-purple/30'}`}>
                                    {assignment.assignment_type}
                                </span>
                            </div>

                            <div className="mb-4 mt-2 flex-grow">
                                <h3 className="text-xl font-bold text-slate-900 dark:text-white group-hover:text-brand-purple transition-colors pr-16">{assignment.title}</h3>
                                <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm line-clamp-2 leading-relaxed">{assignment.description || 'Sin descripción.'}</p>
                            </div>

                            <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-700/50 mt-auto">
                                <div className={`flex items-center text-sm ${activeTab === 'history' ? 'text-brand-danger' : 'text-brand-blue'}`}>
                                    <Calendar className="h-4 w-4 mr-2" />
                                    <span className="font-medium">
                                        {activeTab === 'history' ? 'Finalizó: ' : 'Vence: '}
                                        {formatDate(assignment.due_date)}
                                    </span>
                                </div>
                                <div className="flex items-center text-sm justify-between">
                                    <span className="text-slate-500 dark:text-slate-400">Peso: <strong className="text-slate-800 dark:text-slate-200">{assignment.weight_points}x</strong></span>
                                    <span className="text-brand-purple font-semibold hover:underline">Revisar Entregas &rarr;</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Creation Modal */}
            {
                isModalOpen && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setIsModalOpen(false)} />

                        <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-lg shadow-2xl relative z-10 overflow-hidden animate-in zoom-in-95 duration-300 border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]">
                            <div className="bg-gradient-to-r from-brand-purple to-indigo-600 p-6 text-white shrink-0">
                                <h3 className="text-2xl font-bold">Crear Nueva Tarea</h3>
                                <p className="text-white/80 text-sm mt-1">Configura los detalles de la actividad para los estudiantes.</p>
                            </div>

                            <div className="overflow-y-auto shrink-1 p-8">
                                <form onSubmit={handleSubmit} className="space-y-5">
                                    {errorMsg && (
                                        <div className="bg-brand-danger/10 border border-brand-danger/30 text-brand-danger px-4 py-3 rounded-xl text-sm font-medium animate-shake">
                                            {errorMsg}
                                        </div>
                                    )}

                                    <div>
                                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1">Título de la Tarea</label>
                                        <input
                                            type="text"
                                            required
                                            className="w-full mt-2 px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-purple/50 outline-none transition-all dark:text-white"
                                            placeholder="Ej: Ensayo sobre Historia"
                                            value={newAssignment.title}
                                            onChange={(e) => setNewAssignment({ ...newAssignment, title: e.target.value })}
                                        />
                                    </div>

                                    <div>
                                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1">Descripción / Instrucciones</label>
                                        <textarea
                                            rows={3}
                                            className="w-full mt-2 px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-purple/50 outline-none transition-all resize-none dark:text-white"
                                            placeholder="Detalles sobre lo que el alumno debe hacer..."
                                            value={newAssignment.description}
                                            onChange={(e) => setNewAssignment({ ...newAssignment, description: e.target.value })}
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1">Tipo de Actividad</label>
                                            <select
                                                className="w-full mt-2 px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-purple/50 outline-none dark:text-white"
                                                value={newAssignment.assignment_type}
                                                onChange={(e) => setNewAssignment({ ...newAssignment, assignment_type: e.target.value as any })}
                                            >
                                                <option value="HOMEWORK">Tarea</option>
                                                <option value="EXAM">Examen</option>
                                                <option value="LAB">Laboratorio</option>
                                                <option value="ACTIVITY">Actividad</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1">Fecha Límite</label>
                                            <input
                                                type="datetime-local"
                                                required
                                                className="w-full mt-2 px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-purple/50 outline-none transition-all dark:text-white"
                                                value={newAssignment.due_date}
                                                onChange={(e) => setNewAssignment({ ...newAssignment, due_date: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1">Peso (Multiplicador)</label>
                                            <input
                                                type="number"
                                                step="0.1"
                                                required
                                                className="w-full mt-2 px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-purple/50 outline-none dark:text-white"
                                                value={newAssignment.weight_points}
                                                onChange={(e) => setNewAssignment({ ...newAssignment, weight_points: Number(e.target.value) })}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1">Nota Máxima</label>
                                            <input
                                                type="number"
                                                required
                                                className="w-full mt-2 px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-purple/50 outline-none dark:text-white"
                                                value={newAssignment.max_score}
                                                onChange={(e) => setNewAssignment({ ...newAssignment, max_score: Number(e.target.value) })}
                                            />
                                        </div>
                                    </div>

                                    <div className="flex space-x-4 pt-4">
                                        <button
                                            type="button"
                                            onClick={() => setIsModalOpen(false)}
                                            className="flex-1 px-6 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={createMutation.isPending}
                                            className="flex-1 px-6 py-3 bg-brand-purple text-white font-bold rounded-xl hover:bg-purple-700 shadow-lg shadow-purple-500/20 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center space-x-2"
                                        >
                                            {createMutation.isPending ? (
                                                <Loader2 className="h-5 w-5 animate-spin" />
                                            ) : (
                                                <span>Guardar Tarea</span>
                                            )}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Review / Grading Modal */}
            {
                reviewAssignment && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setReviewAssignment(null)} />

                        <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-5xl shadow-2xl relative z-10 overflow-hidden animate-in zoom-in-95 duration-300 border border-slate-200 dark:border-slate-800 flex flex-col h-[85vh]">
                            {/* Header */}
                            <div className="bg-slate-50 dark:bg-slate-800 p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-start shrink-0">
                                <div>
                                    <h3 className="text-2xl font-bold text-slate-900 dark:text-white">{reviewAssignment.title}</h3>
                                    <p className="text-slate-500 dark:text-slate-400 mt-1 flex items-center">
                                        <Calendar className="h-4 w-4 mr-1" />
                                        Vence: {formatDate(reviewAssignment.due_date)} &bull; Max Score: {reviewAssignment.max_score} pts
                                    </p>
                                </div>
                                <div className="flex space-x-2">
                                    <button
                                        onClick={() => setFilterStatus('ALL')}
                                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filterStatus === 'ALL' ? 'bg-brand-blue text-white' : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600'}`}
                                    >
                                        Todos
                                    </button>
                                    <button
                                        onClick={() => setFilterStatus('SUBMITTED')}
                                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filterStatus === 'SUBMITTED' ? 'bg-brand-purple text-white' : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600'}`}
                                    >
                                        Entregados
                                    </button>
                                    <button
                                        onClick={() => setFilterStatus('PENDING')}
                                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filterStatus === 'PENDING' ? 'bg-brand-danger text-white' : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600'}`}
                                    >
                                        Faltantes
                                    </button>
                                    <button
                                        onClick={() => setFilterStatus('GRADED')}
                                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filterStatus === 'GRADED' ? 'bg-brand-success text-white' : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600'}`}
                                    >
                                        Calificados
                                    </button>
                                    <button
                                        onClick={() => setReviewAssignment(null)}
                                        className="px-3 py-1.5 bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-500 transition ml-4 font-bold"
                                    >
                                        Cerrar
                                    </button>
                                </div>
                            </div>

                            {/* Submissions List */}
                            <div className="flex-1 overflow-y-auto p-6 bg-white dark:bg-slate-900">
                                {isLoadingSubmissions ? (
                                    <div className="flex flex-col items-center justify-center h-full space-y-4">
                                        <Loader2 className="animate-spin h-10 w-10 text-brand-purple/50" />
                                        <p className="text-slate-500">Cargando entregas...</p>
                                    </div>
                                ) : filteredSubmissions.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-full space-y-4">
                                        <ClipboardList className="h-12 w-12 text-slate-300 dark:text-slate-600" />
                                        <p className="text-slate-500 dark:text-slate-400">No hay estudiantes en esta categoría.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {filteredSubmissions.map((sub) => (
                                            <div key={sub.student_id} className="p-5 border border-slate-200 dark:border-slate-700 rounded-2xl flex flex-col lg:flex-row gap-6 items-start lg:items-center bg-slate-50/50 dark:bg-slate-800/30">

                                                {/* Student Info */}
                                                <div className="w-full lg:w-1/3">
                                                    <h4 className="font-bold text-slate-900 dark:text-white text-lg">{sub.student_name}</h4>
                                                    <div className="flex items-center mt-2 space-x-2">
                                                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider 
                                                        ${sub.status === 'GRADED' ? 'bg-brand-success/20 text-brand-success' :
                                                                sub.status === 'SUBMITTED' ? 'bg-brand-purple/20 text-brand-purple' :
                                                                    'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400'}`}>
                                                            {sub.status === 'GRADED' ? 'Calificado' : sub.status === 'SUBMITTED' ? 'Entregado' : 'Pendiente'}
                                                        </span>
                                                        {sub.submission_date && (
                                                            <span className="text-xs text-slate-500">
                                                                el {new Date(sub.submission_date).toLocaleDateString()}
                                                            </span>
                                                        )}
                                                    </div>
                                                    
                                                    {/* File Proof Section */}
                                                    <div className="mt-4">
                                                        {sub.attachment_url ? (
                                                            <div className="flex flex-col space-y-2">
                                                                <div className="flex items-center text-xs text-brand-success font-bold uppercase tracking-tighter">
                                                                    <CheckCircle2 className="w-3 h-3 mr-1" />
                                                                    El alumno subió un archivo
                                                                </div>
                                                                <a 
                                                                    href={`http://localhost:3000${sub.attachment_url}`} 
                                                                    target="_blank" 
                                                                    rel="noopener noreferrer" 
                                                                    className="flex items-center text-sm text-white bg-brand-blue hover:bg-blue-600 transition-all w-max px-4 py-2 rounded-xl font-bold shadow-lg shadow-blue-500/20 active:scale-95"
                                                                >
                                                                    <Paperclip className="h-4 w-4 mr-2" />
                                                                    Visualizar Tarea / Comprobante
                                                                </a>
                                                            </div>
                                                        ) : sub.status !== 'PENDING' ? (
                                                            <div className="flex items-center text-xs text-amber-600 font-bold uppercase tracking-tighter bg-amber-50 dark:bg-amber-900/20 px-3 py-2 rounded-lg border border-amber-200 dark:border-amber-800 w-max">
                                                                <AlertCircle className="w-3 h-3 mr-1" />
                                                                Entregado manual (Sin archivo adjunto)
                                                            </div>
                                                        ) : null}
                                                    </div>
                                                </div>

                                                {/* Grading Form */}
                                                {(sub.status === 'SUBMITTED' || sub.status === 'GRADED') ? (
                                                    <form onSubmit={(e) => handleGradeSubmit(sub.submission_id!, e)} className="w-full lg:w-2/3 flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                                                        <div className="flex flex-col w-full sm:w-1/4">
                                                            <label className="text-xs font-semibold text-slate-500 mb-1">Nota (/{reviewAssignment.max_score})</label>
                                                            <input
                                                                type="number"
                                                                name="score"
                                                                step="0.1"
                                                                max={reviewAssignment.max_score}
                                                                required
                                                                defaultValue={sub.score || ''}
                                                                className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg outline-none focus:ring-2 focus:ring-brand-purple dark:text-white"
                                                            />
                                                        </div>
                                                        <div className="flex flex-col w-full sm:w-2/4">
                                                            <label className="text-xs font-semibold text-slate-500 mb-1">Comentario / Feedback</label>
                                                            <input
                                                                type="text"
                                                                name="feedback"
                                                                defaultValue={sub.feedback || ''}
                                                                placeholder="Buen trabajo..."
                                                                className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg outline-none focus:ring-2 focus:ring-brand-purple dark:text-white"
                                                            />
                                                        </div>
                                                        <div className="w-full sm:w-1/4 flex justify-end mt-4 sm:mt-5">
                                                            <button
                                                                type="submit"
                                                                disabled={gradeMutation.isPending}
                                                                className="w-full px-4 py-2 bg-brand-success text-white font-bold rounded-lg hover:bg-green-600 transition disabled:opacity-50"
                                                            >
                                                                {sub.status === 'GRADED' ? 'Actualizar' : 'Calificar'}
                                                            </button>
                                                        </div>
                                                    </form>
                                                ) : (
                                                    <div className="w-full lg:w-2/3 flex items-center justify-start text-sm text-slate-500 italic">
                                                        El alumno aún no ha marcado esta tarea como entregada en su portal.
                                                    </div>
                                                )}

                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )
            }

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
