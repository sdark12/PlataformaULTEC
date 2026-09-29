import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getJustifications, reviewJustification } from '../attendanceService';
import type { AttendanceJustification } from '../attendanceService';
import { 
    X, ShieldCheck, Loader2, Calendar, 
    CheckCircle2, XCircle, Clock
} from 'lucide-react';

interface JustificationReviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    courseId?: string;
    onJustificationReviewed?: () => void;
}

const REASON_LABELS: Record<string, { label: string; badge: string }> = {
    MEDICA: { label: 'Médica', badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
    LABORAL: { label: 'Laboral', badge: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
    CALAMIDAD: { label: 'Calamidad Familiar', badge: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
    INSTITUCIONAL: { label: 'Institucional', badge: 'bg-purple-500/15 text-purple-400 border-purple-500/30' },
    PERSONAL: { label: 'Personal', badge: 'bg-slate-500/15 text-slate-300 border-slate-500/30' },
};

const JustificationReviewModal = ({
    isOpen,
    onClose,
    courseId,
    onJustificationReviewed,
}: JustificationReviewModalProps) => {
    const queryClient = useQueryClient();
    const [statusFilter, setStatusFilter] = useState<'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL'>('PENDING');
    const [rejectingId, setRejectingId] = useState<string | null>(null);
    const [rejectNotes, setRejectNotes] = useState<string>('');

    const { data: justifications, isLoading } = useQuery({
        queryKey: ['justifications', courseId, statusFilter],
        queryFn: () => getJustifications({ 
            course_id: courseId, 
            status: statusFilter === 'ALL' ? undefined : statusFilter 
        }),
        enabled: isOpen,
    });

    const mutation = useMutation({
        mutationFn: ({ id, status, notes }: { id: string; status: 'APPROVED' | 'REJECTED'; notes?: string }) =>
            reviewJustification(id, { status, review_notes: notes }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['justifications'] });
            queryClient.invalidateQueries({ queryKey: ['attendance'] });
            queryClient.invalidateQueries({ queryKey: ['attendance_matrix'] });
            setRejectingId(null);
            setRejectNotes('');
            if (onJustificationReviewed) onJustificationReviewed();
        },
        onError: (err: any) => {
            alert(err.response?.data?.message || 'Error al procesar justificación');
        }
    });

    const handleApprove = (id: string) => {
        mutation.mutate({ id, status: 'APPROVED' });
    };

    const handleReject = (id: string) => {
        mutation.mutate({ id, status: 'REJECTED', notes: rejectNotes });
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
            <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                
                {/* Header */}
                <div className="px-5 py-4 border-b border-slate-800/80 flex items-center justify-between bg-slate-950/60">
                    <div className="flex items-center space-x-2.5">
                        <div className="p-2 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-xl">
                            <ShieldCheck className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-slate-100">
                                Bandeja de Justificaciones de Faltas
                            </h3>
                            <p className="text-xs text-slate-400">
                                Revisa y valida solicitudes de justificación enviadas por estudiantes y tutores.
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Filtros de Pestaña */}
                <div className="px-5 py-3 border-b border-slate-800/60 bg-slate-950/30 flex items-center gap-2 overflow-x-auto">
                    {(['PENDING', 'APPROVED', 'REJECTED', 'ALL'] as const).map((st) => (
                        <button
                            key={st}
                            type="button"
                            onClick={() => setStatusFilter(st)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                                statusFilter === st
                                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                            }`}
                        >
                            {st === 'PENDING' && 'Pendientes'}
                            {st === 'APPROVED' && 'Aprobadas'}
                            {st === 'REJECTED' && 'Rechazadas'}
                            {st === 'ALL' && 'Todas'}
                        </button>
                    ))}
                </div>

                {/* Lista de Justificaciones */}
                <div className="p-5 overflow-y-auto space-y-4 flex-1">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                            <Loader2 className="animate-spin h-8 w-8 text-blue-500 mb-3" />
                            <p className="text-xs font-medium">Cargando solicitudes...</p>
                        </div>
                    ) : justifications && justifications.length > 0 ? (
                        justifications.map((item: AttendanceJustification) => {
                            const reasonInfo = REASON_LABELS[item.reason_type] || { label: item.reason_type, badge: 'bg-slate-800 text-slate-300 border-slate-700' };
                            const isPending = item.status === 'PENDING';

                            return (
                                <div
                                    key={item.id}
                                    className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4 space-y-3"
                                >
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                        <div className="flex items-center space-x-2.5">
                                            <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-300 font-bold flex items-center justify-center text-xs">
                                                {item.students?.full_name?.charAt(0) || 'E'}
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-sm text-white">{item.students?.full_name}</h4>
                                                <p className="text-[11px] text-slate-400">
                                                    {item.courses?.name || 'Curso'}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${reasonInfo.badge}`}>
                                                {reasonInfo.label}
                                            </span>
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase ${
                                                item.status === 'PENDING' ? 'bg-amber-500/15 text-amber-400 border-amber-500/30' :
                                                item.status === 'APPROVED' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' :
                                                'bg-rose-500/15 text-rose-400 border-rose-500/30'
                                            }`}>
                                                {item.status === 'PENDING' ? 'Pendiente' : item.status === 'APPROVED' ? 'Aprobada' : 'Rechazada'}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Fecha y Detalle */}
                                    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 space-y-1.5 text-xs">
                                        <div className="flex items-center text-slate-400 text-[11px] gap-1.5">
                                            <Calendar className="w-3.5 h-3.5 text-blue-400" />
                                            <span>Fecha de inasistencia: <strong className="text-slate-200">{item.date}</strong></span>
                                        </div>
                                        <p className="text-slate-300 italic pt-1">
                                            "{item.description}"
                                        </p>
                                    </div>

                                    {/* Revisor previo si ya fue resuelta */}
                                    {item.reviewed_at && (
                                        <div className="text-[11px] text-slate-500 flex items-center gap-1.5 pt-0.5">
                                            <Clock className="w-3 h-3" />
                                            <span>Revisado por {item.reviewer?.full_name || 'Personal'} el {new Date(item.reviewed_at).toLocaleDateString('es-ES')}</span>
                                            {item.review_notes && <span className="text-slate-400 font-mono">({item.review_notes})</span>}
                                        </div>
                                    )}

                                    {/* Modal / Panel para rechazar con nota */}
                                    {rejectingId === item.id && (
                                        <div className="pt-2 border-t border-slate-800/80 space-y-2">
                                            <label className="text-[11px] font-bold text-rose-400">
                                                Motivo del rechazo (opcional):
                                            </label>
                                            <input
                                                type="text"
                                                placeholder="Ej: No adjuntó constancia médica o excede el límite..."
                                                value={rejectNotes}
                                                onChange={(e) => setRejectNotes(e.target.value)}
                                                className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 text-slate-200 rounded-xl text-xs outline-none focus:border-rose-500"
                                            />
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setRejectingId(null)}
                                                    className="px-3 py-1 bg-slate-800 text-slate-300 rounded-lg text-xs font-semibold"
                                                >
                                                    Cancelar
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleReject(item.id)}
                                                    disabled={mutation.isPending}
                                                    className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold"
                                                >
                                                    Confirmar Rechazo
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Acciones para solicitudes pendientes */}
                                    {isPending && rejectingId !== item.id && (
                                        <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-800/80">
                                            <button
                                                type="button"
                                                onClick={() => setRejectingId(item.id)}
                                                disabled={mutation.isPending}
                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-xl text-xs font-bold transition-all active:scale-95"
                                            >
                                                <XCircle className="w-3.5 h-3.5" />
                                                <span>Rechazar</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleApprove(item.id)}
                                                disabled={mutation.isPending}
                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/30 rounded-xl text-xs font-bold transition-all active:scale-95"
                                            >
                                                <CheckCircle2 className="w-3.5 h-3.5" />
                                                <span>Aprobar (Excusar Falta)</span>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    ) : (
                        <div className="text-center py-16 text-slate-500 space-y-2">
                            <ShieldCheck className="w-12 h-12 text-slate-600 mx-auto" />
                            <p className="text-sm font-semibold text-slate-300">No hay justificaciones en esta sección</p>
                            <p className="text-xs text-slate-500">
                                {statusFilter === 'PENDING' ? 'No tienes solicitudes pendientes por revisar.' : 'No se encontraron registros.'}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default JustificationReviewModal;
