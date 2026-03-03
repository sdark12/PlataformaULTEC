import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { assignmentsService } from '../../../services/assignmentsService';
import type { StudentAssignment } from '../../../services/assignmentsService';
import { Loader2, Clock, CheckCircle2, AlertCircle, Send, Paperclip, X, FileText } from 'lucide-react';

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

    return (
        <div className={`group glass-card p-6 border transition-all duration-300 relative overflow-hidden flex flex-col h-full
            ${isSubmitted ? 'border-brand-success/30 bg-brand-success/5' :
                isOverdue ? 'border-brand-danger/30 bg-brand-danger/5' :
                    isUrgent ? 'border-amber-500/30 bg-amber-500/5' : 'border-slate-200 dark:border-white/10'}`}
        >
            {/* Status Badge */}
            <div className="absolute top-0 right-0 p-4">
                {isSubmitted ? (
                    <span className="flex items-center text-[10px] px-2 py-1 bg-brand-success/20 text-brand-success rounded-full font-bold uppercase tracking-wider">
                        <CheckCircle2 className="w-3 h-3 mr-1" /> Entregado
                    </span>
                ) : (
                    <span className={`text-[10px] px-2 py-1 rounded-full font-bold uppercase tracking-wider
                        ${isOverdue ? 'bg-brand-danger/20 text-brand-danger' :
                            isUrgent ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400' : 'bg-brand-blue/20 text-brand-blue'}`}>
                        {assignment.assignment_type}
                    </span>
                )}
            </div>

            <div className="flex-1">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mt-2 lg:mt-0 pr-24">{assignment.title}</h3>
                <p className="text-sm font-semibold text-brand-purple mt-1">{assignment.course_name}</p>
                <p className="text-slate-500 dark:text-slate-400 mt-4 text-sm leading-relaxed whitespace-pre-line">
                    {assignment.description || 'Sin instrucciones adicionales.'}
                </p>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-700/50 space-y-4">
                {/* Time Left Indicator */}
                <div className="flex items-center justify-between">
                    <div className={`flex items-center text-sm font-medium ${isOverdue && !isSubmitted ? 'text-brand-danger' : isUrgent && !isSubmitted ? 'text-amber-500' : 'text-slate-600 dark:text-slate-300'}`}>
                        <Clock className="w-4 h-4 mr-2" />
                        <span>{isSubmitted ? 'Completado a tiempo' : timeLeft}</span>
                    </div>
                </div>

                {/* Effort / Weight Indicator */}
                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 mb-1 overflow-hidden">
                    <div
                        className="bg-brand-purple h-1.5 rounded-full shadow-[0_0_10px_rgba(139,92,246,0.5)]"
                        style={{ width: `${Math.min(100, (assignment.weight_points / 5) * 100)}%` }}
                    ></div>
                </div>
                <div className="flex justify-between text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    <span>Peso de Actividad</span>
                    <span>{assignment.weight_points}x • {assignment.max_score} pts</span>
                </div>

                {/* Action Button */}
                {!isSubmitted && (
                    <button
                        onClick={() => onOpenSubmitModal(assignment)}
                        className={`w-full mt-2 py-2.5 rounded-xl font-bold flex items-center justify-center space-x-2 transition-all active:scale-95
                            ${isOverdue ? 'bg-slate-200 text-slate-500 cursor-not-allowed dark:bg-slate-800' :
                                'bg-brand-blue hover:bg-blue-600 text-white shadow-lg shadow-blue-500/20'}`}
                        disabled={isOverdue}
                    >
                        <Send className="w-4 h-4" />
                        <span>Realizar Entrega</span>
                    </button>
                )}

                {isSubmitted && assignment.attachment_url && (
                    <a href={`http://localhost:3000${assignment.attachment_url}`} target="_blank" rel="noopener noreferrer" className="w-full mt-2 py-2 rounded-xl text-sm font-bold flex items-center justify-center space-x-2 text-brand-blue bg-brand-blue/10 hover:bg-brand-blue/20 transition-all">
                        <Paperclip className="w-4 h-4" />
                        <span>Ver Evidencia Adjunta</span>
                    </a>
                )}

                {assignment.status === 'GRADED' && (
                    <div className="bg-brand-success/10 border border-brand-success/20 rounded-xl p-3 flex justify-between items-center text-sm">
                        <span className="text-brand-success font-semibold">Calificación Obtenida:</span>
                        <span className="text-brand-success font-bold text-lg">{assignment.score} / {assignment.max_score}</span>
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

    const confirmSubmission = async () => {
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

    const pendingTasks = assignments?.filter(a => a.status !== 'SUBMITTED' && a.status !== 'GRADED') || [];
    const completedTasks = assignments?.filter(a => a.status === 'SUBMITTED' || a.status === 'GRADED') || [];

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Mis Tareas</h2>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">Revisa tus actividades pendientes y tiempo límite para entrega.</p>
                </div>

                <div className="bg-white dark:bg-slate-800 px-6 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 flex space-x-6 shadow-sm">
                    <div className="text-center">
                        <div className="text-2xl font-bold text-slate-900 dark:text-white">{pendingTasks.length}</div>
                        <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Pendientes</div>
                    </div>
                    <div className="w-px bg-slate-200 dark:bg-slate-700"></div>
                    <div className="text-center">
                        <div className="text-2xl font-bold text-brand-success">{completedTasks.length}</div>
                        <div className="text-[10px] text-brand-success/80 font-bold uppercase tracking-wider">Completadas</div>
                    </div>
                </div>
            </div>

            {pendingTasks.length > 0 && (
                <div className="space-y-4">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 flex items-center">
                        <AlertCircle className="w-5 h-5 mr-2 text-brand-blue" />
                        Próximas Entregas
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {pendingTasks.map(assignment => (
                            <AssignmentCard
                                key={assignment.assignment_id}
                                assignment={assignment}
                                onOpenSubmitModal={openSubmitModal}
                            />
                        ))}
                    </div>
                </div>
            )}

            {completedTasks.length > 0 && (
                <div className="space-y-4 pt-8 border-t border-slate-200 dark:border-slate-800">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 flex items-center opacity-80">
                        <CheckCircle2 className="w-5 h-5 mr-2 text-brand-success" />
                        Entregas Anteriores
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 opacity-75 grayscale-[20%] transition-all hover:grayscale-0 hover:opacity-100">
                        {completedTasks.map(assignment => (
                            <AssignmentCard
                                key={assignment.assignment_id}
                                assignment={assignment}
                                onOpenSubmitModal={() => { }} // Disabled
                            />
                        ))}
                    </div>
                </div>
            )}

            {assignments?.length === 0 && (
                <div className="bg-white/50 dark:bg-slate-800/50 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-3xl py-20 text-center flex flex-col items-center justify-center space-y-4 backdrop-blur-sm">
                    <div className="h-20 w-20 bg-brand-success/10 rounded-full flex items-center justify-center text-brand-success mb-2">
                        <CheckCircle2 className="h-10 w-10" />
                    </div>
                    <div className="max-w-sm">
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white">¡Todo al día!</h3>
                        <p className="text-slate-500 dark:text-slate-400 text-base mt-2">No tienes tareas pendientes en este momento. Tómate un descanso o adelanta el estudio de la próxima clase.</p>
                    </div>
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
        </div>
    );
};

export default StudentAssignments;
