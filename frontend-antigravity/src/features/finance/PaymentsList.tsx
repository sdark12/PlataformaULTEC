import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getPayments, createPayment, updatePayment, deletePayment } from '../../features/finance/paymentService';
import { getEnrollments } from '../../features/academic/academicService';
import { downloadInvoicePdf } from '../../features/finance/invoiceService';
import { Plus, Loader2, DollarSign, Edit2, Trash2, Search, CheckCircle, Printer, X } from 'lucide-react';

const PaymentsList = () => {
    const queryClient = useQueryClient();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [newPayment, setNewPayment] = useState({ enrollment_id: '', amount: '', method: 'CASH', reference_number: '', description: '', tuition_month: '', payment_type: 'TUITION', discount: '0' });
    const [selectedPayment, setSelectedPayment] = useState<any>(null);
    const [lastInvoice, setLastInvoice] = useState<{ id: number; invoice_number: string } | null>(null);

    const { data: payments, isLoading } = useQuery({
        queryKey: ['payments'],
        queryFn: getPayments,
    });

    const { data: enrollments } = useQuery({
        queryKey: ['enrollments'],
        queryFn: getEnrollments,
        enabled: isModalOpen
    });

    const createMutation = useMutation({
        mutationFn: createPayment,
        onSuccess: (data: any) => {
            queryClient.invalidateQueries({ queryKey: ['payments'] });
            queryClient.invalidateQueries({ queryKey: ['invoices'] });
            if (data.invoice_id) {
                setLastInvoice({ id: data.invoice_id, invoice_number: data.invoice_number || 'REC-NEW' });
            } else {
                setIsModalOpen(false);
                setNewPayment({ enrollment_id: '', amount: '', method: 'CASH', reference_number: '', description: '', tuition_month: '', payment_type: 'TUITION', discount: '0' });
            }
            setSearchTerm('');
        },
        onError: (err: any) => {
            alert(err.response?.data?.message || "Error al registrar pago");
        }
    });

    const updateMutation = useMutation({
        mutationFn: (data: any) => updatePayment(selectedPayment.id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['payments'] });
            setIsModalOpen(false);
            setSelectedPayment(null);
            setSearchTerm('');
            setNewPayment({ enrollment_id: '', amount: '', method: 'CASH', reference_number: '', description: '', tuition_month: '', payment_type: 'TUITION', discount: '0' });
        },
        onError: (err: any) => {
            alert(err.response?.data?.message || "Error al actualizar pago");
        }
    });

    const deleteMutation = useMutation({
        mutationFn: deletePayment,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['payments'] });
        },
        onError: (err: any) => {
            alert(err.response?.data?.message || "Error al eliminar pago");
        }
    });

    const handleDelete = (id: string) => {
        if (window.confirm('¿Está seguro de eliminar este registro de pago?')) {
            deleteMutation.mutate(id);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const data = {
            enrollment_id: newPayment.enrollment_id,
            amount: Number(newPayment.amount),
            method: newPayment.method,
            reference_number: newPayment.reference_number,
            description: newPayment.description,
            tuition_month: newPayment.payment_type === 'TUITION' ? newPayment.tuition_month : undefined,
            payment_type: newPayment.payment_type,
            discount: Number(newPayment.discount)
        };

        if (selectedPayment) {
            updateMutation.mutate(data);
        } else {
            createMutation.mutate(data);
        }
    };

    const handleEdit = (payment: any) => {
        setSelectedPayment(payment);
        setNewPayment({
            enrollment_id: payment.enrollment_id || '',
            amount: payment.amount.toString(),
            method: payment.method,
            reference_number: payment.reference_number || '',
            description: payment.description || '',
            tuition_month: payment.tuition_month || '',
            payment_type: payment.payment_type || 'TUITION',
            discount: payment.discount ? payment.discount.toString() : '0'
        });
        setIsModalOpen(true);
    };

    const handleNewPayment = () => {
        setSelectedPayment(null);
        setLastInvoice(null);
        setSearchTerm('');
        setNewPayment({ enrollment_id: '', amount: '', method: 'CASH', reference_number: '', description: '', tuition_month: '', payment_type: 'TUITION', discount: '0' });
        setIsModalOpen(true);
    };

    const filteredEnrollments = enrollments?.filter((e: any) =>
        e.student_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.course_name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin h-8 w-8 text-blue-600" /></div>;

    return (
        <div>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div>
                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Registro de Pagos</h2>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">Control de ingresos y facturación.</p>
                </div>
                <button
                    onClick={handleNewPayment}
                    className="flex items-center space-x-2 px-6 py-3 bg-brand-blue text-white rounded-xl hover:bg-blue-600 transition-all shadow-[0_0_15px_rgba(13,89,242,0.4)] active:scale-95 font-semibold border border-white/10"
                >
                    <Plus className="h-5 w-5" />
                    <span>Registrar Pago</span>
                </button>
            </div>

            <div className="glass-card rounded-3xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50/50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700/50">
                            <tr>
                                <th className="px-6 py-5 font-bold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-widest">Estudiante</th>
                                <th className="px-6 py-5 font-bold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-widest">Curso</th>
                                <th className="px-6 py-5 font-bold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-widest">Concepto</th>
                                <th className="px-6 py-5 font-bold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-widest">Monto</th>
                                <th className="px-6 py-5 font-bold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-widest">Método</th>
                                <th className="px-6 py-5 font-bold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-widest">Fecha</th>
                                <th className="px-6 py-5 font-bold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-widest text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 bg-white/50 dark:bg-transparent">
                            {payments?.map((payment: any) => (
                                <tr key={payment.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition group">
                                    <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">{payment.student_name}</td>
                                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300 bg-slate-50/50 dark:bg-slate-800/30 font-medium">{payment.course_name}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center space-x-2 mb-1">
                                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${payment.payment_type === 'TUITION' ? 'bg-brand-blue/10 text-brand-blue border-brand-blue/20' :
                                                payment.payment_type === 'ENROLLMENT' ? 'bg-brand-purple/10 text-brand-purple border-brand-purple/20' :
                                                    payment.payment_type === 'UNIFORM' ? 'bg-brand-teal/10 text-brand-teal border-brand-teal/20' :
                                                        payment.payment_type === 'MATERIALS' ? 'bg-brand-warning/10 text-brand-warning border-brand-warning/20' :
                                                            'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-600'
                                                }`}>
                                                {payment.payment_type === 'TUITION' ? 'Mensualidad' :
                                                    payment.payment_type === 'ENROLLMENT' ? 'Inscripción' :
                                                        payment.payment_type === 'UNIFORM' ? 'Uniforme' :
                                                            payment.payment_type === 'MATERIALS' ? 'Materiales' : 'Otro'}
                                            </span>
                                            {payment.payment_type === 'TUITION' && payment.tuition_month && (
                                                <span className="text-xs text-slate-500 dark:text-slate-400 font-bold border border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded-full bg-white/50 dark:bg-slate-800/50">
                                                    {new Date(payment.tuition_month + '-01T00:00:00').toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[150px]">{payment.description || '-'}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="font-bold text-brand-success bg-brand-success/10 px-2 py-1 rounded-lg inline-block border border-brand-success/20">Q{payment.amount}</div>
                                        {Number(payment.discount) > 0 && (
                                            <div className="text-xs font-bold text-brand-danger bg-brand-danger/10 px-2 py-0.5 rounded-md inline-block mt-1 border border-brand-danger/20"> Desc: Q{payment.discount}</div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                                        <span className="text-xs font-bold px-2 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg whitespace-nowrap">{payment.method}</span>
                                    </td>
                                    <td className="px-6 py-4 text-slate-500 dark:text-slate-400 font-medium whitespace-nowrap">
                                        {new Date(payment.payment_date).toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => handleEdit(payment)}
                                                className="p-2 text-slate-400 hover:text-brand-blue hover:bg-brand-blue/10 rounded-lg transition-colors"
                                                title="Editar Pago"
                                            >
                                                <Edit2 className="h-4 w-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(payment.id)}
                                                className="p-2 text-slate-400 hover:text-brand-danger hover:bg-brand-danger/10 rounded-lg transition-colors"
                                                title="Eliminar Pago"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {payments?.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
                                        No hay pagos registrados.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setIsModalOpen(false)} />
                    <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl relative z-10 overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
                        {lastInvoice ? (
                            <div className="text-center p-8">
                                <div className="flex justify-center mb-6">
                                    <div className="bg-brand-success/20 p-4 rounded-full border border-brand-success/30 shadow-[0_0_20px_rgba(34,197,94,0.2)]">
                                        <CheckCircle className="h-16 w-16 text-brand-success" />
                                    </div>
                                </div>
                                <h3 className="text-3xl font-bold text-slate-900 mb-2">¡Pago Registrado!</h3>
                                <p className="text-slate-500 mb-8 font-medium">El pago se ha procesado correctamente y la factura ha sido generada.</p>

                                <div className="space-y-4">
                                    <button
                                        onClick={() => downloadInvoicePdf(lastInvoice.id, lastInvoice.invoice_number)}
                                        className="w-full flex items-center justify-center space-x-2 py-4 bg-brand-blue text-white rounded-xl font-bold hover:bg-blue-600 transition-all shadow-[0_0_15px_rgba(13,89,242,0.3)] active:scale-95 text-lg"
                                    >
                                        <Printer className="h-6 w-6" />
                                        <span>Imprimir Factura / Recibo</span>
                                    </button>
                                    <button
                                        onClick={() => {
                                            setIsModalOpen(false);
                                            setLastInvoice(null);
                                            setNewPayment({ enrollment_id: '', amount: '', method: 'CASH', reference_number: '', description: '', tuition_month: '', payment_type: 'TUITION', discount: '0' });
                                        }}
                                        className="w-full py-4 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-colors text-lg"
                                    >
                                        Cerrar
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="bg-gradient-to-r from-brand-blue to-brand-teal p-6 text-white border-b border-white/10 shrink-0">
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <h3 className="text-2xl font-bold">{selectedPayment ? 'Editar Pago' : 'Registrar Pago'}</h3>
                                            <p className="text-blue-100 text-sm mt-1">{selectedPayment ? 'Modifique los datos del cobro.' : 'Genere un nuevo cobro.'}</p>
                                        </div>
                                        <button onClick={() => setIsModalOpen(false)} className="text-white/80 hover:text-white bg-black/10 hover:bg-black/20 p-2 rounded-full transition-colors">
                                            <X className="h-6 w-6" />
                                        </button>
                                    </div>
                                </div>
                                <form onSubmit={handleSubmit} className="p-8 space-y-6 overflow-y-auto custom-scrollbar">
                                    {!selectedPayment && (
                                        <div className="relative">
                                            <label className="block text-sm font-semibold text-slate-700 ml-1">Inscripción (Buscar Estudiante / Curso)</label>
                                            <div className="relative mt-2">
                                                <Search className="absolute left-4 top-3.5 h-5 w-5 text-slate-400 group-focus-within:text-brand-blue transition-colors" />
                                                <input
                                                    type="text"
                                                    className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-brand-blue/10 focus:border-brand-blue outline-none transition-all placeholder:text-slate-400"
                                                    placeholder="Escriba para buscar..."
                                                    value={searchTerm}
                                                    onChange={(e) => {
                                                        setSearchTerm(e.target.value);
                                                        setIsDropdownOpen(true);
                                                        setNewPayment({ ...newPayment, enrollment_id: '' });
                                                    }}
                                                    onFocus={() => setIsDropdownOpen(true)}
                                                    onBlur={() => setTimeout(() => setIsDropdownOpen(false), 200)}
                                                />
                                            </div>

                                            {isDropdownOpen && (
                                                <div className="absolute z-10 w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 overflow-y-auto overflow-hidden animate-in fade-in slide-in-from-top-1">
                                                    {filteredEnrollments && filteredEnrollments.length > 0 ? (
                                                        filteredEnrollments.map((e: any) => (
                                                            <div
                                                                key={e.id}
                                                                className="px-4 py-3 hover:bg-blue-50 cursor-pointer border-b border-slate-50 last:border-0 transition-colors"
                                                                onClick={() => {
                                                                    setNewPayment({ ...newPayment, enrollment_id: e.id });
                                                                    setSearchTerm(`${e.student_name} - ${e.course_name}`);
                                                                    setIsDropdownOpen(false);
                                                                }}
                                                            >
                                                                <div className="font-bold text-slate-900">{e.student_name}</div>
                                                                <div className="text-sm font-medium text-slate-500">{e.course_name}</div>
                                                            </div>
                                                        ))
                                                    ) : (
                                                        <div className="px-5 py-4 text-sm text-slate-500 text-center bg-slate-50/50">No se encontraron resultados</div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    <div className="grid grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-sm font-semibold text-slate-700 ml-1">Tipo de Cobro</label>
                                            <select
                                                required
                                                className="w-full mt-2 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-brand-blue/10 focus:border-brand-blue outline-none transition-all text-slate-700"
                                                value={newPayment.payment_type}
                                                onChange={(e) => setNewPayment({ ...newPayment, payment_type: e.target.value })}
                                            >
                                                <option value="TUITION">Mensualidad</option>
                                                <option value="ENROLLMENT">Inscripción</option>
                                                <option value="UNIFORM">Uniforme(s)</option>
                                                <option value="MATERIALS">Materiales</option>
                                                <option value="OTHER">Otro concepto</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-semibold text-slate-700 ml-1">Descuento aplicado (Q)</label>
                                            <input
                                                type="number"
                                                min="0"
                                                className="w-full mt-2 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-brand-blue/10 focus:border-brand-blue outline-none transition-all"
                                                value={newPayment.discount}
                                                onChange={(e) => setNewPayment({ ...newPayment, discount: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 ml-1">Monto Neto a Pagar (Q)</label>
                                        <div className="relative mt-2">
                                            <DollarSign className="absolute left-4 top-3.5 h-5 w-5 text-slate-400 group-focus-within:text-brand-success transition-colors" />
                                            <input
                                                type="number"
                                                required
                                                min="0"
                                                className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-brand-success/20 focus:border-brand-success outline-none transition-all font-bold text-brand-success text-lg"
                                                value={newPayment.amount}
                                                onChange={(e) => setNewPayment({ ...newPayment, amount: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 ml-1">Método de Pago</label>
                                        <select
                                            required
                                            className="w-full mt-2 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-brand-blue/10 focus:border-brand-blue outline-none transition-all text-slate-700"
                                            value={newPayment.method}
                                            onChange={(e) => setNewPayment({ ...newPayment, method: e.target.value })}
                                        >
                                            <option value="CASH">Efectivo</option>
                                            <option value="TRANSFER">Transferencia</option>
                                            <option value="CARD">Tarjeta</option>
                                        </select>
                                    </div>
                                    {newPayment.payment_type === 'TUITION' && (
                                        <div>
                                            <label className="block text-sm font-semibold text-slate-700 ml-1">Mes de Colegiatura</label>
                                            <input
                                                type="month"
                                                required
                                                className="w-full mt-2 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-brand-blue/10 focus:border-brand-blue outline-none transition-all text-slate-700"
                                                value={newPayment.tuition_month}
                                                onChange={(e) => setNewPayment({ ...newPayment, tuition_month: e.target.value })}
                                            />
                                        </div>
                                    )}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-sm font-semibold text-slate-700 ml-1">Descripción</label>
                                            <input
                                                type="text"
                                                className="w-full mt-2 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-brand-blue/10 focus:border-brand-blue outline-none transition-all placeholder:text-slate-400"
                                                placeholder="Ej. Colegiatura, Inscripción..."
                                                value={newPayment.description}
                                                onChange={(e) => setNewPayment({ ...newPayment, description: e.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-semibold text-slate-700 ml-1">Referencia (Opcional)</label>
                                            <input
                                                type="text"
                                                className="w-full mt-2 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-brand-blue/10 focus:border-brand-blue outline-none transition-all placeholder:text-slate-400"
                                                placeholder="No. Boleta / Transacción"
                                                value={newPayment.reference_number}
                                                onChange={(e) => setNewPayment({ ...newPayment, reference_number: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                    <div className="flex space-x-4 pt-6 mt-4 border-t border-slate-100">
                                        <button
                                            type="button"
                                            onClick={() => setIsModalOpen(false)}
                                            className="flex-1 px-6 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors"
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={createMutation.isPending || updateMutation.isPending}
                                            className="flex-1 px-6 py-3 bg-brand-blue text-white font-bold rounded-xl hover:bg-blue-600 shadow-[0_0_15px_rgba(13,89,242,0.3)] transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center space-x-2"
                                        >
                                            {createMutation.isPending || updateMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <span>{selectedPayment ? 'Actualizar Pago' : 'Registrar Pago'}</span>}
                                        </button>
                                    </div>
                                </form>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default PaymentsList;
