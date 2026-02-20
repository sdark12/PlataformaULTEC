import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getCourses, createCourse, updateCourse, deleteCourse } from '../../features/academic/academicService';
import { Plus, Loader2, BookOpen, Edit2, Trash2 } from 'lucide-react';

const CoursesList = () => {
    const queryClient = useQueryClient();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newCourse, setNewCourse] = useState({ name: '', description: '', monthly_fee: 0 });
    const [selectedCourse, setSelectedCourse] = useState<any>(null);
    const [errorMsg, setErrorMsg] = useState('');

    const { data: courses, isLoading, isError } = useQuery({
        queryKey: ['courses'],
        queryFn: getCourses,
    });

    const createMutation = useMutation({
        mutationFn: createCourse,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['courses'] });
            setIsModalOpen(false);
            setNewCourse({ name: '', description: '', monthly_fee: 0 });
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
            setNewCourse({ name: '', description: '', monthly_fee: 0 });
            setErrorMsg('');
        },
        onError: (err: any) => {
            setErrorMsg(err.response?.data?.message || 'Error al actualizar el curso.');
        }
    });

    const deleteMutation = useMutation({
        mutationFn: deleteCourse,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['courses'] });
        },
        onError: (err: any) => {
            alert(err.response?.data?.message || 'Error al eliminar el curso.');
        }
    });

    const handleDelete = (id: string) => {
        if (window.confirm('¿Está seguro de eliminar este curso? Esta acción no se puede deshacer.')) {
            deleteMutation.mutate(id);
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
            monthly_fee: course.monthly_fee
        });
        setErrorMsg('');
        setIsModalOpen(true);
    };

    const handleNewCourse = () => {
        setSelectedCourse(null);
        setNewCourse({ name: '', description: '', monthly_fee: 0 });
        setErrorMsg('');
        setIsModalOpen(true);
    };

    if (isLoading) return (
        <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
            <Loader2 className="animate-spin h-12 w-12 text-blue-500/50" />
            <p className="text-slate-400 font-medium animate-pulse">Cargando cursos...</p>
        </div>
    );

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Cursos Disponibles</h2>
                    <p className="text-slate-500 mt-1">Gestión de oferta académica y cuotas mensuales.</p>
                </div>
                <button
                    onClick={handleNewCourse}
                    className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-500 hover:to-indigo-500 transition-all shadow-lg shadow-blue-500/25 active:scale-95 font-semibold"
                >
                    <Plus className="h-5 w-5" />
                    <span>Nuevo Curso</span>
                </button>
            </div>

            {isError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center space-x-3">
                    <span className="font-medium">Hubo un problema al cargar los cursos. Por favor, reintente.</span>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {courses?.map((course: any) => (
                    <div
                        key={course.id}
                        className="group bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:border-blue-300 hover:shadow-xl hover:shadow-blue-500/5 transition-all duration-300 relative overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="text-[10px] px-2 py-1 bg-green-100 text-green-700 rounded-full font-bold uppercase tracking-wider">Activo</span>
                        </div>

                        <div className="mb-4">
                            <div className="h-12 w-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 mb-4 group-hover:bg-blue-600 group-hover:text-white transition-colors duration-300">
                                <BookOpen className="h-6 w-6" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{course.name}</h3>
                            <p className="text-slate-500 mt-2 text-sm line-clamp-2 leading-relaxed">{course.description || 'Sin descripción disponible.'}</p>
                        </div>

                        <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
                            <div>
                                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Cuota Mensual</p>
                                <span className="text-2xl font-bold text-slate-900 tracking-tight">Q{course.monthly_fee}</span>
                            </div>
                            <div className="flex space-x-1">
                                <button
                                    onClick={() => handleEdit(course)}
                                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                >
                                    <Edit2 className="h-4 w-4" />
                                </button>
                                <button
                                    onClick={() => handleDelete(course.id)}
                                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}

                {courses?.length === 0 && !isLoading && (
                    <div className="col-span-full bg-slate-100/50 border-2 border-dashed border-slate-200 rounded-3xl py-20 text-center flex flex-col items-center justify-center space-y-4">
                        <div className="h-16 w-16 bg-slate-200 rounded-full flex items-center justify-center text-slate-400">
                            <BookOpen className="h-8 w-8" />
                        </div>
                        <div className="max-w-xs">
                            <h3 className="text-lg font-bold text-slate-900">No hay cursos aún</h3>
                            <p className="text-slate-500 text-sm mt-1">Comienza agregando tu primer curso para la academia.</p>
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
        </div>
    );
};

export default CoursesList;
