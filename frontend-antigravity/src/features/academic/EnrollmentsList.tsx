import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getEnrollments, enrollStudent, getStudents, getCourses, updateEnrollment, deleteEnrollment } from '../../features/academic/academicService';
import { Plus, Loader2, RefreshCw, Trash2 } from 'lucide-react';

const EnrollmentsList = () => {
    const queryClient = useQueryClient();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newEnrollment, setNewEnrollment] = useState({ student_id: '', course_id: '' });

    const { data: enrollments, isLoading } = useQuery({
        queryKey: ['enrollments'],
        queryFn: getEnrollments,
    });

    const { data: students } = useQuery({
        queryKey: ['students'],
        queryFn: getStudents,
        enabled: isModalOpen
    });

    const { data: courses } = useQuery({
        queryKey: ['courses'],
        queryFn: getCourses,
        enabled: isModalOpen
    });

    const createMutation = useMutation({
        mutationFn: enrollStudent,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['enrollments'] });
            setIsModalOpen(false);
            setNewEnrollment({ student_id: '', course_id: '' });
        },
        onError: (err: any) => {
            alert(err.response?.data?.message || "Error al inscribir");
        }
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) => updateEnrollment(id, { is_active }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['enrollments'] });
        },
        onError: (err: any) => {
            alert(err.response?.data?.message || "Error al actualizar estado");
        }
    });

    const deleteMutation = useMutation({
        mutationFn: deleteEnrollment,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['enrollments'] });
        },
        onError: (err: any) => {
            alert(err.response?.data?.message || "Error al eliminar inscripción");
        }
    });

    const handleToggleStatus = (enrollment: any) => {
        updateMutation.mutate({ id: enrollment.id, is_active: !enrollment.is_active });
    };

    const handleDelete = (id: string) => {
        if (window.confirm('¿Está seguro de eliminar esta inscripción?')) {
            deleteMutation.mutate(id);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newEnrollment.student_id || !newEnrollment.course_id) return;

        createMutation.mutate({
            student_id: newEnrollment.student_id,
            course_id: newEnrollment.course_id
        });
    };

    if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin h-8 w-8 text-blue-600" /></div>;

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-slate-800">Inscripciones</h2>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                    <Plus className="h-4 w-4" />
                    <span>Nueva Inscripción</span>
                </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th className="px-6 py-4 font-medium text-slate-500">Estudiante</th>
                            <th className="px-6 py-4 font-medium text-slate-500">Curso</th>
                            <th className="px-6 py-4 font-medium text-slate-500">Fecha de Inscripción</th>
                            <th className="px-6 py-4 font-medium text-slate-500">Estado</th>
                            <th className="px-6 py-4 font-medium text-slate-500 text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {enrollments?.map((enrollment: any) => (
                            <tr key={enrollment.id} className="hover:bg-slate-50 transition">
                                <td className="px-6 py-4 font-medium text-slate-900">{enrollment.student_name}</td>
                                <td className="px-6 py-4 text-slate-600">{enrollment.course_name}</td>
                                <td className="px-6 py-4 text-slate-600">
                                    {new Date(enrollment.enrollment_date).toLocaleDateString()}
                                </td>
                                <td className="px-6 py-4">
                                    <button
                                        onClick={() => handleToggleStatus(enrollment)}
                                        disabled={updateMutation.isPending}
                                        className={`px-3 py-1 rounded-full text-xs font-bold transition-all flex items-center space-x-2 ${enrollment.is_active
                                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                            : 'bg-red-100 text-red-700 hover:bg-red-200'
                                            }`}
                                    >
                                        <span>{enrollment.is_active ? 'ACTIVO' : 'INACTIVO'}</span>
                                        {updateMutation.isPending && <RefreshCw className="h-3 w-3 animate-spin" />}
                                    </button>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <button
                                        onClick={() => handleDelete(enrollment.id)}
                                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                        title="Eliminar Inscripción"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {enrollments?.length === 0 && (
                            <tr>
                                <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                                    No hay inscripciones registradas.
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
                        <h3 className="text-xl font-bold mb-4">Inscribir Estudiante</h3>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700">Estudiante</label>
                                <select
                                    required
                                    className="w-full mt-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                    value={newEnrollment.student_id}
                                    onChange={(e) => setNewEnrollment({ ...newEnrollment, student_id: e.target.value })}
                                >
                                    <option value="">Seleccione estudiante</option>
                                    {students?.map((s: any) => (
                                        <option key={s.id} value={s.id}>{s.full_name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700">Curso</label>
                                <select
                                    required
                                    className="w-full mt-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                    value={newEnrollment.course_id}
                                    onChange={(e) => setNewEnrollment({ ...newEnrollment, course_id: e.target.value })}
                                >
                                    <option value="">Seleccione curso</option>
                                    {courses?.map((c: any) => (
                                        <option key={c.id} value={c.id}>{c.name} (Q{c.monthly_fee})</option>
                                    ))}
                                </select>
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
                                    disabled={createMutation.isPending}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                                >
                                    {createMutation.isPending ? 'Inscribiendo...' : 'Inscribir'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EnrollmentsList;
