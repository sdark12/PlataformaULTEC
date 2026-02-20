import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getPayments, createPayment, updatePayment, deletePayment } from '../../features/finance/paymentService';
import { getEnrollments } from '../../features/academic/academicService';
import { Plus, Loader2, DollarSign, Edit2, Trash2 } from 'lucide-react';

const PaymentsList = () => {
    const queryClient = useQueryClient();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newPayment, setNewPayment] = useState({ enrollment_id: '', amount: '', method: 'CASH', reference_number: '', description: '', tuition_month: '' });
    const [selectedPayment, setSelectedPayment] = useState<any>(null);

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
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['payments'] });
            setIsModalOpen(false);
            setNewPayment({ enrollment_id: '', amount: '', method: 'CASH', reference_number: '', description: '', tuition_month: '' });
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
            setNewPayment({ enrollment_id: '', amount: '', method: 'CASH', reference_number: '', description: '', tuition_month: '' });
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
            tuition_month: newPayment.tuition_month
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
            tuition_month: payment.tuition_month || ''
        });
        setIsModalOpen(true);
    };

    const handleNewPayment = () => {
        setSelectedPayment(null);
        setNewPayment({ enrollment_id: '', amount: '', method: 'CASH', reference_number: '', description: '', tuition_month: '' });
        setIsModalOpen(true);
    };

    if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin h-8 w-8 text-blue-600" /></div>;

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-slate-800">Pagos</h2>
                <button
                    onClick={handleNewPayment}
                    className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                    <Plus className="h-4 w-4" />
                    <span>Registrar Pago</span>
                </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th className="px-6 py-4 font-medium text-slate-500">Estudiante</th>
                            <th className="px-6 py-4 font-medium text-slate-500">Curso</th>
                            <th className="px-6 py-4 font-medium text-slate-500">Mes / Desc</th>
                            <th className="px-6 py-4 font-medium text-slate-500">Monto</th>
                            <th className="px-6 py-4 font-medium text-slate-500">Método</th>
                            <th className="px-6 py-4 font-medium text-slate-500">Fecha</th>
                            <th className="px-6 py-4 font-medium text-slate-500">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {payments?.map((payment: any) => (
                            <tr key={payment.id} className="hover:bg-slate-50 transition">
                                <td className="px-6 py-4 font-medium text-slate-900">{payment.student_name}</td>
                                <td className="px-6 py-4 text-slate-600">{payment.course_name}</td>
                                <td className="px-6 py-4">
                                    <div className="text-sm font-medium text-slate-900">{payment.tuition_month ? new Date(payment.tuition_month + '-01T00:00:00').toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : '-'}</div>
                                    <div className="text-xs text-slate-500 truncate max-w-[150px]">{payment.description || '-'}</div>
                                </td>
                                <td className="px-6 py-4 font-bold text-green-600">Q{payment.amount}</td>
                                <td className="px-6 py-4 text-slate-600">
                                    <span className="text-xs font-medium px-2 py-1 bg-slate-100 rounded">{payment.method}</span>
                                </td>
                                <td className="px-6 py-4 text-slate-600">
                                    {new Date(payment.payment_date).toLocaleDateString()}
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex space-x-2">
                                        <button
                                            onClick={() => handleEdit(payment)}
                                            className="p-2 text-slate-400 hover:text-blue-600 rounded-lg transition-colors"
                                        >
                                            <Edit2 className="h-4 w-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(payment.id)}
                                            className="p-2 text-slate-400 hover:text-red-600 rounded-lg transition-colors"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {payments?.length === 0 && (
                            <tr>
                                <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                                    No hay pagos registrados.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl max-w-md w-full p-6">
                        <h3 className="text-xl font-bold mb-4">{selectedPayment ? 'Editar Pago' : 'Registrar Pago'}</h3>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {!selectedPayment && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-700">Inscripción (Estudiante - Curso)</label>
                                    <select
                                        required
                                        className="w-full mt-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                        value={newPayment.enrollment_id}
                                        onChange={(e) => setNewPayment({ ...newPayment, enrollment_id: e.target.value })}
                                    >
                                        <option value="">Seleccione...</option>
                                        {enrollments?.map((e: any) => (
                                            <option key={e.id} value={e.id}>{e.student_name} - {e.course_name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            <div>
                                <label className="block text-sm font-medium text-slate-700">Monto (Q)</label>
                                <div className="relative">
                                    <DollarSign className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                                    <input
                                        type="number"
                                        required
                                        min="1"
                                        className="w-full pl-9 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                        value={newPayment.amount}
                                        onChange={(e) => setNewPayment({ ...newPayment, amount: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700">Método de Pago</label>
                                <select
                                    required
                                    className="w-full mt-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                    value={newPayment.method}
                                    onChange={(e) => setNewPayment({ ...newPayment, method: e.target.value })}
                                >
                                    <option value="CASH">Efectivo</option>
                                    <option value="TRANSFER">Transferencia</option>
                                    <option value="CARD">Tarjeta</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700">Mes de Colegiatura</label>
                                <input
                                    type="month"
                                    className="w-full mt-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                    value={newPayment.tuition_month}
                                    onChange={(e) => setNewPayment({ ...newPayment, tuition_month: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700">Descripción</label>
                                <input
                                    type="text"
                                    className="w-full mt-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                    placeholder="Ej. Colegiatura, Inscripción..."
                                    value={newPayment.description}
                                    onChange={(e) => setNewPayment({ ...newPayment, description: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700">Referencia (Opcional)</label>
                                <input
                                    type="text"
                                    className="w-full mt-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                    placeholder="No. Boleta / Transacción"
                                    value={newPayment.reference_number}
                                    onChange={(e) => setNewPayment({ ...newPayment, reference_number: e.target.value })}
                                />
                            </div>
                            <div className="flex justify-end space-x-3 mt-6">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={createMutation.isPending || updateMutation.isPending}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                                >
                                    {createMutation.isPending || updateMutation.isPending ? 'Guardando...' : (selectedPayment ? 'Actualizar Pago' : 'Registrar Pago')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PaymentsList;
