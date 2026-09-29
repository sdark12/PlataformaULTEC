import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAnnouncements, createAnnouncement, deleteAnnouncement, getCourses } from './academicService';
import { 
    Loader2, Megaphone, Trash2, Plus, X, Send, Bell, BellRing, 
    Search, Calendar, AlertTriangle, BookOpen, 
    Users, Sparkles, CheckCircle2
} from 'lucide-react';
import ConfirmModal from '../../components/ui/ConfirmModal';

const Announcements = () => {
    const queryClient = useQueryClient();
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const userRole = user?.role;
    const isStudent = userRole === 'student';
    const isAdmin = ['admin', 'superadmin', 'secretary'].includes(userRole);

    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
    
    // Filters & Search
    const [searchTerm, setSearchTerm] = useState('');
    const [audienceFilter, setAudienceFilter] = useState<'all' | 'students' | 'instructors' | 'courses'>('all');
    
    // New Announcement Form
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [targetRole, setTargetRole] = useState('all');
    const [targetCourseId, setTargetCourseId] = useState('');
    const [isUrgent, setIsUrgent] = useState(false);
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
            setIsUrgent(false);
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
        if (!title.trim() || !content.trim()) return;
        setIsSubmitting(true);
        try {
            const finalTitle = isUrgent && !title.toUpperCase().includes('URGENTE') 
                ? `🚨 URGENTE: ${title.trim()}` 
                : title.trim();

            await createMutation.mutateAsync({ 
                title: finalTitle, 
                content: content.trim(), 
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

    const handleDelete = (id: string) => {
        setDeleteConfirmId(id);
    };

    const confirmDelete = async () => {
        if (deleteConfirmId) {
            await deleteMutation.mutateAsync(deleteConfirmId);
            setDeleteConfirmId(null);
        }
    };

    // Filtered announcements
    const filteredAnnouncements = useMemo(() => {
        if (!announcements) return [];
        return announcements.filter(item => {
            const matchesSearch = 
                item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                item.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (item.author_name && item.author_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (item.course_name && item.course_name.toLowerCase().includes(searchTerm.toLowerCase()));

            if (!matchesSearch) return false;

            if (audienceFilter === 'students') return item.target_role === 'student';
            if (audienceFilter === 'instructors') return item.target_role === 'instructor';
            if (audienceFilter === 'courses') return Boolean(item.target_course_id);

            return true;
        });
    }, [announcements, searchTerm, audienceFilter]);

    // Counts for filter pills
    const counts = useMemo(() => {
        if (!announcements) return { all: 0, students: 0, instructors: 0, courses: 0 };
        return {
            all: announcements.length,
            students: announcements.filter(a => a.target_role === 'student').length,
            instructors: announcements.filter(a => a.target_role === 'instructor').length,
            courses: announcements.filter(a => Boolean(a.target_course_id)).length,
        };
    }, [announcements]);

    return (
        <div className="max-w-6xl mx-auto pb-16 px-1 sm:px-4 animate-in fade-in duration-500">
            {/* Header section with high-contrast typography and mobile-friendly stacking */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div className="flex items-start gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-lg shadow-blue-500/25 ring-4 ring-blue-500/10">
                        <Megaphone className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                            Tablón de Comunicados
                        </h1>
                        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-xl">
                            Avisos importantes, noticias y actualizaciones oficiales de la institución y tus cursos.
                        </p>
                    </div>
                </div>

                {!isStudent && (
                    <button 
                        onClick={() => setIsCreateModalOpen(true)}
                        className="w-full sm:w-auto bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-indigo-500 text-white px-5 py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2.5 transition-all active:scale-[0.98] shadow-lg shadow-blue-500/25 border border-white/10"
                    >
                        <Plus className="w-5 h-5 stroke-[2.5]" />
                        <span>Publicar Aviso</span>
                    </button>
                )}
            </div>

            {/* Search and Audience Filter Controls */}
            <div className="space-y-3 mb-6">
                <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        placeholder="Buscar por título, contenido, autor o curso..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-9 py-2.5 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue transition-all shadow-sm"
                    />
                    {searchTerm && (
                        <button
                            onClick={() => setSearchTerm('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>

                {/* Filter Pills (scrollable horizontally on mobile) */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar text-xs font-semibold">
                    <button
                        onClick={() => setAudienceFilter('all')}
                        className={`px-3.5 py-1.5 rounded-xl transition-all shrink-0 flex items-center gap-1.5 ${
                            audienceFilter === 'all'
                                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
                                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                    >
                        <span>Todos</span>
                        <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                            audienceFilter === 'all' ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                        }`}>
                            {counts.all}
                        </span>
                    </button>

                    <button
                        onClick={() => setAudienceFilter('students')}
                        className={`px-3.5 py-1.5 rounded-xl transition-all shrink-0 flex items-center gap-1.5 ${
                            audienceFilter === 'students'
                                ? 'bg-purple-600 text-white shadow-md shadow-purple-500/25'
                                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                    >
                        <span>Solo Alumnos</span>
                        <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                            audienceFilter === 'students' ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                        }`}>
                            {counts.students}
                        </span>
                    </button>

                    <button
                        onClick={() => setAudienceFilter('instructors')}
                        className={`px-3.5 py-1.5 rounded-xl transition-all shrink-0 flex items-center gap-1.5 ${
                            audienceFilter === 'instructors'
                                ? 'bg-amber-600 text-white shadow-md shadow-amber-500/25'
                                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                    >
                        <span>Solo Profesores</span>
                        <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                            audienceFilter === 'instructors' ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                        }`}>
                            {counts.instructors}
                        </span>
                    </button>

                    <button
                        onClick={() => setAudienceFilter('courses')}
                        className={`px-3.5 py-1.5 rounded-xl transition-all shrink-0 flex items-center gap-1.5 ${
                            audienceFilter === 'courses'
                                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/25'
                                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                    >
                        <span>Por Curso</span>
                        <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                            audienceFilter === 'courses' ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                        }`}>
                            {counts.courses}
                        </span>
                    </button>
                </div>
            </div>

            {/* Content loading / empty / list */}
            {loadingAnnouncements ? (
                <div className="flex flex-col items-center justify-center p-16 sm:p-24 bg-white/50 dark:bg-slate-900/50 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 backdrop-blur-sm">
                    <Loader2 className="w-10 h-10 animate-spin text-brand-blue mb-4" />
                    <p className="text-slate-500 dark:text-slate-400 font-semibold text-sm">Cargando comunicados...</p>
                </div>
            ) : filteredAnnouncements.length === 0 ? (
                <div className="bg-white/60 dark:bg-slate-900/60 rounded-3xl border border-dashed border-slate-300 dark:border-slate-800 p-12 sm:p-20 flex flex-col items-center justify-center text-center shadow-sm backdrop-blur-sm">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 bg-blue-500/10 text-blue-500 rounded-3xl flex items-center justify-center mb-4 ring-8 ring-blue-500/5">
                        <Bell className="w-8 h-8 sm:w-10 sm:h-10" />
                    </div>
                    <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white mb-2">
                        {searchTerm ? 'No se encontraron resultados' : 'Sin Comunicados Disponibles'}
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-sm mb-6">
                        {searchTerm 
                            ? 'Prueba con otra palabra clave o limpia el campo de búsqueda.' 
                            : 'No hay avisos registrados bajo los filtros seleccionados en este momento.'}
                    </p>
                    {searchTerm ? (
                        <button
                            onClick={() => setSearchTerm('')}
                            className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all"
                        >
                            Limpiar búsqueda
                        </button>
                    ) : !isStudent && (
                        <button
                            onClick={() => setIsCreateModalOpen(true)}
                            className="px-5 py-2.5 bg-brand-blue hover:bg-blue-600 text-white rounded-xl text-xs sm:text-sm font-bold shadow-lg shadow-blue-500/20 active:scale-95 transition-all flex items-center gap-2"
                        >
                            <Plus className="w-4 h-4" />
                            <span>Crear el primer comunicado</span>
                        </button>
                    )}
                </div>
            ) : (
                <div className="space-y-4">
                    {filteredAnnouncements.map((announcement) => {
                        const isNoticeUrgent = 
                            announcement.title.toUpperCase().includes('URGENTE') || 
                            announcement.title.toUpperCase().includes('IMPORTANTE') ||
                            announcement.title.includes('🚨');

                        return (
                            <article 
                                key={announcement.id} 
                                className="bg-white dark:bg-slate-900/90 rounded-3xl shadow-sm hover:shadow-md border border-slate-200/80 dark:border-slate-800/90 p-5 sm:p-6 relative overflow-hidden transition-all duration-200 group"
                            >
                                {/* Left accent indicator */}
                                <div 
                                    className={`absolute left-0 top-0 bottom-0 w-1.5 sm:w-2 ${
                                        isNoticeUrgent
                                            ? 'bg-gradient-to-b from-rose-500 to-amber-500'
                                            : announcement.target_role === 'student'
                                            ? 'bg-gradient-to-b from-purple-500 to-pink-500'
                                            : announcement.target_role === 'instructor'
                                            ? 'bg-gradient-to-b from-amber-500 to-orange-500'
                                            : 'bg-gradient-to-b from-blue-500 to-indigo-600'
                                    }`}
                                />
                                
                                <div className="pl-1.5 sm:pl-2">
                                    {/* Top Metadata Row: Badges and Actions */}
                                    <div className="flex items-start justify-between gap-3 mb-3">
                                        <div className="flex flex-wrap items-center gap-2">
                                            {/* Audience Badge */}
                                            {announcement.target_role === 'student' && (
                                                <span className="px-2.5 py-1 rounded-lg text-[10px] sm:text-xs font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 uppercase tracking-wider flex items-center gap-1">
                                                    <Users className="w-3 h-3" /> Solo Alumnos
                                                </span>
                                            )}
                                            {announcement.target_role === 'instructor' && (
                                                <span className="px-2.5 py-1 rounded-lg text-[10px] sm:text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 uppercase tracking-wider flex items-center gap-1">
                                                    <Users className="w-3 h-3" /> Solo Profesores
                                                </span>
                                            )}
                                            {announcement.target_role === 'all' && (
                                                <span className="px-2.5 py-1 rounded-lg text-[10px] sm:text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 uppercase tracking-wider flex items-center gap-1">
                                                    <Sparkles className="w-3 h-3" /> Toda la Institución
                                                </span>
                                            )}

                                            {/* Course Badge if any */}
                                            {announcement.course_name && (
                                                <span className="px-2.5 py-1 rounded-lg text-[10px] sm:text-xs font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center gap-1">
                                                    <BookOpen className="w-3 h-3" /> {announcement.course_name}
                                                </span>
                                            )}

                                            {/* Urgent indicator tag */}
                                            {isNoticeUrgent && (
                                                <span className="px-2 py-1 rounded-lg text-[10px] sm:text-xs font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 flex items-center gap-1 animate-pulse">
                                                    <AlertTriangle className="w-3 h-3" /> URGENTE
                                                </span>
                                            )}
                                        </div>

                                        {/* Admin Delete Action */}
                                        {isAdmin && (
                                            <button 
                                                onClick={() => handleDelete(announcement.id)}
                                                className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center transition-all active:scale-90 border border-rose-500/20 shrink-0"
                                                title="Eliminar Comunicado"
                                                aria-label="Eliminar Comunicado"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>

                                    {/* Announcement Title */}
                                    <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-3 leading-snug break-words">
                                        {announcement.title}
                                    </h2>

                                    {/* Announcement Body */}
                                    <div className="bg-slate-50/80 dark:bg-slate-800/50 p-4 sm:p-5 rounded-2xl border border-slate-100 dark:border-slate-800/80 mb-4 text-slate-700 dark:text-slate-200 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap break-words">
                                        {announcement.content}
                                    </div>

                                    {/* Footer Info: Author & Date */}
                                    <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800/60">
                                        <div className="flex items-center gap-2 font-medium">
                                            <div className="w-6 h-6 rounded-full bg-blue-500/10 text-brand-blue flex items-center justify-center font-bold text-[10px] uppercase">
                                                {announcement.author_name ? announcement.author_name.charAt(0) : 'U'}
                                            </div>
                                            <span className="text-slate-800 dark:text-slate-200 font-semibold">
                                                {announcement.author_name || 'Administración'}
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-1.5 font-medium">
                                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                            <span>
                                                {new Date(announcement.created_at).toLocaleDateString('es-ES', { 
                                                    weekday: 'short', 
                                                    year: 'numeric', 
                                                    month: 'short', 
                                                    day: 'numeric' 
                                                })}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </article>
                        );
                    })}
                </div>
            )}

            {/* Create Modal for Instructors/Admins */}
            {isCreateModalOpen && createPortal(
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-[120] p-4 overflow-y-auto">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 my-auto">
                        {/* Modal Header */}
                        <div className="flex justify-between items-center px-6 py-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-brand-blue flex items-center justify-center">
                                    <BellRing className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">Publicar Nuevo Aviso</h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">Será visible para los destinatarios seleccionados.</p>
                                </div>
                            </div>
                            <button 
                                onClick={() => setIsCreateModalOpen(false)} 
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 p-2 rounded-xl transition-colors"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Modal Form */}
                        <form onSubmit={handleCreate} className="p-6 space-y-4">
                            {/* Urgent toggle */}
                            <div 
                                onClick={() => setIsUrgent(!isUrgent)}
                                className={`flex items-center justify-between p-3.5 rounded-2xl border cursor-pointer transition-all ${
                                    isUrgent 
                                        ? 'bg-rose-500/10 border-rose-500/40 text-rose-700 dark:text-rose-300' 
                                        : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/80 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                                }`}
                            >
                                <div className="flex items-center gap-2.5">
                                    <AlertTriangle className={`w-5 h-5 ${isUrgent ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'}`} />
                                    <div>
                                        <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                                            Marcar como Urgente / Alta Prioridad
                                        </div>
                                        <div className="text-[11px] opacity-80">
                                            Destacará el aviso con borde e indicador llamativo.
                                        </div>
                                    </div>
                                </div>
                                <div className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all ${
                                    isUrgent ? 'bg-rose-600 border-rose-600 text-white' : 'border-slate-400'
                                }`}>
                                    {isUrgent && <CheckCircle2 className="w-4 h-4 text-white" />}
                                </div>
                            </div>

                            {/* Title */}
                            <div>
                                <label className="block text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                    Título del Comunicado <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-4 focus:ring-brand-blue/10 focus:border-brand-blue transition-all outline-none text-sm text-slate-900 dark:text-white placeholder-slate-400"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="Ej. Suspensión de actividades por asueto..."
                                />
                            </div>
                            
                            {/* Message content */}
                            <div>
                                <label className="block text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                    Contenido del Aviso <span className="text-rose-500">*</span>
                                </label>
                                <textarea
                                    required
                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-4 focus:ring-brand-blue/10 focus:border-brand-blue transition-all outline-none resize-none h-32 text-sm text-slate-900 dark:text-white placeholder-slate-400"
                                    value={content}
                                    onChange={(e) => setContent(e.target.value)}
                                    placeholder="Escribe los detalles completos del comunicado oficial..."
                                />
                            </div>

                            {/* Audience & Course Selector */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                <div>
                                    <label className="block text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                        Destinatarios
                                    </label>
                                    <select
                                        className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-4 focus:ring-brand-blue/10 focus:border-brand-blue transition-all outline-none text-xs sm:text-sm text-slate-900 dark:text-white"
                                        value={targetRole}
                                        onChange={(e) => setTargetRole(e.target.value)}
                                    >
                                        <option value="all">Toda la Institución</option>
                                        <option value="student">Solo Estudiantes</option>
                                        <option value="instructor">Solo Profesores</option>
                                    </select>
                                </div>
                                
                                <div>
                                    <label className="block text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                        Curso Específico
                                    </label>
                                    <select
                                        className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-4 focus:ring-brand-blue/10 focus:border-brand-blue transition-all outline-none text-xs sm:text-sm text-slate-900 dark:text-white"
                                        value={targetCourseId}
                                        onChange={(e) => setTargetCourseId(e.target.value)}
                                    >
                                        <option value="">Aviso Institucional General</option>
                                        {courses?.map((c) => (
                                             <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Buttons */}
                            <div className="pt-3 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsCreateModalOpen(false)}
                                    className="flex-1 px-4 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-xs sm:text-sm"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting || !title.trim() || !content.trim()}
                                    className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-2 text-xs sm:text-sm shadow-lg shadow-blue-500/25"
                                >
                                    {isSubmitting ? (
                                        <><Loader2 className="w-4 h-4 animate-spin" /> Publicando...</>
                                    ) : (
                                        <><Send className="w-4 h-4" /> Publicar Aviso</>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}

            {/* Modal de Confirmación para Eliminar Comunicado */}
            <ConfirmModal
                isOpen={!!deleteConfirmId}
                title="¿Eliminar Comunicado?"
                description="¿Estás seguro de que deseas eliminar este comunicado? Ya no será visible para los estudiantes ni docentes."
                confirmText="Sí, Eliminar"
                cancelText="Cancelar"
                variant="danger"
                isLoading={deleteMutation.isPending}
                onConfirm={confirmDelete}
                onClose={() => setDeleteConfirmId(null)}
            />
        </div>
    );
};

export default Announcements;

