import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { requestJustification } from '../attendanceService';
import { X, ShieldCheck, Calendar, BookOpen, AlertCircle, Loader2, Send } from 'lucide-react';

interface StudentJustificationModalProps {
    isOpen: boolean;
    onClose: () => void;
    record: {
        id: string;
        course_id: string;
        course_name: string;
        date: string;
    } | null;
    onSuccess?: () => void;
}

const REASONS = [
    { value: 'MEDICA', label: 'Médica (enfermedad, cita médica o reposo)' },
    { value: 'CALAMIDAD', label: 'Calamidad familiar o emergencia doméstica' },
    { value: 'LABORAL', label: 'Laboral o trámite oficial indispensable' },
    { value: 'INSTITUCIONAL', label: 'Actividad institucional o académica ULTEC' },
    { value: 'PERSONAL', label: 'Motivo personal de fuerza mayor' },
];

const StudentJustificationModal = ({
    isOpen,
    onClose,
    record,
    onSuccess,
}: StudentJustificationModalProps) => {
    const queryClient = useQueryClient();
    const [reasonType, setReasonType] = useState('MEDICA');
    const [description, setDescription] = useState('');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const mutation = useMutation({
        mutationFn: requestJustification,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['my_attendance'] });
            queryClient.invalidateQueries({ queryKey: ['justifications'] });
            setDescription('');
            if (onSuccess) onSuccess();
            onClose();
        },
        onError: (err: any) => {
            setErrorMessage(err.response?.data?.message || 'Error al enviar la justificación');
        }
    });

    if (!isOpen || !record) return null;

    const formattedDate = new Date(record.date + 'T00:00:00').toLocaleDateString('es-ES', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMessage(null);

        if (!description.trim() || description.trim().length < 5) {
            setErrorMessage('Por favor ingresa una explicación detallada del motivo.');
            return;
        }

        mutation.mutate({
            course_id: record.course_id,
            date: record.date,
            reason_type: reasonType,
            description: description.trim(),
        });
    };

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
            <div className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
                
                {/* Header */}
                <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950/60">
                    <div className="flex items-center space-x-2.5">
                        <div className="p-2 bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 rounded-xl">
                            <ShieldCheck className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-slate-900 dark:text-white">
                                Solicitar Justificación de Falta
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                Envía tu solicitud al docente y a secretaría académica.
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Formulario */}
                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    {/* Tarjeta de Resumen de la Falta */}
                    <div className="bg-slate-100 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 space-y-2 text-xs">
                        <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-bold">
                            <BookOpen className="w-4 h-4 text-brand-blue" />
                            <span className="truncate">{record.course_name}</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 capitalize">
                            <Calendar className="w-4 h-4 text-indigo-400" />
                            <span>{formattedDate}</span>
                        </div>
                    </div>

                    {/* Selector de Categoría */}
                    <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                            Tipo de Motivo
                        </label>
                        <select
                            value={reasonType}
                            onChange={(e) => setReasonType(e.target.value)}
                            className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-medium text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500/30 cursor-pointer"
                        >
                            {REASONS.map((r) => (
                                <option key={r.value} value={r.value}>
                                    {r.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Explicación / Descripción */}
                    <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                            Explicación / Detalle de la Inasistencia
                        </label>
                        <textarea
                            rows={4}
                            placeholder="Describe brevemente el motivo de tu ausencia (ej: cita en el seguro médico, constancia que presentaré a secretaría...)"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-blue-500/30"
                        />
                    </div>

                    {errorMessage && (
                        <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 rounded-xl flex items-center gap-2 text-xs text-rose-600 dark:text-rose-400">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <span>{errorMessage}</span>
                        </div>
                    )}

                    {/* Botones */}
                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={mutation.isPending}
                            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-600/30 active:scale-95 disabled:opacity-50 transition-all"
                        >
                            {mutation.isPending ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Send className="w-4 h-4" />
                            )}
                            <span>{mutation.isPending ? 'Enviando...' : 'Enviar Justificación'}</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default StudentJustificationModal;
