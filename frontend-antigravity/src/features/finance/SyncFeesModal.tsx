import React, { useState } from 'react';
import { X, RefreshCw, CheckCircle2, AlertTriangle, Calendar, ShieldCheck } from 'lucide-react';
import { syncMonthlyFees, type SyncMonthlyFeesResponse } from './paymentService';

interface SyncFeesModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}

export const SyncFeesModal: React.FC<SyncFeesModalProps> = ({
    isOpen,
    onClose,
    onSuccess
}) => {
    const now = new Date();
    const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const [targetMonth, setTargetMonth] = useState(defaultMonth);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<SyncMonthlyFeesResponse | null>(null);

    if (!isOpen) return null;

    const handleSync = async () => {
        setLoading(true);
        setError(null);
        setResult(null);

        try {
            const data = await syncMonthlyFees({ target_month: targetMonth });
            setResult(data);
            if (onSuccess) {
                onSuccess();
            }
        } catch (err: any) {
            console.error('Error during fee sync:', err);
            setError(err.response?.data?.message || 'Error al ejecutar la sincronización de cuotas.');
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        setResult(null);
        setError(null);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden text-slate-100">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800 bg-slate-900/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
                            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white tracking-tight">
                                Conciliador de Cuotas
                            </h2>
                            <p className="text-xs text-slate-400">
                                Sincronización mensual y auditoría de morosidad
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={handleClose}
                        disabled={loading}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-5">
                    {/* Information Box */}
                    <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-800 text-xs text-slate-300 space-y-2">
                        <div className="flex items-center gap-2 text-blue-400 font-semibold text-sm">
                            <ShieldCheck className="w-4 h-4" />
                            <span>Auditoría de Deuda Automatizada</span>
                        </div>
                        <p>
                            Este proceso audita todas las inscripciones activas y concilia los pagos registrados contra las mensualidades transcurridas según la fecha de inicio de cada curso.
                        </p>
                        <p className="text-slate-400">
                            Aplica descuentos de becas asignadas y alinea los indicadores del Dashboard con el Centro de Reportes.
                        </p>
                    </div>

                    {/* Month Selector */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                            Conciliar Hasta el Mes:
                        </label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                                <Calendar className="w-4 h-4" />
                            </div>
                            <input
                                type="month"
                                value={targetMonth}
                                onChange={(e) => setTargetMonth(e.target.value)}
                                disabled={loading}
                                className="w-full pl-10 pr-4 py-2.5 bg-slate-950/60 border border-slate-700/80 rounded-xl text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all"
                            />
                        </div>
                    </div>

                    {/* Error Banner */}
                    {error && (
                        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2.5">
                            <AlertTriangle className="w-4 h-4 shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Success Summary Banner */}
                    {result && (
                        <div className="space-y-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 animate-in fade-in duration-200">
                            <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                                <CheckCircle2 className="w-4 h-4" />
                                <span>{result.message}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2.5 pt-1 text-xs">
                                <div className="p-2.5 bg-slate-900/60 rounded-lg border border-slate-800">
                                    <span className="text-slate-400 block text-[11px]">Inscripciones Auditadas</span>
                                    <span className="text-white font-bold text-base">{result.active_enrollments_processed}</span>
                                </div>
                                <div className="p-2.5 bg-slate-900/60 rounded-lg border border-slate-800">
                                    <span className="text-slate-400 block text-[11px]">Total Cuotas Conciliadas</span>
                                    <span className="text-blue-400 font-bold text-base">{result.total_reconciled}</span>
                                </div>
                                <div className="p-2.5 bg-slate-900/60 rounded-lg border border-slate-800">
                                    <span className="text-slate-400 block text-[11px]">Cuotas al Día (Pagadas)</span>
                                    <span className="text-emerald-400 font-bold text-base">{result.total_paid}</span>
                                </div>
                                <div className="p-2.5 bg-slate-900/60 rounded-lg border border-slate-800">
                                    <span className="text-slate-400 block text-[11px]">Cuotas Pendientes / Mora</span>
                                    <span className="text-amber-400 font-bold text-base">{result.total_pending}</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-800 bg-slate-900/50">
                    <button
                        type="button"
                        onClick={handleClose}
                        disabled={loading}
                        className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
                    >
                        {result ? 'Listo' : 'Cancelar'}
                    </button>
                    <button
                        type="button"
                        onClick={handleSync}
                        disabled={loading}
                        className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 active:scale-[0.98] rounded-xl shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:pointer-events-none transition-all"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        <span>{loading ? 'Conciliando...' : 'Iniciar Conciliación'}</span>
                    </button>
                </div>
            </div>
        </div>
    );
};
