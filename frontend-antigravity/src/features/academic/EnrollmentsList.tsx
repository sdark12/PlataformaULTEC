import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getEnrollments, enrollStudent, getStudents, getCourses, updateEnrollment, deleteEnrollment, getCourseSchedules } from './academicService';
import { getBranches } from '../branches/branchesService';
import { getCurrentUser } from '../auth/authService';
import { 
    Plus, 
    Loader2, 
    RefreshCw, 
    Trash2, 
    Search, 
    Filter, 
    Calendar, 
    Pencil, 
    X, 
    BookOpen, 
    Clock, 
    Sparkles, 
    GraduationCap, 
    Users, 
    CheckCircle2, 
    XCircle,
    ArrowRight
} from 'lucide-react';
import ConfirmModal from '../../components/ui/ConfirmModal';
import SearchableSelect, { type SearchableOption } from '../../components/ui/SearchableSelect';
import CycleSelectorPills from '../../components/common/CycleSelectorPills';

const EnrollmentsList: React.FC = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [deleteConfirmEnrollment, setDeleteConfirmEnrollment] = useState<any | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [newEnrollment, setNewEnrollment] = useState({ 
        student_id: '', 
        course_id: '', 
        schedule_id: '', 
        branch_id: '',
        scholarship_type: 'NONE',
        scholarship_amount: '',
        scholarship_reason: ''
    });

    // Filtros
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'promoted' | 'inactive'>('active');
    const [filterCourse, setFilterCourse] = useState('');
    const [selectedYearFilter, setSelectedYearFilter] = useState('ALL');
    const [modalYearFilter, setModalYearFilter] = useState('ALL');

    const user = getCurrentUser();

    // Query enrollments
    const { data: enrollments = [], isLoading } = useQuery({
        queryKey: ['enrollments'],
        queryFn: getEnrollments,
    });

    // Query students for modal
    const { data: students = [] } = useQuery({
        queryKey: ['students-list-enr'],
        queryFn: () => getStudents(),
        enabled: isModalOpen
    });

    // Query courses for modal & filter
    const { data: courses = [] } = useQuery({
        queryKey: ['courses'],
        queryFn: getCourses,
    });

    // Query schedules when course selected in modal
    const { data: courseSchedules = [], isLoading: isLoadingSchedules } = useQuery({
        queryKey: ['course_schedules', newEnrollment.course_id],
        queryFn: () => getCourseSchedules(newEnrollment.course_id),
        enabled: !!newEnrollment.course_id && isModalOpen
    });

    // Query branches if superadmin
    const { data: branches = [] } = useQuery({
        queryKey: ['branches-list'],
        queryFn: getBranches,
        enabled: !user?.branch_id && isModalOpen
    });

    // Distinct cycles for tabs and modal filter
    const distinctCycles = useMemo(() => {
        const years = new Set<string>();
        const current = new Date().getFullYear();
        years.add(String(current));
        years.add(String(current + 1));
        courses.forEach((c: any) => {
            if (c.academic_year) years.add(String(c.academic_year));
        });
        enrollments.forEach((e: any) => {
            if (e.academic_year) years.add(String(e.academic_year));
        });
        return Array.from(years).sort((a, b) => Number(b) - Number(a));
    }, [courses, enrollments]);

    // Extract unique course names
    const uniqueCourses = useMemo(() => {
        return Array.from(new Set(enrollments.map((e: any) => e.course_name).filter(Boolean))).sort();
    }, [enrollments]);

    // Summary stats
    const stats = useMemo(() => {
        const total = enrollments.length;
        const active = enrollments.filter((e: any) => e.is_active === true && e.academic_status !== 'PROMOTED').length;
        const promoted = enrollments.filter((e: any) => e.academic_status === 'PROMOTED').length;
        const inactive = enrollments.filter((e: any) => e.is_active === false && e.academic_status !== 'PROMOTED').length;
        return { total, active, promoted, inactive };
    }, [enrollments]);

    // Student & Course options for SearchableSelect in modal
    const studentSelectOptions: SearchableOption[] = useMemo(() => {
        return students.map((s: any) => ({
            value: s.id,
            label: s.full_name,
            badge: s.personal_code || s.academy_code || s.identification_document || undefined,
            subLabel: s.identification_document ? `Doc: ${s.identification_document}` : undefined
        }));
    }, [students]);

    const courseSelectOptions: SearchableOption[] = useMemo(() => {
        let list = courses;
        if (modalYearFilter && modalYearFilter !== 'ALL') {
            list = list.filter((c: any) => String(c.academic_year || 2026) === modalYearFilter);
        }
        return list.map((c: any) => ({
            value: c.id,
            label: c.name,
            badge: c.academic_year ? `Ciclo ${c.academic_year}` : (c.code || undefined),
            subLabel: c.monthly_fee ? `Q${c.monthly_fee}/mes${c.academic_year ? ` • Ciclo ${c.academic_year}` : ''}` : undefined
        }));
    }, [courses, modalYearFilter]);

    // Mutations
    const createMutation = useMutation({
        mutationFn: enrollStudent,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['enrollments'] });
            queryClient.invalidateQueries({ queryKey: ['grades'] });
            queryClient.invalidateQueries({ queryKey: ['attendance'] });
            closeModal();
        },
        onError: (err: any) => {
            alert(err.response?.data?.message || "Error al inscribir estudiante");
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
            alert(err.response?.data?.message || "Error al actualizar inscripción");
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
        updateMutation.mutate({ 
            id: enrollment.id, 
            data: { 
                is_active: !enrollment.is_active,
                academic_status: !enrollment.is_active ? 'ACTIVE' : 'INACTIVE'
            } 
        });
    };

    const handleEdit = (enrollment: any) => {
        setEditingId(enrollment.id);
        setNewEnrollment({
            student_id: enrollment.student_id,
            course_id: enrollment.course_id,
            schedule_id: enrollment.schedule_id || '',
            branch_id: enrollment.branch_id || '',
            scholarship_type: enrollment.scholarship_type || 'NONE',
            scholarship_amount: enrollment.scholarship_amount ? String(enrollment.scholarship_amount) : '',
            scholarship_reason: enrollment.scholarship_reason || ''
        });
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingId(null);
        setModalYearFilter('ALL');
        setNewEnrollment({ 
            student_id: '', 
            course_id: '', 
            schedule_id: '', 
            branch_id: '',
            scholarship_type: 'NONE',
            scholarship_amount: '',
            scholarship_reason: ''
        });
    };

    const handleDelete = (enrollment: any) => {
        setDeleteConfirmEnrollment(enrollment);
    };

    const confirmDeleteEnrollment = () => {
        if (deleteConfirmEnrollment) {
            deleteMutation.mutate(deleteConfirmEnrollment.id);
            setDeleteConfirmEnrollment(null);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newEnrollment.student_id || !newEnrollment.course_id) return;

        if (editingId) {
            updateMutation.mutate({
                id: editingId,
                data: { 
                    schedule_id: newEnrollment.schedule_id || '',
                    scholarship_type: newEnrollment.scholarship_type || 'NONE',
                    scholarship_amount: newEnrollment.scholarship_amount ? Number(newEnrollment.scholarship_amount) : 0,
                    scholarship_reason: newEnrollment.scholarship_reason || null
                }
            });
        } else {
            createMutation.mutate({
                student_id: newEnrollment.student_id,
                course_id: newEnrollment.course_id,
                schedule_id: newEnrollment.schedule_id || undefined,
                branch_id: newEnrollment.branch_id || undefined,
                scholarship_type: newEnrollment.scholarship_type || 'NONE',
                scholarship_amount: newEnrollment.scholarship_amount ? Number(newEnrollment.scholarship_amount) : 0,
                scholarship_reason: newEnrollment.scholarship_reason || null
            } as any);
        }
    };

    // Filter enrollments
    const filteredEnrollments = useMemo(() => {
        return enrollments.filter((e: any) => {
            const searchLower = searchTerm.toLowerCase();
            const matchesSearch =
                (e.student_name && e.student_name.toLowerCase().includes(searchLower)) ||
                (e.student_code && e.student_code.toLowerCase().includes(searchLower)) ||
                (e.course_name && e.course_name.toLowerCase().includes(searchLower)) ||
                (e.academic_year && String(e.academic_year).includes(searchLower));

            const matchesStatus =
                filterStatus === 'all' ? true :
                filterStatus === 'active' ? (e.is_active === true && e.academic_status !== 'PROMOTED') :
                filterStatus === 'promoted' ? (e.academic_status === 'PROMOTED') :
                (e.is_active === false && e.academic_status !== 'PROMOTED');

            const matchesCourse = filterCourse ? e.course_name === filterCourse : true;
            const matchesYear = selectedYearFilter === 'ALL' || String(e.academic_year || 2026) === selectedYearFilter;

            return matchesSearch && matchesStatus && matchesCourse && matchesYear;
        });
    }, [enrollments, searchTerm, filterStatus, filterCourse, selectedYearFilter]);

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center p-16 space-y-4">
                <Loader2 className="animate-spin h-10 w-10 text-brand-blue" />
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Cargando inscripciones...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white/40 dark:bg-slate-900/40 p-5 sm:p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 backdrop-blur-xl">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-brand-blue/10 dark:bg-blue-500/20 text-brand-blue dark:text-blue-400 rounded-2xl border border-brand-blue/20">
                            <GraduationCap className="h-6 w-6" />
                        </div>
                        <div>
                            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                                Inscripciones
                            </h2>
                            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                                Asignación de estudiantes a cursos y control de matrículas académicas.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    <button
                        onClick={() => navigate('/promotions')}
                        className="flex-1 md:flex-none flex items-center justify-center space-x-2 px-4 py-2.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-xl transition-all border border-amber-500/20 text-sm font-bold active:scale-95"
                        title="Ir a Promoción de Alumnos"
                    >
                        <Sparkles className="h-4 w-4" />
                        <span>Promoción de Ciclo</span>
                        <ArrowRight className="h-3.5 w-3.5 opacity-60" />
                    </button>

                    <button
                        onClick={() => {
                            setEditingId(null);
                            setNewEnrollment({ 
                                student_id: '', 
                                course_id: '', 
                                schedule_id: '', 
                                branch_id: '',
                                scholarship_type: 'NONE',
                                scholarship_amount: '',
                                scholarship_reason: ''
                            });
                            setIsModalOpen(true);
                        }}
                        className="flex-1 md:flex-none flex items-center justify-center space-x-2 px-5 py-2.5 bg-brand-blue text-white rounded-xl hover:bg-blue-600 transition-all shadow-[0_0_15px_rgba(13,89,242,0.4)] active:scale-95 font-semibold text-sm border border-white/10"
                    >
                        <Plus className="h-4 w-4" />
                        <span>Nueva Inscripción</span>
                    </button>
                </div>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <div 
                    onClick={() => setFilterStatus('all')}
                    className={`cursor-pointer p-4 sm:p-5 rounded-2xl border transition-all ${
                        filterStatus === 'all' 
                            ? 'bg-blue-500/10 border-blue-500/40 ring-2 ring-blue-500/20 shadow-md' 
                            : 'bg-white/60 dark:bg-slate-900/60 border-slate-200/80 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                >
                    <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
                        <span className="text-xs font-bold uppercase tracking-wider">Total</span>
                        <Users className="w-4 h-4 text-slate-400" />
                    </div>
                    <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
                        {stats.total}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">Registros históricos</p>
                </div>

                <div 
                    onClick={() => setFilterStatus('active')}
                    className={`cursor-pointer p-4 sm:p-5 rounded-2xl border transition-all ${
                        filterStatus === 'active' 
                            ? 'bg-emerald-500/10 border-emerald-500/40 ring-2 ring-emerald-500/20 shadow-md' 
                            : 'bg-white/60 dark:bg-slate-900/60 border-slate-200/80 dark:border-slate-800/80 hover:border-emerald-500/30'
                    }`}
                >
                    <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 mb-2">
                        <span className="text-xs font-bold uppercase tracking-wider">Activas</span>
                        <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <div className="text-2xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">
                        {stats.active}
                    </div>
                    <p className="text-[11px] text-emerald-600/70 dark:text-emerald-400/70 mt-1">Cursando actualmente</p>
                </div>

                <div 
                    onClick={() => setFilterStatus('promoted')}
                    className={`cursor-pointer p-4 sm:p-5 rounded-2xl border transition-all ${
                        filterStatus === 'promoted' 
                            ? 'bg-purple-500/10 border-purple-500/40 ring-2 ring-purple-500/20 shadow-md' 
                            : 'bg-white/60 dark:bg-slate-900/60 border-slate-200/80 dark:border-slate-800/80 hover:border-purple-500/30'
                    }`}
                >
                    <div className="flex items-center justify-between text-purple-600 dark:text-purple-400 mb-2">
                        <span className="text-xs font-bold uppercase tracking-wider">Promovidas</span>
                        <Sparkles className="w-4 h-4" />
                    </div>
                    <div className="text-2xl sm:text-3xl font-extrabold text-purple-600 dark:text-purple-400">
                        {stats.promoted}
                    </div>
                    <p className="text-[11px] text-purple-600/70 dark:text-purple-400/70 mt-1">Pasaron a ciclo superior</p>
                </div>

                <div 
                    onClick={() => setFilterStatus('inactive')}
                    className={`cursor-pointer p-4 sm:p-5 rounded-2xl border transition-all ${
                        filterStatus === 'inactive' 
                            ? 'bg-rose-500/10 border-rose-500/40 ring-2 ring-rose-500/20 shadow-md' 
                            : 'bg-white/60 dark:bg-slate-900/60 border-slate-200/80 dark:border-slate-800/80 hover:border-rose-500/30'
                    }`}
                >
                    <div className="flex items-center justify-between text-rose-600 dark:text-rose-400 mb-2">
                        <span className="text-xs font-bold uppercase tracking-wider">Inactivas</span>
                        <XCircle className="w-4 h-4" />
                    </div>
                    <div className="text-2xl sm:text-3xl font-extrabold text-rose-600 dark:text-rose-400">
                        {stats.inactive}
                    </div>
                    <p className="text-[11px] text-rose-600/70 dark:text-rose-400/70 mt-1">Suspendidas o dadas de baja</p>
                </div>
            </div>

            {/* Filtros de Ciclo Lectivo */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 shrink-0 mr-1">
                    <Calendar className="h-3.5 w-3.5 text-purple-500" /> Ciclo:
                </span>
                <CycleSelectorPills
                    cycles={distinctCycles}
                    selectedYear={selectedYearFilter}
                    onSelectYear={setSelectedYearFilter}
                    activeVariant="purple"
                    maxVisiblePills={1}
                    allLabel="Todos los Ciclos"
                    className="!bg-white/60 dark:!bg-slate-800/60 !border-slate-200 dark:!border-white/5"
                />
            </div>

            {/* Filtros */}
            <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between bg-white/50 dark:bg-slate-900/50 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 backdrop-blur-sm">
                <div className="flex flex-1 gap-3 flex-col sm:flex-row">
                    <div className="relative flex-1 group">
                        <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400 group-focus-within:text-brand-blue transition-colors" />
                        <input
                            type="text"
                            placeholder="Buscar por estudiante, código, curso o ciclo (ej. 2026)..."
                            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white rounded-xl text-sm focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue outline-none transition-all placeholder:text-slate-400"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <div className="relative">
                        <div className="absolute left-3.5 top-3 flex items-center pointer-events-none text-slate-400">
                            <Filter className="h-4 w-4" />
                        </div>
                        <select
                            className="w-full sm:w-56 pl-10 pr-8 py-2.5 bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue outline-none transition-all appearance-none cursor-pointer"
                            value={filterCourse}
                            onChange={(e) => setFilterCourse(e.target.value)}
                        >
                            <option value="">Todos los Cursos</option>
                            {uniqueCourses.map((c: any) => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                        <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-slate-400">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                        </div>
                    </div>
                </div>

                {/* Status Segmented Buttons */}
                <div className="bg-slate-100 dark:bg-slate-800/90 p-1 rounded-xl flex space-x-1 self-stretch md:self-auto overflow-x-auto no-scrollbar">
                    <button
                        onClick={() => setFilterStatus('all')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex-1 md:flex-none ${
                            filterStatus === 'all'
                                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                    >
                        Todas ({stats.total})
                    </button>
                    <button
                        onClick={() => setFilterStatus('active')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex-1 md:flex-none ${
                            filterStatus === 'active'
                                ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 shadow-sm border border-emerald-500/30'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                    >
                        Activas ({stats.active})
                    </button>
                    <button
                        onClick={() => setFilterStatus('promoted')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex-1 md:flex-none ${
                            filterStatus === 'promoted'
                                ? 'bg-purple-500/20 text-purple-600 dark:text-purple-400 shadow-sm border border-purple-500/30'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                    >
                        Promovidas ({stats.promoted})
                    </button>
                    <button
                        onClick={() => setFilterStatus('inactive')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex-1 md:flex-none ${
                            filterStatus === 'inactive'
                                ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400 shadow-sm border border-rose-500/30'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                    >
                        Inactivas ({stats.inactive})
                    </button>
                </div>
            </div>

            {/* Mobile Cards Feed */}
            <div className="block md:hidden space-y-3">
                {filteredEnrollments.map((enrollment: any) => {
                    const isPromoted = enrollment.academic_status === 'PROMOTED';
                    const initials = (enrollment.student_name || 'U')
                        .split(' ')
                        .map((n: string) => n[0])
                        .slice(0, 2)
                        .join('')
                        .toUpperCase();

                    return (
                        <div
                            key={enrollment.id}
                            className="bg-white/70 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-4 shadow-sm backdrop-blur-sm space-y-3"
                        >
                            {/* Header: Student Name + Status Pill */}
                            <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-blue/20 to-blue-500/20 text-brand-blue dark:text-blue-400 flex items-center justify-center font-bold text-xs border border-brand-blue/20 shrink-0">
                                        {initials}
                                    </div>
                                    <div className="min-w-0">
                                        <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm leading-tight truncate">
                                            {enrollment.student_name}
                                        </h4>
                                        <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                                            Cód: {enrollment.student_code || 'N/A'} • {new Date(enrollment.enrollment_date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                                        </p>
                                    </div>
                                </div>

                                <button
                                    onClick={() => handleToggleStatus(enrollment)}
                                    disabled={updateMutation.isPending}
                                    className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all inline-flex items-center space-x-1.5 border shrink-0 ${
                                        isPromoted
                                            ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30'
                                            : enrollment.is_active
                                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                                            : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30'
                                    }`}
                                >
                                    {isPromoted ? (
                                        <>
                                            <Sparkles className="w-3 h-3 text-purple-500" />
                                            <span>Promovido</span>
                                        </>
                                    ) : (
                                        <>
                                            <div className={`w-1.5 h-1.5 rounded-full ${enrollment.is_active ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                                            <span>{enrollment.is_active ? 'Activa' : 'Inactiva'}</span>
                                        </>
                                    )}
                                </button>
                            </div>

                            {/* Course & Branch Badge */}
                            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 rounded-lg font-semibold">
                                    <BookOpen className="h-3.5 w-3.5" />
                                    <span>{enrollment.course_name}</span>
                                </div>
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold text-xs border border-purple-500/20">
                                    <Calendar className="h-3 w-3" />
                                    Ciclo {enrollment.academic_year || 2026}
                                </span>


                                {enrollment.scholarship_type && enrollment.scholarship_type !== 'NONE' && (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/30" title={enrollment.scholarship_reason || 'Beca asignada'}>
                                        {enrollment.scholarship_type === 'PERCENTAGE' ? `Beca ${enrollment.scholarship_amount}%` : `Beca Q${enrollment.scholarship_amount}`}
                                    </span>
                                )}
                            </div>

                            {/* Schedule & Actions */}
                            <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                                <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 min-w-0">
                                    <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                    <span className="truncate">
                                        {enrollment.schedule_details || 'Sin horario asignado'}
                                    </span>
                                </div>

                                <div className="flex items-center gap-1 shrink-0">
                                    <button
                                        onClick={() => handleEdit(enrollment)}
                                        className="p-2 text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 bg-slate-100 dark:bg-slate-800 rounded-xl transition-colors"
                                        title="Editar Horario"
                                    >
                                        <Pencil className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(enrollment)}
                                        className="p-2 text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 bg-slate-100 dark:bg-slate-800 rounded-xl transition-colors"
                                        title="Eliminar Inscripción"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}

                {filteredEnrollments.length === 0 && (
                    <div className="p-10 text-center bg-white/40 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl text-slate-400 flex flex-col items-center justify-center">
                        <GraduationCap className="w-10 h-10 text-slate-300 dark:text-slate-600 mb-2 stroke-1" />
                        <span className="font-semibold text-slate-600 dark:text-slate-300">No se encontraron inscripciones</span>
                        <span className="text-xs text-slate-400 mt-1">Prueba cambiando los filtros o la búsqueda.</span>
                    </div>
                )}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block bg-white/70 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800/80 rounded-3xl overflow-hidden shadow-sm backdrop-blur-xl">
                <table className="w-full text-left">
                    <thead className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800/80 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        <tr>
                            <th className="px-6 py-4">Estudiante</th>
                            <th className="px-6 py-4">Curso</th>
                            <th className="px-6 py-4">Horario Asignado</th>
                            <th className="px-6 py-4">Fecha de Inscripción</th>
                            <th className="px-6 py-4">Estado Académico</th>
                            <th className="px-6 py-4 text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-sm">
                        {filteredEnrollments.map((enrollment: any) => {
                            const isPromoted = enrollment.academic_status === 'PROMOTED';
                            const initials = (enrollment.student_name || 'U')
                                .split(' ')
                                .map((n: string) => n[0])
                                .slice(0, 2)
                                .join('')
                                .toUpperCase();

                            return (
                                <tr key={enrollment.id} className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition group">
                                    {/* Student Column */}
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-blue/20 to-blue-500/20 text-brand-blue dark:text-blue-400 flex items-center justify-center font-bold text-xs border border-brand-blue/20 shrink-0">
                                                {initials}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="font-bold text-slate-900 dark:text-white truncate">
                                                    {enrollment.student_name}
                                                </div>
                                                <div className="text-xs text-slate-400 font-mono mt-0.5">
                                                    Cód: {enrollment.student_code || 'N/A'}
                                                </div>
                                            </div>
                                        </div>
                                    </td>

                                    {/* Course Column */}
                                    <td className="px-6 py-4 font-semibold text-slate-700 dark:text-slate-300">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="px-2.5 py-1 bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 rounded-lg text-xs font-bold">
                                                {enrollment.course_name}
                                            </span>
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold text-[11px] border border-purple-500/20">
                                                <Calendar className="h-3 w-3" />
                                                Ciclo {enrollment.academic_year || 2026}
                                            </span>
                                            {enrollment.scholarship_type && enrollment.scholarship_type !== 'NONE' && (
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/30" title={enrollment.scholarship_reason || 'Beca Asignada'}>
                                                    {enrollment.scholarship_type === 'PERCENTAGE' ? `Beca ${enrollment.scholarship_amount}%` : `Beca Q${enrollment.scholarship_amount}`}
                                                </span>
                                            )}
                                        </div>
                                    </td>

                                    {/* Schedule Column */}
                                    <td className="px-6 py-4 text-slate-500 dark:text-slate-400 text-xs">
                                        {enrollment.schedule_details ? (
                                            <div className="flex items-center gap-1.5">
                                                <Clock className="h-3.5 w-3.5 text-slate-400" />
                                                <span>{enrollment.schedule_details}</span>
                                            </div>
                                        ) : (
                                            <span className="text-slate-400 italic">Sin horario asignado</span>
                                        )}
                                    </td>

                                    {/* Enrollment Date */}
                                    <td className="px-6 py-4 text-xs text-slate-500 dark:text-slate-400">
                                        <div className="flex items-center gap-1.5">
                                            <Calendar className="h-3.5 w-3.5 text-slate-400" />
                                            <span>{new Date(enrollment.enrollment_date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                        </div>
                                    </td>

                                    {/* Status Column */}
                                    <td className="px-6 py-4">
                                        <button
                                            onClick={() => handleToggleStatus(enrollment)}
                                            disabled={updateMutation.isPending}
                                            className={`px-3 py-1 rounded-full text-xs font-bold transition-all inline-flex items-center justify-center space-x-1.5 border ${
                                                isPromoted
                                                    ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30'
                                                    : enrollment.is_active
                                                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                                                    : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30 hover:bg-rose-500/20'
                                            }`}
                                        >
                                            {isPromoted ? (
                                                <>
                                                    <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                                                    <span>PROMOVIDO</span>
                                                </>
                                            ) : (
                                                <>
                                                    <div className={`w-1.5 h-1.5 rounded-full ${enrollment.is_active ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                                                    <span>{enrollment.is_active ? 'ACTIVA' : 'INACTIVA'}</span>
                                                </>
                                            )}
                                            {updateMutation.isPending && <RefreshCw className="h-3 w-3 animate-spin ml-1" />}
                                        </button>
                                    </td>

                                    {/* Actions Column */}
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end space-x-1">
                                            <button
                                                onClick={() => handleEdit(enrollment)}
                                                className="p-2 text-slate-400 hover:text-brand-blue hover:bg-brand-blue/10 rounded-xl transition-colors"
                                                title="Editar Horario"
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(enrollment)}
                                                className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-xl transition-colors"
                                                title="Eliminar Inscripción"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}

                        {filteredEnrollments.length === 0 && (
                            <tr>
                                <td colSpan={6} className="px-6 py-16 text-center text-slate-500 dark:text-slate-400">
                                    <div className="flex flex-col items-center justify-center space-y-2">
                                        <GraduationCap className="w-12 h-12 text-slate-300 dark:text-slate-600 stroke-1" />
                                        <p className="text-base font-semibold text-slate-700 dark:text-slate-300">
                                            No se encontraron inscripciones
                                        </p>
                                        <p className="text-xs text-slate-400">
                                            Prueba cambiando los filtros de búsqueda o estado.
                                        </p>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Modal de Inscripción / Edición */}
            {isModalOpen && createPortal(
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-md animate-in fade-in duration-200" onClick={closeModal} />
                    <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 my-auto text-slate-900 dark:text-slate-100">
                        {/* Modal Header */}
                        <div className="bg-slate-50/80 dark:bg-slate-950/80 p-5 sm:p-6 border-b border-slate-200 dark:border-slate-800/80 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-brand-blue/10 text-brand-blue rounded-xl">
                                    <GraduationCap className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                                        {editingId ? 'Editar Inscripción' : 'Inscribir Estudiante'}
                                    </h3>
                                    <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
                                        {editingId ? 'Actualiza el horario del alumno en este curso.' : 'Asigna un estudiante a un curso y horario.'}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={closeModal}
                                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        {/* Modal Form */}
                        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4">
                            {/* Student Picker with Search */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                    Estudiante *
                                </label>
                                {editingId ? (
                                    <div className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-300">
                                        {enrollments.find((e: any) => e.id === editingId)?.student_name || 'Estudiante'}
                                    </div>
                                ) : (
                                    <SearchableSelect
                                        options={studentSelectOptions}
                                        value={newEnrollment.student_id}
                                        onChange={(val) => setNewEnrollment({ ...newEnrollment, student_id: val })}
                                        placeholder="Buscar y seleccionar estudiante..."
                                        searchPlaceholder="Escribe el nombre o documento del alumno..."
                                        required
                                    />
                                )}
                            </div>

                            {/* Course Picker with Search */}
                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                    Curso *
                                    </label>
                                    {!editingId && distinctCycles.length > 1 && (
                                        <div className="flex items-center gap-1">
                                            <span className="text-[10px] text-slate-400 font-medium mr-1">Ciclo:</span>
                                            <button
                                                type="button"
                                                onClick={() => setModalYearFilter('ALL')}
                                                className={`text-[10px] px-2 py-0.5 rounded-md font-bold transition-all ${
                                                    modalYearFilter === 'ALL'
                                                        ? 'bg-blue-600 text-white shadow-xs'
                                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                                                }`}
                                            >
                                                Todos
                                            </button>
                                            {distinctCycles.map((year) => (
                                                <button
                                                    key={year}
                                                    type="button"
                                                    onClick={() => setModalYearFilter(year)}
                                                    className={`text-[10px] px-2 py-0.5 rounded-md font-bold transition-all ${
                                                        modalYearFilter === year
                                                            ? 'bg-blue-600 text-white shadow-xs'
                                                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                                                    }`}
                                                >
                                                    {year}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                {editingId ? (
                                    <div className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-300">
                                        {enrollments.find((e: any) => e.id === editingId)?.course_name || 'Curso'}
                                    </div>
                                ) : (
                                    <SearchableSelect
                                        options={courseSelectOptions}
                                        value={newEnrollment.course_id}
                                        onChange={(val) => setNewEnrollment({ ...newEnrollment, course_id: val, schedule_id: '' })}
                                        placeholder="Buscar y seleccionar curso..."
                                        searchPlaceholder="Escribe el nombre del curso o año..."
                                        required
                                    />
                                )}
                            </div>

                            {/* Schedule Selector */}
                            {newEnrollment.course_id && (
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                        Horario / Jornada (Opcional)
                                    </label>
                                    <select
                                        className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-slate-800 dark:text-slate-200 text-sm disabled:opacity-50"
                                        value={newEnrollment.schedule_id}
                                        onChange={(e) => setNewEnrollment({ ...newEnrollment, schedule_id: e.target.value })}
                                        disabled={isLoadingSchedules}
                                    >
                                        <option value="">Sin horario específico</option>
                                        {courseSchedules.map((s: any) => (
                                            <option key={s.id} value={s.id}>
                                                {s.grade} - {s.day_of_week} ({s.start_time?.substring(0, 5)} a {s.end_time?.substring(0, 5)})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Branch Selector (Only if Superadmin & Creating) */}
                            {!user?.branch_id && !editingId && branches.length > 0 && (
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                        Sede (Opcional)
                                    </label>
                                    <select
                                        className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-slate-800 dark:text-slate-200 text-sm"
                                        value={newEnrollment.branch_id}
                                        onChange={(e) => setNewEnrollment({ ...newEnrollment, branch_id: e.target.value })}
                                    >
                                        <option value="">Sede por defecto</option>
                                        {branches.map((b: any) => (
                                            <option key={b.id} value={b.id}>
                                                {b.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Sección de Beca / Descuento Especial */}
                            <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80">
                                <div className="flex items-center gap-2 mb-3">
                                    <Sparkles className="w-4 h-4 text-amber-500" />
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                                        Beca o Descuento Institucional
                                    </h4>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                                            Tipo de Beca
                                        </label>
                                        <select
                                            className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-slate-800 dark:text-slate-200 text-sm"
                                            value={newEnrollment.scholarship_type}
                                            onChange={(e) => setNewEnrollment({ ...newEnrollment, scholarship_type: e.target.value })}
                                        >
                                            <option value="NONE">Sin Beca (Tarifa regular)</option>
                                            <option value="PERCENTAGE">Porcentaje de Descuento (%)</option>
                                            <option value="FIXED_AMOUNT">Monto Fijo de Descuento (Q)</option>
                                        </select>
                                    </div>

                                    {newEnrollment.scholarship_type !== 'NONE' && (
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                                                {newEnrollment.scholarship_type === 'PERCENTAGE' ? 'Porcentaje (%)' : 'Descuento Mensual (Q)'}
                                            </label>
                                            <input
                                                type="number"
                                                min="0"
                                                step={newEnrollment.scholarship_type === 'PERCENTAGE' ? '1' : '0.50'}
                                                max={newEnrollment.scholarship_type === 'PERCENTAGE' ? '100' : undefined}
                                                className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-slate-800 dark:text-slate-200 text-sm"
                                                placeholder={newEnrollment.scholarship_type === 'PERCENTAGE' ? 'Ej. 25' : 'Ej. 50.00'}
                                                value={newEnrollment.scholarship_amount}
                                                onChange={(e) => setNewEnrollment({ ...newEnrollment, scholarship_amount: e.target.value })}
                                            />
                                        </div>
                                    )}
                                </div>

                                {newEnrollment.scholarship_type !== 'NONE' && (
                                    <div className="mt-3">
                                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                                            Motivo / Razón de la Beca
                                        </label>
                                        <input
                                            type="text"
                                            className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-slate-800 dark:text-slate-200 text-sm"
                                            placeholder="Ej. Beca deportiva, Hermanos, Excelencia académica..."
                                            value={newEnrollment.scholarship_reason}
                                            onChange={(e) => setNewEnrollment({ ...newEnrollment, scholarship_reason: e.target.value })}
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Modal Actions */}
                            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800/80">
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    className="px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={createMutation.isPending || updateMutation.isPending}
                                    className="px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 active:scale-95 rounded-xl shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2 disabled:opacity-50"
                                >
                                    {(createMutation.isPending || updateMutation.isPending) && (
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    )}
                                    {editingId ? 'Guardar Cambios' : 'Completar Inscripción'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}

            <ConfirmModal
                isOpen={!!deleteConfirmEnrollment}
                title="¿Eliminar Inscripción?"
                description={
                    <div className="space-y-1.5">
                        <p>
                            ¿Estás seguro de eliminar la inscripción de <strong className="text-rose-500">{deleteConfirmEnrollment?.student_name}</strong> en el curso <strong className="text-slate-800 dark:text-slate-200">{deleteConfirmEnrollment?.course_name}</strong>?
                        </p>
                        <p className="text-[11px] text-slate-400">Esta acción desvinculará al alumno del curso y sus horarios.</p>
                    </div>
                }
                confirmText="Sí, Eliminar"
                cancelText="Cancelar"
                variant="danger"
                isLoading={deleteMutation.isPending}
                onConfirm={confirmDeleteEnrollment}
                onClose={() => setDeleteConfirmEnrollment(null)}
            />
        </div>
    );
};

export default EnrollmentsList;
