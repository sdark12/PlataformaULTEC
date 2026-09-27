import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { assignmentsService } from '../../../services/assignmentsService';
import type { StudentAssignment } from '../../../services/assignmentsService';
import { Loader2, Clock, CheckCircle2, AlertCircle, Send, Paperclip, X, FileText, Sparkles } from 'lucide-react';
import ConfirmModal from '../../../components/ui/ConfirmModal';

// A simple hook to calculate time left
const useTimeLeft = (targetDate: string) => {
    const [timeLeft, setTimeLeft] = useState('');
    const [isUrgent, setIsUrgent] = useState(false);
    const [isOverdue, setIsOverdue] = useState(false);

    useEffect(() => {
        const calculate = () => {
            const now = new Date().getTime();
            const target = new Date(targetDate).getTime();
            const difference = target - now;

            if (difference < 0) {
                setTimeLeft('Vencido');
                setIsOverdue(true);
                setIsUrgent(false);
                return;
            }

            const days = Math.floor(difference / (1000 * 60 * 60 * 24));
            const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));

            setIsUrgent(days <= 1); // Mark urgent if 1 day or less

            if (days > 0) {
                setTimeLeft(`${days}d ${hours}h restantes`);
            } else if (hours > 0) {
                setTimeLeft(`${hours}h ${minutes}m restantes`);
            } else {
                setTimeLeft(`${minutes}m restantes`);
            }
        };

        calculate();
        const timer = setInterval(calculate, 60000); // Update every minute
        return () => clearInterval(timer);
    }, [targetDate]);

    return { timeLeft, isUrgent, isOverdue };
};

