import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
    CheckCircle2, 
    XCircle, 
    ShieldCheck, 
    User, 
    BookOpen, 
    Building2, 
    ExternalLink
} from 'lucide-react';
import { verifyInvoicePublic, type VerifyInvoiceData } from '../features/finance/paymentService';

export const VerifyReceipt: React.FC = () => {
    const { invoiceNumber } = useParams<{ invoiceNumber: string }>();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<VerifyInvoiceData | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!invoiceNumber) {
            setError('Número de comprobante no especificado.');
            setLoading(false);
            return;
        }

        const fetchVerification = async () => {
            try {
                const res = await verifyInvoicePublic(invoiceNumber);
                if (res.valid) {
                    setData(res);
                } else {
                    setError(res.message || 'El comprobante no es válido.');
                }
            } catch (err: any) {
                console.error('Error verifying receipt:', err);
                setError(err.response?.data?.message || 'Comprobante no encontrado en los registros oficiales de ULTEC.');
            } finally {
                setLoading(false);
            }
        };

        fetchVerification();
    }, [invoiceNumber]);

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 sm:p-6 selection:bg-blue-500 selection:text-white">
            {/* Background elements */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(59,130,246,0.15),rgba(255,255,255,0))] pointer-events-none" />

            <div className="relative w-full max-w-xl">
                {/* Header Brand */}
                <div className="text-center mb-6">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold uppercase tracking-wider mb-3">
                        <ShieldCheck className="w-4 h-4" />
                        <span>Portal Oficial de Verificación</span>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                        ULTRA TECNOLOGÍA
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-400 mt-1">
                        Centro Académico de Capacitación Integral
                    </p>
                </div>

                {/* Main Card */}
                <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl relative overflow-hidden">
                    {loading ? (
                        <div className="py-16 flex flex-col items-center justify-center gap-4 text-slate-400">
                            <div className="w-10 h-10 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                            <p className="text-sm font-medium">Validando autenticidad en registros institucionales...</p>
                        </div>
                    ) : error ? (
                        <div className="py-8 flex flex-col items-center text-center space-y-4">
                            <div className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
                                <XCircle className="w-8 h-8" />
                            </div>
                            <h2 className="text-xl font-bold text-white">Comprobante No Verificado</h2>
                            <p className="text-sm text-slate-400 max-w-md">
                                {error}
                            </p>
                            <div className="pt-4">
                                <Link
                                    to="/login"
                                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm font-semibold text-white transition-colors"
                                >
                                    <span>Ir al Portal Principal</span>
                                    <ExternalLink className="w-4 h-4" />
                                </Link>
                            </div>
                        </div>
                    ) : data ? (
                        <div className="space-y-6">
                            {/* Verification Badge */}
                            <div className="flex items-center gap-3 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                                <CheckCircle2 className="w-6 h-6 shrink-0" />
                                <div>
                                    <h3 className="text-sm font-bold tracking-tight">Comprobante Oficial y Auténtico</h3>
                                    <p className="text-xs text-emerald-400/80">
                                        Registrado y validado en el sistema financiero de ULTEC.
                                    </p>
                                </div>
                            </div>

                            {/* Key Metadata Grid */}
                            <div className="grid grid-cols-2 gap-3 text-xs">
                                <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
                                    <span className="text-slate-400 block text-[11px] mb-0.5">No. de Recibo</span>
                                    <span className="text-white font-mono font-bold text-sm">{data.invoice_number}</span>
                                </div>
                                <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
                                    <span className="text-slate-400 block text-[11px] mb-0.5">Fecha de Emisión</span>
                                    <span className="text-white font-medium">
                                        {new Date(data.issue_date).toLocaleDateString('es-GT', { year: 'numeric', month: 'long', day: 'numeric' })}
                                    </span>
                                </div>
                            </div>

                            {/* Details List */}
                            <div className="space-y-3 pt-2 border-t border-slate-800/80 text-xs">
                                <div className="flex items-start gap-3">
                                    <div className="p-2 rounded-lg bg-slate-800 text-slate-300">
                                        <User className="w-4 h-4" />
                                    </div>
                                    <div className="flex-1">
                                        <span className="text-slate-400 block text-[11px]">Estudiante / Cliente</span>
                                        <span className="text-white font-bold text-sm">{data.student_name}</span>
                                        <span className="text-slate-400 block text-[11px]">Código: {data.student_code}</span>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3">
                                    <div className="p-2 rounded-lg bg-slate-800 text-slate-300">
                                        <BookOpen className="w-4 h-4" />
                                    </div>
                                    <div className="flex-1">
                                        <span className="text-slate-400 block text-[11px]">Curso / Carrera</span>
                                        <span className="text-white font-semibold text-sm">{data.course_name}</span>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3">
                                    <div className="p-2 rounded-lg bg-slate-800 text-slate-300">
                                         <Building2 className="w-4 h-4" />
                                     </div>
                                     <div className="flex-1">
                                         <span className="text-slate-400 block text-[11px]">Sede Emisora</span>
                                         <span className="text-white font-semibold">{data.branch_name}</span>
                                         {data.branch_address && (
                                             <span className="text-slate-400 block text-[11px]">{data.branch_address}</span>
                                         )}
                                     </div>
                                 </div>
                            </div>

                            {/* Concepts Breakdown */}
                            <div className="space-y-2 pt-2 border-t border-slate-800/80">
                                <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
                                    Conceptos Cancelados
                                </span>
                                <div className="bg-slate-950/60 rounded-xl border border-slate-800 overflow-hidden text-xs">
                                    {data.items && data.items.length > 0 ? (
                                        data.items.map((item, idx) => (
                                             <div 
                                                 key={idx} 
                                                 className="flex items-center justify-between p-3 border-b border-slate-800/60 last:border-b-0"
                                             >
                                                 <div>
                                                     <span className="text-white font-medium block">{item.description}</span>
                                                     <span className="text-slate-400 text-[11px]">Cant: {item.quantity}</span>
                                                 </div>
                                                 <span className="text-white font-bold">
                                                     Q{Number(item.total_price || 0).toFixed(2)}
                                                 </span>
                                             </div>
                                         ))
                                     ) : (
                                         <div className="p-3 text-slate-400 text-center">
                                             Pago de Colegiatura
                                         </div>
                                     )}
                                 </div>
                            </div>

                            {/* Total Banner */}
                            <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-600/20 via-indigo-600/20 to-purple-600/20 border border-blue-500/30 flex items-center justify-between">
                                <div>
                                    <span className="text-xs text-blue-300 uppercase tracking-wider font-semibold block">
                                        Total Cancelado
                                    </span>
                                    <span className="text-2xl font-black text-white">
                                        Q{Number(data.total_amount || 0).toFixed(2)}
                                    </span>
                                </div>
                                <div className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-bold uppercase tracking-wider">
                                    {data.status === 'ISSUED' || data.status === 'PAID' ? 'PAGADO / VÁLIDO' : data.status === 'VOID' ? 'ANULADO' : data.status}
                                </div>
                            </div>

                            {/* Portal Access Call-to-Action */}
                            <div className="pt-2 border-t border-slate-800/80">
                                <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 text-center space-y-3">
                                    <p className="text-xs text-slate-400">
                                        ¿Deseas consultar tu estado de cuenta completo, solvencia académica o historial de pagos?
                                    </p>
                                    <Link
                                        to="/login"
                                        className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-xs font-bold text-white shadow-lg shadow-blue-500/20 active:scale-[0.99] transition-all"
                                    >
                                        <span>Iniciar Sesión en el Portal Institucional</span>
                                        <ExternalLink className="w-4 h-4" />
                                    </Link>
                                </div>
                            </div>
                        </div>
                    ) : null}
                </div>

                {/* Footer Legal */}
                <div className="text-center mt-6 text-[11px] text-slate-500 space-y-1">
                    <p>Resolución 154-2006, 00840-DIGEACE | Códigos: 00929-2010 / 00930-2010</p>
                    <p>© {new Date().getFullYear()} PlataformaULTEC. Todos los derechos reservados.</p>
                </div>
            </div>
        </div>
    );
};

export default VerifyReceipt;
