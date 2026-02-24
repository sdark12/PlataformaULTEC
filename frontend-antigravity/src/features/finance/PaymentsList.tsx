import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getPayments, createPayment, updatePayment, deletePayment } from '../../features/finance/paymentService';
import { getEnrollments } from '../../features/academic/academicService';
import { Plus, Loader2, DollarSign, Edit2, Trash2, Search } from 'lucide-react';

const PaymentsList = () => {
    const queryClient = useQueryClient();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [newPayment, setNewPayment] = useState({ enrollment_id: '', amount: '', method: 'CASH', reference_number: '', description: '', tuition_month: '', payment_type: 'TUITION', discount: '0' });
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
            setSearchTerm('');
            setNewPayment({ enrollment_id: '', amount: '', method: 'CASH', reference_number: '', description: '', tuition_month: '', payment_type: 'TUITION', discount: '0' });
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
                            <th className="px-6 py-4 font-medium text-slate-500">Concepto</th>
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
                                    <div className="flex items-center space-x-2 mb-1">
                                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${payment.payment_type === 'TUITION' ? 'bg-blue-100 text-blue-700' :
                                            payment.payment_type === 'ENROLLMENT' ? 'bg-purple-100 text-purple-700' :
                                                payment.payment_type === 'UNIFORM' ? 'bg-emerald-100 text-emerald-700' :
                                                    payment.payment_type === 'MATERIALS' ? 'bg-amber-100 text-amber-700' :
                                                        'bg-slate-100 text-slate-700'
                                            }`}>
                                            {payment.payment_type === 'TUITION' ? 'Mensualidad' :
                                                payment.payment_type === 'ENROLLMENT' ? 'Inscripción' :
                                                    payment.payment_type === 'UNIFORM' ? 'Uniforme' :
                                                        payment.payment_type === 'MATERIALS' ? 'Materiales' : 'Otro'}
                                        </span>
                                        {payment.payment_type === 'TUITION' && payment.tuition_month && (
                                            <span className="text-xs text-slate-500 font-medium border border-slate-200 px-2 py-0.5 rounded-full">
                                                {new Date(payment.tuition_month + '-01T00:00:00').toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-xs text-slate-500 truncate max-w-[150px]">{payment.description || '-'}</div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="font-bold text-green-600">Q{payment.amount}</div>
                                    {Number(payment.discount) > 0 && (
                                        <div className="text-xs font-medium text-rose-500 mt-0.5"> Desc: Q{payment.discount}</div>
                                    )}
                                </td>
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
                                <div className="relative">
                                    <label className="block text-sm font-medium text-slate-700">Inscripción (Buscar Estudiante / Curso)</label>
                                    <div className="relative">
                                        <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                                        <input
                                            type="text"
                                            className="w-full mt-1 pl-9 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                            placeholder="Escriba para buscar..."
                                            value={searchTerm}
                                            onChange={(e) => {
                                                setSearchTerm(e.target.value);
                                                setIsDropdownOpen(true);
                                                setNewPayment({ ...newPayment, enrollment_id: '' }); // Reset selection while typing
                                            }}
                                            onFocus={() => setIsDropdownOpen(true)}
                                            onBlur={() => setTimeout(() => setIsDropdownOpen(false), 200)} // Delay to allow click
                                        />
                                    </div>

                                    {isDropdownOpen && (
                                        <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                                            {filteredEnrollments && filteredEnrollments.length > 0 ? (
                                                filteredEnrollments.map((e: any) => (
                                                    <div
                                                        key={e.id}
                                                        className="px-4 py-2 hover:bg-blue-50 cursor-pointer"
                                                        onClick={() => {
                                                            setNewPayment({ ...newPayment, enrollment_id: e.id });
                                                            setSearchTerm(`${e.student_name} - ${e.course_name}`);
                                                            setIsDropdownOpen(false);
                                                        }}
                                                    >
                                                        <div className="font-medium text-slate-900">{e.student_name}</div>
                                                        <div className="text-sm text-slate-500">{e.course_name}</div>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="px-4 py-2 text-sm text-slate-500">No se encontraron resultados</div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700">Tipo de Cobro</label>
                                    <select
                                        required
                                        className="w-full mt-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
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
                                    <label className="block text-sm font-medium text-slate-700">Descuento aplicado (Q)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        className="w-full mt-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                        value={newPayment.discount}
                                        onChange={(e) => setNewPayment({ ...newPayment, discount: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700">Monto Neto a Pagar (Q)</label>
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
                            {newPayment.payment_type === 'TUITION' && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-700">Mes de Colegiatura</label>
                                    <input
                                        type="month"
                                        required
                                        className="w-full mt-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                        value={newPayment.tuition_month}
                                        onChange={(e) => setNewPayment({ ...newPayment, tuition_month: e.target.value })}
                                    />
                                </div>
                            )}
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
