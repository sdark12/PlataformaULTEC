import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { 
    X, Loader2, CheckCircle2, AlertCircle, 
    Printer, Download, Phone, BookOpen, 
    CreditCard, ArrowUpRight, Award, ShieldCheck, RefreshCw
} from 'lucide-react';
import { getStudentStatement } from './paymentService';
import type { StudentStatement } from './paymentService';
import { downloadInvoicePdf } from './invoiceService';
import * as XLSX from 'xlsx';
import { saveWorkbook } from '../../utils/fileDownloader';

interface StudentStatementModalProps {
    isOpen: boolean;
    studentId: string | null;
    studentName?: string;
    onClose: () => void;
    onPayBalance?: (studentId: string, studentName: string, courses: any[]) => void;
}

const StudentStatementModal: React.FC<StudentStatementModalProps> = ({
    isOpen,
    studentId,
    studentName,
    onClose,
    onPayBalance
}) => {
    const [activeTab, setActiveTab] = useState<'summary' | 'courses' | 'payments'>('summary');

    const { data: statement, isLoading, isError, refetch } = useQuery<StudentStatement>({
        queryKey: ['student-statement', studentId],
        queryFn: () => getStudentStatement(studentId!),
        enabled: isOpen && !!studentId,
    });

    if (!isOpen || !studentId) return null;

    const exportStatementToExcel = async () => {
        if (!statement) return;

        const wb = XLSX.utils.book_new();

        // Sheet 1: General Info & KPI
        const infoData = [
            { Propiedad: 'Estudiante', Valor: statement.student.full_name },
            { Propiedad: 'Código Personal', Valor: statement.student.personal_code || '-' },
            { Propiedad: 'DPI / Documento', Valor: statement.student.identification_document || '-' },
            { Propiedad: 'Teléfono', Valor: statement.student.phone || '-' },
            { Propiedad: 'Encargado', Valor: statement.student.guardian_name || '-' },
            { Propiedad: 'Teléfono Encargado', Valor: statement.student.guardian_phone || '-' },
            { Propiedad: 'Sede', Valor: statement.student.branch_name || '-' },
            { Propiedad: 'Estado de Solvencia', Valor: statement.summary.is_solvent ? 'SOLVENTE / AL DÍA' : 'CON SALDO PENDIENTE' },
            { Propiedad: 'Total Pagado Histórico (Q)', Valor: statement.summary.total_paid },
            { Propiedad: 'Total Pendiente en Mora (Q)', Valor: statement.summary.total_pending },
            { Propiedad: 'Descuentos Totales Aplicados (Q)', Valor: statement.summary.total_discount },
            { Propiedad: 'Fecha de Emisión', Valor: new Date().toLocaleDateString('es-GT') }
        ];
        const wsInfo = XLSX.utils.json_to_sheet(infoData);
        XLSX.utils.book_append_sheet(wb, wsInfo, 'Resumen General');

        // Sheet 2: Cursos
        const coursesData = statement.courses.map(c => ({
            'Curso': c.course_name,
            'Ciclo': c.academic_year ? `Ciclo ${c.academic_year}` : 'General',
            'Horario': c.schedule_label || 'Regular',
            'Cuota Mensual (Q)': c.monthly_fee,
            'Meses Transcurridos': c.months_elapsed,
            'Meses Pagados': c.months_paid,
            'Meses en Mora': c.months_pending,
            'Total Esperado (Q)': c.total_due,
            'Total Pagado (Q)': c.total_paid,
            'Saldo Pendiente (Q)': c.pending_amount,
            'Solvencia': c.is_solvent ? 'Al Día' : 'Con Mora'
        }));
        const wsCourses = XLSX.utils.json_to_sheet(coursesData);
        XLSX.utils.book_append_sheet(wb, wsCourses, 'Cursos y Cuotas');

        // Sheet 3: Historial de Pagos
        const paymentsData = statement.payments.map(p => ({
            'ID': p.id,
            'Fecha': new Date(p.payment_date).toLocaleDateString(),
            'Curso': p.course_name,
            'Ciclo': p.academic_year ? `Ciclo ${p.academic_year}` : 'General',
            'Concepto': p.payment_type === 'TUITION' ? 'Colegiatura' : p.payment_type,
            'Mes de Pago': p.tuition_month || '-',
            'Descripción': p.description || '',
            'Monto (Q)': p.amount,
            'Descuento (Q)': p.discount,
            'Método': p.method,
            'Referencia': p.reference_number || '-'
        }));
        const wsPayments = XLSX.utils.json_to_sheet(paymentsData);
        XLSX.utils.book_append_sheet(wb, wsPayments, 'Historial de Pagos');

        await saveWorkbook(wb, `Estado_Cuenta_${statement.student.full_name.replace(/\s+/g, '_')}.xlsx`);
    };

    const handleActionPay = () => {
        if (!statement || !onPayBalance) return;
        const pendingCourses = statement.courses
            .filter(c => c.is_active && c.pending_amount > 0)
            .map(c => ({
                enrollment_id: c.enrollment_id,
                course_name: c.course_name,
                monthly_fee: c.monthly_fee,
                pending_amount: c.pending_amount,
                academic_year: c.academic_year
            }));
        onPayBalance(statement.student.id, statement.student.full_name, pendingCourses);
        onClose();
    };

    return createPortal(
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-3 sm:p-4 md:p-6">
            <div 
                className="fixed inset-0 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300"
                onClick={onClose}
            />

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-4xl shadow-2xl relative z-10 overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[92vh]">
                
                {/* Header with Student Identity & Solvency Status */}
                <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 p-5 md:p-6 text-white border-b border-white/10 shrink-0 relative overflow-hidden">
                    <div className="absolute -right-16 -top-16 w-48 h-48 bg-brand-teal/20 rounded-full blur-3xl pointer-events-none" />
                    <div className="absolute -left-16 -bottom-16 w-48 h-48 bg-brand-purple/20 rounded-full blur-3xl pointer-events-none" />

                    <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-start gap-4">
                            <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-gradient-to-tr from-brand-blue to-brand-teal flex items-center justify-center font-black text-xl text-white shadow-lg shadow-brand-blue/30 shrink-0">
                                {statement?.student?.full_name ? statement.student.full_name.charAt(0).toUpperCase() : (studentName?.charAt(0) || 'E')}
                            </div>
                            <div className="min-w-0">
                                <div className="flex items-center gap-2.5 flex-wrap">
                                    <h3 className="text-xl md:text-2xl font-black tracking-tight text-white truncate">
                                        {statement?.student?.full_name || studentName || 'Estado de Cuenta'}
                                    </h3>
                                    {statement && (
                                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1 ${
                                            statement.summary.is_solvent 
                                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                                                : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                        }`}>
                                            {statement.summary.is_solvent ? (
                                                <><ShieldCheck className="h-3.5 w-3.5" /> Solvente</>
                                            ) : (
                                                <><AlertCircle className="h-3.5 w-3.5" /> Con Saldo Pendiente</>
                                            )}
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-400 flex-wrap">
                                    {statement?.student?.personal_code && (
                                        <span>Código: <strong className="text-slate-300">{statement.student.personal_code}</strong></span>
                                    )}
                                    {statement?.student?.phone && (
                                        <span className="flex items-center gap-1">
                                            <Phone className="h-3 w-3" /> {statement.student.phone}
                                        </span>
                                    )}
                                    {statement?.student?.guardian_name && (
                                        <span>Encargado: <strong className="text-slate-300">{statement.student.guardian_name}</strong></span>
                                    )}
                                    {statement?.student?.branch_name && (
                                        <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[10px] font-semibold text-slate-300">
                                            {statement.student.branch_name}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-center">
                            <button
                                onClick={exportStatementToExcel}
                                disabled={isLoading || !statement}
                                title="Exportar a Excel"
                                className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all disabled:opacity-50"
                            >
                                <Download className="h-4 w-4" />
                            </button>
                            <button
                                onClick={() => refetch()}
                                title="Recargar"
                                className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all"
                            >
                                <RefreshCw className="h-4 w-4" />
                            </button>
                            <button 
                                onClick={onClose} 
                                className="text-white/80 hover:text-white bg-black/20 hover:bg-black/30 p-2.5 rounded-xl transition-colors"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                    </div>

                    {/* Navigation Tabs */}
                    <div className="flex items-center gap-2 mt-5 border-t border-white/10 pt-3">
                        <button
                            onClick={() => setActiveTab('summary')}
                            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                activeTab === 'summary'
                                    ? 'bg-brand-blue text-white shadow-md'
                                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                            }`}
                        >
                            Resumen Financiero
                        </button>
                        <button
                            onClick={() => setActiveTab('courses')}
                            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                                activeTab === 'courses'
                                    ? 'bg-brand-blue text-white shadow-md'
                                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                            }`}
                        >
                            <span>Cursos Matriculados</span>
                            {statement && (
                                <span className="px-1.5 py-0.2 rounded-full bg-white/20 text-[10px]">
                                    {statement.courses.length}
                                </span>
                            )}
                        </button>
                        <button
                            onClick={() => setActiveTab('payments')}
                            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                                activeTab === 'payments'
                                    ? 'bg-brand-blue text-white shadow-md'
                                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                            }`}
                        >
                            <span>Historial de Pagos</span>
                            {statement && (
                                <span className="px-1.5 py-0.2 rounded-full bg-white/20 text-[10px]">
                                    {statement.payments.length}
                                </span>
                            )}
                        </button>
                    </div>
                </div>

                {/* Content Area */}
                <div className="p-5 md:p-6 overflow-y-auto custom-scrollbar flex-1 bg-slate-50/50 dark:bg-slate-900/50 space-y-6">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-20">
                            <Loader2 className="animate-spin h-10 w-10 text-brand-blue mb-3" />
                            <p className="text-sm font-semibold text-slate-500">Calculando balance del estudiante...</p>
                        </div>
                    ) : isError || !statement ? (
                        <div className="text-center py-16">
                            <AlertCircle className="h-12 w-12 text-rose-500 mx-auto mb-3" />
                            <h4 className="text-lg font-bold text-slate-800 dark:text-white">Error al cargar estado de cuenta</h4>
                            <p className="text-xs text-slate-500 mt-1">No se pudo consultar la información financiera del estudiante.</p>
                        </div>
                    ) : (
                        <>
                            {/* KPI Metrics Strip */}
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
                                <div className="bg-white dark:bg-slate-800/80 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 shadow-sm">
                                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold mb-1">
                                        <span>Total Pagado</span>
                                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                    </div>
                                    <div className="text-xl md:text-2xl font-black text-emerald-600 dark:text-emerald-400">
                                        Q{statement.summary.total_paid.toLocaleString('es-GT', { minimumFractionDigits: 2 })}
                                    </div>
                                    <div className="text-[11px] text-slate-400 mt-1">
                                        {statement.summary.total_payments_count} cobros registrados
                                    </div>
                                </div>

                                <div className="bg-white dark:bg-slate-800/80 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 shadow-sm">
                                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold mb-1">
                                        <span>Saldo Pendiente</span>
                                        <AlertCircle className={`h-4 w-4 ${statement.summary.total_pending > 0 ? 'text-rose-500' : 'text-slate-400'}`} />
                                    </div>
                                    <div className={`text-xl md:text-2xl font-black ${statement.summary.total_pending > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-700 dark:text-slate-300'}`}>
                                        Q{statement.summary.total_pending.toLocaleString('es-GT', { minimumFractionDigits: 2 })}
                                    </div>
                                    <div className="text-[11px] text-slate-400 mt-1">
                                        {statement.summary.is_solvent ? 'Al día sin atrasos' : 'Cuotas vencidas pendientes'}
                                    </div>
                                </div>

                                <div className="bg-white dark:bg-slate-800/80 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 shadow-sm">
                                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold mb-1">
                                        <span>Descuentos Recibidos</span>
                                        <Award className="h-4 w-4 text-brand-purple" />
                                    </div>
                                    <div className="text-xl md:text-2xl font-black text-brand-purple">
                                        Q{statement.summary.total_discount.toLocaleString('es-GT', { minimumFractionDigits: 2 })}
                                    </div>
                                    <div className="text-[11px] text-slate-400 mt-1">
                                        Becas / beneficios aplicados
                                    </div>
                                </div>

                                <div className="bg-white dark:bg-slate-800/80 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 shadow-sm">
                                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold mb-1">
                                        <span>Cursos Activos</span>
                                        <BookOpen className="h-4 w-4 text-brand-blue" />
                                    </div>
                                    <div className="text-xl md:text-2xl font-black text-brand-blue">
                                        {statement.summary.active_courses_count}
                                    </div>
                                    <div className="text-[11px] text-slate-400 mt-1">
                                        Inscripciones vigentes
                                    </div>
                                </div>
                            </div>

                            {/* TAB 1: SUMMARY TAB */}
                            {activeTab === 'summary' && (
                                <div className="space-y-6">
                                    {/* Action Banner if debt exists */}
                                    {statement.summary.total_pending > 0 && onPayBalance && (
                                        <div className="p-4 rounded-2xl bg-gradient-to-r from-rose-500/10 via-rose-500/5 to-transparent border border-rose-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                            <div>
                                                <div className="text-sm font-bold text-rose-700 dark:text-rose-300 flex items-center gap-1.5">
                                                    <AlertCircle className="h-4 w-4" />
                                                    El estudiante tiene un saldo adeudado de Q{statement.summary.total_pending.toLocaleString('es-GT', { minimumFractionDigits: 2 })}
                                                </div>
                                                <p className="text-xs text-rose-600/80 dark:text-rose-400/80 mt-0.5">
                                                    Puedes procesar la liquidación del saldo pendiente directamente desde este módulo.
                                                </p>
                                            </div>
                                            <button
                                                onClick={handleActionPay}
                                                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-rose-600/20 active:scale-95 whitespace-nowrap flex items-center gap-1.5"
                                            >
                                                <CreditCard className="h-4 w-4" />
                                                <span>Pagar Saldo Pendiente</span>
                                            </button>
                                        </div>
                                    )}

                                    {/* Courses Progress Strip */}
                                    <div className="bg-white dark:bg-slate-800/80 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 shadow-sm space-y-4">
                                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                                            <BookOpen className="h-3.5 w-3.5 text-brand-blue" />
                                            <span>Estado por Curso Matriculado</span>
                                        </h4>

                                        <div className="space-y-3">
                                            {statement.courses.map((course) => {
                                                const percent = course.total_due > 0 
                                                    ? Math.min(100, Math.round((course.total_paid / course.total_due) * 100))
                                                    : 100;

                                                return (
                                                    <div 
                                                        key={course.enrollment_id}
                                                        className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 space-y-2.5"
                                                    >
                                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                                            <div>
                                                                <div className="flex items-center gap-2 flex-wrap">
                                                                    <span className="font-bold text-sm text-slate-900 dark:text-white">{course.course_name}</span>
                                                                    {course.academic_year && (
                                                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800/50">
                                                                            Ciclo {course.academic_year}
                                                                        </span>
                                                                    )}
                                                                    {course.scholarship_type && course.scholarship_type !== 'NONE' && (
                                                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/30">
                                                                            {course.scholarship_type === 'PERCENTAGE' ? `Beca ${course.scholarship_amount}%` : `Beca Q${course.scholarship_amount}`}
                                                                        </span>
                                                                    )}
                                                                    {course.schedule_label && (
                                                                        <span className="px-2 py-0.5 rounded-md bg-brand-blue/10 text-brand-blue text-[10px] font-bold">
                                                                            {course.schedule_label}
                                                                        </span>
                                                                    )}
                                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${course.is_solvent ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'}`}>
                                                                        {course.is_solvent ? 'Al Día' : `${course.months_pending} meses mora`}
                                                                    </span>
                                                                </div>
                                                                <div className="text-xs text-slate-500 mt-0.5">
                                                                    Cuota: <strong>Q{course.effective_monthly_fee ?? course.monthly_fee}</strong> / mes {course.effective_monthly_fee && course.effective_monthly_fee < course.monthly_fee ? `(Regular Q${course.monthly_fee})` : ''} • Pagados: <strong>{course.months_paid}</strong> de {course.months_elapsed} meses
                                                                </div>
                                                            </div>

                                                            <div className="text-left sm:text-right">
                                                                <div className="text-xs font-bold text-slate-600 dark:text-slate-300">
                                                                    Q{course.total_paid} <span className="text-slate-400 font-normal">de Q{course.total_due}</span>
                                                                </div>
                                                                {course.pending_amount > 0 && (
                                                                    <div className="text-xs font-black text-rose-600 dark:text-rose-400">
                                                                        Debe: Q{course.pending_amount}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Progress bar */}
                                                        <div className="w-full bg-slate-200 dark:bg-slate-700/60 rounded-full h-2 overflow-hidden">
                                                            <div 
                                                                className={`h-full rounded-full transition-all duration-500 ${course.is_solvent ? 'bg-emerald-500' : 'bg-gradient-to-r from-amber-500 to-rose-500'}`}
                                                                style={{ width: `${percent}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                );
                                            })}

                                            {statement.courses.length === 0 && (
                                                <p className="text-xs text-slate-400 text-center py-4">No tiene cursos matriculados registrados.</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Recent Receipts Summary */}
                                    <div className="bg-white dark:bg-slate-800/80 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 shadow-sm space-y-4">
                                        <div className="flex items-center justify-between">
                                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                                                <Printer className="h-3.5 w-3.5 text-brand-teal" />
                                                <span>Últimos Comprobantes / Recibos Emitidos</span>
                                            </h4>
                                            <button
                                                onClick={() => setActiveTab('payments')}
                                                className="text-xs font-bold text-brand-blue hover:underline flex items-center gap-1"
                                            >
                                                <span>Ver todos ({statement.payments.length})</span>
                                                <ArrowUpRight className="h-3 w-3" />
                                            </button>
                                        </div>

                                        <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
                                            {statement.payments.slice(0, 4).map((p) => (
                                                <div key={p.id} className="py-2.5 flex items-center justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <div className="font-bold text-xs text-slate-900 dark:text-white truncate flex items-center gap-1.5">
                                                            <span>{p.course_name}</span>
                                                            {p.academic_year && (
                                                                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800/50">
                                                                    Ciclo {p.academic_year}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="text-[11px] text-slate-400">
                                                            {new Date(p.payment_date).toLocaleDateString()} • {p.tuition_month || p.payment_type} • Ref: {p.reference_number || 'Efectivo'}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-3 shrink-0">
                                                        <span className="font-black text-xs text-emerald-600 dark:text-emerald-400">
                                                            Q{p.amount}
                                                        </span>
                                                        <button
                                                            onClick={() => downloadInvoicePdf(p.id, statement.student.full_name)}
                                                            className="p-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-600 dark:text-slate-300 rounded-lg text-xs"
                                                            title="Descargar Recibo"
                                                        >
                                                            <Printer className="h-3.5 w-3.5" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}

                                            {statement.payments.length === 0 && (
                                                <p className="text-xs text-slate-400 text-center py-4">No hay pagos registrados para este estudiante.</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* TAB 2: COURSES TAB */}
                            {activeTab === 'courses' && (
                                <div className="space-y-4">
                                    <div className="overflow-x-auto rounded-2xl border border-slate-200/80 dark:border-slate-700/60 bg-white dark:bg-slate-800/80 shadow-sm">
                                        <table className="w-full text-left text-xs">
                                            <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                                                <tr>
                                                    <th className="px-4 py-3.5 font-bold text-slate-500 uppercase">Curso</th>
                                                    <th className="px-4 py-3.5 font-bold text-slate-500 uppercase">Cuota</th>
                                                    <th className="px-4 py-3.5 font-bold text-slate-500 uppercase">Meses</th>
                                                    <th className="px-4 py-3.5 font-bold text-slate-500 uppercase">Total Cuotas</th>
                                                    <th className="px-4 py-3.5 font-bold text-slate-500 uppercase">Pagado</th>
                                                    <th className="px-4 py-3.5 font-bold text-slate-500 uppercase">Saldo Deudor</th>
                                                    <th className="px-4 py-3.5 font-bold text-slate-500 uppercase text-right">Estado</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                                                {statement.courses.map((course) => (
                                                    <tr key={course.enrollment_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/30 transition">
                                                        <td className="px-4 py-3">
                                                            <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 flex-wrap">
                                                                <span>{course.course_name}</span>
                                                                {course.academic_year && (
                                                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800/50">
                                                                        Ciclo {course.academic_year}
                                                                    </span>
                                                                )}
                                                                {course.scholarship_type && course.scholarship_type !== 'NONE' && (
                                                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/30">
                                                                        {course.scholarship_type === 'PERCENTAGE' ? `Beca ${course.scholarship_amount}%` : `Beca Q${course.scholarship_amount}`}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {course.schedule_label && (
                                                                <div className="text-[10px] text-slate-400">{course.schedule_label}</div>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">
                                                            <div>Q{course.effective_monthly_fee ?? course.monthly_fee}</div>
                                                            {course.effective_monthly_fee && course.effective_monthly_fee < course.monthly_fee && (
                                                                <div className="text-[10px] text-slate-400 line-through">Q{course.monthly_fee}</div>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                                                            <span>{course.months_paid} pag. / {course.months_elapsed} trans.</span>
                                                        </td>
                                                        <td className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">
                                                            Q{course.total_due}
                                                        </td>
                                                        <td className="px-4 py-3 font-bold text-emerald-600 dark:text-emerald-400">
                                                            Q{course.total_paid}
                                                        </td>
                                                        <td className="px-4 py-3 font-black text-rose-600 dark:text-rose-400">
                                                            {course.pending_amount > 0 ? `Q${course.pending_amount}` : '-'}
                                                        </td>
                                                        <td className="px-4 py-3 text-right">
                                                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                                                                course.is_solvent 
                                                                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' 
                                                                    : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                                                            }`}>
                                                                {course.is_solvent ? 'Solvente' : `${course.months_pending}m Mora`}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                                {statement.courses.length === 0 && (
                                                    <tr>
                                                        <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                                                            No hay inscripciones registradas.
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* TAB 3: PAYMENTS HISTORY TAB */}
                            {activeTab === 'payments' && (
                                <div className="space-y-4">
                                    <div className="overflow-x-auto rounded-2xl border border-slate-200/80 dark:border-slate-700/60 bg-white dark:bg-slate-800/80 shadow-sm">
                                        <table className="w-full text-left text-xs">
                                            <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                                                <tr>
                                                    <th className="px-4 py-3.5 font-bold text-slate-500 uppercase">Fecha</th>
                                                    <th className="px-4 py-3.5 font-bold text-slate-500 uppercase">Curso</th>
                                                    <th className="px-4 py-3.5 font-bold text-slate-500 uppercase">Concepto</th>
                                                    <th className="px-4 py-3.5 font-bold text-slate-500 uppercase">Monto</th>
                                                    <th className="px-4 py-3.5 font-bold text-slate-500 uppercase">Método</th>
                                                    <th className="px-4 py-3.5 font-bold text-slate-500 uppercase">Ref / Boleta</th>
                                                    <th className="px-4 py-3.5 font-bold text-slate-500 uppercase text-right">Recibo</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                                                {statement.payments.map((p) => (
                                                    <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/30 transition">
                                                        <td className="px-4 py-3 whitespace-nowrap text-slate-600 dark:text-slate-300 font-medium">
                                                            {new Date(p.payment_date).toLocaleDateString()}
                                                        </td>
                                                        <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">
                                                            {p.course_name}
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="px-2 py-0.5 rounded-md bg-brand-blue/10 text-brand-blue text-[10px] font-bold">
                                                                    {p.payment_type === 'TUITION' ? 'Colegiatura' : p.payment_type}
                                                                </span>
                                                                {p.tuition_month && (
                                                                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold">
                                                                        ({p.tuition_month})
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 font-black text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                                                            Q{p.amount}
                                                            {p.discount > 0 && (
                                                                <span className="block text-[10px] text-rose-500 font-semibold">Desc: Q{p.discount}</span>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                                                            <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-[10px] font-semibold">
                                                                {p.method}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 text-slate-500 font-mono text-[11px]">
                                                            {p.reference_number || '-'}
                                                        </td>
                                                        <td className="px-4 py-3 text-right">
                                                            <button
                                                                onClick={() => downloadInvoicePdf(p.id, statement.student.full_name)}
                                                                className="px-2.5 py-1 bg-brand-blue/10 hover:bg-brand-blue/20 text-brand-blue rounded-lg text-xs font-bold inline-flex items-center gap-1 transition"
                                                                title="Descargar Comprobante PDF"
                                                            >
                                                                <Printer className="h-3 w-3" />
                                                                <span>PDF</span>
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                                {statement.payments.length === 0 && (
                                                    <tr>
                                                        <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                                                            No se han registrado pagos para este estudiante.
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Footer Controls */}
                <div className="p-4 md:p-5 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
                    <div className="text-xs text-slate-400 text-center sm:text-left">
                        {statement?.summary && (
                            <span>Estado de cuenta verificado y conciliado al <strong>{new Date().toLocaleDateString('es-GT')}</strong></span>
                        )}
                    </div>
                    <div className="flex items-center gap-2.5 w-full sm:w-auto">
                        <button
                            onClick={exportStatementToExcel}
                            disabled={isLoading || !statement}
                            className="flex-1 sm:flex-none px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow-sm active:scale-95 flex items-center justify-center gap-1.5 disabled:opacity-50"
                        >
                            <Download className="h-4 w-4" />
                            <span>Exportar Estado (Excel)</span>
                        </button>
                        {statement && statement.summary.total_pending > 0 && onPayBalance && (
                            <button
                                onClick={handleActionPay}
                                className="flex-1 sm:flex-none px-4 py-2.5 bg-gradient-to-r from-brand-purple to-brand-blue text-white rounded-xl text-xs font-bold transition shadow-md shadow-brand-purple/20 active:scale-95 flex items-center justify-center gap-1.5"
                            >
                                <CreditCard className="h-4 w-4" />
                                <span>Cobrar Saldo (Q{statement.summary.total_pending})</span>
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            className="flex-1 sm:flex-none px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 rounded-xl text-xs font-bold transition"
                        >
                            Cerrar
                        </button>
                    </div>
                </div>

            </div>
        </div>,
        document.body
    );
};

export default StudentStatementModal;
