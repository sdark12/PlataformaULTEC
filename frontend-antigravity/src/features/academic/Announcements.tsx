import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAnnouncements, createAnnouncement, deleteAnnouncement, getCourses } from './academicService';
import { Loader2, Megaphone, Trash2, Plus, X, Send, Bell } from 'lucide-react';

const Announcements = () => {
    const queryClient = useQueryClient();
    const userRole = JSON.parse(localStorage.getItem('user') || '{}')?.role;
    const isStudent = userRole === 'student';
    const isAdmin = ['admin', 'superadmin', 'secretary'].includes(userRole);

    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    
    // New Announcement Form
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [targetRole, setTargetRole] = useState('all');
    const [targetCourseId, setTargetCourseId] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Get Announcements
    const { data: announcements, isLoading: loadingAnnouncements } = useQuery({
        queryKey: ['announcements'],
        queryFn: getAnnouncements,
    });

    // Get Courses for selection (if instructor/admin)
    const { data: courses } = useQuery({
        queryKey: ['courses'],
        queryFn: getCourses,
        enabled: !isStudent,
    });

    const createMutation = useMutation({
        mutationFn: (data: any) => createAnnouncement(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['announcements'] });
            setIsCreateModalOpen(false);
            setTitle('');
            setContent('');
            setTargetRole('all');
            setTargetCourseId('');
        }
    });

    const deleteMutation = useMutation({
        mutationFn: deleteAnnouncement,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['announcements'] });
        }
    });

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title || !content) return;
        setIsSubmitting(true);
        try {
            await createMutation.mutateAsync({ 
                title, 
                content, 
                target_role: targetRole, 
                target_course_id: targetCourseId || null 
            });
        } catch (error) {
            console.error('Error creating announcement:', error);
            alert('Error al publicar el comunicado.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('¿Estás seguro de que deseas eliminar este comunicado?')) {
            await deleteMutation.mutateAsync(id);
        }
    };

    return (
        <div className="max-w-7xl mx-auto pb-12 animate-in fade-in duration-500">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h2 className="text-3xl font-bold text-slate-900 tracking-tight mb-2">Tablón de Comunicados</h2>
                    <p className="text-slate-500 max-w-2xl">
                        Avisos importantes, noticias y actualizaciones oficiales de la institución y tus cursos.
                    </p>
                </div>
                {!isStudent && (
                    <button 
                        onClick={() => setIsCreateModalOpen(true)}
                        className="bg-brand-blue hover:bg-blue-600 text-white px-5 py-3 rounded-xl font-bold flex items-center gap-2 transition-all active:scale-95 shadow-lg shadow-blue-500/20"
                    >
                        <Plus className="w-5 h-5" />
                        <span>Publicar Aviso</span>
                    </button>
                )}
            </div>

            {loadingAnnouncements ? (
                <div className="flex flex-col items-center justify-center p-20">
                    <Loader2 className="w-10 h-10 animate-spin text-brand-blue mb-4" />
                    <p className="text-slate-500 font-medium">Cargando comunicados...</p>
                </div>
            ) : announcements?.length === 0 ? (
                <div className="bg-slate-50/50 rounded-3xl border border-dashed border-slate-300 p-20 flex flex-col items-center justify-center text-center">
                    <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-sm mb-4">
                        <Bell className="w-10 h-10 text-slate-300" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 mb-2">Sin Anuncios Recientes</h3>
                    <p className="text-slate-500 max-w-sm">
                        No hay comunicados publicados en este momento por la administración o tus profesores.
                    </p>
                </div>
            ) : (
                <div className="grid gap-6">
                    {announcements?.map((announcement) => (
                        <div key={announcement.id} className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6 relative overflow-hidden group">
                            {/* Decorative accent */}
                            <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-brand-blue"></div>
                            
                            <div className="flex justify-between items-start">
                                <div className="flex gap-4">
                                    <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-brand-blue shrink-0">
                                        <Megaphone className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-3 mb-1">
                                            <h3 className="text-xl font-bold text-slate-900">{announcement.title}</h3>
                                            {announcement.target_role === 'student' && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700 uppercase tracking-wider">Solo Alumnos</span>}
                                            {announcement.target_role === 'instructor' && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 uppercase tracking-wider">Solo Profesores</span>}
                                            {announcement.target_role === 'all' && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 uppercase tracking-wider">General</span>}
                                        </div>
                                        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-4">
                                            <span>{new Date(announcement.created_at).toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                                            <span>•</span>
                                            <span className="text-brand-blue">{announcement.author_name}</span>
                                            {announcement.course_name && (
                                                <>
                                                    <span>•</span>
                                                    <span className="bg-slate-100 px-2 py-0.5 rounded-md text-slate-600 border border-slate-200">
                                                        Curso: {announcement.course_name}
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                        <div className="text-slate-600 leading-relaxed whitespace-pre-wrap">
                                            {announcement.content}
                                        </div>
                                    </div>
                                </div>
                                
                                {isAdmin && (
                                    <button 
                                        onClick={() => handleDelete(announcement.id)}
                                        className="w-10 h-10 rounded-full bg-rose-50 hover:bg-rose-100 text-rose-400 hover:text-rose-600 flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                                        title="Eliminar Aviso"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Create Modal for Instructors/Admins */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center p-6 border-b border-slate-100">
                            <h3 className="text-xl font-bold text-slate-800">Publicar Nuevo Aviso</h3>
                            <button onClick={() => setIsCreateModalOpen(false)} className="text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 p-2 rounded-full transition-colors">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <form onSubmit={handleCreate} className="p-6 space-y-5">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Asunto del Comunicado</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-brand-blue/10 focus:border-brand-blue transition-all outline-none"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="Ej. Suspensión de clases por feriado..."
                                />
                            </div>
                            
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Mensaje</label>
                                <textarea
                                    required
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-brand-blue/10 focus:border-brand-blue transition-all outline-none resize-none h-32"
                                    value={content}
                                    onChange={(e) => setContent(e.target.value)}
                                    placeholder="Detalles del aviso..."
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Público Objetivo</label>
                                    <select
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-brand-blue/10 focus:border-brand-blue transition-all outline-none"
                                        value={targetRole}
                                        onChange={(e) => setTargetRole(e.target.value)}
                                    >
                                        <option value="all">Toda la Institución</option>
                                        <option value="student">Solo Estudiantes</option>
                                        <option value="instructor">Solo Profesores</option>
                                    </select>
                                </div>
                                
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Curso Específico (Opcional)</label>
                                    <select
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-brand-blue/10 focus:border-brand-blue transition-all outline-none"
                                        value={targetCourseId}
                                        onChange={(e) => setTargetCourseId(e.target.value)}
                                        disabled={courses?.length === 0}
                                    >
                                        <option value="">Aviso General</option>
                                        {courses?.map((c) => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsCreateModalOpen(false)}
                                    className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting || !title || !content}
                                    className="flex-1 px-4 py-3 bg-brand-blue text-white font-bold rounded-xl hover:bg-blue-600 transition-colors active:scale-95 disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-2"
                                >
                                    {isSubmitting ? (
                                        <><Loader2 className="w-5 h-5 animate-spin" /> Publicando...</>
                                    ) : (
                                        <><Send className="w-5 h-5" /> Publicar Aviso</>
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

export default Announcements;
