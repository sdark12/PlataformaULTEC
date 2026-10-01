import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
    X, Phone, MessageSquare, Users, CheckCircle2, 
    AlertTriangle, ShieldCheck, Plus, Loader2, BookOpen
} from 'lucide-react';
import { 
    getStudentInterventions, 
    createStudentIntervention, 
    updateStudentIntervention 
} from './intelligenceService';
import type { StudentRiskProfile, InterventionType, InterventionStatus } from '../../types/intelligence';

interface InterventionModalProps {
    student: StudentRiskProfile | null;
    isOpen: boolean;
    onClose: () => void;
}

const TYPE_CONFIG: Record<InterventionType, { label: string; icon: any; color: string }> = {
    PHONE_CALL: { label: 'Llamada telefónica', icon: Phone, color: 'text-blue-500 bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800' },
    WHATSAPP: { label: 'Mensaje WhatsApp', icon: MessageSquare, color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800' },
    IN_PERSON_MEETING: { label: 'Cita presencial', icon: Users, color: 'text-purple-500 bg-purple-50 dark:bg-purple-900/30 border-purple-200 dark:border-purple-800' },
    PAYMENT_AGREEMENT: { label: 'Convenio de pago', icon: ShieldCheck, color: 'text-amber-500 bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800' },
    ACADEMIC_TUTORING: { label: 'Tutoría de refuerzo', icon: BookOpen, color: 'text-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-800' }
};

const STATUS_CONFIG: Record<InterventionStatus, { label: string; color: string }> = {
    OPEN: { label: 'Pendiente', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' },
    IN_PROGRESS: { label: 'En proceso', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300' },
    RESOLVED: { label: 'Resuelto / Cumplido', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' },
    DROPPED: { label: 'Baja confirmada', color: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300' }
};

export const InterventionModal = ({ student, isOpen, onClose }: InterventionModalProps) => {
    const queryClient = useQueryClient();
    const [showForm, setShowForm] = useState(false);

    // Form state
    const [interventionType, setInterventionType] = useState<InterventionType>('PHONE_CALL');
    const [notes, setNotes] = useState('');
    const [commitment, setCommitment] = useState('');
    const [followUpDate, setFollowUpDate] = useState('');
    const [status, setStatus] = useState<InterventionStatus>('OPEN');

    const { data: interventions, isLoading } = useQuery({
        queryKey: ['studentInterventions', student?.id],
        queryFn: () => (student?.id ? getStudentInterventions(student.id) : Promise.resolve([])),
        enabled: isOpen && !!student?.id
    });

    const createMutation = useMutation({
        mutationFn: createStudentIntervention,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['studentInterventions', student?.id] });
            queryClient.invalidateQueries({ queryKey: ['earlyWarningReport'] });
            setShowForm(false);
            setNotes('');
            setCommitment('');
            setFollowUpDate('');
            setStatus('OPEN');
        }
    });

    const updateStatusMutation = useMutation({
        mutationFn: ({ id, status }: { id: string; status: InterventionStatus }) =>
            updateStudentIntervention(id, { status }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['studentInterventions', student?.id] });
            queryClient.invalidateQueries({ queryKey: ['earlyWarningReport'] });
        }
    });

    if (!isOpen || !student) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!notes.trim()) return;

        createMutation.mutate({
            student_id: student.id,
            intervention_type: interventionType,
            notes: notes.trim(),
            commitment: commitment.trim() || undefined,
            follow_up_date: followUpDate || undefined,
            status
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
                
                {/* Header */}
                <div className="p-5 sm:p-6 border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex items-start justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-brand-blue/10 dark:bg-brand-blue/20 text-brand-blue dark:text-blue-400 border border-brand-blue/20">
                                BITÁCORA DE RETENCIÓN
                            </span>
                            <span className="text-xs font-mono font-bold text-slate-400">
                                {student.code}
                            </span>
                        </div>
                        <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1">
                            {student.full_name}
                        </h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            {student.branch_name} • {student.courses.join(', ')}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Sub-header info badges */}
                <div className="px-5 sm:px-6 py-3 bg-slate-100/60 dark:bg-slate-800/60 border-b border-slate-200/60 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                        <span className="text-slate-500 dark:text-slate-400">Tutor:</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                            {student.guardian_name || 'No registrado'}
                        </span>
                        {student.guardian_phone && (
                            <span className="font-mono text-slate-600 dark:text-slate-300">
                                ({student.guardian_phone})
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-slate-500 dark:text-slate-400">Índice IRE:</span>
                        <span className={`px-2 py-0.5 rounded-lg font-black text-xs ${
                            student.risk_level === 'critical' ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300' :
                            student.risk_level === 'moderate' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' :
                            'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                        }`}>
                            {student.ire_score}/100 ({student.risk_level.toUpperCase()})
                        </span>
                    </div>
                </div>

                {/* Body Content */}
                <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
                    {/* Top action button to open form */}
                    {!showForm && (
                        <button
                            onClick={() => setShowForm(true)}
                            className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-brand-blue to-blue-600 hover:from-blue-600 hover:to-brand-blue text-white font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 active:scale-[0.99]"
                        >
                            <Plus className="w-4 h-4" />
                            Registrar Nueva Acción de Intervención
                        </button>
                    )}

                    {/* Form */}
                    {showForm && (
                        <form onSubmit={handleSubmit} className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-4 animate-in fade-in duration-200">
                            <div className="flex items-center justify-between">
                                <h3 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2">
                                    <ShieldCheck className="w-4 h-4 text-brand-blue dark:text-blue-400" />
                                    Nueva Intervención de Retención
                                </h3>
                                <button
                                    type="button"
                                    onClick={() => setShowForm(false)}
                                    className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                >
                                    Cancelar
                                </button>
                            </div>

                            {/* Type selector */}
                            <div>
                                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">
                                    Tipo de Acción
                                </label>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    {(Object.keys(TYPE_CONFIG) as InterventionType[]).map((typeKey) => {
                                        const cfg = TYPE_CONFIG[typeKey];
                                        const Icon = cfg.icon;
                                        const isSelected = interventionType === typeKey;
                                        return (
                                            <button
                                                key={typeKey}
                                                type="button"
                                                onClick={() => setInterventionType(typeKey)}
                                                className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition-all ${
                                                    isSelected 
                                                        ? 'border-brand-blue bg-brand-blue/10 text-brand-blue dark:text-blue-400 font-bold shadow-sm' 
                                                        : 'border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs'
                                                }`}
                                            >
                                                <Icon className="w-3.5 h-3.5 shrink-0" />
                                                <span className="truncate text-xs">{cfg.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Notes */}
                            <div>
                                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                                    Notas y Resumen de la Conversación *
                                </label>
                                <textarea
                                    required
                                    rows={3}
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="Ej. Se llamó a la madre, indica que el estudiante estuvo enfermo 3 días pero ya se reincorpora..."
                                    className="w-full text-xs p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-blue"
                                />
                            </div>

                            {/* Commitment & Date */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                                        Compromiso Acordado (Opcional)
                                    </label>
                                    <input
                                        type="text"
                                        value={commitment}
                                        onChange={(e) => setCommitment(e.target.value)}
                                        placeholder="Ej. Realizar abono el 15 de Octubre"
                                        className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-blue"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                                        Fecha de Próximo Seguimiento
                                    </label>
                                    <input
                                        type="date"
                                        value={followUpDate}
                                        onChange={(e) => setFollowUpDate(e.target.value)}
                                        className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-blue"
                                    />
                                </div>
                            </div>

                            {/* Status */}
                            <div>
                                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                                    Estado Inicial
                                </label>
                                <select
                                    value={status}
                                    onChange={(e) => setStatus(e.target.value as InterventionStatus)}
                                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-blue"
                                >
                                    <option value="OPEN">Pendiente de verificación</option>
                                    <option value="IN_PROGRESS">En proceso de atención</option>
                                    <option value="RESOLVED">Resuelto / Estudiante regularizado</option>
                                    <option value="DROPPED">Baja confirmada</option>
                                </select>
                            </div>

                            {/* Submit button */}
                            <div className="flex justify-end gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowForm(false)}
                                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={createMutation.isPending || !notes.trim()}
                                    className="px-4 py-2 rounded-xl bg-brand-blue hover:bg-blue-600 text-white text-xs font-bold shadow flex items-center gap-1.5 disabled:opacity-50"
                                >
                                    {createMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                                    Guardar Intervención
                                </button>
                            </div>
                        </form>
                    )}

                    {/* Timeline of past interventions */}
                    <div className="space-y-3">
                        <h3 className="font-black text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            Historial de Intervenciones ({interventions?.length || 0})
                        </h3>

                        {isLoading && (
                            <div className="flex items-center justify-center p-8 text-slate-400">
                                <Loader2 className="w-6 h-6 animate-spin" />
                            </div>
                        )}

                        {!isLoading && interventions && interventions.length === 0 && (
                            <div className="p-6 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-400 text-xs">
                                No hay intervenciones registradas aún para este estudiante.
                            </div>
                        )}

                        {!isLoading && interventions && interventions.map((item) => {
                            const typeCfg = TYPE_CONFIG[item.intervention_type] || TYPE_CONFIG.PHONE_CALL;
                            const TypeIcon = typeCfg.icon;
                            const statusCfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.OPEN;

                            return (
                                <div
                                    key={item.id}
                                    className="p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-850 shadow-sm space-y-2.5"
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                            <span className={`p-1.5 rounded-lg border text-xs flex items-center gap-1 font-bold ${typeCfg.color}`}>
                                                <TypeIcon className="w-3.5 h-3.5" />
                                                {typeCfg.label}
                                            </span>
                                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${statusCfg.color}`}>
                                                {statusCfg.label}
                                            </span>
                                        </div>
                                        <span className="text-[11px] text-slate-400 font-mono">
                                            {new Date(item.created_at).toLocaleDateString('es-GT', {
                                                day: '2-digit',
                                                month: 'short',
                                                year: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                        </span>
                                    </div>

                                    <p className="text-xs text-slate-700 dark:text-slate-200 whitespace-pre-line">
                                        {item.notes}
                                    </p>

                                    {item.commitment && (
                                        <div className="p-2 rounded-xl bg-amber-50/70 dark:bg-amber-900/20 border border-amber-200/60 dark:border-amber-800/40 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-1.5">
                                            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                            <span><strong>Compromiso:</strong> {item.commitment}</span>
                                        </div>
                                    )}

                                    <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800/60 text-[11px] text-slate-400">
                                        <span>Registrado por: <strong>{item.author?.full_name || 'Personal'}</strong></span>
                                        
                                        {item.status !== 'RESOLVED' && (
                                            <button
                                                onClick={() => updateStatusMutation.mutate({ id: item.id, status: 'RESOLVED' })}
                                                disabled={updateStatusMutation.isPending}
                                                className="text-xs font-bold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 flex items-center gap-1"
                                            >
                                                <CheckCircle2 className="w-3 h-3" />
                                                Marcar como Resuelto
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-5 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default InterventionModal;
