import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getEnrollments, enrollStudent, getStudents, getCourses, updateEnrollment, deleteEnrollment } from '../../features/academic/academicService';
import { Plus, Loader2, RefreshCw, Trash2, Search, Filter } from 'lucide-react';

const EnrollmentsList = () => {
    const queryClient = useQueryClient();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newEnrollment, setNewEnrollment] = useState({ student_id: '', course_id: '' });

    // Filtros
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
    const [filterCourse, setFilterCourse] = useState('');

    const { data: enrollments, isLoading } = useQuery({
        queryKey: ['enrollments'],
        queryFn: getEnrollments,
    });

    // Extraer cursos únicos de las inscripciones
    const uniqueCourses = Array.from(new Set(enrollments?.map((e: any) => e.course_name).filter(Boolean))).sort();

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
            queryClient.invalidateQueries({ queryKey: ['grades'] });
            queryClient.invalidateQueries({ queryKey: ['attendance'] });
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
            queryClient.invalidateQueries({ queryKey: ['grades'] });
            queryClient.invalidateQueries({ queryKey: ['attendance'] });
        },
        onError: (err: any) => {
            alert(err.response?.data?.message || "Error al actualizar estado");
        }
    });

    const deleteMutation = useMutation({
        mutationFn: deleteEnrollment,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['enrollments'] });
            queryClient.invalidateQueries({ queryKey: ['grades'] });
            queryClient.invalidateQueries({ queryKey: ['attendance'] });
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

    const filteredEnrollments = enrollments?.filter((e: any) => {
        const matchesSearch =
            e.student_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            e.course_name.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesStatus =
            filterStatus === 'all' ? true :
                filterStatus === 'active' ? e.is_active === true :
                    e.is_active === false;

        const matchesCourse = filterCourse ? e.course_name === filterCourse : true;

        return matchesSearch && matchesStatus && matchesCourse;
    });

    if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin h-8 w-8 text-blue-600" /></div>;

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Inscripciones</h2>
                    <p className="text-slate-500 mt-1">Gestión de alumnos asignados a cursos.</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-500 hover:to-indigo-500 transition-all shadow-lg shadow-blue-500/25 active:scale-95 font-semibold"
                >
                    <Plus className="h-5 w-5" />
                    <span>Nueva Inscripción</span>
                </button>
            </div>

            {/* Filtros */}
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="flex flex-1 w-full gap-4 flex-col md:flex-row">
                    <div className="relative flex-1 max-w-md group">
                        <Search className="absolute left-4 top-3.5 h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                        <input
                            type="text"
                            placeholder="Buscar alumno o curso..."
                            className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 outline-none transition-all shadow-sm"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="relative">
                        <div className="absolute left-4 top-3.5 flex items-center pointer-events-none text-slate-400">
                            <Filter className="h-5 w-5" />
                        </div>
                        <select
                            className="w-full md:w-64 pl-12 pr-10 py-3 bg-white border border-slate-200 text-slate-600 rounded-2xl focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 outline-none transition-all shadow-sm appearance-none font-medium cursor-pointer hover:bg-slate-50"
                            value={filterCourse}
                            onChange={(e) => setFilterCourse(e.target.value)}
                        >
                            <option value="">Todos los Cursos</option>
                            {uniqueCourses.map((c: any) => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                        <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-slate-500">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm flex space-x-1 self-start w-full md:w-auto overflow-x-auto">
                    <button
                        onClick={() => setFilterStatus('all')}
                        className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex-1 md:flex-none whitespace-nowrap ${filterStatus === 'all' ? 'bg-slate-100 text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
                    >
                        Todas
                    </button>
                    <button
                        onClick={() => setFilterStatus('active')}
                        className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex-1 md:flex-none whitespace-nowrap ${filterStatus === 'active' ? 'bg-green-100/50 text-green-700 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
                    >
                        Activas
                    </button>
                    <button
                        onClick={() => setFilterStatus('inactive')}
                        className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex-1 md:flex-none whitespace-nowrap ${filterStatus === 'inactive' ? 'bg-red-100/50 text-red-700 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
                    >
                        Inactivas
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
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
                        {filteredEnrollments?.map((enrollment: any) => (
                            <tr key={enrollment.id} className="hover:bg-slate-50 transition group">
                                <td className="px-6 py-4 font-bold text-slate-900">{enrollment.student_name}</td>
                                <td className="px-6 py-4 font-medium text-slate-600 bg-slate-50/50">{enrollment.course_name}</td>
                                <td className="px-6 py-4 text-slate-500">
                                    {new Date(enrollment.enrollment_date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </td>
                                <td className="px-6 py-4">
                                    <button
                                        onClick={() => handleToggleStatus(enrollment)}
                                        disabled={updateMutation.isPending}
                                        className={`px-3 py-1 rounded-full text-xs font-bold transition-all inline-flex items-center justify-center space-x-1 border ${enrollment.is_active
                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                            : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                                            }`}
                                    >
                                        <div className={`w-1.5 h-1.5 rounded-full ${enrollment.is_active ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                                        <span>{enrollment.is_active ? 'ACTIVA' : 'INACTIVA'}</span>
                                        {updateMutation.isPending && <RefreshCw className="h-3 w-3 animate-spin ml-1" />}
                                    </button>
                                </td>
                                <td className="px-6 py-4 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => handleDelete(enrollment.id)}
                                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                        title="Eliminar Inscripción"
                                    >
                                        <Trash2 className="h-5 w-5" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {filteredEnrollments?.length === 0 && (
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
