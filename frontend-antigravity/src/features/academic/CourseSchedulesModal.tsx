import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getCourseSchedules, createCourseSchedule, deleteCourseSchedule } from './academicService';
import type { CourseSchedule, Course } from './academicService';
import { X, Plus, Trash2, Loader2, Calendar, Clock } from 'lucide-react';

interface Props {
    course: Course;
    onClose: () => void;
}


export const CourseSchedulesModal = ({ course, onClose }: Props) => {
    const queryClient = useQueryClient();
    const [newSchedule, setNewSchedule] = useState({ grade: '', day_of_week: 'Lunes a Viernes', start_time: '', end_time: '' });
    const [errorMsg, setErrorMsg] = useState('');

    const { data: schedules, isLoading } = useQuery({
        queryKey: ['course_schedules', course.id],
        queryFn: () => getCourseSchedules(course.id)
    });

    const createMutation = useMutation({
        mutationFn: (data: Omit<CourseSchedule, 'id' | 'course_id'>) => createCourseSchedule(course.id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['course_schedules', course.id] });
            setNewSchedule({ grade: '', day_of_week: 'Lunes a Viernes', start_time: '', end_time: '' });
            setErrorMsg('');
        },
        onError: (err: any) => {
            setErrorMsg(err.response?.data?.message || 'Error al crear horario.');
        }
    });

    const deleteMutation = useMutation({
        mutationFn: deleteCourseSchedule,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['course_schedules', course.id] });
        }
    });

    const handleAdd = (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg('');
        if (!newSchedule.grade || !newSchedule.start_time || !newSchedule.end_time) {
            setErrorMsg('Todos los campos son obligatorios');
            return;
        }

        // Validate time
        if (newSchedule.start_time >= newSchedule.end_time) {
            setErrorMsg('La hora de fin debe ser mayor a la hora de inicio');
            return;
        }

        // Add seconds if not present (PostgreSQL TIME format)
        const formatTime = (t: string) => t.length === 5 ? `${t}:00` : t;

        createMutation.mutate({
            grade: newSchedule.grade,
            day_of_week: newSchedule.day_of_week,
            start_time: formatTime(newSchedule.start_time),
            end_time: formatTime(newSchedule.end_time)
        });
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={onClose} />

            <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl relative z-10 overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="bg-gradient-to-r from-emerald-600 to-teal-600 p-6 text-white flex justify-between items-start shrink-0">
                    <div>
                        <h3 className="text-2xl font-bold flex items-center gap-2">
                            <Calendar className="h-6 w-6" />
                            Horarios del Curso
                        </h3>
                        <p className="text-emerald-100 text-sm mt-1">Configura grados, días y horas para: <span className="font-bold">{course.name}</span></p>
                    </div>
                    <button onClick={onClose} className="p-2 bg-black/10 hover:bg-black/20 rounded-full transition-colors text-white">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Add Schedule Form */}
                    <form onSubmit={handleAdd} className="bg-slate-50 p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                        <h4 className="font-bold text-slate-800 flex items-center gap-2">
                            <Plus className="h-5 w-5 text-emerald-600" />
                            Agregar Nuevo Horario
                        </h4>

                        {errorMsg && (
                            <div className="bg-red-50 text-red-600 px-4 py-2 rounded-lg text-sm font-medium animate-shake border border-red-200">
                                {errorMsg}
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pb-4">
                            <div className="lg:col-span-1">
                                <label className="text-xs font-semibold text-slate-600 ml-1">Grado/Nivel</label>
                                <input
                                    type="text" required placeholder="Ej: 2do Básico"
                                    className="w-full mt-1 px-3 py-2 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all text-sm shadow-sm"
                                    value={newSchedule.grade}
                                    onChange={e => setNewSchedule({ ...newSchedule, grade: e.target.value })}
                                />
                            </div>

                            <div className="lg:col-span-1">
                                <label className="text-xs font-semibold text-slate-600 ml-1">Días</label>
                                <select
                                    className="w-full mt-1 px-3 py-2 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all text-sm shadow-sm"
                                    value={newSchedule.day_of_week}
                                    onChange={e => setNewSchedule({ ...newSchedule, day_of_week: e.target.value })}
                                >
                                    <optgroup label="Agrupados">
                                        <option value="Lunes a Viernes">Lunes a Viernes</option>
                                        <option value="Sábado y Domingo">Sábado y Domingo</option>
                                        <option value="Lunes, Miérc. y Vier.">Lunes, Miérc. y Vier.</option>
                                        <option value="Martes y Jueves">Martes y Jueves</option>
                                    </optgroup>
                                    <optgroup label="Individuales">
                                        <option value="Lunes">Lunes</option>
                                        <option value="Martes">Martes</option>
                                        <option value="Miércoles">Miércoles</option>
                                        <option value="Jueves">Jueves</option>
                                        <option value="Viernes">Viernes</option>
                                        <option value="Sábado">Sábado</option>
                                        <option value="Domingo">Domingo</option>
                                    </optgroup>
                                </select>
                            </div>

                            <div className="lg:col-span-1">
                                <label className="text-xs font-semibold text-slate-600 ml-1">Inicio</label>
                                <input
                                    type="time" required
                                    className="w-full mt-1 px-3 py-2 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all text-sm shadow-sm"
                                    value={newSchedule.start_time}
                                    onChange={e => setNewSchedule({ ...newSchedule, start_time: e.target.value })}
                                />
                            </div>

                            <div className="lg:col-span-1">
                                <label className="text-xs font-semibold text-slate-600 ml-1">Fin</label>
                                <input
                                    type="time" required
                                    className="w-full mt-1 px-3 py-2 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all text-sm shadow-sm"
                                    value={newSchedule.end_time}
                                    onChange={e => setNewSchedule({ ...newSchedule, end_time: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="flex justify-end pt-2">
                            <button
                                type="submit"
                                disabled={createMutation.isPending}
                                className="px-5 py-2 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-all flex items-center gap-2 text-sm shadow-lg shadow-emerald-500/20 active:scale-95 disabled:opacity-50"
                            >
                                {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                Guardar Horario
                            </button>
                        </div>
                    </form>

                    {/* Schedules List */}
                    <div>
                        <h4 className="font-bold text-slate-800 mb-4 px-1">Horarios Registrados</h4>

                        {isLoading ? (
                            <div className="flex justify-center p-8">
                                <Loader2 className="h-8 w-8 text-emerald-500 animate-spin" />
                            </div>
                        ) : schedules?.length === 0 ? (
                            <div className="text-center p-8 bg-slate-50 border border-dashed border-slate-300 rounded-2xl text-slate-500">
                                <Clock className="h-8 w-8 mx-auto mb-2 text-slate-400 opacity-50" />
                                <p className="text-sm">No hay horarios registrados para este curso.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {schedules?.map(schedule => (
                                    <div key={schedule.id} className="flex items-center justify-between p-4 bg-white border border-slate-200 shadow-sm hover:border-emerald-200 hover:shadow-md transition-all rounded-xl group">
                                        <div className="flex items-center gap-4">
                                            <div className="h-10 w-10 bg-emerald-100 text-emerald-600 rounded-lg flex flex-col items-center justify-center font-bold text-xs uppercase">
                                                <span>{schedule.day_of_week.substring(0, 3)}</span>
                                            </div>
                                            <div>
                                                <p className="font-bold text-slate-800">{schedule.grade}</p>
                                                <p className="text-sm text-slate-500">
                                                    {schedule.start_time.substring(0, 5)} - {schedule.end_time.substring(0, 5)}
                                                </p>
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => deleteMutation.mutate(schedule.id)}
                                            disabled={deleteMutation.isPending}
                                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                            title="Eliminar horario"
                                        >
                                            <Trash2 className="h-5 w-5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-100 bg-slate-50 shrink-0 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-6 py-2.5 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-100 transition-colors shadow-sm"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
};