const AssignmentCard = ({ assignment, onOpenSubmitModal }: { assignment: StudentAssignment, onOpenSubmitModal: (assignment: StudentAssignment) => void }) => {
    const { timeLeft, isUrgent, isOverdue } = useTimeLeft(assignment.due_date);
    const isSubmitted = assignment.status === 'SUBMITTED' || assignment.status === 'GRADED';
    const isGraded = assignment.status === 'GRADED';

    return (
        <div className={`group relative bg-white dark:bg-[#1c1f2a] rounded-3xl p-5 sm:p-6 border transition-all duration-300 flex flex-col justify-between overflow-hidden shadow-sm hover:shadow-md
            ${isSubmitted 
                ? 'border-emerald-500/30 dark:border-emerald-500/20' 
                : isOverdue 
                    ? 'border-rose-500/30 dark:border-rose-500/20 bg-rose-500/[0.02]' 
                    : isUrgent 
                        ? 'border-amber-500/40 dark:border-amber-500/30 bg-amber-500/[0.02]' 
                        : 'border-slate-200/80 dark:border-white/10'}`}
        >
            {/* Top glowing accent bar for urgent / active cards */}
            <div className={`absolute top-0 left-0 right-0 h-1.5 ${
                isSubmitted 
                    ? 'bg-gradient-to-r from-emerald-400 to-teal-500' 
                    : isOverdue 
                        ? 'bg-gradient-to-r from-rose-500 to-red-600' 
                        : isUrgent 
                            ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500' 
                            : 'bg-gradient-to-r from-brand-blue to-indigo-500'
            }`} />

            <div>
                {/* Header row: Course, Unit & Status */}
                <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[11px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-brand-blue/10 dark:bg-brand-blue/20 text-brand-blue truncate max-w-[150px]">
                            {assignment.course_name}
                        </span>
                        {assignment.unit_name && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                                {assignment.unit_name}
                            </span>
                        )}
                        {Number(assignment.merit_points) > 0 && (
                            <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                <Sparkles className="w-3 h-3 text-amber-500" />
                                +{assignment.merit_points} mérito
                            </span>
                        )}
                    </div>

                    {isGraded ? (
                        <span className="flex items-center text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 className="w-3 h-3 mr-1 shrink-0" />
                            Calificado
                        </span>
                    ) : isSubmitted ? (
                        <span className="flex items-center text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20">
                            <CheckCircle2 className="w-3 h-3 mr-1 shrink-0" />
                            Entregado
                        </span>
                    ) : isOverdue ? (
                        <span className="flex items-center text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                            <AlertCircle className="w-3 h-3 mr-1 shrink-0" />
                            Expirada
                        </span>
                    ) : isUrgent ? (
                        <span className="flex items-center text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 animate-pulse">
                            <Clock className="w-3 h-3 mr-1 shrink-0" />
                            Urgente
                        </span>
                    ) : (
                        <span className="text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                            {assignment.assignment_type || 'Tarea'}
                        </span>
                    )}
                </div>

                {/* Title and Description */}
                <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-snug group-hover:text-brand-blue transition-colors">
                    {assignment.title}
                </h3>
                <p className="text-slate-500 dark:text-slate-400 mt-2 text-xs sm:text-sm leading-relaxed line-clamp-3">
                    {assignment.description || 'Sin instrucciones adicionales provistas para esta asignación.'}
                </p>

                {/* Graded feedback & earned merits */}
                {isGraded && (
                    <div className="mt-3 space-y-2">
                        {Number(assignment.merit_points_awarded) > 0 && (
                            <div className="p-2.5 bg-gradient-to-r from-amber-500/15 to-yellow-500/15 border border-amber-500/30 rounded-2xl flex items-center justify-between">
                                <span className="flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400">
                                    <Sparkles className="w-4 h-4 text-amber-500 animate-bounce" />
                                    ¡Puntos de Mérito Ganados!
                                </span>
                                <span className="text-xs font-black text-amber-600 dark:text-amber-400 bg-amber-500/20 px-2 py-0.5 rounded-full">
                                    +{assignment.merit_points_awarded} pts
                                </span>
                            </div>
                        )}
                        {assignment.feedback && (
                            <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700/60">
                                <p className="text-[10px] font-black uppercase text-brand-purple tracking-widest mb-1 flex items-center gap-1">
                                    <span>💬</span> Comentario del Docente:
                                </p>
                                <p className="text-xs italic text-slate-600 dark:text-slate-300">"{assignment.feedback}"</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Bottom Meta & Action Area */}
            <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800/80 space-y-3.5">
                {/* Time left and Points badge */}
                <div className="flex items-center justify-between text-xs">
                    <div className={`flex items-center gap-1.5 font-semibold ${
                        isSubmitted ? 'text-teal-600 dark:text-teal-400' :
                        isOverdue ? 'text-rose-500' :
                        isUrgent ? 'text-amber-500' : 'text-slate-500 dark:text-slate-400'
                    }`}>
                        <Clock className="w-3.5 h-3.5" />
                        <span>{isSubmitted ? 'Entregado a tiempo' : isOverdue ? 'Plazo Vencido' : timeLeft}</span>
                    </div>

                    <div className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs text-right">
                        {isGraded ? (
                            <div>
                                <span className="text-emerald-500 font-black">{assignment.score} <span className="text-slate-400 font-normal">/ {assignment.max_score} pts</span></span>
                                {Number(assignment.merit_points_awarded) > 0 && (
                                    <div className="text-[10px] text-amber-500 font-bold flex items-center justify-end gap-1 mt-0.5">
                                        <Sparkles className="w-2.5 h-2.5" />
                                        +{assignment.merit_points_awarded} mérito
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div>
                                <span>{assignment.max_score} pts</span>
                                {Number(assignment.merit_points) > 0 && (
                                    <div className="text-[10px] text-amber-500 font-bold flex items-center justify-end gap-1 mt-0.5">
                                        <Sparkles className="w-2.5 h-2.5" />
                                        +{assignment.merit_points} mérito
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Action button */}
                {!isSubmitted ? (
                    <button
                        onClick={() => onOpenSubmitModal(assignment)}
                        disabled={isOverdue}
                        className={`w-full py-3 px-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] ${
                            isOverdue 
                                ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20 cursor-not-allowed opacity-80' 
                                : 'bg-gradient-to-r from-brand-blue to-blue-600 hover:from-blue-600 hover:to-brand-blue text-white shadow-md shadow-brand-blue/25'
                        }`}
                    >
                        {isOverdue ? (
                            <>
                                <Clock className="w-4 h-4 text-rose-500" />
                                <span>Plazo Cerrado</span>
                            </>
                        ) : (
                            <>
                                <Send className="w-4 h-4" />
                                <span>Entregar Tarea</span>
                            </>
                        )}
                    </button>
                ) : assignment.attachment_url ? (
                    <a
                        href={`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}${assignment.attachment_url}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full py-3 px-4 rounded-2xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 text-brand-blue bg-brand-blue/10 hover:bg-brand-blue/20 dark:bg-brand-blue/20 dark:hover:bg-brand-blue/30 transition-all border border-brand-blue/20"
                    >
                        <Paperclip className="w-4 h-4" />
                        <span>Ver Evidencia Entregada</span>
                    </a>
                ) : (
                    <div className="w-full py-3 px-4 rounded-2xl text-xs font-semibold flex items-center justify-center gap-2 text-slate-400 bg-slate-100 dark:bg-slate-800/80 italic border border-slate-200 dark:border-slate-700/50">
                        <CheckCircle2 className="w-4 h-4 text-teal-500" />
                        <span>Entregado sin archivo</span>
                    </div>
                )}
            </div>
        </div>
    );
};

const StudentAssignments = () => {
    const queryClient = useQueryClient();
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const studentId = 'me';

    const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
    const [selectedAssignment, setSelectedAssignment] = useState<StudentAssignment | null>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [showNoFileConfirm, setShowNoFileConfirm] = useState(false);

    const [activeTab, setActiveTab] = useState<'pending' | 'submitted' | 'overdue' | 'all'>('pending');
    const [selectedCourse, setSelectedCourse] = useState<string>('ALL');
    const [selectedUnit, setSelectedUnit] = useState<string>('ALL');
    const [searchQuery, setSearchQuery] = useState<string>('');

    const { data: assignments, isLoading, error } = useQuery({
        queryKey: ['studentAssignments', studentId],
        queryFn: () => assignmentsService.getStudentAssignments(studentId),
        enabled: user.role === 'student' || user.role === 'admin'
    });

    const submitMutation = useMutation({
        mutationFn: async ({ assignmentId, file }: { assignmentId: string, file: File | null }) => {
            let attachment_url;
            if (file) {
                attachment_url = await assignmentsService.uploadAssignmentFile(file);
            }
            return assignmentsService.submitAssignment(assignmentId, studentId, attachment_url);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['studentAssignments', studentId] });
            closeSubmitModal();
        }
    });

    const openSubmitModal = (assignment: StudentAssignment) => {
        setSelectedAssignment(assignment);
        setIsSubmitModalOpen(true);
    };

    const closeSubmitModal = () => {
        setIsSubmitModalOpen(false);
        setSelectedAssignment(null);
        setSelectedFile(null);
        setIsUploading(false);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            // Enforce size limit 10MB approx
            if (file.size > 10 * 1024 * 1024) {
                alert('El archivo excede el tamaño máximo permitido (10MB).');
                return;
            }
            setSelectedFile(file);
        }
    };

    const executeSubmission = async () => {
        if (!selectedAssignment) return;
        setIsUploading(true);
        try {
            await submitMutation.mutateAsync({ assignmentId: selectedAssignment.assignment_id, file: selectedFile });
        } catch (error) {
            console.error('Error in submission:', error);
            alert('Hubo un error al entregar la tarea.');
        } finally {
            setIsUploading(false);
        }
    };

    const confirmSubmission = async () => {
        if (!selectedAssignment) return;

        // If no file, ask for confirmation to be explicit
        if (!selectedFile) {
            setShowNoFileConfirm(true);
            return;
        }

        executeSubmission();
    };

    if (user.role !== 'student') {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center max-w-2xl mx-auto space-y-6">
                <div className="h-24 w-24 bg-brand-blue/10 rounded-full flex items-center justify-center text-brand-blue mb-4">
                    <AlertCircle className="w-12 h-12" />
                </div>
                <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Vista de Estudiante</h2>
                <div className="glass-card p-8 border border-slate-200 dark:border-white/10 rounded-3xl backdrop-blur-md bg-white/50 dark:bg-slate-900/50 hover:shadow-xl transition-all shadow-lg">
                    <p className="text-lg text-slate-600 dark:text-slate-300 leading-relaxed">
                        Hola <strong>Administrador</strong>. Te encuentras en el módulo <strong>"Mis Tareas"</strong>. <br /><br />
                        Esta área es un tablero personal diseñado <strong>exclusivamente para los estudiantes</strong>, donde cada uno puede ver sus propios trabajos pendientes y realizar entregas.
                    </p>
                    <div className="mt-8">
                        <p className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-4">¿Qué deseas hacer?</p>
                        <a href="/assignments" className="inline-block px-8 py-4 bg-brand-blue text-white font-bold rounded-2xl shadow-[0_4px_20px_rgba(13,89,242,0.3)] hover:bg-blue-600 hover:-translate-y-1 transition-all">
                            Ir a la Gestión General de Tareas
                        </a>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        const axError = error as any;
        const serverMessage = axError?.response?.data?.message;
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] text-center max-w-lg mx-auto space-y-4 animate-in fade-in duration-500">
                <div className="w-20 h-20 bg-brand-danger/10 rounded-full flex items-center justify-center text-brand-danger mb-4 shadow-sm">
                    <AlertCircle className="w-10 h-10" />
                </div>
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white">
                    {serverMessage === 'Perfil de estudiante no encontrado' ? 'Perfil No Vinculado' : 'Error de Conexión'}
                </h3>
                <p className="text-slate-500 dark:text-slate-400 text-base leading-relaxed">
                    {serverMessage === 'Perfil de estudiante no encontrado'
                        ? 'Tu cuenta aún no ha sido enlazada a un perfil académico oficial. Por favor, comunícate con la administración de la academia para que te habiliten el acceso a tus tareas.'
                        : 'No se pudo cargar la información en este momento. Inténtalo de nuevo más tarde.'}
                </p>
                {serverMessage !== 'Perfil de estudiante no encontrado' && (
                    <p className="text-xs font-mono text-slate-400 mt-4 bg-slate-100 dark:bg-slate-800 p-2 rounded w-full overflow-hidden text-ellipsis">
                        Detalle: {axError.message || 'Desconocido'}
                    </p>
                )}
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
                <Loader2 className="animate-spin h-12 w-12 text-brand-blue/50" />
                <p className="text-slate-400 font-medium animate-pulse">Cargando tus tareas...</p>
            </div>
        );
    }

    const now = Date.now();
    const allList = assignments || [];

    const activePendingTasks = allList.filter(a =>
        a.status !== 'SUBMITTED' && a.status !== 'GRADED' && (!a.due_date || new Date(a.due_date).getTime() >= now)
    );

    const expiredTasks = allList.filter(a =>
        a.status !== 'SUBMITTED' && a.status !== 'GRADED' && a.due_date && new Date(a.due_date).getTime() < now
    );

    const completedTasks = allList.filter(a =>
        a.status === 'SUBMITTED' || a.status === 'GRADED'
    );

    // Calculate graded average or points
    const gradedAssignments = allList.filter(a => a.status === 'GRADED' && typeof a.score === 'number');
    const averageScore = gradedAssignments.length > 0
        ? (gradedAssignments.reduce((acc, curr) => acc + (curr.score || 0), 0) / gradedAssignments.length).toFixed(1)
        : null;

    // Unique courses for filter chips
    const courses = ['ALL', ...Array.from(new Set(allList.map(a => a.course_name).filter(Boolean)))];

    // Filter displayed list based on activeTab, selectedCourse, and searchQuery
    const displayedAssignments = allList.filter(a => {
        // Tab filter
        const isCompleted = a.status === 'SUBMITTED' || a.status === 'GRADED';
        const isExpired = !isCompleted && a.due_date && new Date(a.due_date).getTime() < now;
        const isPending = !isCompleted && !isExpired;

        if (activeTab === 'pending' && !isPending) return false;
        if (activeTab === 'submitted' && !isCompleted) return false;
        if (activeTab === 'overdue' && !isExpired) return false;

        // Course filter
        if (selectedCourse !== 'ALL' && a.course_name !== selectedCourse) return false;

        // Unit / Bimestre filter
        if (selectedUnit !== 'ALL' && (a.unit_name || 'Bimestre 1') !== selectedUnit) return false;

        // Search query
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            const matchTitle = a.title?.toLowerCase().includes(q);
            const matchDesc = a.description?.toLowerCase().includes(q);
            const matchCourse = a.course_name?.toLowerCase().includes(q);
            if (!matchTitle && !matchDesc && !matchCourse) return false;
        }

        return true;
    });

    return (
        <div className="space-y-6 pb-36 sm:pb-16 animate-in fade-in duration-500">
            {/* Top Header & Context */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">Mis Tareas</h2>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">Control de asignaciones, entregas de proyectos y calificaciones.</p>
                </div>

                {/* Quick 3-metric Stitch pill cards */}
                <div className="grid grid-cols-3 gap-1.5 sm:gap-2.5 sm:flex sm:items-center bg-white dark:bg-[#1c1f2a] p-1.5 sm:p-2 rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-sm overflow-hidden">
                    <div className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 px-1.5 sm:px-3 py-1.5 rounded-xl bg-amber-500/10 dark:bg-amber-500/15 min-w-0">
                        <span className="relative flex h-2 w-2 sm:h-2.5 sm:w-2.5 shrink-0">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 sm:h-2.5 sm:w-2.5 bg-amber-500"></span>
                        </span>
                        <div className="text-center sm:text-left min-w-0">
                            <span className="text-xs sm:text-base font-black text-amber-600 dark:text-amber-400">{activePendingTasks.length}</span>
                            <span className="block text-[8px] sm:text-[9px] font-black uppercase text-amber-700/70 dark:text-amber-300 tracking-wider truncate">Pendientes</span>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 px-1.5 sm:px-3 py-1.5 rounded-xl bg-teal-500/10 dark:bg-teal-500/15 min-w-0">
                        <CheckCircle2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
                        <div className="text-center sm:text-left min-w-0">
                            <span className="text-xs sm:text-base font-black text-teal-600 dark:text-teal-400">{completedTasks.length}</span>
                            <span className="block text-[8px] sm:text-[9px] font-black uppercase text-teal-700/70 dark:text-teal-300 tracking-wider truncate">Entregadas</span>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 px-1.5 sm:px-3 py-1.5 rounded-xl bg-brand-blue/10 dark:bg-brand-blue/15 min-w-0">
                        <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-brand-blue shrink-0" />
                        <div className="text-center sm:text-left min-w-0">
                            <span className="text-xs sm:text-base font-black text-brand-blue">{averageScore ? `${averageScore}` : `${expiredTasks.length}`}</span>
                            <span className="block text-[8px] sm:text-[9px] font-black uppercase text-blue-700/70 dark:text-blue-300 tracking-wider truncate">{averageScore ? 'Promedio' : 'Expiradas'}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Segmented Filter Bar from Stitch */}
            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-[#161922] p-1.5 rounded-2xl border border-slate-200/80 dark:border-white/5 overflow-x-auto no-scrollbar">
                <button
                    onClick={() => setActiveTab('pending')}
                    className={`flex-shrink-0 sm:flex-1 py-2 px-3 sm:px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 whitespace-nowrap transition-all ${
                        activeTab === 'pending'
                            ? 'bg-white dark:bg-[#252a3a] text-slate-900 dark:text-white shadow-sm'
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                >
                    <span>Pendientes</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${
                        activeTab === 'pending' ? 'bg-amber-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                    }`}>
                        {activePendingTasks.length}
                    </span>
                </button>

                <button
                    onClick={() => setActiveTab('submitted')}
                    className={`flex-shrink-0 sm:flex-1 py-2 px-3 sm:px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 whitespace-nowrap transition-all ${
                        activeTab === 'submitted'
                            ? 'bg-white dark:bg-[#252a3a] text-slate-900 dark:text-white shadow-sm'
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                >
                    <span>Entregadas</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${
                        activeTab === 'submitted' ? 'bg-teal-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                    }`}>
                        {completedTasks.length}
                    </span>
                </button>

                <button
                    onClick={() => setActiveTab('overdue')}
                    className={`flex-shrink-0 sm:flex-1 py-2 px-3 sm:px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 whitespace-nowrap transition-all ${
                        activeTab === 'overdue'
                            ? 'bg-white dark:bg-[#252a3a] text-slate-900 dark:text-white shadow-sm'
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                >
                    <span>Expiradas</span>
                    {expiredTasks.length > 0 && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${
                            activeTab === 'overdue' ? 'bg-rose-500 text-white' : 'bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400'
                        }`}>
                            {expiredTasks.length}
                        </span>
                    )}
                </button>

                <button
                    onClick={() => setActiveTab('all')}
                    className={`flex-shrink-0 sm:flex-1 py-2 px-3 sm:px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 whitespace-nowrap transition-all ${
                        activeTab === 'all'
                            ? 'bg-white dark:bg-[#252a3a] text-slate-900 dark:text-white shadow-sm'
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                >
                    <span>Todas</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-black">
                        {allList.length}
                    </span>
                </button>
            </div>

            {/* Search and Course Pills */}
            <div className="space-y-3">
                <div className="relative">
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Buscar por título, instrucciones o materia..."
                        className="w-full pl-4 pr-10 py-3 bg-white dark:bg-[#1c1f2a] rounded-2xl border border-slate-200 dark:border-white/10 text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/30 transition-all shadow-sm"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>

                {/* Horizontal Course Filter Chips */}
                {courses.length > 2 && (
                    <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                        {courses.map((course) => {
                            const isSelected = selectedCourse === course;
                            return (
                                <button
                                    key={course}
                                    onClick={() => setSelectedCourse(course)}
                                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                                        isSelected
                                            ? 'bg-brand-blue text-white shadow-sm shadow-blue-500/25'
                                            : 'bg-white dark:bg-[#1c1f2a] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-white/10 hover:border-brand-blue/40'
                                    }`}
                                >
                                    {course === 'ALL' ? 'Todos los Cursos' : course}
                                </button>
                            );
                        })}
                    </div>
                )}

                {/* Horizontal Unit / Bimestre Filter Chips */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                    {['ALL', 'Bimestre 1', 'Bimestre 2', 'Bimestre 3', 'Bimestre 4'].map((unit) => {
                        const isSelected = selectedUnit === unit;
                        return (
                            <button
                                key={unit}
                                onClick={() => setSelectedUnit(unit)}
                                className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                                    isSelected
                                        ? 'bg-purple-600 text-white shadow-sm shadow-purple-500/25'
                                        : 'bg-white dark:bg-[#1c1f2a] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-white/10 hover:border-purple-500/40'
                                }`}
                            >
                                {unit === 'ALL' ? 'Todos los Bimestres' : unit}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Cards Grid */}
            {displayedAssignments.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
                    {displayedAssignments.map(assignment => (
                        <AssignmentCard
                            key={assignment.assignment_id}
                            assignment={assignment}
                            onOpenSubmitModal={openSubmitModal}
                        />
                    ))}
                </div>
            ) : (
                <div className="bg-white/60 dark:bg-[#1c1f2a]/60 border border-dashed border-slate-300 dark:border-white/10 rounded-3xl py-16 px-6 text-center flex flex-col items-center justify-center space-y-3 backdrop-blur-sm">
                    <div className="h-16 w-16 bg-brand-blue/10 dark:bg-brand-blue/20 rounded-full flex items-center justify-center text-brand-blue">
                        <CheckCircle2 className="h-8 w-8" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                        {searchQuery ? 'Sin resultados para la búsqueda' : 'No hay tareas en esta sección'}
                    </h3>
                    <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm max-w-sm">
                        {searchQuery
                            ? 'Prueba con otro término de búsqueda o selecciona "Todos los Cursos".'
                            : activeTab === 'pending'
                                ? '¡Excelente trabajo! No tienes entregas pendientes por el momento.'
                                : 'No se encontraron asignaciones que coincidan con los filtros seleccionados.'}
                    </p>
                </div>
            )}

            {/* Submit Modal */}
            {isSubmitModalOpen && selectedAssignment && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={!isUploading ? closeSubmitModal : undefined} />

                    <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-lg shadow-2xl relative z-10 overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="flex justify-between items-start p-6 border-b border-slate-100 dark:border-slate-800">
                            <div>
                                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Entregar Actividad</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{selectedAssignment.title}</p>
                            </div>
                            <button
                                onClick={closeSubmitModal}
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
                                disabled={isUploading}
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 p-4 rounded-xl text-sm border border-blue-100 dark:border-blue-900/50">
                                <strong>Nota:</strong> Al presionar confirmar, esta tarea quedará marcada como "Entregada" de forma oficial, registrando la fecha y hora exactas actuales.
                            </div>

                            {Number(selectedAssignment.merit_points) > 0 && (
                                <div className="bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 p-3.5 rounded-xl text-xs font-bold flex items-center gap-2.5">
                                    <Sparkles className="w-5 h-5 shrink-0 text-amber-500" />
                                    <span>¡Esta tarea otorga hasta <strong>+{selectedAssignment.merit_points} puntos de mérito</strong> para la tienda escolar al obtener 60% o más de punteo!</span>
                                </div>
                            )}

                            <div className="space-y-3">
                                <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Evidencia Adjunta (Opcional)</label>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Sube un PDF, imagen o documento de captura de tu evidencia.</p>

                                <div className="relative border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-6 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-center group">
                                    <input
                                        type="file"
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                        accept="image/*,.pdf,.doc,.docx"
                                        onChange={handleFileChange}
                                        disabled={isUploading}
                                    />

                                    <div className="pointer-events-none flex flex-col items-center justify-center space-y-2">
                                        <div className={`h-12 w-12 rounded-full flex items-center justify-center transition-colors ${selectedFile ? 'bg-brand-success/10 text-brand-success' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 group-hover:text-brand-blue group-hover:bg-brand-blue/10'}`}>
                                            {selectedFile ? <FileText className="h-6 w-6" /> : <Paperclip className="h-6 w-6" />}
                                        </div>
                                        {selectedFile ? (
                                            <div>
                                                <p className="text-sm font-bold text-brand-success">{selectedFile.name}</p>
                                                <p className="text-xs text-slate-500">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                                            </div>
                                        ) : (
                                            <div>
                                                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Haz clic o arrastra un archivo aquí</p>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">PDF, JPG, PNG, DOC (Max: 10MB)</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex space-x-4 bg-slate-50/50 dark:bg-slate-800/20">
                            <button
                                onClick={closeSubmitModal}
                                disabled={isUploading}
                                className="flex-1 px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={confirmSubmission}
                                disabled={isUploading}
                                className="flex-[2] px-4 py-3 bg-brand-blue text-white rounded-xl font-bold flex items-center justify-center space-x-2 shadow-lg shadow-blue-500/20 hover:bg-blue-600 transition-all active:scale-95 disabled:opacity-70"
                            >
                                {isUploading ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        <span>Subiendo...</span>
                                    </>
                                ) : (
                                    <>
                                        <Send className="w-5 h-5" />
                                        <span>Confirmar Entrega</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <ConfirmModal
                isOpen={showNoFileConfirm}
                title="¿Entregar sin comprobante?"
                message="No has seleccionado ningún archivo de evidencia. ¿Estás seguro de que deseas marcar esta tarea como entregada sin adjuntar un comprobante?"
                confirmText="Sí, Entregar"
                cancelText="Cancelar"
                variant="warning"
                isLoading={isUploading}
                onConfirm={() => {
                    setShowNoFileConfirm(false);
                    executeSubmission();
                }}
                onCancel={() => setShowNoFileConfirm(false)}
            />
        </div>
    );
};

export default StudentAssignments;
