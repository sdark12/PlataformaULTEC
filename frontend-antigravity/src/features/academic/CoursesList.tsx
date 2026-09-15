import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getCourses, createCourse, updateCourse } from '../../features/academic/academicService';
import { getBranches } from '../../features/branches/branchesService';
import { getCurrentUser } from '../../features/auth/authService';
import { Plus, Loader2, BookOpen, Edit2, Trash2, CalendarClock, Building2, Search, GraduationCap, X } from 'lucide-react';
import { CourseSchedulesModal } from './CourseSchedulesModal';

const CoursesList = () => {
    const queryClient = useQueryClient();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newCourse, setNewCourse] = useState({ name: '', description: '', monthly_fee: 0, start_date: '', end_date: '', branch_id: '' });
    const [selectedCourse, setSelectedCourse] = useState<any>(null);
    const [scheduleCourse, setScheduleCourse] = useState<any>(null);
    const [errorMsg, setErrorMsg] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedBranchFilter, setSelectedBranchFilter] = useState('ALL');

    const user = getCurrentUser();

    const { data: courses, isLoading, isError } = useQuery({
        queryKey: ['courses'],
        queryFn: getCourses,
    });

    const { data: branches } = useQuery({
        queryKey: ['branches-list'],
        queryFn: getBranches,
        enabled: !user?.branch_id
    });

    const createMutation = useMutation({
        mutationFn: createCourse,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['courses'] });
            setIsModalOpen(false);
            setNewCourse({ name: '', description: '', monthly_fee: 0, start_date: '', end_date: '', branch_id: '' });
            setErrorMsg('');
        },
        onError: (err: any) => {
            console.error('Error creating course:', err);
            setErrorMsg(err.response?.data?.message || 'Error al crear el curso. Verifique su conexión.');
        }
    });

    const updateMutation = useMutation({
        mutationFn: (data: any) => updateCourse(selectedCourse.id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['courses'] });
            setIsModalOpen(false);
            setSelectedCourse(null);
            setNewCourse({ name: '', description: '', monthly_fee: 0, start_date: '', end_date: '', branch_id: '' });
            setErrorMsg('');
        },
        onError: (err: any) => {
            setErrorMsg(err.response?.data?.message || 'Error al actualizar el curso.');
        }
    });

    const archiveMutation = useMutation({
        mutationFn: (course: any) => updateCourse(course.id, {
            name: course.name,
            description: course.description,
            monthly_fee: course.monthly_fee,
            start_date: course.start_date,
            end_date: course.end_date,
            is_active: false
        }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['courses'] });
        },
        onError: (err: any) => {
            alert(err.response?.data?.message || 'Error al archivar el curso.');
        }
    });

    const handleDelete = (course: any) => {
        if (window.confirm(`¿Está seguro de archivar "${course.name}"? Dejará de estar disponible, pero se mantendrá su historial de estudiantes y pagos.`)) {
            archiveMutation.mutate(course);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg('');
        if (!newCourse.name || newCourse.monthly_fee <= 0) {
            setErrorMsg('El nombre y el monto son obligatorios');
            return;
        }

        if (selectedCourse) {
            updateMutation.mutate(newCourse);
        } else {
            createMutation.mutate(newCourse);
        }
    };

    const handleEdit = (course: any) => {
        setSelectedCourse(course);
        setNewCourse({
            name: course.name,
            description: course.description || '',
            monthly_fee: course.monthly_fee,
            start_date: course.start_date ? course.start_date.split('T')[0] : '',
            end_date: course.end_date ? course.end_date.split('T')[0] : '',
            branch_id: course.branch_id || ''
        });
        setErrorMsg('');
        setIsModalOpen(true);
    };

    const handleNewCourse = () => {
        setSelectedCourse(null);
        setNewCourse({ name: '', description: '', monthly_fee: 0, start_date: '', end_date: '', branch_id: '' });
        setErrorMsg('');
        setIsModalOpen(true);
    };

    const filteredCourses = courses?.filter((course: any) => {
        const matchesSearch = !searchTerm || 
            course.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
            course.description?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesBranch = selectedBranchFilter === 'ALL' || course.branch_id === selectedBranchFilter;
        return matchesSearch && matchesBranch;
    });

    const avgFee = courses && courses.length > 0 
        ? Math.round(courses.reduce((acc: number, c: any) => acc + (Number(c.monthly_fee) || 0), 0) / courses.length) 
        : 0;

    if (isLoading) return (
        <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
            <Loader2 className="animate-spin h-12 w-12 text-blue-500/50" />
            <p className="text-slate-400 font-medium animate-pulse">Cargando cursos...</p>
        </div>
    );

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-20 md:pb-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                        <GraduationCap className="h-7 w-7 text-brand-blue" />
                        Gestión Académica
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
                        Cursos, grupos, horarios y cuotas mensuales.
                    </p>
                </div>
                <button
                    onClick={handleNewCourse}
                    className="w-full md:w-auto flex items-center justify-center space-x-2 px-5 py-3 bg-gradient-to-r from-brand-blue via-indigo-600 to-purple-600 text-white rounded-xl hover:opacity-95 transition-all shadow-[0_4px_16px_rgba(13,89,242,0.35)] active:scale-95 font-semibold border border-white/10"
                >
                    <Plus className="h-5 w-5" />
                    <span>Nuevo Curso</span>
                </button>
            </div>

            {/* Stitch KPI Metrics Row */}
            <div className="grid grid-cols-3 gap-3">
                {/* Metric 1: Cursos Activos */}
                <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-2xl p-3 md:p-4 border border-slate-200/80 dark:border-white/10 shadow-sm relative overflow-hidden flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] md:text-xs font-bold uppercase tracking-wider text-slate-400">Activos</span>
                        <div className="w-6 h-6 md:w-8 md:h-8 rounded-lg bg-blue-500/10 text-brand-blue flex items-center justify-center">
                            <BookOpen className="h-3.5 w-3.5 md:h-4 md:h-4" />
                        </div>
                    </div>
                    <div className="text-xl md:text-2xl font-extrabold text-slate-900 dark:text-white leading-tight">
                        {courses?.length || 0}
                    </div>
                    <span className="text-[10px] md:text-xs text-brand-blue font-semibold truncate mt-0.5">
                        Cursos vigentes
                    </span>
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-brand-blue to-transparent"></div>
                </div>

                {/* Metric 2: Sedes */}
                <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-2xl p-3 md:p-4 border border-slate-200/80 dark:border-white/10 shadow-sm relative overflow-hidden flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] md:text-xs font-bold uppercase tracking-wider text-slate-400">Sedes</span>
                        <div className="w-6 h-6 md:w-8 md:h-8 rounded-lg bg-purple-500/10 text-brand-purple flex items-center justify-center">
                            <Building2 className="h-3.5 w-3.5 md:h-4 md:h-4" />
                        </div>
                    </div>
                    <div className="text-xl md:text-2xl font-extrabold text-slate-900 dark:text-white leading-tight">
                        {branches?.length || 1}
                    </div>
                    <span className="text-[10px] md:text-xs text-brand-purple font-semibold truncate mt-0.5">
                        Campus activos
                    </span>
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-brand-purple to-transparent"></div>
                </div>

                {/* Metric 3: Cuota Promedio */}
                <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-2xl p-3 md:p-4 border border-slate-200/80 dark:border-white/10 shadow-sm relative overflow-hidden flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] md:text-xs font-bold uppercase tracking-wider text-slate-400">Cuota Prom.</span>
                        <div className="w-6 h-6 md:w-8 md:h-8 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                            <span className="font-bold text-xs">Q</span>
                        </div>
                    </div>
                    <div className="text-xl md:text-2xl font-extrabold text-slate-900 dark:text-white leading-tight">
                        Q{avgFee}
                    </div>
                    <span className="text-[10px] md:text-xs text-emerald-500 font-semibold truncate mt-0.5">
                        Promedio mensual
                    </span>
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-500 to-transparent"></div>
                </div>
            </div>

            {/* Search and Sede Filter */}
            <div className="flex flex-col md:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Buscar por curso o descripción..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-10 py-2.5 bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-white/10 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/30 dark:text-white placeholder:text-slate-400"
                    />
                    {searchTerm && (
                        <button
                            onClick={() => setSearchTerm('')}
                            className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    )}
                </div>

                {!user?.branch_id && branches && branches.length > 0 && (
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                        <button
                            onClick={() => setSelectedBranchFilter('ALL')}
                            className={`flex-shrink-0 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                                selectedBranchFilter === 'ALL'
                                    ? 'bg-brand-blue text-white shadow-md shadow-brand-blue/20'
                                    : 'bg-white/60 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 border border-slate-200 dark:border-white/5'
                            }`}
                        >
                            Todas las Sedes
                        </button>
                        {branches.map((b: any) => (
                            <button
                                key={b.id}
                                onClick={() => setSelectedBranchFilter(b.id)}
                                className={`flex-shrink-0 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                                    selectedBranchFilter === b.id
                                        ? 'bg-brand-blue text-white shadow-md shadow-brand-blue/20'
                                        : 'bg-white/60 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 border border-slate-200 dark:border-white/5'
                                }`}
                            >
                                {b.name}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {isError && (
                <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/50 text-red-700 dark:text-red-300 px-4 py-3 rounded-xl flex items-center space-x-3">
                    <span className="font-medium text-sm">Hubo un problema al cargar los cursos. Por favor, reintente.</span>
                </div>
            )}

            {/* Courses Grid / Cards (Mobile & Desktop) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredCourses?.map((course: any) => (
                    <div
                        key={course.id}
                        className="group bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-2xl p-5 border border-slate-200/80 dark:border-white/10 hover:border-brand-blue/40 dark:hover:border-brand-blue/40 shadow-md hover:shadow-xl transition-all duration-300 relative overflow-hidden flex flex-col justify-between"
                    >
                        {/* Glow ambient top edge */}
                        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-brand-blue via-brand-purple to-brand-teal opacity-90"></div>

                        <div>
                            {/* Badges row */}
                            <div className="flex items-center justify-between gap-2 mb-3">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 font-bold text-[11px] border border-emerald-500/20">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                        En Curso
                                    </span>
                                    {!user?.branch_id && course.branches && (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold text-[11px] border border-amber-500/20">
                                            <Building2 className="h-3 w-3" />
                                            {course.branches.name}
                                        </span>
                                    )}
                                </div>
                                <span className="text-xs font-bold text-brand-blue dark:text-brand-teal">
                                    Q{course.monthly_fee}/mes
                                </span>
                            </div>

                            {/* Header info */}
                            <div className="flex items-start gap-3 mb-3">
                                <div className="h-11 w-11 rounded-xl bg-gradient-to-tr from-brand-blue/20 to-brand-purple/20 flex items-center justify-center text-brand-blue dark:text-brand-teal border border-brand-blue/10 flex-shrink-0 shadow-inner">
                                    <BookOpen className="h-5 w-5" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white group-hover:text-brand-blue dark:group-hover:text-brand-teal transition-colors truncate">
                                        {course.name}
                                    </h3>
                                    {course.start_date && (
                                        <p className="text-[11px] text-slate-400 font-medium">
                                            Inició: {course.start_date.split('T')[0]}
                                        </p>
                                    )}
                                </div>
                            </div>

                            <p className="text-slate-500 dark:text-slate-400 text-xs line-clamp-2 leading-relaxed mb-4">
                                {course.description || 'Sin descripción disponible para este curso.'}
                            </p>
                        </div>

                        {/* Action buttons */}
                        <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2">
                            <button
                                onClick={() => setScheduleCourse(course)}
                                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-blue-50 dark:bg-brand-blue/15 text-brand-blue dark:text-brand-teal hover:bg-blue-100 dark:hover:bg-brand-blue/25 font-bold text-xs transition-all active:scale-95"
                                title="Gestionar horarios y grupos de este curso"
                            >
                                <CalendarClock className="h-4 w-4" />
                                <span>Horarios</span>
                            </button>

                            <div className="flex items-center space-x-1">
                                <button
                                    onClick={() => handleEdit(course)}
                                    className="p-2.5 text-slate-400 hover:text-brand-blue hover:bg-brand-blue/10 rounded-xl transition-colors active:scale-95"
                                    title="Editar curso"
                                >
                                    <Edit2 className="h-4 w-4" />
                                </button>
                                <button
                                    onClick={() => handleDelete(course)}
                                    className="p-2.5 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-xl transition-colors active:scale-95"
                                    title="Archivar curso"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}

                {filteredCourses?.length === 0 && !isLoading && (
                    <div className="col-span-full bg-white/50 dark:bg-slate-800/50 border-2 border-dashed border-slate-200 dark:border-slate-700/60 rounded-3xl py-16 text-center flex flex-col items-center justify-center space-y-3 backdrop-blur-sm">
                        <div className="h-14 w-14 bg-slate-100 dark:bg-slate-700/50 rounded-2xl flex items-center justify-center text-slate-400 dark:text-slate-500">
                            <BookOpen className="h-7 w-7" />
                        </div>
                        <div className="max-w-xs">
                            <h3 className="text-base font-bold text-slate-900 dark:text-white">No se encontraron cursos</h3>
                            <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">
                                {searchTerm ? 'Intenta con otro término de búsqueda.' : 'Comienza agregando tu primer curso para la academia.'}
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setIsModalOpen(false)} />

                    <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl relative z-10 overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white">
                            <h3 className="text-2xl font-bold">{selectedCourse ? 'Editar Curso' : 'Crear Nuevo Curso'}</h3>
                            <p className="text-blue-100 text-sm mt-1">{selectedCourse ? 'Modifique los detalles del curso.' : 'Complete los detalles para ofertar un nuevo curso.'}</p>
                        </div>

                        <form onSubmit={handleSubmit} className="p-8 space-y-6">
                            {errorMsg && (
                                <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm font-medium animate-shake">
                                    {errorMsg}
                                </div>
                            )}

                            <div className="space-y-4">
                                <div>
                                    <label className="text-sm font-semibold text-slate-700 ml-1">Nombre del Curso</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full mt-2 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all placeholder:text-slate-400"
                                        placeholder="Ej: Programación Web"
                                        value={newCourse.name}
                                        onChange={(e) => setNewCourse({ ...newCourse, name: e.target.value })}
                                    />
                                </div>

                                {!user?.branch_id && (
                                    <div>
                                        <label className="text-sm font-semibold text-slate-700 ml-1 flex items-center">
                                            <Building2 className="h-4 w-4 mr-1 text-slate-400" />
                                            Sede *
                                        </label>
                                        <select
                                            className="w-full mt-2 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all text-slate-700"
                                            value={newCourse.branch_id}
                                            onChange={(e) => setNewCourse({ ...newCourse, branch_id: e.target.value })}
                                            required={!user?.branch_id}
                                        >
                                            <option value="">Seleccione una sede...</option>
                                            {branches?.map((branch: any) => (
                                                <option key={branch.id} value={branch.id}>{branch.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                <div>
                                    <label className="text-sm font-semibold text-slate-700 ml-1">Descripción</label>
                                    <textarea
                                        rows={3}
                                        className="w-full mt-2 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all placeholder:text-slate-400 resize-none"
                                        placeholder="Breve descripción del curso..."
                                        value={newCourse.description}
                                        onChange={(e) => setNewCourse({ ...newCourse, description: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="text-sm font-semibold text-slate-700 ml-1">Costo Mensual (Q)</label>
                                    <div className="relative mt-2">
                                        <div className="absolute left-4 top-3.5 text-slate-400 pointer-events-none font-bold">Q</div>
                                        <input
                                            type="number"
                                            required
                                            min="1"
                                            className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
                                            value={newCourse.monthly_fee}
                                            onChange={(e) => setNewCourse({ ...newCourse, monthly_fee: Number(e.target.value) })}
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-sm font-semibold text-slate-700 ml-1">Fecha de Inicio</label>
                                        <input
                                            type="date"
                                            className="w-full mt-2 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all text-slate-700"
                                            value={newCourse.start_date}
                                            onChange={(e) => setNewCourse({ ...newCourse, start_date: e.target.value })}
                                        />
                                        <p className="text-[10px] text-slate-400 mt-1 ml-1 leading-tight">Define desde qué mes se empieza a cobrar (Morosidad).</p>
                                    </div>
                                    <div>
                                        <label className="text-sm font-semibold text-slate-700 ml-1">Fecha de Fin (Opcional)</label>
                                        <input
                                            type="date"
                                            className="w-full mt-2 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all text-slate-700"
                                            value={newCourse.end_date}
                                            onChange={(e) => setNewCourse({ ...newCourse, end_date: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="flex space-x-4 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 px-6 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={createMutation.isPending}
                                    className="flex-1 px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-500/20 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center space-x-2"
                                >
                                    {createMutation.isPending || updateMutation.isPending ? (
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                    ) : (
                                        <span>{selectedCourse ? 'Actualizar Curso' : 'Guardar Curso'}</span>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Schedules Modal */}
            {scheduleCourse && (
                <CourseSchedulesModal
                    course={scheduleCourse}
                    onClose={() => setScheduleCourse(null)}
                />
            )}
        </div>
    );
};

export default CoursesList;
