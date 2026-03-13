import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getEnrollments, enrollStudent, getStudents, getCourses, updateEnrollment, deleteEnrollment, getCourseSchedules } from '../../features/academic/academicService';
import { getBranches } from '../../features/branches/branchesService';
import { getCurrentUser } from '../../features/auth/authService';
import { Plus, Loader2, RefreshCw, Trash2, Search, Filter, Calendar, Pencil, Building2 } from 'lucide-react';

const EnrollmentsList = () => {
    const queryClient = useQueryClient();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [newEnrollment, setNewEnrollment] = useState({ student_id: '', course_id: '', schedule_id: '', branch_id: '' });

    // Filtros
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
    const [filterCourse, setFilterCourse] = useState('');

    const user = getCurrentUser();

    const { data: enrollments, isLoading } = useQuery({
        queryKey: ['enrollments'],
        queryFn: getEnrollments,
    });

    // Extraer cursos únicos de las inscripciones
    const uniqueCourses = Array.from(new Set(enrollments?.map((e: any) => e.course_name).filter(Boolean))).sort();

    const { data: students } = useQuery({
        queryKey: ['students-list-enr'],
        queryFn: () => getStudents(),
    });

    const { data: courses } = useQuery({
        queryKey: ['courses'],
        queryFn: getCourses,
        enabled: isModalOpen
    });

    const { data: courseSchedules, isLoading: isLoadingSchedules } = useQuery({
        queryKey: ['course_schedules', newEnrollment.course_id],
        queryFn: () => getCourseSchedules(newEnrollment.course_id),
        enabled: !!newEnrollment.course_id && isModalOpen
    });

    const { data: branches } = useQuery({
        queryKey: ['branches-list'],
        queryFn: getBranches,
        enabled: !user?.branch_id && isModalOpen
    });

    const createMutation = useMutation({
        mutationFn: enrollStudent,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['enrollments'] });
            queryClient.invalidateQueries({ queryKey: ['grades'] });
            queryClient.invalidateQueries({ queryKey: ['attendance'] });
            closeModal();
        },
        onError: (err: any) => {
            alert(err.response?.data?.message || "Error al inscribir");
        }
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: any }) => updateEnrollment(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['enrollments'] });
            queryClient.invalidateQueries({ queryKey: ['grades'] });
            queryClient.invalidateQueries({ queryKey: ['attendance'] });
            if (editingId) closeModal();
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
        updateMutation.mutate({ id: enrollment.id, data: { is_active: !enrollment.is_active } });
    };

    const handleEdit = (enrollment: any) => {
        setEditingId(enrollment.id);
        setNewEnrollment({
            student_id: enrollment.student_id,
            course_id: enrollment.course_id,
            schedule_id: enrollment.schedule_id || '',
            branch_id: enrollment.branch_id || ''
        });
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingId(null);
        setNewEnrollment({ student_id: '', course_id: '', schedule_id: '', branch_id: '' });
    };

    const handleDelete = (id: string) => {
        if (window.confirm('¿Está seguro de eliminar esta inscripción?')) {
            deleteMutation.mutate(id);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newEnrollment.student_id || !newEnrollment.course_id) return;

        if (editingId) {
            updateMutation.mutate({
                id: editingId,
                data: { schedule_id: newEnrollment.schedule_id || '' }
            });
        } else {
            createMutation.mutate({
                student_id: newEnrollment.student_id,
                course_id: newEnrollment.course_id,
                schedule_id: newEnrollment.schedule_id || undefined,
                branch_id: newEnrollment.branch_id || undefined
            } as any);
        }
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
                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Inscripciones</h2>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">Gestión de alumnos asignados a cursos.</p>
                </div>
                <button
                    onClick={() => {
                        setEditingId(null);
                        setNewEnrollment({ student_id: '', course_id: '', schedule_id: '', branch_id: '' });
                        setIsModalOpen(true);
                    }}
                    className="flex items-center space-x-2 px-6 py-3 bg-brand-blue text-white rounded-xl hover:bg-blue-600 transition-all shadow-[0_0_15px_rgba(13,89,242,0.4)] active:scale-95 font-semibold border border-white/10"
                >
                    <Plus className="h-5 w-5" />
                    <span>Nueva Inscripción</span>
                </button>
            </div>

            {/* Filtros */}
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="flex flex-1 w-full gap-4 flex-col md:flex-row">
                    <div className="relative flex-1 max-w-md group">
                        <Search className="absolute left-4 top-3.5 h-5 w-5 text-slate-400 dark:text-slate-500 group-focus-within:text-brand-blue transition-colors" />
                        <input
                            type="text"
                            placeholder="Buscar alumno o curso..."
                            className="w-full pl-12 pr-4 py-3 bg-white/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white rounded-xl focus:ring-4 focus:ring-brand-blue/20 focus:border-brand-blue outline-none transition-all shadow-sm backdrop-blur-sm placeholder:text-slate-400 dark:placeholder:text-slate-500"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="relative">
                        <div className="absolute left-4 top-3.5 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
                            <Filter className="h-5 w-5" />
                        </div>
                        <select
                            className="w-full md:w-64 pl-12 pr-10 py-3 bg-white/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-xl focus:ring-4 focus:ring-brand-blue/20 focus:border-brand-blue outline-none transition-all shadow-sm appearance-none font-medium cursor-pointer hover:bg-white dark:hover:bg-slate-800 backdrop-blur-sm"
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

                <div className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex space-x-1 self-start w-full md:w-auto overflow-x-auto">
                    <button
                        onClick={() => setFilterStatus('all')}
                        className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex-1 md:flex-none whitespace-nowrap ${filterStatus === 'all' ? 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-white/50 dark:hover:bg-slate-700/50'}`}
                    >
                        Todas
                    </button>
                    <button
                        onClick={() => setFilterStatus('active')}
                        className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex-1 md:flex-none whitespace-nowrap ${filterStatus === 'active' ? 'bg-brand-success/20 text-brand-success shadow-sm border border-brand-success/30' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-white/50 dark:hover:bg-slate-700/50'}`}
                    >
                        Activas
                    </button>
                    <button
                        onClick={() => setFilterStatus('inactive')}
                        className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex-1 md:flex-none whitespace-nowrap ${filterStatus === 'inactive' ? 'bg-brand-danger/20 text-brand-danger shadow-sm border border-brand-danger/30' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-white/50 dark:hover:bg-slate-700/50'}`}
                    >
                        Inactivas
                    </button>
                </div>
            </div>

            <div className="glass-card rounded-3xl overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-slate-50/50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700/50">
                        <tr>
                            <th className="px-6 py-4 font-medium text-slate-500 dark:text-slate-400">Estudiante</th>
                            <th className="px-6 py-4 font-medium text-slate-500 dark:text-slate-400">Curso</th>
                            <th className="px-6 py-4 font-medium text-slate-500 dark:text-slate-400">Horario</th>
                            <th className="px-6 py-4 font-medium text-slate-500 dark:text-slate-400">Fecha de Inscripción</th>
                            <th className="px-6 py-4 font-medium text-slate-500 dark:text-slate-400">Estado</th>
                            <th className="px-6 py-4 font-medium text-slate-500 dark:text-slate-400 text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                        {filteredEnrollments?.map((enrollment: any) => (
                            <tr key={enrollment.id} className="hover:bg-white/50 dark:hover:bg-slate-800/50 transition group">
                                <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">{enrollment.student_name}</td>
                                <td className="px-6 py-4 font-medium text-slate-600 dark:text-slate-300 bg-slate-50/50 dark:bg-slate-800/30">
                                    {enrollment.course_name}
                                    {!user?.branch_id && enrollment.branches && (
                                        <div className="flex items-center text-[10px] text-amber-500 font-bold mt-1">
                                            <Building2 className="h-3 w-3 mr-1" />
                                            {enrollment.branches.name}
                                        </div>
                                    )}
                                </td>
                                <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">
                                    {enrollment.schedule_details ? (
                                        <div className="flex items-center gap-1">
                                            <Calendar className="h-3 w-3 text-slate-400" />
                                            {enrollment.schedule_details}
                                        </div>
                                    ) : (
                                        <span className="text-slate-400 italic">No asignado</span>
                                    )}
                                </td>
                                <td className="px-6 py-4 text-slate-500 dark:text-slate-400">
                                    {new Date(enrollment.enrollment_date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </td>
                                <td className="px-6 py-4">
                                    <button
                                        onClick={() => handleToggleStatus(enrollment)}
                                        disabled={updateMutation.isPending}
                                        className={`px-3 py-1 rounded-full text-xs font-bold transition-all inline-flex items-center justify-center space-x-1 border ${enrollment.is_active
                                            ? 'bg-brand-success/10 text-brand-success border-brand-success/20 hover:bg-brand-success/20 shadow-[0_0_10px_rgba(34,197,94,0.1)]'
                                            : 'bg-brand-danger/10 text-brand-danger border-brand-danger/20 hover:bg-brand-danger/20 shadow-[0_0_10px_rgba(239,68,68,0.1)]'
                                            }`}
                                    >
                                        <div className={`w-1.5 h-1.5 rounded-full ${enrollment.is_active ? 'bg-brand-success' : 'bg-brand-danger'}`}></div>
                                        <span>{enrollment.is_active ? 'ACTIVA' : 'INACTIVA'}</span>
                                        {updateMutation.isPending && <RefreshCw className="h-3 w-3 animate-spin ml-1" />}
                                    </button>
                                </td>
                                <td className="px-6 py-4 text-right opacity-0 group-hover:opacity-100 transition-opacity flex justify-end space-x-2">
                                    <button
                                        onClick={() => handleEdit(enrollment)}
                                        className="p-2 text-slate-400 hover:text-brand-blue hover:bg-brand-blue/10 rounded-lg transition-colors"
                                        title="Editar Inscripción"
                                    >
                                        <Pencil className="h-5 w-5" />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(enrollment.id)}
                                        className="p-2 text-slate-400 hover:text-brand-danger hover:bg-brand-danger/10 rounded-lg transition-colors"
                                        title="Eliminar Inscripción"
                                    >
                                        <Trash2 className="h-5 w-5" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {filteredEnrollments?.length === 0 && (
                            <tr>
                                <td colSpan={5} className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
                                    No hay inscripciones registradas.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={closeModal} />
                    <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl relative z-10 overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="bg-gradient-to-r from-brand-blue to-brand-teal p-6 text-white border-b border-white/10">
                            <h3 className="text-2xl font-bold">{editingId ? 'Editar Inscripción' : 'Inscribir Estudiante'}</h3>
                            <p className="text-blue-100 text-sm mt-1">{editingId ? 'Actualiza el horario de la inscripción.' : 'Asigna un alumno a un curso.'}</p>
                        </div>
                        <form onSubmit={handleSubmit} className="p-8 space-y-6">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 ml-1">Estudiante</label>
                                <select
                                    required
                                    disabled={!!editingId}
                                    className="w-full mt-2 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-brand-blue/10 focus:border-brand-blue outline-none transition-all text-slate-700 disabled:opacity-75 disabled:bg-slate-100 disabled:cursor-not-allowed"
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
                                <label className="block text-sm font-semibold text-slate-700 ml-1">Curso</label>
                                <select
                                    required
                                    disabled={!!editingId}
                                    className="w-full mt-2 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-brand-blue/10 focus:border-brand-blue outline-none transition-all text-slate-700 disabled:opacity-75 disabled:bg-slate-100 disabled:cursor-not-allowed"
                                    value={newEnrollment.course_id}
                                    onChange={(e) => setNewEnrollment({ ...newEnrollment, course_id: e.target.value, schedule_id: '' })}
                                >
                                    <option value="">Seleccione curso</option>
                                    {courses?.map((c: any) => (
                                        <option key={c.id} value={c.id}>{c.name} (Q{c.monthly_fee})</option>
                                    ))}
                                </select>
                            </div>

                            {!user?.branch_id && !editingId && (
                                <div>
                                    <label className="text-sm font-semibold text-slate-700 ml-1 flex items-center">
                                        <Building2 className="h-4 w-4 mr-1 text-slate-400" />
                                        Sede (Opcional)
                                    </label>
                                    <select
                                        className="w-full mt-2 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all text-slate-700"
                                        value={newEnrollment.branch_id}
                                        onChange={(e) => setNewEnrollment({ ...newEnrollment, branch_id: e.target.value })}
                                        required={!user?.branch_id}
                                    >
                                        <option value="">Seleccione una sede...</option>
                                        {branches?.map((branch: any) => (
                                            <option key={branch.id} value={branch.id}>{branch.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {newEnrollment.course_id && (
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 ml-1">Horario / Grado</label>
                                    <select
                                        className="w-full mt-2 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-brand-blue/10 focus:border-brand-blue outline-none transition-all text-slate-700 disabled:opacity-50"
                                        value={newEnrollment.schedule_id}
                                        onChange={(e) => setNewEnrollment({ ...newEnrollment, schedule_id: e.target.value })}
                                        disabled={isLoadingSchedules}
                                    >
                                        <option value="">Sin horario específico</option>
                                        {courseSchedules?.map((s: any) => (
                                            <option key={s.id} value={s.id}>
                                                {s.grade} - {s.day_of_week} ({s.start_time.substring(0, 5)} a {s.end_time.substring(0, 5)})
                                            </option>
                                        ))}
                                    </select>
                                    {isLoadingSchedules && <p className="text-xs text-brand-blue ml-2 mt-1">Cargando horarios...</p>}
                                </div>
                            )}

                            <div className="flex space-x-4 pt-4">
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    className="flex-1 px-6 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={createMutation.isPending || updateMutation.isPending}
                                    className="flex-1 px-6 py-3 bg-brand-blue text-white font-bold rounded-xl hover:bg-blue-600 shadow-[0_0_15px_rgba(13,89,242,0.3)] transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center space-x-2"
                                >
                                    {(createMutation.isPending || updateMutation.isPending) ? <Loader2 className="h-5 w-5 animate-spin" /> : <span>{editingId ? 'Guardar' : 'Inscribir'}</span>}
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
