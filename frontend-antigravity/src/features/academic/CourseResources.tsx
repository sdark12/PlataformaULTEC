import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getCourses, getCourseResources, createCourseResource, deleteCourseResource, getMyEnrolledCourses } from './academicService';
import type { Course } from './academicService';
import { Loader2, Library, FileText, Trash2, Plus, X, UploadCloud, Link as LinkIcon, Video, Image, BookOpen, Search, ExternalLink } from 'lucide-react';

const RESOURCE_TYPE_MAP: Record<string, { label: string; icon: any; color: string; bg: string }> = {
    link: { label: 'Enlace', icon: LinkIcon, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-100' },
    document: { label: 'Documento', icon: FileText, color: 'text-indigo-600', bg: 'bg-indigo-50 border-indigo-100' },
    video: { label: 'Video', icon: Video, color: 'text-rose-600', bg: 'bg-rose-50 border-rose-100' },
    image: { label: 'Imagen', icon: Image, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-100' },
    other: { label: 'Otro', icon: BookOpen, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-100' },
};

const getResourceStyle = (type?: string) => RESOURCE_TYPE_MAP[type || 'link'] || RESOURCE_TYPE_MAP.link;

const CourseResources = () => {
    const queryClient = useQueryClient();
    const userRole = JSON.parse(localStorage.getItem('user') || '{}')?.role;

    const isStudentOrParent = userRole === 'student' || userRole === 'parent';
    const canManage = ['admin', 'superadmin', 'instructor'].includes(userRole);

    const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    
    // New Resource Form
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [fileUrl, setFileUrl] = useState('');
    const [resourceType, setResourceType] = useState('link');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Get courses — students/parents: enrolled only, others: all courses
    const { data: courses, isLoading: loadingCourses } = useQuery({
        queryKey: isStudentOrParent ? ['my-enrolled-courses'] : ['courses'],
        queryFn: isStudentOrParent ? getMyEnrolledCourses : getCourses,
    });

    // Get Resources for selected course
    const { data: resources, isLoading: loadingResources } = useQuery({
        queryKey: ['course-resources', selectedCourse?.id],
        queryFn: () => getCourseResources(selectedCourse!.id),
        enabled: !!selectedCourse,
    });

    const createResourceMutation = useMutation({
        mutationFn: (data: { title: string; description: string; file_url: string; resource_type: string }) => createCourseResource(selectedCourse!.id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['course-resources', selectedCourse?.id] });
            setIsUploadModalOpen(false);
            resetForm();
        }
    });

    const deleteResourceMutation = useMutation({
        mutationFn: deleteCourseResource,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['course-resources', selectedCourse?.id] });
        }
    });

    const resetForm = () => {
        setTitle('');
        setDescription('');
        setFileUrl('');
        setResourceType('link');
    };

    const handleCreateResource = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title || !fileUrl) return;
        setIsSubmitting(true);
        try {
            await createResourceMutation.mutateAsync({ title, description, file_url: fileUrl, resource_type: resourceType });
        } catch (error) {
            console.error('Error uploading resource:', error);
            alert('Error al subir el recurso.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteResource = async (resourceId: string) => {
        if (window.confirm('¿Estás seguro de que deseas eliminar este recurso?')) {
            await deleteResourceMutation.mutateAsync(resourceId);
        }
    };

    const filteredResources = resources?.filter((r) =>
        r.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.description?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="max-w-7xl mx-auto pb-12 animate-in fade-in duration-500">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight mb-2">Biblioteca de Recursos</h2>
            <p className="text-slate-500 dark:text-slate-400 mb-8 max-w-2xl">
                {isStudentOrParent
                    ? 'Accede al material de estudio, documentos, enlaces y herramientas compartidas por los profesores de los cursos.'
                    : 'Gestiona y comparte material de estudio, documentos y enlaces con tus estudiantes.'}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                {/* Courses Sidebar */}
                <div className="md:col-span-1 space-y-3">
                    <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm uppercase tracking-wider mb-4">
                        {isStudentOrParent ? 'Cursos Inscritos' : 'Cursos Disponibles'}
                    </h3>
                    {loadingCourses ? (
                        <div className="flex justify-center p-6"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
                    ) : !courses || courses.length === 0 ? (
                        <div className="text-center p-6 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
                            <Library className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                {isStudentOrParent ? 'No hay cursos inscritos actualmente.' : 'No hay cursos registrados.'}
                            </p>
                        </div>
                    ) : (
                        courses.map((course) => (
                            <button
                                key={course.id}
                                onClick={() => { setSelectedCourse(course); setSearchTerm(''); }}
                                className={`w-full text-left p-4 rounded-xl border transition-all duration-200 ${
                                    selectedCourse?.id === course.id 
                                        ? 'bg-brand-blue/10 dark:bg-brand-blue/20 border-brand-blue/30 shadow-sm shadow-brand-blue/10' 
                                        : 'bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 hover:border-brand-blue/30 hover:shadow-sm'
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg ${selectedCourse?.id === course.id ? 'bg-brand-blue/20 text-brand-blue' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}`}>
                                        <Library className="w-5 h-5" />
                                    </div>
                                    <span className={`font-semibold text-sm ${selectedCourse?.id === course.id ? 'text-brand-blue' : 'text-slate-700 dark:text-slate-300'}`}>
                                        {course.name}
                                    </span>
                                </div>
                            </button>
                        ))
                    )}
                </div>

                {/* Resources Main Area */}
                <div className="md:col-span-3">
                    {!selectedCourse ? (
                        <div className="bg-slate-50/50 dark:bg-slate-800/30 rounded-3xl border border-dashed border-slate-300 dark:border-slate-700 p-16 flex flex-col items-center justify-center text-center">
                            <div className="w-20 h-20 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center shadow-sm mb-4">
                                <FileText className="w-10 h-10 text-slate-300 dark:text-slate-600" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-2">Selecciona un curso</h3>
                            <p className="text-slate-500 dark:text-slate-400 max-w-sm">
                                Elige uno de tus cursos a la izquierda para ver los recursos y materiales de estudio disponibles.
                            </p>
                        </div>
                    ) : (
                        <div className="bg-white dark:bg-slate-800/50 rounded-2xl shadow-sm border border-slate-200/60 dark:border-slate-700/60 overflow-hidden">
                            {/* Header */}
                            <div className="p-6 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/80 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                <div>
                                    <h3 className="font-bold text-slate-800 dark:text-white text-lg">{selectedCourse.name}</h3>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">{filteredResources?.length || 0} recursos disponibles</p>
                                </div>
                                <div className="flex items-center gap-3 w-full sm:w-auto">
                                    {/* Search */}
                                    <div className="relative flex-1 sm:flex-initial">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <input
                                            type="text"
                                            placeholder="Buscar recurso..."
                                            className="w-full sm:w-56 pl-9 pr-4 py-2.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue outline-none transition-all"
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                        />
                                    </div>
                                    {canManage && (
                                        <button 
                                            onClick={() => setIsUploadModalOpen(true)}
                                            className="bg-brand-blue hover:bg-blue-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all active:scale-95 shadow-sm shadow-blue-500/20 whitespace-nowrap"
                                        >
                                            <Plus className="w-4 h-4" />
                                            <span>Subir Recurso</span>
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Resources List */}
                            {loadingResources ? (
                                <div className="flex justify-center p-16"><Loader2 className="w-8 h-8 animate-spin text-brand-blue" /></div>
                            ) : filteredResources?.length === 0 ? (
                                <div className="p-16 text-center text-slate-500 dark:text-slate-400">
                                    <UploadCloud className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
                                    <p className="font-medium text-slate-600 dark:text-slate-300">
                                        {searchTerm ? 'No se encontraron recursos con ese término.' : 'No hay recursos en este curso.'}
                                    </p>
                                    {canManage && !searchTerm && <p className="text-sm mt-1">Sube el primer material para tus alumnos.</p>}
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-100 dark:divide-slate-700/50 p-2">
                                    {filteredResources?.map((resource) => {
                                        const style = getResourceStyle(resource.resource_type);
                                        const IconComponent = style.icon;
                                        return (
                                            <div key={resource.id} className="p-4 hover:bg-slate-50/50 dark:hover:bg-slate-700/30 rounded-xl transition-colors flex items-start gap-4 group">
                                                <div className={`w-12 h-12 ${style.bg} dark:bg-opacity-20 rounded-xl flex items-center justify-center border shrink-0`}>
                                                    <IconComponent className={`w-6 h-6 ${style.color}`} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <h4 className="font-bold text-slate-800 dark:text-white text-base truncate">{resource.title}</h4>
                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${style.bg} ${style.color} border shrink-0`}>
                                                            {style.label}
                                                        </span>
                                                    </div>
                                                    {resource.description && (
                                                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 leading-relaxed line-clamp-2">{resource.description}</p>
                                                    )}
                                                    <div className="flex items-center gap-3 mt-3 text-xs font-semibold text-slate-400 dark:text-slate-500">
                                                        <span>Subido el {new Date(resource.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                                        {resource.author?.full_name && (
                                                            <>
                                                                <span>•</span>
                                                                <span>Por {resource.author.full_name}</span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0 opacity-70 group-hover:opacity-100 transition-opacity">
                                                    <a 
                                                        href={resource.file_url.startsWith('http') ? resource.file_url : `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}${resource.file_url}`} 
                                                        target="_blank" 
                                                        rel="noopener noreferrer"
                                                        className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 hover:bg-brand-blue/10 text-slate-600 dark:text-slate-400 hover:text-brand-blue flex items-center justify-center transition-colors"
                                                        title="Abrir / Descargar"
                                                    >
                                                        <ExternalLink className="w-4 h-4" />
                                                    </a>
                                                    {canManage && (
                                                        <button 
                                                            onClick={() => handleDeleteResource(resource.id)}
                                                            className="w-10 h-10 rounded-full bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 dark:hover:bg-rose-500/20 text-rose-500 flex items-center justify-center transition-colors"
                                                            title="Eliminar"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Upload Modal for Instructors/Admins */}
            {isUploadModalOpen && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center p-6 border-b border-slate-100 dark:border-slate-700">
                            <h3 className="text-xl font-bold text-slate-800 dark:text-white">Subir Recurso de Estudio</h3>
                            <button onClick={() => { setIsUploadModalOpen(false); resetForm(); }} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 p-2 rounded-full transition-colors">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <form onSubmit={handleCreateResource} className="p-6 space-y-5">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Título del Recurso</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-4 focus:ring-brand-blue/10 focus:border-brand-blue transition-all outline-none text-slate-800 dark:text-white"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="Ej. Presentación Clase 1, Guía de Estudio..."
                                />
                            </div>
                            
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Tipo de Recurso</label>
                                <div className="grid grid-cols-5 gap-2">
                                    {Object.entries(RESOURCE_TYPE_MAP).map(([key, item]) => {
                                        const TypeIcon = item.icon;
                                        return (
                                            <button
                                                type="button"
                                                key={key}
                                                onClick={() => setResourceType(key)}
                                                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-xs font-bold transition-all ${
                                                    resourceType === key
                                                        ? `${item.bg} ${item.color} border-current shadow-sm`
                                                        : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:border-slate-300'
                                                }`}
                                            >
                                                <TypeIcon className="w-5 h-5" />
                                                {item.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Descripción (Opcional)</label>
                                <textarea
                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-4 focus:ring-brand-blue/10 focus:border-brand-blue transition-all outline-none resize-none h-24 text-slate-800 dark:text-white"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Instrucciones breves o resumen del material..."
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">URL del Archivo o Enlace</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-4 focus:ring-brand-blue/10 focus:border-brand-blue transition-all outline-none text-slate-800 dark:text-white"
                                    value={fileUrl}
                                    onChange={(e) => setFileUrl(e.target.value)}
                                    placeholder="https://drive.google.com/... o enlace a video"
                                />
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 flex items-center gap-1">
                                    <LinkIcon className="w-3 h-3" /> Pega un enlace de Google Drive, YouTube, OneDrive, etc.
                                </p>
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => { setIsUploadModalOpen(false); resetForm(); }}
                                    className="flex-1 px-4 py-3 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting || !title || !fileUrl}
                                    className="flex-1 px-4 py-3 bg-brand-blue text-white font-bold rounded-xl hover:bg-blue-600 transition-colors active:scale-95 disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-2"
                                >
                                    {isSubmitting ? (
                                        <><Loader2 className="w-5 h-5 animate-spin" /> Subiendo...</>
                                    ) : (
                                        <><UploadCloud className="w-5 h-5" /> Publicar Recurso</>
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

export default CourseResources;
