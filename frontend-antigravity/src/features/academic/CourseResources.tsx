import React, { useState, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
    getCourses, 
    getAllResources, 
    createCourseResource, 
    updateCourseResource,
    deleteCourseResource, 
    getMyEnrolledCourses,
    getResourcesSummaryCounts,
    uploadResourceFile
} from './academicService';
import type { CourseResource } from './academicService';
import { 
    Loader2, 
    Library, 
    FileText, 
    Trash2, 
    Plus, 
    X, 
    UploadCloud, 
    Link as LinkIcon, 
    Video, 
    Image as ImageIcon, 
    BookOpen, 
    Search, 
    LayoutGrid,
    List,
    Copy,
    Check,
    Pencil,
    ChevronDown,
    Layers,
    Calendar,
    User,
    FileUp,
    Eye,
    Play,
    Download
} from 'lucide-react';
import ConfirmModal from '../../components/ui/ConfirmModal';
import MediaViewerModal, { isYouTubeUrl } from './components/MediaViewerModal';

const RESOURCE_TYPE_MAP: Record<string, { label: string; icon: any; color: string; bg: string }> = {
    link: { label: 'Enlace', icon: LinkIcon, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900/50' },
    document: { label: 'Documento', icon: FileText, color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-900/50' },
    video: { label: 'Video', icon: Video, color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/50' },
    image: { label: 'Imagen', icon: ImageIcon, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/50' },
    other: { label: 'Otro', icon: BookOpen, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/50' },
};

const getResourceStyle = (type?: string) => RESOURCE_TYPE_MAP[type || 'link'] || RESOURCE_TYPE_MAP.link;

const CourseResources = () => {
    const queryClient = useQueryClient();
    const userRole = JSON.parse(localStorage.getItem('user') || '{}')?.role;

    const isStudentOrParent = userRole === 'student' || userRole === 'parent';
    const canManage = ['admin', 'superadmin', 'instructor'].includes(userRole);

    // Filter states
    const [selectedCourseId, setSelectedCourseId] = useState<string>('ALL'); // 'ALL' or course.id
    const [isCourseDropdownOpen, setIsCourseDropdownOpen] = useState(false);
    const [courseSearchTerm, setCourseSearchTerm] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedType, setSelectedType] = useState<string>('all');
    const [selectedAuthor, setSelectedAuthor] = useState<string>('all');
    const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'alphabetical'>('newest');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

    // Media Viewer modal state
    const [viewerResource, setViewerResource] = useState<CourseResource | null>(null);
    const [isViewerModalOpen, setIsViewerModalOpen] = useState(false);

    // Action feedback
    const [copiedId, setCopiedId] = useState<string | null>(null);

    // Modal state for Upload / Edit
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [editingResource, setEditingResource] = useState<CourseResource | null>(null);
    const [uploadMode, setUploadMode] = useState<'file' | 'url'>('url');
    const [modalCourseId, setModalCourseId] = useState<string>('');
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [fileUrl, setFileUrl] = useState('');
    const [resourceType, setResourceType] = useState('link');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Delete confirmation modal state
    const [deleteConfirmResourceId, setDeleteConfirmResourceId] = useState<string | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const courseDropdownRef = useRef<HTMLDivElement>(null);

    // Close course dropdown on outside click
    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (courseDropdownRef.current && !courseDropdownRef.current.contains(event.target as Node)) {
                setIsCourseDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Fetch courses
    const { data: courses } = useQuery({
        queryKey: isStudentOrParent ? ['my-enrolled-courses'] : ['courses'],
        queryFn: isStudentOrParent ? getMyEnrolledCourses : getCourses,
    });

    // Fetch summary metrics (counts by course and type)
    const { data: summary } = useQuery({
        queryKey: ['resources-summary-counts'],
        queryFn: getResourcesSummaryCounts,
        refetchInterval: 15000,
    });

    // Fetch resources (if 'ALL', fetch all, otherwise by course)
    const { data: resources, isLoading: loadingResources } = useQuery({
        queryKey: ['course-resources', selectedCourseId],
        queryFn: () => getAllResources(selectedCourseId === 'ALL' ? undefined : { courseId: selectedCourseId }),
    });

    const createResourceMutation = useMutation({
        mutationFn: ({ courseId, data }: { courseId: string; data: any }) => createCourseResource(courseId, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['course-resources'] });
            queryClient.invalidateQueries({ queryKey: ['resources-summary-counts'] });
            setIsUploadModalOpen(false);
            resetForm();
        }
    });

    const updateResourceMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: any }) => updateCourseResource(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['course-resources'] });
            queryClient.invalidateQueries({ queryKey: ['resources-summary-counts'] });
            setIsUploadModalOpen(false);
            resetForm();
        }
    });

    const deleteResourceMutation = useMutation({
        mutationFn: deleteCourseResource,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['course-resources'] });
            queryClient.invalidateQueries({ queryKey: ['resources-summary-counts'] });
        }
    });

    const resetForm = () => {
        setEditingResource(null);
        setTitle('');
        setDescription('');
        setFileUrl('');
        setResourceType('link');
        setSelectedFile(null);
        setUploadMode('url');
        setModalCourseId(selectedCourseId !== 'ALL' ? selectedCourseId : (courses?.[0]?.id || ''));
    };

    const handleOpenCreateModal = () => {
        resetForm();
        if (selectedCourseId !== 'ALL') {
            setModalCourseId(selectedCourseId);
        } else if (courses && courses.length > 0) {
            setModalCourseId(courses[0].id);
        }
        setIsUploadModalOpen(true);
    };

    const handleOpenEditModal = (resource: CourseResource) => {
        setEditingResource(resource);
        setTitle(resource.title);
        setDescription(resource.description || '');
        setFileUrl(resource.file_url);
        setResourceType(resource.resource_type || 'link');
        setModalCourseId(resource.course_id);
        setUploadMode(resource.file_url.startsWith('/uploads') ? 'file' : 'url');
        setSelectedFile(null);
        setIsUploadModalOpen(true);
    };

    const handleSelectResourceType = (key: string) => {
        setResourceType(key);
        if (key === 'video') {
            setUploadMode('url');
            setSelectedFile(null);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const ext = file.name.split('.').pop()?.toLowerCase() || '';

        // Block direct video uploads to protect server disk space and bandwidth
        if (['mp4', 'mov', 'avi', 'mkv', 'webm', 'wmv', 'flv', '3gp', 'm4v'].includes(ext)) {
            alert('Por optimización del almacenamiento en el servidor del colegio, los videos no se suben directamente como archivo.\n\nPor favor comparte el enlace de YouTube (puedes subirlo a YouTube como "No listado" para mantener la privacidad de la clase y no consumir almacenamiento del servidor).');
            if (e.target) e.target.value = '';
            setSelectedFile(null);
            setResourceType('video');
            setUploadMode('url');
            return;
        }

        // 15MB limit check (aligned with backend upload middleware)
        if (file.size > 15 * 1024 * 1024) {
            alert('El archivo supera el tamaño máximo permitido de 15 MB.');
            if (e.target) e.target.value = '';
            return;
        }

        setSelectedFile(file);
        if (!title) {
            // Use file name without extension as default title
            const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
            setTitle(nameWithoutExt);
        }

        // Detect resource type
        if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) {
            setResourceType('image');
        } else {
            setResourceType('document');
        }
    };

    const handleSubmitResource = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title || !modalCourseId) {
            alert('Por favor completa el título y selecciona el curso correspondiente.');
            return;
        }

        setIsSubmitting(true);
        try {
            let finalUrl = fileUrl;

            // If a new local file was selected, upload it first
            if (uploadMode === 'file' && selectedFile) {
                const uploadRes = await uploadResourceFile(selectedFile);
                finalUrl = uploadRes.file_url;
            }

            if (!finalUrl) {
                alert('Debes subir un archivo o ingresar una URL válida.');
                setIsSubmitting(false);
                return;
            }

            if (editingResource) {
                await updateResourceMutation.mutateAsync({
                    id: editingResource.id,
                    data: {
                        title,
                        description,
                        file_url: finalUrl,
                        resource_type: resourceType,
                        course_id: modalCourseId
                    }
                });
            } else {
                await createResourceMutation.mutateAsync({
                    courseId: modalCourseId,
                    data: {
                        title,
                        description,
                        file_url: finalUrl,
                        resource_type: resourceType
                    }
                });
            }
        } catch (error: any) {
            console.error('Error saving resource:', error);
            alert(`Error al guardar el recurso: ${error?.response?.data?.message || error?.message || 'Error desconocido'}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const confirmDeleteResource = async () => {
        if (deleteConfirmResourceId) {
            try {
                await deleteResourceMutation.mutateAsync(deleteConfirmResourceId);
                setDeleteConfirmResourceId(null);
            } catch (err: any) {
                alert(`Error al eliminar: ${err?.message || 'Error inesperado'}`);
            }
        }
    };

    const handleCopyLink = (resourceId: string, url: string) => {
        const fullUrl = url.startsWith('http')
            ? url
            : `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}${url}`;

        navigator.clipboard.writeText(fullUrl).then(() => {
            setCopiedId(resourceId);
            setTimeout(() => setCopiedId(null), 2500);
        }).catch(() => {
            alert(`Enlace: ${fullUrl}`);
        });
    };

    const handleOpenViewer = (resource: CourseResource) => {
        setViewerResource(resource);
        setIsViewerModalOpen(true);
    };

    const handleOpenResource = (url: string) => {
        const backendUrl = (import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/+$/, '');
        const fullUrl = url.startsWith('http')
            ? url
            : `${backendUrl}${url.startsWith('/') ? '' : '/'}${url}`;

        // Standard window.open opens YouTube in native app on Android, or new tab in desktop
        window.open(fullUrl, '_blank', 'noopener,noreferrer');
    };

    // Extract available instructors/authors
    const availableAuthors = useMemo(() => {
        if (!resources) return [];
        const authorSet = new Set<string>();
        resources.forEach(r => {
            if (r.author?.full_name?.trim()) {
                authorSet.add(r.author.full_name.trim());
            }
        });
        return Array.from(authorSet).sort();
    }, [resources]);

    // Filter and Sort resources
    const filteredResources = useMemo(() => {
        if (!resources) return [];

        let result = resources.filter((r) => {
            // Type filter
            if (selectedType !== 'all' && r.resource_type !== selectedType) return false;

            // Author filter
            if (selectedAuthor !== 'all' && r.author?.full_name?.trim() !== selectedAuthor) return false;

            // Search filter
            if (searchTerm.trim()) {
                const q = searchTerm.toLowerCase().trim();
                const matchTitle = r.title?.toLowerCase().includes(q);
                const matchDesc = r.description?.toLowerCase().includes(q);
                const matchCourse = r.courses?.name?.toLowerCase().includes(q);
                const matchAuthor = r.author?.full_name?.toLowerCase().includes(q);
                if (!matchTitle && !matchDesc && !matchCourse && !matchAuthor) return false;
            }

            return true;
        });

        // Sorting
        result.sort((a, b) => {
            if (sortBy === 'newest') {
                return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
            }
            if (sortBy === 'oldest') {
                return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
            }
            if (sortBy === 'alphabetical') {
                return a.title.localeCompare(b.title);
            }
            return 0;
        });

        return result;
    }, [resources, selectedType, selectedAuthor, searchTerm, sortBy]);

    // Active course object
    const selectedCourseObj = useMemo(() => {
        if (selectedCourseId === 'ALL') return null;
        return courses?.find(c => c.id === selectedCourseId) || null;
    }, [courses, selectedCourseId]);

    // Filtered course list for the dropdown
    const filteredDropdownCourses = useMemo(() => {
        if (!courses) return [];
        if (!courseSearchTerm.trim()) return courses;
        const q = courseSearchTerm.toLowerCase().trim();
        return courses.filter(c => c.name.toLowerCase().includes(q));
    }, [courses, courseSearchTerm]);

    const totalMaterialsCount = summary?.countsByType?.total ?? resources?.length ?? 0;

    return (
        <div className="max-w-7xl mx-auto pb-36 sm:pb-16 space-y-6 animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                    <div className="p-3 bg-brand-blue/10 dark:bg-brand-blue/20 rounded-2xl text-brand-blue dark:text-blue-400 border border-brand-blue/20">
                        <Library className="h-7 w-7" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                                Biblioteca Virtual
                            </h2>
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-brand-blue/10 text-brand-blue dark:bg-brand-blue/20 dark:text-blue-300 border border-brand-blue/20">
                                {totalMaterialsCount} {totalMaterialsCount === 1 ? 'Material' : 'Materiales'}
                            </span>
                        </div>
                        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                            {isStudentOrParent
                                ? 'Guías oficiales, libros de texto, diapositivas y enlaces de estudio de tus cursos inscritos.'
                                : 'Gestiona, explora y comparte material académico con tus estudiantes.'}
                        </p>
                    </div>
                </div>

                {canManage && (
                    <button
                        onClick={handleOpenCreateModal}
                        className="bg-gradient-to-r from-brand-blue to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white px-5 py-3 rounded-2xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-brand-blue/25 shrink-0"
                    >
                        <Plus className="w-4 h-4 stroke-[3]" />
                        <span>Subir Recurso</span>
                    </button>
                )}
            </div>

            {/* Secretary Read-only Notice */}
            {userRole === 'secretary' && (
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-800 dark:text-amber-200 flex items-center gap-3.5 shadow-sm animate-in fade-in">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                        <BookOpen className="w-5 h-5" />
                    </div>
                    <div className="text-xs space-y-0.5 min-w-0">
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-slate-900 dark:text-white">Modo Consulta de Secretaría</span>
                            <span className="px-2 py-0.2 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-700 dark:text-amber-300 uppercase tracking-wider">
                                Solo Lectura
                            </span>
                        </div>
                        <p className="text-slate-600 dark:text-slate-400">
                            Tienes acceso completo a la visualización y descarga de todos los materiales didácticos institucionales para brindar soporte a acudientes y alumnos. La subida y edición de contenidos está reservada a docentes y directores académicos.
                        </p>
                    </div>
                </div>
            )}

            {/* Top Quick Stats Metrics Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                <div className="bg-white dark:bg-slate-900/90 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Documentos</p>
                        <p className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                            {summary?.countsByType?.document || 0}
                        </p>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-900/90 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                        <Video className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Videos</p>
                        <p className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                            {summary?.countsByType?.video || 0}
                        </p>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-900/90 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                        <LinkIcon className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Enlaces Web</p>
                        <p className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                            {summary?.countsByType?.link || 0}
                        </p>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-900/90 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                        <BookOpen className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Con Material</p>
                        <p className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                            {Object.keys(summary?.countsByCourse || {}).length} Cursos
                        </p>
                    </div>
                </div>
            </div>

            {/* Smart Filter Panel: Course Selector & Global Search */}
            <div className="bg-white dark:bg-slate-900/90 p-4 sm:p-5 rounded-3xl shadow-sm border border-slate-200/80 dark:border-slate-800 space-y-4">
                {/* Search Bar & Course Selector Dropdown Row */}
                <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
                    {/* Course Selector Dropdown with Search */}
                    <div className="relative md:w-80 shrink-0" ref={courseDropdownRef}>
                        <button
                            type="button"
                            onClick={() => setIsCourseDropdownOpen(!isCourseDropdownOpen)}
                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs sm:text-sm font-bold text-slate-800 dark:text-white flex items-center justify-between gap-2 transition-all outline-none"
                        >
                            <div className="flex items-center gap-2 truncate">
                                <Layers className="w-4 h-4 text-brand-blue shrink-0" />
                                <span className="truncate">
                                    {selectedCourseId === 'ALL'
                                        ? (isStudentOrParent ? '📚 Mis Cursos Inscritos' : '📚 Todos los Cursos')
                                        : selectedCourseObj?.name || 'Seleccionar curso'}
                                </span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                                {selectedCourseId !== 'ALL' && (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-brand-blue/15 text-brand-blue dark:text-blue-400">
                                        {summary?.countsByCourse?.[selectedCourseId] || 0}
                                    </span>
                                )}
                                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isCourseDropdownOpen ? 'rotate-180' : ''}`} />
                            </div>
                        </button>

                        {/* Dropdown Menu with Search */}
                        {isCourseDropdownOpen && (
                            <div className="absolute left-0 top-full mt-2 w-full sm:w-96 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                                {/* Search input within dropdown for when there are 30+ courses */}
                                <div className="relative mb-2">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder="Buscar curso por nombre..."
                                        className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-white outline-none focus:border-brand-blue"
                                        value={courseSearchTerm}
                                        onChange={(e) => setCourseSearchTerm(e.target.value)}
                                        autoFocus
                                    />
                                </div>

                                <div className="max-h-60 overflow-y-auto space-y-1 divide-y divide-slate-100 dark:divide-slate-700/50">
                                    {/* All Courses Option */}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSelectedCourseId('ALL');
                                            setIsCourseDropdownOpen(false);
                                            setCourseSearchTerm('');
                                        }}
                                        className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold flex items-center justify-between transition-colors ${
                                            selectedCourseId === 'ALL'
                                                ? 'bg-brand-blue text-white shadow-sm'
                                                : 'hover:bg-slate-100 dark:hover:bg-slate-700/60 text-slate-700 dark:text-slate-200'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <span>📚</span>
                                            <span>{isStudentOrParent ? 'Mis Cursos Inscritos (Todos)' : 'Todos los Cursos (Catálogo General)'}</span>
                                        </div>
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                                            selectedCourseId === 'ALL' ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500'
                                        }`}>
                                            {totalMaterialsCount}
                                        </span>
                                    </button>

                                    {/* Course List */}
                                    {filteredDropdownCourses.map((course) => {
                                        const count = summary?.countsByCourse?.[course.id] || 0;
                                        const isSelected = selectedCourseId === course.id;
                                        return (
                                            <button
                                                key={course.id}
                                                type="button"
                                                onClick={() => {
                                                    setSelectedCourseId(course.id);
                                                    setIsCourseDropdownOpen(false);
                                                    setCourseSearchTerm('');
                                                }}
                                                className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold flex items-center justify-between transition-colors ${
                                                    isSelected
                                                        ? 'bg-brand-blue text-white shadow-sm'
                                                        : 'hover:bg-slate-100 dark:hover:bg-slate-700/60 text-slate-700 dark:text-slate-200'
                                                }`}
                                            >
                                                <span className="truncate pr-2">{course.name}</span>
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black shrink-0 ${
                                                    isSelected
                                                        ? 'bg-white/20 text-white'
                                                        : count > 0
                                                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                                            : 'bg-slate-100 dark:bg-slate-700 text-slate-400'
                                                }`}>
                                                    {count} {count === 1 ? 'recurso' : 'recursos'}
                                                </span>
                                            </button>
                                        );
                                    })}

                                    {filteredDropdownCourses.length === 0 && (
                                        <p className="p-3 text-center text-xs text-slate-400">
                                            No se encontraron cursos coincidentes.
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Global Search Input */}
                    <div className="relative flex-1">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder={selectedCourseId === 'ALL' ? "Buscar en toda la biblioteca por nombre, tema o contenido..." : `Buscar dentro de ${selectedCourseObj?.name || 'curso'}...`}
                            className="w-full pl-11 pr-10 py-3 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-brand-blue/10 focus:border-brand-blue transition-all"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        {searchTerm && (
                            <button
                                onClick={() => setSearchTerm('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Quick Access Course Pills (Top active courses + "Todos") */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar pt-1">
                    <button
                        onClick={() => setSelectedCourseId('ALL')}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 border ${
                            selectedCourseId === 'ALL'
                                ? 'bg-brand-blue text-white border-brand-blue shadow-md shadow-brand-blue/20'
                                : 'bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-brand-blue/40'
                        }`}
                    >
                        <span>{isStudentOrParent ? '📚 Mis Cursos Inscritos' : '📚 Todos los Cursos'}</span>
                        <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${selectedCourseId === 'ALL' ? 'bg-white/25 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                            {totalMaterialsCount}
                        </span>
                    </button>

                    {courses?.map((course) => {
                        const count = summary?.countsByCourse?.[course.id] || 0;
                        const isSelected = selectedCourseId === course.id;
                        return (
                            <button
                                key={course.id}
                                onClick={() => setSelectedCourseId(course.id)}
                                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 border ${
                                    isSelected
                                        ? 'bg-brand-blue text-white border-brand-blue shadow-md shadow-brand-blue/20'
                                        : 'bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-brand-blue/40'
                                }`}
                            >
                                <span>{course.name}</span>
                                {count > 0 && (
                                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                                        isSelected ? 'bg-white/25 text-white' : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                    }`}>
                                        {count}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Second Row: Type Filter Chips + View Mode & Sort Controls */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                    {/* Resource Type Filter Chips */}
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                        <button
                            onClick={() => setSelectedType('all')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                                selectedType === 'all'
                                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                            }`}
                        >
                            Todos los Tipos
                        </button>
                        {Object.entries(RESOURCE_TYPE_MAP).map(([key, item]) => {
                            const isSelected = selectedType === key;
                            const Icon = item.icon;
                            return (
                                <button
                                    key={key}
                                    onClick={() => setSelectedType(key)}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                                        isSelected
                                            ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm'
                                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                    }`}
                                >
                                    <Icon className="w-3.5 h-3.5" />
                                    <span>{item.label}</span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Sort Selector & View Mode Switcher */}
                    <div className="flex items-center gap-2 self-end sm:self-auto shrink-0 flex-wrap">
                        {/* Instructor / Author Filter */}
                        {availableAuthors.length > 1 && (
                            <div className="relative">
                                <select
                                    value={selectedAuthor}
                                    onChange={(e: any) => setSelectedAuthor(e.target.value)}
                                    className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl border-none outline-none cursor-pointer max-w-[150px] truncate"
                                    title="Filtrar por docente"
                                >
                                    <option value="all">👨‍🏫 Todos los Docentes</option>
                                    {availableAuthors.map(author => (
                                        <option key={author} value={author}>
                                            Prof. {author}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {/* Sort Selector */}
                        <div className="relative">
                            <select
                                value={sortBy}
                                onChange={(e: any) => setSortBy(e.target.value)}
                                className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl border-none outline-none cursor-pointer"
                            >
                                <option value="newest">Más recientes</option>
                                <option value="oldest">Más antiguos</option>
                                <option value="alphabetical">Nombre (A-Z)</option>
                            </select>
                        </div>

                        {/* View Switcher */}
                        <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200/60 dark:border-slate-700">
                            <button
                                onClick={() => setViewMode('grid')}
                                className={`p-1.5 rounded-lg transition-colors ${
                                    viewMode === 'grid'
                                        ? 'bg-white dark:bg-slate-700 text-brand-blue shadow-sm'
                                        : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                                }`}
                                title="Vista de Tarjetas"
                            >
                                <LayoutGrid className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => setViewMode('list')}
                                className={`p-1.5 rounded-lg transition-colors ${
                                    viewMode === 'list'
                                        ? 'bg-white dark:bg-slate-700 text-brand-blue shadow-sm'
                                        : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                                }`}
                                title="Vista de Lista Compacta"
                            >
                                <List className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Resources Content Display */}
            {loadingResources ? (
                <div className="flex flex-col items-center justify-center min-h-[300px] space-y-3 bg-white/40 dark:bg-slate-900/40 rounded-3xl p-12 border border-slate-200/60 dark:border-slate-800">
                    <Loader2 className="w-10 h-10 animate-spin text-brand-blue" />
                    <p className="text-xs sm:text-sm text-slate-500 font-medium">Cargando catálogo de materiales didácticos...</p>
                </div>
            ) : filteredResources?.length === 0 ? (
                <div className="bg-white/60 dark:bg-slate-900/60 border border-dashed border-slate-300 dark:border-slate-800 rounded-3xl py-16 px-6 text-center space-y-3">
                    <div className="w-16 h-16 bg-brand-blue/10 dark:bg-brand-blue/20 rounded-2xl flex items-center justify-center text-brand-blue mx-auto">
                        <UploadCloud className="w-8 h-8" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                        {searchTerm 
                            ? 'No se encontraron resultados' 
                            : isStudentOrParent && (!courses || courses.length === 0)
                                ? 'Sin cursos activos inscritos'
                                : 'Sin materiales en este curso todavía'}
                    </h3>
                    <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm max-w-sm mx-auto">
                        {searchTerm
                            ? 'Prueba con otro término o limpia los filtros de búsqueda.'
                            : isStudentOrParent && (!courses || courses.length === 0)
                                ? 'Aún no tienes cursos activos inscritos en este ciclo escolar. Tan pronto se confirme tu matrícula, aquí aparecerán todas tus materias y guías de estudio.'
                                : selectedCourseId === 'ALL'
                                    ? (isStudentOrParent ? 'Tus docentes aún no han subido materiales en tus cursos inscritos.' : 'Aún no se han publicado recursos en la biblioteca virtual.')
                                    : 'Los docentes de esta materia aún no han subido guías o documentos aquí.'}
                    </p>
                    {canManage && (
                        <button
                            onClick={handleOpenCreateModal}
                            className="mt-2 inline-flex items-center gap-2 px-4 py-2 bg-brand-blue hover:bg-blue-600 text-white text-xs font-bold rounded-xl shadow-md transition-all active:scale-95"
                        >
                            <Plus className="w-4 h-4" />
                            <span>Subir el primer material</span>
                        </button>
                    )}
                </div>
            ) : viewMode === 'grid' ? (
                /* GRID CARDS VIEW */
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {filteredResources?.map((resource) => {
                        const style = getResourceStyle(resource.resource_type);
                        const IconComponent = style.icon;
                        const isCopied = copiedId === resource.id;

                        return (
                            <div
                                key={resource.id}
                                className="bg-white dark:bg-slate-900/95 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between group overflow-hidden relative"
                            >
                                <div>
                                    {/* Top Row: Type Badge + YouTube Badge + Course Pill + Actions */}
                                    <div className="flex items-start justify-between gap-2 mb-3">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <div className={`w-8 h-8 ${style.bg} rounded-xl flex items-center justify-center border shrink-0`}>
                                                <IconComponent className={`w-4 h-4 ${style.color}`} />
                                            </div>
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${style.bg} ${style.color} border`}>
                                                {style.label}
                                            </span>
                                            {isYouTubeUrl(resource.file_url) && (
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-500/15 text-rose-500 border border-rose-500/25 flex items-center gap-1">
                                                    <Play className="w-2.5 h-2.5 fill-rose-500" />
                                                    YouTube
                                                </span>
                                            )}
                                            {resource.courses?.name && (
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 truncate max-w-[120px]" title={resource.courses.name}>
                                                    {resource.courses.name}
                                                </span>
                                            )}
                                        </div>

                                        {/* Action buttons (Edit & Delete for Instructors/Admins) */}
                                        {canManage && (
                                            <div className="flex items-center gap-1 shrink-0">
                                                <button
                                                    onClick={() => handleOpenEditModal(resource)}
                                                    className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
                                                    title="Editar recurso"
                                                >
                                                    <Pencil className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    onClick={() => setDeleteConfirmResourceId(resource.id)}
                                                    className="w-7 h-7 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 flex items-center justify-center transition-colors cursor-pointer"
                                                    title="Eliminar recurso"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {/* Title & Description */}
                                    <h4 
                                        onClick={() => handleOpenViewer(resource)}
                                        className="text-base font-bold text-slate-900 dark:text-white group-hover:text-brand-blue transition-colors line-clamp-2 leading-snug cursor-pointer"
                                        title="Clic para previsualizar"
                                    >
                                        {resource.title}
                                    </h4>

                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 line-clamp-3 leading-relaxed min-h-[32px]">
                                        {resource.description || 'Sin notas adicionales provistas para este material.'}
                                    </p>
                                </div>

                                {/* Bottom Meta & Action Buttons */}
                                <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800/80 space-y-3">
                                    <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium">
                                        <span className="flex items-center gap-1">
                                            <Calendar className="w-3 h-3" />
                                            {new Date(resource.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                                        </span>
                                        {resource.author?.full_name && (
                                            <span className="truncate max-w-[130px] flex items-center gap-1" title={resource.author.full_name}>
                                                <User className="w-3 h-3 shrink-0" />
                                                {resource.author.full_name}
                                            </span>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => handleOpenViewer(resource)}
                                            className="flex-1 py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 bg-brand-blue/10 hover:bg-brand-blue text-brand-blue hover:text-white transition-all duration-200 border border-brand-blue/20 active:scale-[0.98] cursor-pointer"
                                            title="Abrir reproductor o visor"
                                        >
                                            {isYouTubeUrl(resource.file_url) || resource.resource_type === 'video' ? (
                                                <Play className="w-3.5 h-3.5 fill-current" />
                                            ) : resource.resource_type === 'document' ? (
                                                <FileText className="w-3.5 h-3.5" />
                                            ) : resource.resource_type === 'image' ? (
                                                <ImageIcon className="w-3.5 h-3.5" />
                                            ) : (
                                                <Eye className="w-3.5 h-3.5" />
                                            )}
                                            <span>
                                                {isYouTubeUrl(resource.file_url) || resource.resource_type === 'video'
                                                    ? 'Ver Video'
                                                    : resource.resource_type === 'document'
                                                    ? 'Ver Documento'
                                                    : resource.resource_type === 'image'
                                                    ? 'Ver Imagen'
                                                    : 'Ver Recurso'}
                                            </span>
                                        </button>

                                        <button
                                            onClick={() => handleOpenResource(resource.file_url)}
                                            className="p-2.5 rounded-xl border bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-white border-slate-200 dark:border-slate-700 transition-all cursor-pointer"
                                            title="Descargar o abrir externamente"
                                        >
                                            <Download className="w-4 h-4" />
                                        </button>

                                        <button
                                            onClick={() => handleCopyLink(resource.id, resource.file_url)}
                                            className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                                                isCopied
                                                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 border-emerald-200'
                                                    : 'bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-white border-slate-200 dark:border-slate-700'
                                            }`}
                                            title="Copiar enlace"
                                        >
                                            {isCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                /* LIST / TABLE VIEW */
                <div className="bg-white dark:bg-slate-900/90 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {filteredResources?.map((resource) => {
                            const style = getResourceStyle(resource.resource_type);
                            const IconComponent = style.icon;
                            const isCopied = copiedId === resource.id;

                            return (
                                <div
                                    key={resource.id}
                                    className="p-4 sm:p-5 hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                                >
                                    <div className="flex items-start gap-3.5">
                                        <div className={`w-10 h-10 ${style.bg} rounded-xl flex items-center justify-center border shrink-0 mt-0.5`}>
                                            <IconComponent className={`w-5 h-5 ${style.color}`} />
                                        </div>
                                        <div className="space-y-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h4 
                                                    onClick={() => handleOpenViewer(resource)}
                                                    className="text-sm sm:text-base font-bold text-slate-900 dark:text-white hover:text-brand-blue cursor-pointer transition-colors"
                                                    title="Clic para previsualizar"
                                                >
                                                    {resource.title}
                                                </h4>
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${style.bg} ${style.color} border`}>
                                                    {style.label}
                                                </span>
                                                {isYouTubeUrl(resource.file_url) && (
                                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-500/15 text-rose-500 border border-rose-500/25 flex items-center gap-1">
                                                        <Play className="w-2.5 h-2.5 fill-rose-500" />
                                                        YouTube
                                                    </span>
                                                )}
                                                {resource.courses?.name && (
                                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                                        {resource.courses.name}
                                                    </span>
                                                )}
                                            </div>
                                            {resource.description && (
                                                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                                                    {resource.description}
                                                </p>
                                            )}
                                            <div className="flex items-center gap-3 text-[11px] text-slate-400">
                                                <span>Subido el {new Date(resource.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                                {resource.author?.full_name && (
                                                    <span>• Por {resource.author.full_name}</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                                        <button
                                            onClick={() => handleOpenViewer(resource)}
                                            className="px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 bg-brand-blue text-white hover:bg-blue-600 shadow-sm transition-all cursor-pointer"
                                            title="Abrir reproductor o visor"
                                        >
                                            {isYouTubeUrl(resource.file_url) || resource.resource_type === 'video' ? (
                                                <Play className="w-3.5 h-3.5 fill-current" />
                                            ) : (
                                                <Eye className="w-3.5 h-3.5" />
                                            )}
                                            <span>
                                                {isYouTubeUrl(resource.file_url) || resource.resource_type === 'video' ? 'Ver Video' : 'Ver'}
                                            </span>
                                        </button>

                                        <button
                                            onClick={() => handleOpenResource(resource.file_url)}
                                            className="p-2 rounded-xl border bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-white border-slate-200 dark:border-slate-700 transition-all cursor-pointer"
                                            title="Descargar o abrir enlace externo"
                                        >
                                            <Download className="w-3.5 h-3.5" />
                                        </button>

                                        <button
                                            onClick={() => handleCopyLink(resource.id, resource.file_url)}
                                            className={`p-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                                                isCopied
                                                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 border-emerald-200'
                                                    : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                                            }`}
                                            title="Copiar enlace"
                                        >
                                            {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                                            <span className="hidden sm:inline">{isCopied ? 'Copiado' : 'Copiar'}</span>
                                        </button>

                                        {canManage && (
                                            <>
                                                <button
                                                    onClick={() => handleOpenEditModal(resource)}
                                                    className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
                                                    title="Editar"
                                                >
                                                    <Pencil className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    onClick={() => setDeleteConfirmResourceId(resource.id)}
                                                    className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 transition-colors"
                                                    title="Eliminar"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Modal for Create / Edit Resource (Instructors & Admins only) */}
            {isUploadModalOpen && createPortal(
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-[120] p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-lg shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 bg-brand-blue/10 text-brand-blue dark:bg-brand-blue/20 rounded-xl">
                                    {editingResource ? <Pencil className="w-5 h-5" /> : <FileUp className="w-5 h-5" />}
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                                        {editingResource ? 'Editar Recurso de Estudio' : 'Subir Recurso de Estudio'}
                                    </h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        Disponible para los estudiantes inscritos en la materia.
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => { setIsUploadModalOpen(false); resetForm(); }}
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmitResource} className="p-5 sm:p-6 space-y-4 max-h-[80vh] overflow-y-auto">
                            {/* Course Selector in Modal */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                                    Curso Destino *
                                </label>
                                <select
                                    required
                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-medium text-slate-900 dark:text-white outline-none focus:ring-4 focus:ring-brand-blue/10 focus:border-brand-blue"
                                    value={modalCourseId}
                                    onChange={(e) => setModalCourseId(e.target.value)}
                                >
                                    <option value="" disabled>Selecciona un curso</option>
                                    {courses?.map((c) => (
                                        <option key={c.id} value={c.id}>
                                            {c.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Mode Tabs: File Upload vs External URL */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                                    Método de Carga *
                                </label>
                                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                                    <button
                                        type="button"
                                        disabled={resourceType === 'video'}
                                        onClick={() => setUploadMode('file')}
                                        className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                                            resourceType === 'video'
                                                ? 'opacity-40 cursor-not-allowed text-slate-400'
                                                : uploadMode === 'file'
                                                    ? 'bg-white dark:bg-slate-700 text-brand-blue shadow-sm'
                                                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                                        }`}
                                        title={resourceType === 'video' ? 'Para videos utiliza enlace externo (YouTube/Drive)' : ''}
                                    >
                                        <FileUp className="w-4 h-4" />
                                        <span>Subir Archivo Local</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setUploadMode('url')}
                                        className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                                            uploadMode === 'url'
                                                ? 'bg-white dark:bg-slate-700 text-brand-blue shadow-sm'
                                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                                        }`}
                                    >
                                        <LinkIcon className="w-4 h-4" />
                                        <span>Enlace Externo / Web</span>
                                    </button>
                                </div>
                            </div>

                            {/* Educational banner for video resources */}
                            {resourceType === 'video' && (
                                <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 rounded-2xl flex items-start gap-3">
                                    <Video className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                                    <div className="text-xs text-amber-900 dark:text-amber-200 space-y-1">
                                        <p className="font-bold">Ahorro de espacio y máxima velocidad:</p>
                                        <p className="leading-relaxed text-[11px] text-amber-800 dark:text-amber-300">
                                            Para asegurar que el servidor institucional mantenga un rendimiento óptimo y no sature el disco, comparte el enlace de <strong>YouTube</strong> (o Google Drive/Vimeo).
                                        </p>
                                        <p className="text-[11px] text-amber-700 dark:text-amber-400 font-medium">
                                            💡 <em>Tip de privacidad: En YouTube puedes subir tu clase como <strong>"No listado" (Unlisted)</strong>; así solo podrán ver el video los alumnos que tengan el enlace en la plataforma.</em>
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* File Upload Zone */}
                            {uploadMode === 'file' && (
                                <div className="space-y-2">
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        onChange={handleFileSelected}
                                        className="hidden"
                                        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.jpg,.jpeg,.png,.webp,.gif"
                                    />
                                    <div
                                        onClick={() => fileInputRef.current?.click()}
                                        className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-brand-blue dark:hover:border-brand-blue rounded-2xl p-5 text-center cursor-pointer transition-colors bg-slate-50/50 dark:bg-slate-800/40"
                                    >
                                        <UploadCloud className="w-8 h-8 text-brand-blue mx-auto mb-2" />
                                        <p className="text-xs font-bold text-slate-800 dark:text-white">
                                            {selectedFile ? selectedFile.name : (editingResource?.file_url?.startsWith('/uploads') ? 'Archivo actual guardado. Clic para reemplazar.' : 'Haz clic para seleccionar un archivo')}
                                        </p>
                                        <p className="text-[11px] text-slate-400 mt-1">
                                            PDF, Word, Excel, PowerPoint, Imágenes o ZIP (Máx. 15 MB)
                                        </p>
                                    </div>
                                    {selectedFile && (
                                        <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-700 dark:text-emerald-300 flex items-center justify-between">
                                            <span className="truncate">{selectedFile.name} ({(selectedFile.size / (1024 * 1024)).toFixed(2)} MB)</span>
                                            <button
                                                type="button"
                                                onClick={() => setSelectedFile(null)}
                                                className="text-emerald-700 hover:text-rose-600 p-1"
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* External URL Input */}
                            {uploadMode === 'url' && (
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                                        URL del Archivo o Enlace *
                                    </label>
                                    <input
                                        type="url"
                                        required={uploadMode === 'url'}
                                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white outline-none focus:ring-4 focus:ring-brand-blue/10 focus:border-brand-blue"
                                        value={fileUrl}
                                        onChange={(e) => setFileUrl(e.target.value)}
                                        placeholder="https://drive.google.com/... o https://youtube.com/watch?v=..."
                                    />
                                    <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                                        <LinkIcon className="w-3 h-3" /> Compatible con Google Drive, YouTube, OneDrive, enlaces web directos, etc.
                                    </p>
                                </div>
                            )}

                            {/* Title */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                                    Título del Recurso *
                                </label>
                                <input
                                    type="text"
                                    required
                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white outline-none focus:ring-4 focus:ring-brand-blue/10 focus:border-brand-blue"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="Ej. Guía Oficial Unidad 1, Manual de Word, etc."
                                />
                            </div>

                            {/* Resource Type */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                                    Tipo de Recurso
                                </label>
                                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                                    {Object.entries(RESOURCE_TYPE_MAP).map(([key, item]) => {
                                        const TypeIcon = item.icon;
                                        return (
                                            <button
                                                type="button"
                                                key={key}
                                                onClick={() => handleSelectResourceType(key)}
                                                className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border text-xs font-bold transition-all ${
                                                    resourceType === key
                                                        ? `${item.bg} ${item.color} border-current shadow-sm`
                                                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-slate-300'
                                                }`}
                                            >
                                                <TypeIcon className="w-4 h-4" />
                                                <span className="text-[11px]">{item.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                                    Descripción / Instrucciones (Opcional)
                                </label>
                                <textarea
                                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white outline-none focus:ring-4 focus:ring-brand-blue/10 focus:border-brand-blue resize-none h-20"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Instrucciones breves o contenido del recurso..."
                                />
                            </div>

                            {/* Modal Actions */}
                            <div className="pt-2 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => { setIsUploadModalOpen(false); resetForm(); }}
                                    className="flex-1 px-4 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs sm:text-sm transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting || !title || (uploadMode === 'url' && !fileUrl) || (uploadMode === 'file' && !selectedFile && !editingResource?.file_url)}
                                    className="flex-1 px-4 py-3 bg-gradient-to-r from-brand-blue to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-bold rounded-xl text-xs sm:text-sm transition-all shadow-md active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {isSubmitting ? (
                                        <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</>
                                    ) : (
                                        <><UploadCloud className="w-4 h-4" /> {editingResource ? 'Guardar Cambios' : 'Publicar Recurso'}</>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}

            {/* Modal Visor de Multimedia (YouTube, Video HTML5, PDF, Imágenes) */}
            <MediaViewerModal
                isOpen={isViewerModalOpen}
                onClose={() => {
                    setIsViewerModalOpen(false);
                    setViewerResource(null);
                }}
                resource={viewerResource}
            />

            {/* Modal de Confirmación para Eliminar Recurso */}
            <ConfirmModal
                isOpen={!!deleteConfirmResourceId}
                title="¿Eliminar Recurso Educativo?"
                description="¿Estás seguro de eliminar este recurso? Ya no estará disponible para descarga o visualización por parte de los alumnos."
                confirmText="Sí, Eliminar"
                cancelText="Cancelar"
                variant="danger"
                isLoading={deleteResourceMutation.isPending}
                onConfirm={confirmDeleteResource}
                onClose={() => setDeleteConfirmResourceId(null)}
            />
        </div>
    );
};

export default CourseResources;
