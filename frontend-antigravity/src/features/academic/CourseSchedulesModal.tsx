import React, { useState } from 'react';
import { createPortal } from 'react-dom';
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
            const msg = err.response?.data?.errors?.[0]?.message || err.response?.data?.message || 'Error al crear horario.';
            setErrorMsg(msg);
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
        if (!newSchedule.grade.trim() || !newSchedule.start_time || !newSchedule.end_time) {
            setErrorMsg('Todos los campos son obligatorios');
            return;
        }

        // Validate time
        if (newSchedule.start_time >= newSchedule.end_time) {
            setErrorMsg('La hora de fin debe ser mayor a la hora de inicio');
            return;
        }

        // Format to HH:MM standard
        const formatTime = (t: string) => t.slice(0, 5);

        createMutation.mutate({
            grade: newSchedule.grade.trim(),
            day_of_week: newSchedule.day_of_week,
            start_time: formatTime(newSchedule.start_time),
            end_time: formatTime(newSchedule.end_time)
        });
    };

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4">
            <div className="absolute inset-0 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose} />

            <div className="bg-slate-900 text-white rounded-2xl sm:rounded-3xl w-full max-w-2xl shadow-2xl relative z-10 overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[92vh] border border-slate-800">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/90 shrink-0">
                    <div className="flex items-center gap-2.5">
                        <div className="h-9 w-9 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold">
                            <Calendar className="h-5 w-5" />
                        </div>
                        <div>
                            <h3 className="text-base sm:text-lg font-bold">Horarios del Curso</h3>
                            <p className="text-[11px] text-slate-400">
                                <span className="font-semibold text-emerald-400">{course.name}</span> • Configura grados y horas
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                        aria-label="Cerrar"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
                    {/* Add Schedule Form */}
                    <form onSubmit={handleAdd} className="bg-slate-800/60 p-4 sm:p-5 rounded-2xl border border-slate-700/80 space-y-4">
                        <h4 className="font-bold text-sm text-slate-200 flex items-center gap-2">
                            <Plus className="h-4 w-4 text-emerald-400" />
                            Agregar Nuevo Horario
                        </h4>

                        {errorMsg && (
                            <div className="bg-red-500/10 text-red-400 px-3.5 py-2 rounded-xl text-xs font-medium border border-red-500/20 animate-shake">
                                {errorMsg}
                            </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                            <div className="sm:col-span-2 lg:col-span-1">
                                <label className="text-xs font-semibold text-slate-300 ml-1">Grado/Nivel *</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Ej: 2do Básico"
                                    className="w-full mt-1 px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-white text-xs sm:text-sm placeholder:text-slate-500"
                                    value={newSchedule.grade}
                                    onChange={e => setNewSchedule({ ...newSchedule, grade: e.target.value })}
                                />
                            </div>

                            <div className="sm:col-span-2 lg:col-span-1">
                                <label className="text-xs font-semibold text-slate-300 ml-1">Días *</label>
                                <select
                                    className="w-full mt-1 px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-white text-xs sm:text-sm"
                                    value={newSchedule.day_of_week}
                                    onChange={e => setNewSchedule({ ...newSchedule, day_of_week: e.target.value })}
                                >
                                    <optgroup label="Agrupados" className="bg-slate-900 text-slate-400">
                                        <option value="Lunes a Viernes" className="text-white">Lunes a Viernes</option>
                                        <option value="Sábado y Domingo" className="text-white">Sábado y Domingo</option>
                                        <option value="Lunes, Miérc. y Vier." className="text-white">Lunes, Miérc. y Vier.</option>
                                        <option value="Martes y Jueves" className="text-white">Martes y Jueves</option>
                                    </optgroup>
                                    <optgroup label="Individuales" className="bg-slate-900 text-slate-400">
                                        <option value="Lunes" className="text-white">Lunes</option>
                                        <option value="Martes" className="text-white">Martes</option>
                                        <option value="Miércoles" className="text-white">Miércoles</option>
                                        <option value="Jueves" className="text-white">Jueves</option>
                                        <option value="Viernes" className="text-white">Viernes</option>
                                        <option value="Sábado" className="text-white">Sábado</option>
                                        <option value="Domingo" className="text-white">Domingo</option>
                                    </optgroup>
                                </select>
                            </div>

                            <div>
                                <label className="text-xs font-semibold text-slate-300 ml-1">Inicio *</label>
                                <input
                                    type="time"
                                    required
                                    className="w-full mt-1 px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-white text-xs sm:text-sm"
                                    value={newSchedule.start_time}
                                    onChange={e => setNewSchedule({ ...newSchedule, start_time: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="text-xs font-semibold text-slate-300 ml-1">Fin *</label>
                                <input
                                    type="time"
                                    required
                                    className="w-full mt-1 px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-white text-xs sm:text-sm"
                                    value={newSchedule.end_time}
                                    onChange={e => setNewSchedule({ ...newSchedule, end_time: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="flex justify-end pt-1">
                            <button
                                type="submit"
                                disabled={createMutation.isPending}
                                className="w-full sm:w-auto px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 text-xs sm:text-sm shadow-md shadow-emerald-600/30 active:scale-95 disabled:opacity-50"
                            >
                                {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                Guardar Horario
                            </button>
                        </div>
                    </form>

                    {/* Schedules List */}
                    <div>
                        <h4 className="font-bold text-xs sm:text-sm text-slate-300 mb-3 px-1">Horarios Registrados</h4>

                        {isLoading ? (
                            <div className="flex justify-center p-8">
                                <Loader2 className="h-7 w-7 text-emerald-400 animate-spin" />
                            </div>
                        ) : schedules?.length === 0 ? (
                            <div className="text-center p-6 bg-slate-800/40 border border-dashed border-slate-700/80 rounded-2xl text-slate-400">
                                <Clock className="h-7 w-7 mx-auto mb-2 text-slate-500" />
                                <p className="text-xs">No hay horarios registrados para este curso todavía.</p>
                            </div>
                        ) : (
                            <div className="space-y-2.5">
                                {schedules?.map(schedule => (
                                    <div
                                        key={schedule.id}
                                        className="flex items-center justify-between p-3.5 bg-slate-800/70 border border-slate-700/70 hover:border-emerald-500/40 transition-all rounded-xl"
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="h-9 w-9 bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 rounded-xl flex flex-col items-center justify-center font-bold text-[10px] uppercase shrink-0">
                                                <span>{schedule.day_of_week.substring(0, 3)}</span>
                                            </div>
                                            <div className="min-w-0">
                                                <p className="font-bold text-slate-100 text-xs sm:text-sm truncate">{schedule.grade}</p>
                                                <p className="text-[11px] text-slate-400 flex items-center gap-1">
                                                    <Clock className="h-3 w-3" />
                                                    {schedule.start_time.substring(0, 5)} - {schedule.end_time.substring(0, 5)} • {schedule.day_of_week}
                                                </p>
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => deleteMutation.mutate(schedule.id)}
                                            disabled={deleteMutation.isPending}
                                            className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors shrink-0 ml-2"
                                            title="Eliminar horario"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="px-5 py-3.5 border-t border-slate-800 bg-slate-900/90 shrink-0 flex justify-end">
                    <button
                        onClick={onClose}
                        className="w-full sm:w-auto px-5 py-2 bg-slate-800 border border-slate-700 text-slate-300 font-semibold rounded-xl hover:bg-slate-700 transition-colors text-xs sm:text-sm"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};
