import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
    X, Loader2, Users, CheckCircle2, AlertCircle, 
    Printer, CreditCard, Search
} from 'lucide-react';
import { getCourses, getEnrollments } from '../academic/academicService';
import type { Course } from '../academic/academicService';
import { createBulkGroupPayment } from './paymentService';
import type { BulkPaymentPayload, BulkPaymentResponse } from './paymentService';
import { downloadInvoicePdf } from './invoiceService';
import { getCurrentUser } from '../auth/authService';

interface BulkPaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}

interface StudentRowState {
    student_id: string;
    enrollment_id: string;
    student_name: string;
    selected: boolean;
    amount: string;
    discount: string;
    reference_number: string;
    notes: string;
    scholarship_label?: string;
}

const BulkPaymentModal: React.FC<BulkPaymentModalProps> = ({
    isOpen,
    onClose,
    onSuccess
}) => {
    const queryClient = useQueryClient();
    const user = getCurrentUser();

    // Form inputs
    const [selectedCourseId, setSelectedCourseId] = useState<string>('');
    const [branchId] = useState<string>(user?.branch_id || '');
    const [tuitionMonth, setTuitionMonth] = useState<string>(() => {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        return `${year}-${month}`;
    });
    const [method, setMethod] = useState<string>('CASH');
    const [referencePrefix, setReferencePrefix] = useState<string>('');
    const [studentSearch, setStudentSearch] = useState<string>('');
    const [studentRows, setStudentRows] = useState<StudentRowState[]>([]);
    const [resultData, setResultData] = useState<BulkPaymentResponse | null>(null);

    // Queries
    const { data: courses } = useQuery<Course[]>({
        queryKey: ['courses'],
        queryFn: getCourses,
        enabled: isOpen
    });

    const { data: enrollments } = useQuery<any[]>({
        queryKey: ['enrollments'],
        queryFn: getEnrollments,
        enabled: isOpen
    });

    const selectedCourse = useMemo(() => {
        return courses?.find(c => c.id === selectedCourseId);
    }, [courses, selectedCourseId]);

    // When course changes, initialize student rows from enrollments
    useEffect(() => {
        if (!selectedCourseId || !enrollments) {
            setStudentRows([]);
            return;
        }

        const rawFee = Number(selectedCourse?.monthly_fee || 150);
        
        // Filter active enrollments for the selected course
        const activeEnrolled = enrollments.filter((e: any) => 
            e.course_id === selectedCourseId && (e.is_active === true || e.is_active === undefined)
        );

        const rows: StudentRowState[] = activeEnrolled.map((e: any) => {
            let discountVal = 0;
            let scholarshipLabel = '';
            if (e.scholarship_type === 'PERCENTAGE' && Number(e.scholarship_amount) > 0) {
                discountVal = (rawFee * Number(e.scholarship_amount)) / 100;
                scholarshipLabel = `Beca ${e.scholarship_amount}%`;
            } else if (e.scholarship_type === 'FIXED_AMOUNT' && Number(e.scholarship_amount) > 0) {
                discountVal = Number(e.scholarship_amount);
                scholarshipLabel = `Beca Q${e.scholarship_amount}`;
            }

            const netAmount = Math.max(0, rawFee - discountVal);

            return {
                student_id: e.student_id,
                enrollment_id: e.id,
                student_name: e.student_name,
                selected: true,
                amount: String(netAmount),
                discount: String(discountVal),
                reference_number: '',
                notes: scholarshipLabel ? `Beneficio: ${scholarshipLabel}` : '',
                scholarship_label: scholarshipLabel
            };
        });

        setStudentRows(rows);
    }, [selectedCourseId, enrollments, selectedCourse]);

    // Mutation
    const bulkMutation = useMutation({
        mutationFn: (payload: BulkPaymentPayload) => createBulkGroupPayment(payload),
        onSuccess: (data: BulkPaymentResponse) => {
            queryClient.invalidateQueries({ queryKey: ['payments'] });
            queryClient.invalidateQueries({ queryKey: ['invoices'] });
            queryClient.invalidateQueries({ queryKey: ['pendingPaymentsReport'] });
            queryClient.invalidateQueries({ queryKey: ['financialReport'] });
            queryClient.invalidateQueries({ queryKey: ['reports-dashboard'] });
            setResultData(data);
            if (onSuccess) onSuccess();
        },
        onError: (err: any) => {
            alert(err.response?.data?.message || 'Error al procesar el cobro masivo.');
        }
    });

    if (!isOpen) return null;

    // Filter students by search term
    const filteredRows = studentRows.filter(r => 
        r.student_name.toLowerCase().includes(studentSearch.toLowerCase())
    );

    const selectedCount = studentRows.filter(r => r.selected).length;
    const totalAmount = studentRows
        .filter(r => r.selected)
        .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

    const handleToggleAll = () => {
        const allSelected = studentRows.every(r => r.selected);
        setStudentRows(prev => prev.map(r => ({ ...r, selected: !allSelected })));
    };

    const handleRowToggle = (student_id: string) => {
        setStudentRows(prev => prev.map(r => 
            r.student_id === student_id ? { ...r, selected: !r.selected } : r
        ));
    };

    const handleRowChange = (student_id: string, field: keyof StudentRowState, value: any) => {
        setStudentRows(prev => prev.map(r => 
            r.student_id === student_id ? { ...r, [field]: value } : r
        ));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!selectedCourseId) {
            alert('Por favor selecciona un curso.');
            return;
        }

        const selectedToPay = studentRows.filter(r => r.selected && Number(r.amount) > 0);
        if (selectedToPay.length === 0) {
            alert('Debes seleccionar al menos un estudiante con un monto mayor a 0.');
            return;
        }

        const payload: BulkPaymentPayload = {
            course_id: selectedCourseId,
            tuition_month: tuitionMonth,
            method,
            reference_prefix: referencePrefix,
            branch_id: branchId || undefined,
            payments: selectedToPay.map(r => ({
                student_id: r.student_id,
                enrollment_id: r.enrollment_id,
                amount: Number(r.amount),
                discount: Number(r.discount || 0),
                reference_number: r.reference_number || undefined,
                notes: r.notes || undefined
            }))
        };

        bulkMutation.mutate(payload);
    };

    const handleResetAndClose = () => {
        setResultData(null);
        setSelectedCourseId('');
        setStudentRows([]);
        setStudentSearch('');
        onClose();
    };

    return createPortal(
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-3 sm:p-4 md:p-6">
            <div 
                className="fixed inset-0 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300"
                onClick={handleResetAndClose}
            />

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-4xl shadow-2xl relative z-10 overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[92vh]">

                {/* SUCCESS SCREEN */}
                {resultData ? (
                    <div className="p-8 md:p-12 text-center flex flex-col items-center justify-center space-y-6 overflow-y-auto custom-scrollbar">
                        <div className="w-20 h-20 rounded-3xl bg-emerald-500/20 text-emerald-500 flex items-center justify-center border border-emerald-500/30 shadow-[0_0_30px_rgba(16,185,129,0.2)]">
                            <CheckCircle2 className="h-10 w-10" />
                        </div>

                        <div className="space-y-2">
                            <h3 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white">
                                ¡Cobro Masivo Exitoso!
                            </h3>
                            <p className="text-slate-500 text-sm max-w-md mx-auto">
                                Se registraron exitosamente <strong className="text-slate-800 dark:text-white">{resultData.count} pagos</strong> para el curso <strong className="text-brand-blue">{resultData.course_name}</strong> correspondientes al mes <strong className="text-brand-teal">{resultData.tuition_month}</strong>.
                            </p>
                        </div>

                        {/* Summary Pill */}
                        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 max-w-md w-full flex items-center justify-between">
                            <span className="text-xs text-slate-500 font-bold uppercase">Total Recaudado</span>
                            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                                Q{resultData.total_amount.toLocaleString('es-GT', { minimumFractionDigits: 2 })}
                            </span>
                        </div>

                        {/* Generated Invoices List */}
                        <div className="w-full max-w-lg text-left space-y-3">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                                Recibos Generados ({resultData.results.length})
                            </h4>
                            <div className="max-h-48 overflow-y-auto custom-scrollbar divide-y divide-slate-100 dark:divide-slate-800 bg-slate-50 dark:bg-slate-900 rounded-2xl p-2 border border-slate-200 dark:border-slate-800 text-xs">
                                {resultData.results.map((r, i) => (
                                    <div key={i} className="p-2 flex items-center justify-between">
                                        <div className="font-mono text-slate-700 dark:text-slate-300 font-semibold">
                                            {r.invoice_number || `REC-${i + 1}`}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-emerald-600 dark:text-emerald-400">Q{r.amount}</span>
                                            {r.invoice_id && (
                                                <button
                                                    onClick={() => downloadInvoicePdf(r.payment_id || r.invoice_id!, r.invoice_number || 'Recibo')}
                                                    className="p-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg border border-slate-200 dark:border-slate-700"
                                                    title="Imprimir Recibo"
                                                >
                                                    <Printer className="h-3.5 w-3.5" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="flex items-center gap-3 w-full max-w-sm pt-4">
                            <button
                                onClick={handleResetAndClose}
                                className="w-full py-3.5 bg-brand-blue hover:bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-brand-blue/20 transition active:scale-95 text-sm"
                            >
                                Finalizar y Cerrar
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* HEADER */}
                        <div className="bg-gradient-to-r from-brand-purple via-slate-900 to-brand-blue p-5 md:p-6 text-white border-b border-white/10 shrink-0 flex items-center justify-between">
                            <div className="flex items-center gap-3.5">
                                <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center">
                                    <Users className="h-6 w-6 text-brand-teal" />
                                </div>
                                <div>
                                    <h3 className="text-xl md:text-2xl font-black tracking-tight">Cobro Masivo por Curso</h3>
                                    <p className="text-xs text-blue-100/80 mt-0.5">Liquida la colegiatura mensual de un grupo de estudiantes en lote.</p>
                                </div>
                            </div>
                            <button 
                                onClick={handleResetAndClose} 
                                className="text-white/80 hover:text-white bg-black/20 hover:bg-black/30 p-2.5 rounded-xl transition-colors"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="flex-1 overflow-hidden flex flex-col">
                            {/* TOP CONFIGURATION BAR */}
                            <div className="p-4 md:p-5 bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
                                {/* Course Selector */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                        Curso *
                                    </label>
                                    <select
                                        required
                                        className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-white focus:ring-2 focus:ring-brand-blue/20 outline-none"
                                        value={selectedCourseId}
                                        onChange={(e) => setSelectedCourseId(e.target.value)}
                                    >
                                        <option value="">Selecciona un curso...</option>
                                        {courses?.map((c) => (
                                            <option key={c.id} value={c.id}>
                                                {c.name} (Q{c.monthly_fee}/mes)
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Month to Charge */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                        Mes a Cobrar *
                                    </label>
                                    <input
                                        type="month"
                                        required
                                        className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-white focus:ring-2 focus:ring-brand-blue/20 outline-none"
                                        value={tuitionMonth}
                                        onChange={(e) => setTuitionMonth(e.target.value)}
                                    />
                                </div>

                                {/* Payment Method */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                        Método Predeterminado
                                    </label>
                                    <select
                                        className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-white focus:ring-2 focus:ring-brand-blue/20 outline-none"
                                        value={method}
                                        onChange={(e) => setMethod(e.target.value as any)}
                                    >
                                        <option value="CASH">Efectivo</option>
                                        <option value="TRANSFER">Transferencia / Depósito</option>
                                        <option value="CARD">Tarjeta</option>
                                    </select>
                                </div>

                                {/* Reference Prefix */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                        Prefijo Boleta / Ref
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Ej. DEP-SEP"
                                        className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-white focus:ring-2 focus:ring-brand-blue/20 outline-none"
                                        value={referencePrefix}
                                        onChange={(e) => setReferencePrefix(e.target.value)}
                                    />
                                </div>
                            </div>

                            {/* MIDDLE: STUDENTS LIST */}
                            <div className="flex-1 p-4 md:p-6 overflow-y-auto custom-scrollbar space-y-3">
                                {!selectedCourseId ? (
                                    <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                                        <Users className="h-12 w-12 mb-3 opacity-40" />
                                        <p className="text-sm font-semibold">Selecciona un curso arriba para cargar a los estudiantes inscritos.</p>
                                    </div>
                                ) : studentRows.length === 0 ? (
                                    <div className="text-center py-16 text-slate-400">
                                        <AlertCircle className="h-10 w-10 text-amber-500 mx-auto mb-2" />
                                        <p className="text-sm font-bold text-slate-700 dark:text-slate-300">No hay estudiantes activos matriculados en este curso.</p>
                                    </div>
                                ) : (
                                    <>
                                        {/* Action Subheader */}
                                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-2">
                                            <div className="flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={handleToggleAll}
                                                    className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition"
                                                >
                                                    {studentRows.every(r => r.selected) ? 'Desmarcar Todos' : 'Seleccionar Todos'}
                                                </button>
                                                <span className="text-xs text-slate-500">
                                                    {selectedCount} de {studentRows.length} alumnos seleccionados
                                                </span>
                                            </div>

                                            <div className="relative w-full sm:w-64">
                                                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                                                <input
                                                    type="text"
                                                    placeholder="Filtrar por nombre..."
                                                    className="w-full pl-9 pr-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-brand-blue/20 outline-none"
                                                    value={studentSearch}
                                                    onChange={(e) => setStudentSearch(e.target.value)}
                                                />
                                            </div>
                                        </div>

                                        {/* Students Table */}
                                        <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-850 shadow-sm">
                                            <table className="w-full text-left text-xs">
                                                <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                                                    <tr>
                                                        <th className="px-4 py-3 w-10 text-center">
                                                            <input
                                                                type="checkbox"
                                                                className="w-4 h-4 text-brand-blue rounded border-slate-300 focus:ring-brand-blue"
                                                                checked={studentRows.length > 0 && studentRows.every(r => r.selected)}
                                                                onChange={handleToggleAll}
                                                            />
                                                        </th>
                                                        <th className="px-4 py-3 font-bold text-slate-500 uppercase">Estudiante</th>
                                                        <th className="px-4 py-3 font-bold text-slate-500 uppercase w-32">Monto (Q)</th>
                                                        <th className="px-4 py-3 font-bold text-slate-500 uppercase w-28">Desc (Q)</th>
                                                        <th className="px-4 py-3 font-bold text-slate-500 uppercase w-36">Ref / Boleta</th>
                                                        <th className="px-4 py-3 font-bold text-slate-500 uppercase">Nota</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                    {filteredRows.map((row) => (
                                                        <tr 
                                                            key={row.student_id} 
                                                            className={`transition ${row.selected ? 'bg-blue-50/30 dark:bg-blue-950/20' : 'opacity-60 hover:opacity-100'}`}
                                                        >
                                                            <td className="px-4 py-3 text-center">
                                                                <input
                                                                    type="checkbox"
                                                                    className="w-4 h-4 text-brand-blue rounded border-slate-300 focus:ring-brand-blue"
                                                                    checked={row.selected}
                                                                    onChange={() => handleRowToggle(row.student_id)}
                                                                />
                                                            </td>
                                                            <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">
                                                                <div className="flex items-center gap-2 flex-wrap">
                                                                    <span>{row.student_name}</span>
                                                                    {row.scholarship_label && (
                                                                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-600 dark:text-amber-300 font-bold border border-amber-500/30">
                                                                            {row.scholarship_label}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    disabled={!row.selected}
                                                                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-emerald-600 dark:text-emerald-400 outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-40"
                                                                    value={row.amount}
                                                                    onChange={(e) => handleRowChange(row.student_id, 'amount', e.target.value)}
                                                                />
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    disabled={!row.selected}
                                                                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-rose-500 outline-none focus:ring-2 focus:ring-rose-500/20 disabled:opacity-40"
                                                                    value={row.discount}
                                                                    onChange={(e) => handleRowChange(row.student_id, 'discount', e.target.value)}
                                                                />
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <input
                                                                    type="text"
                                                                    placeholder="No. Boleta"
                                                                    disabled={!row.selected}
                                                                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-brand-blue/20 disabled:opacity-40"
                                                                    value={row.reference_number}
                                                                    onChange={(e) => handleRowChange(row.student_id, 'reference_number', e.target.value)}
                                                                />
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <input
                                                                    type="text"
                                                                    placeholder="Opcional"
                                                                    disabled={!row.selected}
                                                                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-500 outline-none focus:ring-2 focus:ring-brand-blue/20 disabled:opacity-40"
                                                                    value={row.notes}
                                                                    onChange={(e) => handleRowChange(row.student_id, 'notes', e.target.value)}
                                                                />
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* FOOTER ACTION BAR */}
                            <div className="p-4 md:p-5 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0">
                                <div className="flex items-center gap-4 text-xs text-slate-500 w-full sm:w-auto justify-between sm:justify-start">
                                    <span>
                                        Alumnos a cobrar: <strong className="text-slate-900 dark:text-white">{selectedCount}</strong>
                                    </span>
                                    <span className="text-slate-300 dark:text-slate-700">•</span>
                                    <span>
                                        Total a Recaudar:{' '}
                                        <strong className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                                            Q{totalAmount.toLocaleString('es-GT', { minimumFractionDigits: 2 })}
                                        </strong>
                                    </span>
                                </div>

                                <div className="flex items-center gap-2.5 w-full sm:w-auto">
                                    <button
                                        type="button"
                                        onClick={handleResetAndClose}
                                        className="flex-1 sm:flex-none px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 rounded-xl text-xs font-bold transition"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={bulkMutation.isPending || selectedCount === 0 || totalAmount <= 0}
                                        className="flex-1 sm:flex-none px-6 py-2.5 bg-gradient-to-r from-brand-purple to-brand-blue hover:opacity-95 text-white font-bold rounded-xl text-xs shadow-lg shadow-brand-purple/20 transition active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        {bulkMutation.isPending ? (
                                            <>
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                <span>Procesando {selectedCount} pagos...</span>
                                            </>
                                        ) : (
                                            <>
                                                <CreditCard className="h-4 w-4" />
                                                <span>Registrar {selectedCount} Pagos</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </form>
                    </>
                )}

            </div>
        </div>,
        document.body
    );
};

export default BulkPaymentModal;
