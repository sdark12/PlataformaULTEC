import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getStudents, createStudent, updateStudent, deleteStudent, requestStudentDeletion } from '../../features/academic/academicService';
import { getBranches } from '../../features/branches/branchesService';
import { getCurrentUser } from '../../features/auth/authService';
import { 
    Loader2, Users, Search, Filter, Calendar, UserPlus, X, Phone, MapPin, 
    Heart, Shield, GraduationCap, Pencil, Trash2, Building2, Download, 
    Link2, Plus, Eye, CheckCircle2, FileText, Sparkles, ChevronLeft, 
    ChevronRight, UserCheck, UserX, AlertCircle 
} from 'lucide-react';
import ConfirmModal from '../../components/ui/ConfirmModal';
import StudentStatementModal from '../finance/StudentStatementModal';
import * as XLSX from 'xlsx';
import { saveWorkbook } from '../../utils/fileDownloader';
import api from '../../services/apiClient';

type FilterTab = 'all' | 'coded' | 'guardian' | 'linked' | 'medical';

const StudentsList = () => {
    const queryClient = useQueryClient();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [deleteConfirmData, setDeleteConfirmData] = useState<{ id: string; name: string } | null>(null);
    const [deleteLinkConfirmId, setDeleteLinkConfirmId] = useState<string | null>(null);
    const [newStudent, setNewStudent] = useState({
        full_name: '',
        birth_date: '',
        gender: '',
        identification_document: '',
        nationality: 'Guatemalteco',
        address: '',
        phone: '',
        guardian_name: '',
        guardian_phone: '',
        guardian_email: '',
        guardian_relationship: '',
        emergency_contact_name: '',
        emergency_contact_phone: '',
        medical_notes: '',
        previous_school: '',
        personal_code: '',
        academy_code: '',
        user_id: '',
        branch_id: ''
    });
    const [selectedStudent, setSelectedStudent] = useState<any>(null);
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState<FilterTab>('all');
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [filterGender, setFilterGender] = useState<'' | 'M' | 'F'>('');
    const [filterInstitution, setFilterInstitution] = useState('');
    const [filterBranchId, setFilterBranchId] = useState('');
    
    // Paginación
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);

    // Vinculación de Padres
    const [parentSearch, setParentSearch] = useState('');
    const [selectedParent, setSelectedParent] = useState<any>(null);

    // Estado de Cuenta / Solvencia
    const [statementStudent, setStatementStudent] = useState<{ id: string; name: string } | null>(null);

    const user = getCurrentUser();
    const isSecretary = user?.role === 'secretary';
    const [deletionReason, setDeletionReason] = useState('');
    const [isSubmittingDeletionReq, setIsSubmittingDeletionReq] = useState(false);

    // Query de estudiantes paginados
    const { data: studentsResponse, isLoading, isError } = useQuery({
        queryKey: ['students', page, pageSize, searchTerm],
        queryFn: () => getStudents(page, pageSize, searchTerm),
    });

    // Query global para métricas de KPI exactas
    const { data: allStudentsData } = useQuery({
        queryKey: ['students-all-metrics'],
        queryFn: () => getStudents(),
    });

    const rawStudents: any[] = useMemo(() => {
        if (!studentsResponse) return [];
        if (Array.isArray(studentsResponse)) return studentsResponse;
        return studentsResponse.data || [];
    }, [studentsResponse]);

    const allStudentsList: any[] = useMemo(() => {
        if (!allStudentsData) return [];
        if (Array.isArray(allStudentsData)) return allStudentsData;
        return allStudentsData.data || [];
    }, [allStudentsData]);

    const meta = studentsResponse?.meta || null;

    const { data: branches } = useQuery({
        queryKey: ['branches-list'],
        queryFn: getBranches,
        enabled: !user?.branch_id
    });

    const { data: parentLinks } = useQuery({
        queryKey: ['parentLinks'],
        queryFn: async () => {
            const res = await api.get('/api/parents/links');
            return res.data;
        }
    });

    const { data: parentResults } = useQuery({
        queryKey: ['parent-search', parentSearch],
        queryFn: async () => {
            const res = await api.get('/api/users', { params: { search: parentSearch, limit: 10 } });
            const allUsers = res.data?.data || res.data || [];
            return allUsers.filter((u: any) => u.role === 'parent' || u.role === 'student'); 
        },
        enabled: parentSearch.length >= 2 && !selectedParent,
    });

    const { data: users } = useQuery({
        queryKey: ['users'],
        queryFn: () => fetch('/api/users', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }).then(res => res.json()),
    });

    // Extract unique institutions dynamically
    const uniqueInstitutions = useMemo(() => {
        const dataset = allStudentsList.length > 0 ? allStudentsList : rawStudents;
        return Array.from(new Set(dataset.map((s: any) => s.previous_school).filter(Boolean))).sort();
    }, [allStudentsList, rawStudents]);

    // Estadísticas globales para las tarjetas KPI
    const metrics = useMemo(() => {
        const dataset = allStudentsList.length > 0 ? allStudentsList : rawStudents;
        const total = meta?.total || dataset.length;
        const withCode = dataset.filter((s: any) => s.academy_code && s.academy_code.trim()).length;
        const withGuardian = dataset.filter((s: any) => (s.guardian_name && s.guardian_name.trim()) || (s.guardian_phone && s.guardian_phone.trim())).length;
        const withUser = dataset.filter((s: any) => s.user_id).length;
        const withMedical = dataset.filter((s: any) => s.medical_notes && s.medical_notes.trim().length > 0).length;

        return { total, withCode, withGuardian, withUser, withMedical };
    }, [allStudentsList, rawStudents, meta]);


    const createMutation = useMutation({
        mutationFn: createStudent,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['students'] });
            queryClient.invalidateQueries({ queryKey: ['grades'] });
            queryClient.invalidateQueries({ queryKey: ['attendance'] });
            setIsModalOpen(false);
            resetForm();
            setErrorMsg('');
        },
        onError: (err: any) => {
            console.error('Error creating student:', err);
            setErrorMsg(err.response?.data?.message || 'Error al registrar al estudiante.');
        }
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: any }) => updateStudent(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['students'] });
            queryClient.invalidateQueries({ queryKey: ['grades'] });
            queryClient.invalidateQueries({ queryKey: ['attendance'] });
            setIsModalOpen(false);
            setIsEditing(false);
            resetForm();
            setErrorMsg('');
        },
        onError: (err: any) => {
            console.error('Error updating student:', err);
            setErrorMsg(err.response?.data?.message || 'Error al actualizar al estudiante.');
        }
    });

    const deleteMutation = useMutation({
        mutationFn: deleteStudent,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['students'] });
            queryClient.invalidateQueries({ queryKey: ['grades'] });
            queryClient.invalidateQueries({ queryKey: ['attendance'] });
        },
        onError: (err: any) => {
            console.error('Error deleting student:', err);
            alert(err.response?.data?.message || 'Error al eliminar al estudiante.');
        }
    });

    const createLinkMutation = useMutation({
        mutationFn: (data: any) => api.post('/api/parents/links', data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['parentLinks'] });
            setParentSearch('');
            setSelectedParent(null);
        },
        onError: (err: any) => {
            alert(err.response?.data?.message || 'Error al crear vínculo');
        }
    });

    const deleteLinkMutation = useMutation({
        mutationFn: (id: string) => api.delete(`/api/parents/links/${id}`),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['parentLinks'] }),
    });

    const handleDelete = (id: string, name?: string) => {
        setDeleteConfirmData({ id, name: name || 'este estudiante' });
    };

    const confirmDeleteStudent = async () => {
        if (!deleteConfirmData) return;

        if (isSecretary) {
            if (!deletionReason.trim()) {
                alert('Debes ingresar el motivo o justificación de la eliminación.');
                return;
            }
            setIsSubmittingDeletionReq(true);
            try {
                await requestStudentDeletion(deleteConfirmData.id, deletionReason.trim());
                alert('Solicitud de eliminación enviada con éxito a la Administración. Cuando sea aprobada por Dirección, el estudiante será retirado del sistema.');
                setDeleteConfirmData(null);
                setDeletionReason('');
            } catch (err: any) {
                alert(err?.response?.data?.message || 'Error al enviar la solicitud de eliminación');
            } finally {
                setIsSubmittingDeletionReq(false);
            }
        } else {
            deleteMutation.mutate(deleteConfirmData.id);
            setDeleteConfirmData(null);
        }
    };

    const confirmDeleteLink = () => {
        if (deleteLinkConfirmId) {
            deleteLinkMutation.mutate(deleteLinkConfirmId);
            setDeleteLinkConfirmId(null);
        }
    };

    const resetForm = () => {
        setNewStudent({
            full_name: '',
            birth_date: '',
            gender: '',
            identification_document: '',
            nationality: 'Guatemalteco',
            address: '',
            phone: '',
            guardian_name: '',
            guardian_phone: '',
            guardian_email: '',
            guardian_relationship: '',
            emergency_contact_name: '',
            emergency_contact_phone: '',
            medical_notes: '',
            previous_school: '',
            personal_code: '',
            academy_code: '',
            user_id: '',
            branch_id: ''
        });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg('');
        if (!newStudent.full_name) {
            setErrorMsg('El nombre completo es obligatorio');
            return;
        }

        if (isEditing && selectedStudent) {
            updateMutation.mutate({ id: selectedStudent.id, data: newStudent });
        } else {
            createMutation.mutate(newStudent);
        }
    };

    // Filtrado del dataset activo (búsqueda local + pestañas + filtros avanzados)
    const filteredStudents = useMemo(() => {
        return rawStudents.filter((s: any) => {
            // Filtro por pestañas
            if (activeTab === 'coded' && (!s.academy_code || !s.academy_code.trim())) return false;
            if (activeTab === 'guardian' && (!s.guardian_name && !s.guardian_phone)) return false;
            if (activeTab === 'linked' && !s.user_id) return false;
            if (activeTab === 'medical' && (!s.medical_notes || s.medical_notes.trim().length === 0)) return false;

            // Filtro por texto de búsqueda local
            if (searchTerm) {
                const q = searchTerm.toLowerCase();
                const matches = (
                    s.full_name?.toLowerCase().includes(q) ||
                    s.identification_document?.toLowerCase().includes(q) ||
                    s.academy_code?.toLowerCase().includes(q) ||
                    s.personal_code?.toLowerCase().includes(q) ||
                    s.phone?.includes(searchTerm) ||
                    s.guardian_name?.toLowerCase().includes(q) ||
                    s.guardian_phone?.includes(searchTerm)
                );
                if (!matches) return false;
            }

            // Filtros avanzados
            if (filterGender && s.gender !== filterGender) return false;
            if (filterInstitution && s.previous_school !== filterInstitution) return false;
            if (filterBranchId && s.branch_id !== filterBranchId) return false;

            return true;
        });
    }, [rawStudents, activeTab, searchTerm, filterGender, filterInstitution, filterBranchId]);

    const activeFiltersCount = (filterGender ? 1 : 0) + (filterInstitution ? 1 : 0) + (filterBranchId ? 1 : 0);

    const exportToExcel = async () => {
        const dataset = filteredStudents.length > 0 ? filteredStudents : rawStudents;
        if (!dataset || dataset.length === 0) return;

        const dataToExport = dataset.map((s: any) => ({
            'ID Sistema': s.id,
            'Código ULTEC': s.academy_code || '',
            'Código MINEDUC': s.personal_code || '',
            'Nombre Completo': s.full_name,
            'Fecha de Nacimiento': s.birth_date ? new Date(s.birth_date).toLocaleDateString() : '',
            'Género': s.gender === 'M' ? 'Masculino' : s.gender === 'F' ? 'Femenino' : '',
            'DPI/CUI': s.identification_document || '',
            'Teléfono Estudiante': s.phone || '',
            'Encargado': s.guardian_name || '',
            'Parentesco': s.guardian_relationship || '',
            'Tel. Encargado': s.guardian_phone || '',
            'Sede': s.branches?.name || 'Sede Principal',
            'Escuela Procedencia': s.previous_school || '',
            'Notas Médicas': s.medical_notes || '',
            'Cuenta Enlazada': s.user_id ? 'SÍ' : 'NO'
        }));

        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Estudiantes");
        await saveWorkbook(workbook, `Reporte_Estudiantes_${new Date().toISOString().slice(0, 10)}.xlsx`);
    };

    const openEditModal = (student: any) => {
        setSelectedStudent(student);
        setNewStudent({
            full_name: student.full_name || '',
            birth_date: student.birth_date ? student.birth_date.split('T')[0] : '',
            gender: student.gender || '',
            identification_document: student.identification_document || '',
            nationality: student.nationality || 'Guatemalteco',
            address: student.address || '',
            phone: student.phone || '',
            guardian_name: student.guardian_name || '',
            guardian_phone: student.guardian_phone || '',
            guardian_email: student.guardian_email || '',
            guardian_relationship: student.guardian_relationship || '',
            emergency_contact_name: student.emergency_contact_name || '',
            emergency_contact_phone: student.emergency_contact_phone || '',
            medical_notes: student.medical_notes || '',
            previous_school: student.previous_school || '',
            personal_code: student.personal_code || '',
            academy_code: student.academy_code || '',
            user_id: student.user_id || '',
            branch_id: student.branch_id || ''
        });
        setIsEditing(true);
        setIsModalOpen(true);
    };

    const openViewProfile = (student: any) => {
        setSelectedStudent(student);
        setIsViewModalOpen(true);
    };

    if (isLoading && !rawStudents.length) return (
        <div className="flex flex-col items-center justify-center min-h-[420px] space-y-4">
            <Loader2 className="animate-spin h-12 w-12 text-brand-blue" />
            <p className="text-slate-400 font-medium animate-pulse">Cargando base de datos de estudiantes...</p>
        </div>
    );

    return (
        <div className="space-y-6 animate-in fade-in duration-500 max-w-7xl mx-auto pb-12">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900/40 p-5 rounded-3xl border border-slate-800/80 backdrop-blur-md">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-2xl bg-brand-blue/15 border border-brand-blue/30 text-brand-blue flex items-center justify-center shadow-inner">
                            <Users className="h-5 w-5" />
                        </div>
                        <div>
                            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Registro de Estudiantes</h2>
                            <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-0.5">Base de datos centralizada de alumnos inscritos en ULTEC.</p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2.5 w-full md:w-auto">
                    <button
                        onClick={exportToExcel}
                        title="Exportar registros a Excel"
                        className="flex-1 md:flex-none flex items-center justify-center space-x-2 px-4 py-2.5 bg-emerald-600/15 text-emerald-400 border border-emerald-500/30 rounded-xl hover:bg-emerald-600 hover:text-white transition-all shadow-sm active:scale-95 text-xs sm:text-sm font-semibold"
                    >
                        <Download className="h-4 w-4" />
                        <span>Exportar ({filteredStudents.length})</span>
                    </button>
                    <button
                        onClick={() => {
                            setErrorMsg('');
                            setIsEditing(false);
                            resetForm();
                            setIsModalOpen(true);
                        }}
                        className="flex-1 md:flex-none flex items-center justify-center space-x-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:opacity-95 transition-all shadow-lg shadow-blue-500/25 active:scale-95 text-xs sm:text-sm font-semibold border border-white/10"
                    >
                        <UserPlus className="h-4 w-4" />
                        <span>Registrar Estudiante</span>
                    </button>
                </div>
            </div>

            {/* Error banner */}
            {isError && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-2xl flex items-center space-x-3 text-sm">
                    <AlertCircle className="h-5 w-5 shrink-0" />
                    <span>Hubo un problema al cargar los estudiantes. Por favor, reintente en unos instantes.</span>
                </div>
            )}

            {/* Interactive Stat Cards (KPIs) */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {/* Total Alumnos */}
                <button
                    onClick={() => setActiveTab('all')}
                    className={`p-4 sm:p-5 rounded-2xl border text-left transition-all relative overflow-hidden group active:scale-[0.98] ${
                        activeTab === 'all'
                            ? 'bg-blue-600/15 border-blue-500/60 shadow-lg shadow-blue-500/10 ring-2 ring-blue-500/30'
                            : 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/90'
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Alumnos</span>
                        <div className="h-8 w-8 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
                            <Users className="h-4 w-4" />
                        </div>
                    </div>
                    <div className="mt-3">
                        <div className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">{metrics.total}</div>
                        <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                            Matrícula general
                        </p>
                    </div>
                </button>

                {/* Con Código ULTEC */}
                <button
                    onClick={() => setActiveTab('coded')}
                    className={`p-4 sm:p-5 rounded-2xl border text-left transition-all relative overflow-hidden group active:scale-[0.98] ${
                        activeTab === 'coded'
                            ? 'bg-purple-600/15 border-purple-500/60 shadow-lg shadow-purple-500/10 ring-2 ring-purple-500/30'
                            : 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/90'
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-purple-400 uppercase tracking-wider">Con Código ULTEC</span>
                        <div className="h-8 w-8 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center border border-purple-500/30">
                            <Sparkles className="h-4 w-4" />
                        </div>
                    </div>
                    <div className="mt-3">
                        <div className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">{metrics.withCode}</div>
                        <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-purple-400"></span>
                            Codificados UT-2026
                        </p>
                    </div>
                </button>

                {/* Con Tutor / Encargado */}
                <button
                    onClick={() => setActiveTab('guardian')}
                    className={`p-4 sm:p-5 rounded-2xl border text-left transition-all relative overflow-hidden group active:scale-[0.98] ${
                        activeTab === 'guardian'
                            ? 'bg-indigo-600/15 border-indigo-500/60 shadow-lg shadow-indigo-500/10 ring-2 ring-indigo-500/30'
                            : 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/90'
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Con Encargado</span>
                        <div className="h-8 w-8 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
                            <Shield className="h-4 w-4" />
                        </div>
                    </div>
                    <div className="mt-3">
                        <div className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">{metrics.withGuardian}</div>
                        <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
                            Contacto familiar activo
                        </p>
                    </div>
                </button>

                {/* Con Cuenta de Plataforma */}
                <button
                    onClick={() => setActiveTab('linked')}
                    className={`p-4 sm:p-5 rounded-2xl border text-left transition-all relative overflow-hidden group active:scale-[0.98] ${
                        activeTab === 'linked'
                            ? 'bg-emerald-600/15 border-emerald-500/60 shadow-lg shadow-emerald-500/10 ring-2 ring-emerald-500/30'
                            : 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/90'
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Cuenta Enlazada</span>
                        <div className="h-8 w-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                            <UserCheck className="h-4 w-4" />
                        </div>
                    </div>
                    <div className="mt-3">
                        <div className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">{metrics.withUser}</div>
                        <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                            Con acceso a la app
                        </p>
                    </div>
                </button>
            </div>

            {/* Filter Pills / Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                <button
                    onClick={() => setActiveTab('all')}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                        activeTab === 'all'
                            ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                            : 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-700/50'
                    }`}
                >
                    <span>Todos</span>
                    <span className="px-1.5 py-0.2 rounded-full bg-white/20 text-[10px]">{metrics.total}</span>
                </button>
                <button
                    onClick={() => setActiveTab('coded')}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                        activeTab === 'coded'
                            ? 'bg-purple-600 text-white shadow-md shadow-purple-500/20'
                            : 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-700/50'
                    }`}
                >
                    <Sparkles className="h-3 w-3" />
                    <span>Con Código ULTEC</span>
                    <span className="px-1.5 py-0.2 rounded-full bg-white/20 text-[10px]">{metrics.withCode}</span>
                </button>
                <button
                    onClick={() => setActiveTab('guardian')}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                        activeTab === 'guardian'
                            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                            : 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-700/50'
                    }`}
                >
                    <Shield className="h-3 w-3" />
                    <span>Con Tutor</span>
                    <span className="px-1.5 py-0.2 rounded-full bg-white/20 text-[10px]">{metrics.withGuardian}</span>
                </button>
                <button
                    onClick={() => setActiveTab('linked')}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                        activeTab === 'linked'
                            ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20'
                            : 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-700/50'
                    }`}
                >
                    <UserCheck className="h-3 w-3" />
                    <span>Con Cuenta Activa</span>
                    <span className="px-1.5 py-0.2 rounded-full bg-white/20 text-[10px]">{metrics.withUser}</span>
                </button>
                <button
                    onClick={() => setActiveTab('medical')}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                        activeTab === 'medical'
                            ? 'bg-rose-600 text-white shadow-md shadow-rose-500/20'
                            : 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-700/50'
                    }`}
                >
                    <Heart className="h-3 w-3" />
                    <span>Notas Médicas</span>
                    <span className="px-1.5 py-0.2 rounded-full bg-white/20 text-[10px]">{metrics.withMedical}</span>
                </button>
            </div>

            {/* Search & Advanced Filters Bar */}
            <div className="flex flex-col md:flex-row gap-3">
                <div className="relative flex-1 group">
                    <Search className="absolute left-4 top-3.5 h-4 w-4 text-slate-400 group-focus-within:text-brand-blue transition-colors" />
                    <input
                        type="text"
                        placeholder="Buscar por nombre, documento DPI, código ULTEC, teléfono o encargado..."
                        className="w-full pl-11 pr-10 py-3 bg-slate-900/70 border border-slate-800 text-white rounded-2xl focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue outline-none transition-all placeholder:text-slate-500 text-xs sm:text-sm shadow-inner"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    {searchTerm && (
                        <button
                            onClick={() => setSearchTerm('')}
                            className="absolute right-3.5 top-3.5 text-slate-500 hover:text-white transition-colors"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    {/* Selector de límite por página */}
                    <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-900/70 border border-slate-800 rounded-2xl text-xs text-slate-300">
                        <span className="text-slate-500">Filas:</span>
                        <select
                            value={pageSize}
                            onChange={(e) => {
                                setPageSize(Number(e.target.value));
                                setPage(1);
                            }}
                            className="bg-transparent text-white font-bold outline-none cursor-pointer"
                        >
                            <option value="15" className="bg-slate-900 text-white">15</option>
                            <option value="25" className="bg-slate-900 text-white">25</option>
                            <option value="50" className="bg-slate-900 text-white">50</option>
                            <option value="100" className="bg-slate-900 text-white">100</option>
                        </select>
                    </div>

                    {/* Popover Filtros */}
                    <div className="relative">
                        <button
                            onClick={() => setIsFilterOpen(!isFilterOpen)}
                            className={`flex items-center justify-center space-x-2 px-4 py-3 border rounded-2xl transition-all font-medium text-xs sm:text-sm shadow-sm ${
                                isFilterOpen || activeFiltersCount > 0
                                    ? 'bg-blue-600/20 border-blue-500/50 text-blue-400'
                                    : 'bg-slate-900/70 border-slate-800 text-slate-300 hover:bg-slate-800/80 hover:text-white'
                            }`}
                        >
                            <Filter className="h-4 w-4" />
                            <span>Filtros {activeFiltersCount > 0 ? `(${activeFiltersCount})` : ''}</span>
                        </button>

                        {isFilterOpen && (
                            <div className="absolute right-0 top-full mt-2 w-72 sm:w-80 bg-slate-900 border border-slate-800 rounded-2xl p-5 z-30 shadow-2xl animate-in fade-in slide-in-from-top-2">
                                <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-2.5">
                                    <h4 className="font-bold text-white text-sm">Filtros Avanzados</h4>
                                    {activeFiltersCount > 0 && (
                                        <button
                                            onClick={() => {
                                                setFilterGender('');
                                                setFilterInstitution('');
                                                setFilterBranchId('');
                                            }}
                                            className="text-[11px] font-semibold text-rose-400 hover:underline"
                                        >
                                            Limpiar todos
                                        </button>
                                    )}
                                </div>

                                <div className="space-y-4">
                                    {/* Sede */}
                                    {!user?.branch_id && branches && branches.length > 0 && (
                                        <div>
                                            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Sede</label>
                                            <select
                                                className="w-full bg-slate-800/80 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-brand-blue outline-none"
                                                value={filterBranchId}
                                                onChange={(e) => setFilterBranchId(e.target.value)}
                                            >
                                                <option value="">Todas las sedes</option>
                                                {branches.map((b: any) => (
                                                    <option key={b.id} value={b.id}>{b.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}

                                    {/* Género */}
                                    <div>
                                        <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Género</label>
                                        <select
                                            className="w-full bg-slate-800/80 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-brand-blue outline-none"
                                            value={filterGender}
                                            onChange={(e) => setFilterGender(e.target.value as '' | 'M' | 'F')}
                                        >
                                            <option value="">Todos los géneros</option>
                                            <option value="M">Masculino</option>
                                            <option value="F">Femenino</option>
                                        </select>
                                    </div>

                                    {/* Escuela de Procedencia */}
                                    {uniqueInstitutions.length > 0 && (
                                        <div>
                                            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Escuela de Procedencia</label>
                                            <select
                                                className="w-full bg-slate-800/80 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-brand-blue outline-none"
                                                value={filterInstitution}
                                                onChange={(e) => setFilterInstitution(e.target.value)}
                                            >
                                                <option value="">Todas las instituciones</option>
                                                {uniqueInstitutions.map((inst: any) => (
                                                    <option key={inst} value={inst}>{inst}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                </div>

                                <div className="mt-5 pt-3 border-t border-slate-800 flex justify-end">
                                    <button
                                        onClick={() => setIsFilterOpen(false)}
                                        className="px-4 py-2 bg-brand-blue hover:bg-blue-600 text-white rounded-xl text-xs font-bold transition-all"
                                    >
                                        Listo
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Mobile Feed (md:hidden) */}
            <div className="block md:hidden space-y-3">
                {filteredStudents.map((student: any) => (
                    <div
                        key={student.id}
                        className="bg-slate-900/70 backdrop-blur-md rounded-2xl p-4 border border-slate-800/80 shadow-md relative overflow-hidden"
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="h-11 w-11 rounded-2xl bg-gradient-to-tr from-brand-blue/30 via-indigo-500/20 to-purple-500/30 text-white border border-blue-500/30 flex items-center justify-center font-bold text-base uppercase shrink-0 shadow-inner">
                                    {student.full_name?.charAt(0) || 'E'}
                                </div>
                                <div className="min-w-0">
                                    <h4 className="font-bold text-white text-sm truncate leading-snug">
                                        {student.full_name}
                                    </h4>
                                    <div className="flex items-center gap-1.5 flex-wrap mt-1">
                                        {student.academy_code ? (
                                            <span className="px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300 font-mono text-[10px] font-bold border border-purple-500/30">
                                                {student.academy_code}
                                            </span>
                                        ) : (
                                            <span className="text-[10px] text-slate-500 font-mono">
                                                #{String(student.id).slice(0, 8)}
                                            </span>
                                        )}
                                        {student.user_id ? (
                                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 text-[10px] font-bold flex items-center gap-0.5 border border-emerald-500/30">
                                                <CheckCircle2 className="h-2.5 w-2.5" />
                                                App
                                            </span>
                                        ) : null}
                                        {student.branches?.name && (
                                            <span className="text-[10px] text-amber-400 font-semibold flex items-center gap-0.5">
                                                <Building2 className="h-2.5 w-2.5" />
                                                {student.branches.name}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Fila de detalles */}
                        <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-800 text-xs">
                            <div className="flex items-center gap-1.5 text-slate-400">
                                <Calendar className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                                <span className="truncate">
                                    {student.birth_date ? new Date(student.birth_date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Sin fecha'}
                                </span>
                            </div>
                            <div className="flex items-center gap-1.5 text-slate-400">
                                <Phone className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                                {student.phone ? (
                                    <a href={`tel:${student.phone}`} className="text-blue-400 hover:underline truncate">
                                        {student.phone}
                                    </a>
                                ) : (
                                    <span className="text-slate-500 truncate">Sin teléfono</span>
                                )}
                            </div>
                        </div>

                        {/* Fila de tutor si existe */}
                        {student.guardian_name && (
                            <div className="mt-2 pt-2 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-400">
                                <div className="flex items-center gap-1.5 truncate">
                                    <Shield className="h-3 w-3 text-indigo-400 shrink-0" />
                                    <span className="truncate text-slate-300 font-medium">{student.guardian_name}</span>
                                    <span className="text-[10px] text-slate-500">({student.guardian_relationship || 'Tutor'})</span>
                                </div>
                                {student.guardian_phone && (
                                    <a href={`tel:${student.guardian_phone}`} className="text-indigo-400 hover:underline shrink-0 text-[11px]">
                                        {student.guardian_phone}
                                    </a>
                                )}
                            </div>
                        )}

                        {/* Botones de acción móvil */}
                        <div className="mt-3 pt-2.5 border-t border-slate-800 flex items-center justify-between gap-2">
                            <button
                                onClick={() => openViewProfile(student)}
                                className="flex-1 py-2 px-2.5 bg-brand-blue/15 text-brand-blue hover:bg-brand-blue/25 rounded-xl text-xs font-bold transition-all text-center active:scale-95 flex items-center justify-center gap-1 border border-brand-blue/20"
                            >
                                <Eye className="h-3.5 w-3.5" />
                                <span>Perfil</span>
                            </button>
                            <button
                                onClick={() => setStatementStudent({ id: student.id, name: student.full_name })}
                                className="flex-1 py-2 px-2.5 bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 rounded-xl text-xs font-bold transition-all text-center active:scale-95 flex items-center justify-center gap-1 border border-emerald-500/20"
                                title="Estado de Cuenta / Solvencia"
                            >
                                <FileText className="h-3.5 w-3.5" />
                                <span>Solvencia</span>
                            </button>
                            <button
                                onClick={() => openEditModal(student)}
                                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors active:scale-95 border border-slate-800"
                                title="Editar Estudiante"
                            >
                                <Pencil className="h-4 w-4" />
                            </button>
                            <button
                                onClick={() => handleDelete(student.id, student.full_name)}
                                className="p-2 text-rose-400 hover:text-white hover:bg-rose-600 rounded-xl transition-colors active:scale-95 border border-rose-500/20"
                                title="Eliminar Estudiante"
                            >
                                <Trash2 className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                ))}

                {filteredStudents.length === 0 && (
                    <div className="bg-slate-900/60 border border-dashed border-slate-800 rounded-3xl py-12 text-center flex flex-col items-center justify-center space-y-2">
                        <Users className="h-8 w-8 text-slate-600" />
                        <p className="text-white font-bold text-sm">No se encontraron estudiantes</p>
                        <p className="text-slate-400 text-xs">Intenta con otro término de búsqueda o cambia de filtro.</p>
                    </div>
                )}
            </div>

            {/* Desktop Table (hidden md:block) */}
            <div className="hidden md:block bg-slate-900/60 border border-slate-800/80 rounded-3xl overflow-hidden backdrop-blur-md shadow-xl">
                <div className="min-w-full inline-block align-middle">
                    <table className="min-w-full divide-y divide-slate-800/80">
                        <thead className="bg-slate-950/70">
                            <tr>
                                <th className="px-6 py-4 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider">Estudiante</th>
                                <th className="px-6 py-4 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider">Documento / Códigos</th>
                                <th className="px-6 py-4 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider">Contacto & Tutor</th>
                                <th className="px-6 py-4 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider">Sede</th>
                                <th className="px-6 py-4 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider">Acceso App</th>
                                <th className="px-6 py-4 text-right text-[11px] font-bold text-slate-400 uppercase tracking-wider">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                            {filteredStudents.map((student: any) => (
                                <tr key={student.id} className="hover:bg-slate-800/40 transition-colors group">
                                    {/* Estudiante (Avatar, Nombre, Badge ULTEC) */}
                                    <td className="px-6 py-4">
                                        <div className="flex items-center space-x-3.5">
                                            <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-brand-blue/30 via-indigo-500/20 to-purple-500/30 text-white border border-blue-500/30 flex items-center justify-center font-bold text-sm uppercase shadow-inner shrink-0">
                                                {student.full_name?.charAt(0) || 'E'}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="font-bold text-white text-sm truncate leading-snug group-hover:text-blue-400 transition-colors">
                                                    {student.full_name}
                                                </p>
                                                <div className="flex items-center gap-1.5 mt-1">
                                                    {student.academy_code ? (
                                                        <span className="px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300 font-mono text-[10px] font-bold border border-purple-500/30">
                                                            {student.academy_code}
                                                        </span>
                                                    ) : (
                                                        <span className="text-[10px] text-slate-500 font-mono">
                                                            #{String(student.id).slice(0, 8)}
                                                        </span>
                                                    )}
                                                    {student.birth_date && (
                                                        <span className="text-[10px] text-slate-500 flex items-center gap-1">
                                                            • {new Date(student.birth_date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </td>

                                    {/* Documento / Códigos */}
                                    <td className="px-6 py-4">
                                        <div className="space-y-1">
                                            {student.identification_document ? (
                                                <div className="flex items-center gap-1.5 text-xs text-slate-300 font-medium">
                                                    <FileText className="h-3.5 w-3.5 text-slate-500" />
                                                    <span>DPI: {student.identification_document}</span>
                                                </div>
                                            ) : (
                                                <span className="text-[11px] text-slate-500 italic">Sin DPI registrado</span>
                                            )}
                                            {student.personal_code && (
                                                <p className="text-[10px] text-slate-400 font-mono">
                                                    MINEDUC: <span className="text-slate-300 font-semibold">{student.personal_code}</span>
                                                </p>
                                            )}
                                        </div>
                                    </td>

                                    {/* Contacto & Tutor */}
                                    <td className="px-6 py-4">
                                        <div className="space-y-1">
                                            {student.phone ? (
                                                <a 
                                                    href={`tel:${student.phone}`} 
                                                    className="flex items-center gap-1.5 text-xs text-blue-400 hover:underline font-medium"
                                                >
                                                    <Phone className="h-3 w-3 text-blue-400" />
                                                    <span>{student.phone}</span>
                                                </a>
                                            ) : (
                                                <span className="text-[11px] text-slate-500 italic">Sin teléfono alumno</span>
                                            )}

                                            {student.guardian_name && (
                                                <div className="flex items-center gap-1 text-[11px] text-slate-400">
                                                    <Shield className="h-3 w-3 text-indigo-400 shrink-0" />
                                                    <span className="text-slate-300 font-medium truncate max-w-[140px]">{student.guardian_name}</span>
                                                    {student.guardian_phone && (
                                                        <a href={`tel:${student.guardian_phone}`} className="text-indigo-400 hover:underline ml-1 font-mono">
                                                            ({student.guardian_phone})
                                                        </a>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </td>

                                    {/* Sede */}
                                    <td className="px-6 py-4">
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 text-xs font-medium">
                                            <Building2 className="h-3.5 w-3.5 text-amber-400" />
                                            <span>{student.branches?.name || 'Sede Central'}</span>
                                        </span>
                                    </td>

                                    {/* Acceso a App */}
                                    <td className="px-6 py-4">
                                        {student.user_id ? (
                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold">
                                                <CheckCircle2 className="h-3 w-3" />
                                                <span>Enlazado</span>
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-800/80 border border-slate-700/60 text-slate-500 text-[11px] font-medium">
                                                <UserX className="h-3 w-3" />
                                                <span>Sin vincular</span>
                                            </span>
                                        )}
                                    </td>

                                    {/* Acciones (SIEMPRE VISIBLES) */}
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end space-x-1.5">
                                            <button
                                                onClick={() => openViewProfile(student)}
                                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600/15 hover:bg-blue-600 text-blue-400 hover:text-white rounded-xl text-xs font-bold transition-all border border-blue-500/20 active:scale-95"
                                                title="Ver Perfil Completo"
                                            >
                                                <Eye className="h-3.5 w-3.5" />
                                                <span>Perfil</span>
                                            </button>

                                            <button
                                                onClick={() => setStatementStudent({ id: student.id, name: student.full_name })}
                                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600/15 hover:bg-emerald-600 text-emerald-400 hover:text-white rounded-xl text-xs font-bold transition-all border border-emerald-500/20 active:scale-95"
                                                title="Consultar Estado de Cuenta y Solvencia"
                                            >
                                                <FileText className="h-3.5 w-3.5" />
                                                <span>Solvencia</span>
                                            </button>

                                            <button
                                                onClick={() => openEditModal(student)}
                                                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all border border-slate-800 hover:border-slate-700 active:scale-95"
                                                title="Editar Estudiante"
                                            >
                                                <Pencil className="h-3.5 w-3.5" />
                                            </button>

                                            <button
                                                onClick={() => handleDelete(student.id, student.full_name)}
                                                className="p-1.5 text-rose-400 hover:text-white hover:bg-rose-600 rounded-xl transition-all border border-rose-500/20 active:scale-95"
                                                title="Eliminar Estudiante"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}

                            {filteredStudents.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-8 py-16 text-center">
                                        <div className="flex flex-col items-center justify-center space-y-3">
                                            <div className="h-14 w-14 bg-slate-800/60 border border-slate-700 rounded-2xl flex items-center justify-center text-slate-500">
                                                <Users className="h-7 w-7" />
                                            </div>
                                            <div>
                                                <p className="text-white font-bold text-base">No se encontraron estudiantes</p>
                                                <p className="text-slate-400 text-xs mt-1">Intenta con otro término de búsqueda o limpia los filtros activos.</p>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Paginación y Resumen */}
            {meta && meta.totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 bg-slate-900/50 rounded-2xl border border-slate-800/80 animate-in fade-in text-xs sm:text-sm">
                    <p className="text-slate-400">
                        Mostrando registros del <strong className="text-white">{(meta.page - 1) * meta.limit + 1}</strong> al <strong className="text-white">{Math.min(meta.page * meta.limit, meta.total)}</strong> de <strong className="text-brand-blue">{meta.total}</strong> alumnos
                    </p>

                    <div className="flex items-center space-x-2">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="px-3.5 py-2 border border-slate-800 rounded-xl bg-slate-800/60 text-slate-300 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all font-medium flex items-center gap-1 active:scale-95"
                        >
                            <ChevronLeft className="h-4 w-4" />
                            <span>Anterior</span>
                        </button>

                        <div className="px-3 py-1.5 bg-slate-800 rounded-xl font-mono text-xs font-bold text-white border border-slate-700">
                            {page} / {meta.totalPages}
                        </div>

                        <button
                            onClick={() => setPage(p => Math.min(meta.totalPages, p + 1))}
                            disabled={page === meta.totalPages}
                            className="px-3.5 py-2 border border-slate-800 rounded-xl bg-slate-800/60 text-slate-300 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all font-medium flex items-center gap-1 active:scale-95"
                        >
                            <span>Siguiente</span>
                            <ChevronRight className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            )}


            {/* Modal Registrar / Editar Estudiante */}
            {isModalOpen && createPortal(
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4">
                    <div 
                        className="absolute inset-0 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200" 
                        onClick={() => setIsModalOpen(false)} 
                    />

                    <div className="bg-slate-900 text-white rounded-2xl sm:rounded-3xl w-full max-w-3xl shadow-2xl relative z-10 overflow-hidden animate-in zoom-in-95 duration-200 max-h-[92vh] flex flex-col border border-slate-800">
                        {/* Header */}
                        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/90 shrink-0">
                            <div className="flex items-center gap-2.5">
                                <div className="h-9 w-9 rounded-xl bg-blue-500/20 text-brand-blue border border-blue-500/30 flex items-center justify-center font-bold">
                                    <UserPlus className="h-5 w-5" />
                                </div>
                                <div>
                                    <h3 className="text-base sm:text-lg font-bold">
                                        {isEditing ? 'Editar Estudiante' : 'Registrar Estudiante'}
                                    </h3>
                                    <p className="text-[11px] text-slate-400">
                                        {isEditing ? 'Modifique los datos del estudiante.' : 'Complete los datos básicos para formalizar el registro.'}
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsModalOpen(false)}
                                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                                aria-label="Cerrar"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Form */}
                        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
                            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 custom-scrollbar">
                                {errorMsg && (
                                    <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium animate-shake">
                                        {errorMsg}
                                    </div>
                                )}

                                <div className="space-y-4">
                                    {/* Información Personal */}
                                    <div className="border-b border-slate-800 pb-2">
                                        <h4 className="text-sm font-bold text-slate-200 uppercase tracking-wider">Información Personal</h4>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                        <div className="sm:col-span-2">
                                            <label className="text-xs sm:text-sm font-semibold text-slate-300 ml-1">Nombre Completo *</label>
                                            <input
                                                type="text"
                                                required
                                                className="w-full mt-1.5 px-3.5 py-2.5 sm:py-3 bg-slate-800/80 border border-slate-700 text-white rounded-xl focus:ring-2 focus:ring-brand-blue focus:border-brand-blue outline-none transition-all placeholder:text-slate-500 text-sm"
                                                placeholder="Ej: Juan Pérez"
                                                value={newStudent.full_name}
                                                onChange={(e) => setNewStudent({ ...newStudent, full_name: e.target.value })}
                                            />
                                        </div>

                                        {!user?.branch_id && (
                                            <div className="sm:col-span-2">
                                                <label className="text-xs sm:text-sm font-semibold text-slate-300 ml-1 flex items-center">
                                                    <Building2 className="h-3.5 w-3.5 mr-1 text-slate-400" />
                                                    Sede *
                                                </label>
                                                <select
                                                    className="w-full mt-1.5 px-3.5 py-2.5 sm:py-3 bg-slate-800/80 border border-slate-700 text-white rounded-xl focus:ring-2 focus:ring-brand-blue focus:border-brand-blue outline-none transition-all text-sm"
                                                    value={newStudent.branch_id}
                                                    onChange={(e) => setNewStudent({ ...newStudent, branch_id: e.target.value })}
                                                    required={!user?.branch_id}
                                                >
                                                    <option value="" className="bg-slate-900 text-slate-400">Seleccione una sede...</option>
                                                    {branches?.map((branch: any) => (
                                                        <option key={branch.id} value={branch.id} className="bg-slate-900 text-white">{branch.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}

                                        <div>
                                            <label className="text-xs sm:text-sm font-semibold text-slate-300 ml-1">Fecha de Nacimiento</label>
                                            <input
                                                type="date"
                                                className="w-full mt-1.5 px-3.5 py-2.5 sm:py-3 bg-slate-800/80 border border-slate-700 text-white rounded-xl focus:ring-2 focus:ring-brand-blue focus:border-brand-blue outline-none transition-all text-sm"
                                                value={newStudent.birth_date}
                                                onChange={(e) => setNewStudent({ ...newStudent, birth_date: e.target.value })}
                                            />
                                        </div>

                                        <div>
                                            <label className="text-xs sm:text-sm font-semibold text-slate-300 ml-1">Género</label>
                                            <select
                                                className="w-full mt-1.5 px-3.5 py-2.5 sm:py-3 bg-slate-800/80 border border-slate-700 text-white rounded-xl focus:ring-2 focus:ring-brand-blue focus:border-brand-blue outline-none transition-all text-sm"
                                                value={newStudent.gender}
                                                onChange={(e) => setNewStudent({ ...newStudent, gender: e.target.value })}
                                            >
                                                <option value="" className="bg-slate-900 text-slate-400">Seleccione...</option>
                                                <option value="M" className="bg-slate-900 text-white">Masculino</option>
                                                <option value="F" className="bg-slate-900 text-white">Femenino</option>
                                            </select>
                                        </div>

                                        <div className="sm:col-span-2">
                                            <label className="text-xs sm:text-sm font-semibold text-slate-300 ml-1">DPI / CUI / Documento</label>
                                            <input
                                                type="text"
                                                className="w-full mt-1.5 px-3.5 py-2.5 sm:py-3 bg-slate-800/80 border border-slate-700 text-white rounded-xl focus:ring-2 focus:ring-brand-blue focus:border-brand-blue outline-none transition-all placeholder:text-slate-500 text-sm"
                                                placeholder="Documento de Identificación"
                                                value={newStudent.identification_document}
                                                onChange={(e) => setNewStudent({ ...newStudent, identification_document: e.target.value })}
                                            />
                                        </div>

                                        {/* Enlazar cuenta */}
                                        <div className="sm:col-span-2 bg-brand-blue/10 border border-brand-blue/20 rounded-xl p-3.5 sm:p-4">
                                            <label className="text-xs sm:text-sm font-bold text-brand-blue dark:text-brand-teal flex items-center mb-1.5">
                                                Enlazar a Cuenta de Plataforma
                                            </label>
                                            <select
                                                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-blue focus:border-brand-blue outline-none transition-all text-white text-xs sm:text-sm"
                                                value={newStudent.user_id || ''}
                                                onChange={(e) => setNewStudent({ ...newStudent, user_id: e.target.value })}
                                            >
                                                <option value="" className="bg-slate-900 text-slate-400">No enlazado / Crear perfil primero</option>
                                                {users?.filter((u: any) => u.role === 'student')?.map((user: any) => (
                                                    <option key={user.id} value={user.id} className="bg-slate-900 text-white">
                                                        {user.full_name} ({user.email})
                                                    </option>
                                                ))}
                                            </select>
                                            <p className="text-[11px] text-slate-400 mt-1.5">
                                                * El alumno debe tener una cuenta con rol "estudiante" en Usuarios para vincularla.
                                            </p>
                                        </div>
                                    </div>

                                    {/* Contacto */}
                                    <div className="border-b border-slate-800 pb-2 pt-2">
                                        <h4 className="text-sm font-bold text-slate-200 uppercase tracking-wider">Contacto</h4>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                        <div className="sm:col-span-2">
                                            <label className="text-xs sm:text-sm font-semibold text-slate-300 ml-1">Dirección</label>
                                            <input
                                                type="text"
                                                className="w-full mt-1.5 px-3.5 py-2.5 sm:py-3 bg-slate-800/80 border border-slate-700 text-white rounded-xl focus:ring-2 focus:ring-brand-blue focus:border-brand-blue outline-none transition-all placeholder:text-slate-500 text-sm"
                                                placeholder="Dirección domiciliar completa"
                                                value={newStudent.address}
                                                onChange={(e) => setNewStudent({ ...newStudent, address: e.target.value })}
                                            />
                                        </div>

                                        <div>
                                            <label className="text-xs sm:text-sm font-semibold text-slate-300 ml-1">Teléfono</label>
                                            <input
                                                type="text"
                                                className="w-full mt-1.5 px-3.5 py-2.5 sm:py-3 bg-slate-800/80 border border-slate-700 text-white rounded-xl focus:ring-2 focus:ring-brand-blue focus:border-brand-blue outline-none transition-all placeholder:text-slate-500 text-sm"
                                                placeholder="Ej: 5555-5555"
                                                value={newStudent.phone}
                                                onChange={(e) => setNewStudent({ ...newStudent, phone: e.target.value })}
                                            />
                                        </div>

                                        <div>
                                            <label className="text-xs sm:text-sm font-semibold text-slate-300 ml-1">Escuela de Procedencia</label>
                                            <input
                                                type="text"
                                                className="w-full mt-1.5 px-3.5 py-2.5 sm:py-3 bg-slate-800/80 border border-slate-700 text-white rounded-xl focus:ring-2 focus:ring-brand-blue focus:border-brand-blue outline-none transition-all placeholder:text-slate-500 text-sm"
                                                placeholder="Institución anterior"
                                                value={newStudent.previous_school || ''}
                                                onChange={(e) => setNewStudent({ ...newStudent, previous_school: e.target.value })}
                                            />
                                        </div>

                                        <div>
                                            <label className="text-xs sm:text-sm font-semibold text-slate-300 ml-1">Código Personal (MINEDUC)</label>
                                            <input
                                                type="text"
                                                className="w-full mt-1.5 px-3.5 py-2.5 sm:py-3 bg-slate-800/80 border border-slate-700 text-white rounded-xl focus:ring-2 focus:ring-brand-blue focus:border-brand-blue outline-none transition-all placeholder:text-slate-500 text-sm"
                                                placeholder="Código del establecimiento"
                                                value={newStudent.personal_code || ''}
                                                onChange={(e) => setNewStudent({ ...newStudent, personal_code: e.target.value })}
                                            />
                                        </div>

                                        <div>
                                            <label className="text-xs sm:text-sm font-semibold text-slate-300 ml-1">Código Academia ULTEC</label>
                                            <input
                                                type="text"
                                                className="w-full mt-1.5 px-3.5 py-2.5 sm:py-3 bg-purple-950/40 border border-purple-800 text-purple-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all placeholder:text-purple-600/50 font-mono text-sm font-semibold"
                                                placeholder="Ej: UT-2026-001"
                                                value={newStudent.academy_code || ''}
                                                onChange={(e) => setNewStudent({ ...newStudent, academy_code: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    {/* Padre o Encargado */}
                                    <div className="border-b border-slate-800 pb-2 pt-2">
                                        <h4 className="text-sm font-bold text-slate-200 uppercase tracking-wider">Padre o Encargado</h4>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                        <div>
                                            <label className="text-xs sm:text-sm font-semibold text-slate-300 ml-1">Nombre del Encargado</label>
                                            <input
                                                type="text"
                                                className="w-full mt-1.5 px-3.5 py-2.5 sm:py-3 bg-slate-800/80 border border-slate-700 text-white rounded-xl focus:ring-2 focus:ring-brand-blue focus:border-brand-blue outline-none transition-all placeholder:text-slate-500 text-sm"
                                                placeholder="Nombre completo"
                                                value={newStudent.guardian_name}
                                                onChange={(e) => setNewStudent({ ...newStudent, guardian_name: e.target.value })}
                                            />
                                        </div>

                                        <div>
                                            <label className="text-xs sm:text-sm font-semibold text-slate-300 ml-1">Parentesco</label>
                                            <select
                                                className="w-full mt-1.5 px-3.5 py-2.5 sm:py-3 bg-slate-800/80 border border-slate-700 text-white rounded-xl focus:ring-2 focus:ring-brand-blue focus:border-brand-blue outline-none transition-all text-sm"
                                                value={newStudent.guardian_relationship}
                                                onChange={(e) => setNewStudent({ ...newStudent, guardian_relationship: e.target.value })}
                                            >
                                                <option value="" className="bg-slate-900 text-slate-400">Seleccione...</option>
                                                <option value="Padre" className="bg-slate-900 text-white">Padre</option>
                                                <option value="Madre" className="bg-slate-900 text-white">Madre</option>
                                                <option value="Tutor" className="bg-slate-900 text-white">Tutor Legal</option>
                                                <option value="Otro" className="bg-slate-900 text-white">Otro</option>
                                            </select>
                                        </div>

                                        <div className="sm:col-span-2">
                                            <label className="text-xs sm:text-sm font-semibold text-slate-300 ml-1">Teléfono Encargado</label>
                                            <input
                                                type="text"
                                                className="w-full mt-1.5 px-3.5 py-2.5 sm:py-3 bg-slate-800/80 border border-slate-700 text-white rounded-xl focus:ring-2 focus:ring-brand-blue focus:border-brand-blue outline-none transition-all placeholder:text-slate-500 text-sm"
                                                placeholder="Teléfono de contacto"
                                                value={newStudent.guardian_phone}
                                                onChange={(e) => setNewStudent({ ...newStudent, guardian_phone: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    {/* Emergencia y Salud */}
                                    <div className="border-b border-slate-800 pb-2 pt-2">
                                        <h4 className="text-sm font-bold text-slate-200 uppercase tracking-wider">Emergencia y Salud</h4>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                        <div>
                                            <label className="text-xs sm:text-sm font-semibold text-slate-300 ml-1">Contacto Emergencia</label>
                                            <input
                                                type="text"
                                                className="w-full mt-1.5 px-3.5 py-2.5 sm:py-3 bg-slate-800/80 border border-slate-700 text-white rounded-xl focus:ring-2 focus:ring-brand-blue focus:border-brand-blue outline-none transition-all placeholder:text-slate-500 text-sm"
                                                placeholder="Nombre contacto"
                                                value={newStudent.emergency_contact_name}
                                                onChange={(e) => setNewStudent({ ...newStudent, emergency_contact_name: e.target.value })}
                                            />
                                        </div>

                                        <div>
                                            <label className="text-xs sm:text-sm font-semibold text-slate-300 ml-1">Tel. Emergencia</label>
                                            <input
                                                type="text"
                                                className="w-full mt-1.5 px-3.5 py-2.5 sm:py-3 bg-slate-800/80 border border-slate-700 text-white rounded-xl focus:ring-2 focus:ring-brand-blue focus:border-brand-blue outline-none transition-all placeholder:text-slate-500 text-sm"
                                                placeholder="Teléfono emergencia"
                                                value={newStudent.emergency_contact_phone}
                                                onChange={(e) => setNewStudent({ ...newStudent, emergency_contact_phone: e.target.value })}
                                            />
                                        </div>

                                        <div className="sm:col-span-2">
                                            <label className="text-xs sm:text-sm font-semibold text-slate-300 ml-1">Notas Médicas / Alergias</label>
                                            <textarea
                                                className="w-full mt-1.5 px-3.5 py-2.5 sm:py-3 bg-slate-800/80 border border-slate-700 text-white rounded-xl focus:ring-2 focus:ring-brand-blue focus:border-brand-blue outline-none transition-all placeholder:text-slate-500 text-sm resize-none"
                                                placeholder="Especifique alergias, condiciones médicas o cuidados especiales..."
                                                rows={2}
                                                value={newStudent.medical_notes || ''}
                                                onChange={(e) => setNewStudent({ ...newStudent, medical_notes: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="px-5 py-3.5 border-t border-slate-800 bg-slate-900/90 flex gap-3 shrink-0">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs sm:text-sm font-semibold transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={createMutation.isPending || updateMutation.isPending}
                                    className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:opacity-95 text-white text-xs sm:text-sm font-semibold shadow-lg shadow-blue-600/30 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {createMutation.isPending || updateMutation.isPending ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <span>{isEditing ? 'Guardar Cambios' : 'Confirmar Registro'}</span>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}


            {/* View Profile Modal */}
            {isViewModalOpen && selectedStudent && createPortal(
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-md animate-in fade-in duration-200" onClick={() => setIsViewModalOpen(false)} />
                    <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col my-auto text-slate-100">

                        {/* Header */}
                        <div className="bg-slate-950/80 p-5 sm:p-7 border-b border-slate-800/80 flex justify-between items-start shrink-0">
                            <div className="flex items-center space-x-4 sm:space-x-6 min-w-0">
                                <div className="h-14 w-14 sm:h-20 sm:w-20 rounded-2xl sm:rounded-full bg-blue-600 text-white flex items-center justify-center text-2xl sm:text-3xl font-bold border-2 sm:border-4 border-slate-800 shrink-0 shadow-lg shadow-blue-500/20">
                                    {selectedStudent.full_name.charAt(0)}
                                </div>
                                <div className="min-w-0">
                                    <h3 className="text-xl sm:text-3xl font-bold truncate text-white">{selectedStudent.full_name}</h3>
                                    <div className="flex flex-wrap items-center gap-2 text-slate-400 mt-1.5 text-xs sm:text-sm">
                                        <span className="bg-slate-800/80 text-blue-400 px-2.5 py-0.5 rounded-full border border-slate-700 font-mono">ID: #{selectedStudent.id.toString().padStart(4, '0')}</span>
                                        <span>•</span>
                                        <span>{selectedStudent.nationality || 'Nacionalidad no registrada'}</span>
                                        {selectedStudent.gender && (
                                            <>
                                                <span>•</span>
                                                <span>{selectedStudent.gender === 'M' ? 'Masculino' : 'Femenino'}</span>
                                            </>
                                        )}
                                        {!user?.branch_id && selectedStudent.branches && (
                                            <>
                                                <span>•</span>
                                                <span className="flex items-center text-amber-400">
                                                    <Building2 className="h-3.5 w-3.5 mr-1" />
                                                    {selectedStudent.branches.name}
                                                </span>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center space-x-2 shrink-0 ml-2">
                                <button
                                    onClick={() => {
                                        setIsEditing(true);
                                        setNewStudent(selectedStudent);
                                        setIsViewModalOpen(false);
                                        setIsModalOpen(true);
                                    }}
                                    className="text-blue-400 hover:text-white transition-colors bg-blue-500/20 hover:bg-blue-600 p-2 sm:p-2.5 rounded-xl border border-blue-500/30"
                                    title="Editar Estudiante"
                                >
                                    <Pencil className="h-4 w-4 sm:h-5 sm:w-5" />
                                </button>
                                <button 
                                    onClick={() => setIsViewModalOpen(false)} 
                                    className="text-slate-400 hover:text-white transition-colors bg-slate-800/80 p-2 sm:p-2.5 rounded-xl hover:bg-slate-700 border border-slate-700"
                                >
                                    <X className="h-4 w-4 sm:h-5 sm:w-5" />
                                </button>
                            </div>
                        </div>

                        {/* Body */}
                        <div className="p-5 sm:p-8 overflow-y-auto custom-scrollbar space-y-6 sm:space-y-8">

                            {/* Personal & Contact */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                                <div className="bg-slate-800/40 p-4 sm:p-5 rounded-2xl border border-slate-800 space-y-3">
                                    <div className="flex items-center space-x-2 text-blue-400 font-bold border-b border-slate-700/60 pb-2 text-sm">
                                        <UserPlus className="h-4 w-4" />
                                        <span>Datos Personales</span>
                                    </div>
                                    <div className="space-y-2.5">
                                        <div>
                                            <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Fecha de Nacimiento</p>
                                            <p className="text-slate-200 font-medium text-sm">
                                                {selectedStudent.birth_date
                                                    ? new Date(selectedStudent.birth_date).toLocaleDateString('es-ES', { dateStyle: 'long' })
                                                    : 'No registrada'}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Documento Identificación</p>
                                            <p className="text-slate-200 font-medium text-sm">{selectedStudent.identification_document || '---'}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-slate-800/40 p-4 sm:p-5 rounded-2xl border border-slate-800 space-y-3">
                                    <div className="flex items-center space-x-2 text-blue-400 font-bold border-b border-slate-700/60 pb-2 text-sm">
                                        <MapPin className="h-4 w-4" />
                                        <span>Ubicación y Contacto</span>
                                    </div>
                                    <div className="space-y-2.5">
                                        <div>
                                            <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Dirección</p>
                                            <p className="text-slate-200 font-medium text-sm">{selectedStudent.address || '---'}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Teléfono Personal</p>
                                            <div className="flex items-center space-x-2 text-slate-200 text-sm">
                                                <Phone className="h-3.5 w-3.5 text-slate-400" />
                                                <span className="font-medium">{selectedStudent.phone || '---'}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Guardian & Emergency */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                                <div className="bg-indigo-950/20 p-5 rounded-2xl border border-indigo-900/40 space-y-3">
                                    <div className="flex items-center space-x-2 text-indigo-400 font-bold text-sm">
                                        <Shield className="h-4 w-4" />
                                        <span>Encargado / Tutor</span>
                                    </div>
                                    {selectedStudent.guardian_name ? (
                                        <div className="space-y-2">
                                            <p className="text-base font-bold text-slate-100">{selectedStudent.guardian_name}</p>
                                            <div className="flex items-center space-x-2 text-xs text-indigo-300">
                                                <span className="bg-indigo-900/60 text-indigo-300 px-2 py-0.5 rounded border border-indigo-700/50 font-bold uppercase">{selectedStudent.guardian_relationship || 'Tutor'}</span>
                                            </div>
                                            <div className="flex items-center space-x-2 text-slate-300 text-sm">
                                                <Phone className="h-3.5 w-3.5 text-slate-400" />
                                                <span>{selectedStudent.guardian_phone || 'Sin teléfono'}</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="text-slate-500 text-xs italic">No hay información de encargado registrada.</p>
                                    )}
                                </div>

                                <div className="bg-red-950/20 p-5 rounded-2xl border border-red-900/40 space-y-3">
                                    <div className="flex items-center space-x-2 text-red-400 font-bold text-sm">
                                        <Heart className="h-4 w-4" />
                                        <span>Salud y Emergencia</span>
                                    </div>
                                    <div className="space-y-2">
                                        <div>
                                            <p className="text-[10px] text-red-400 uppercase font-bold tracking-wider">Contacto de Emergencia</p>
                                            <p className="font-bold text-slate-100 text-sm">{selectedStudent.emergency_contact_name || '---'}</p>
                                            <p className="text-xs text-slate-400">{selectedStudent.emergency_contact_phone}</p>
                                        </div>
                                        {selectedStudent.medical_notes && (
                                            <div className="pt-2 border-t border-red-900/30">
                                                <p className="text-[10px] text-red-400 uppercase font-bold tracking-wider mb-1">Notas Médicas</p>
                                                <p className="text-xs text-slate-300 bg-red-950/40 p-2.5 rounded-lg border border-red-900/30 italic">
                                                    "{selectedStudent.medical_notes}"
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Academic */}
                            {(selectedStudent.previous_school || selectedStudent.personal_code || selectedStudent.academy_code) && (
                                <div className="space-y-3 pt-4 border-t border-slate-800">
                                    <div className="flex items-center space-x-2 text-emerald-400 font-bold text-sm">
                                        <GraduationCap className="h-4 w-4" />
                                        <span>Historial Académico</span>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        {selectedStudent.previous_school && (
                                            <div className="bg-slate-800/30 p-3 rounded-xl border border-slate-800">
                                                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Escuela de Procedencia</p>
                                                <p className="text-slate-200 font-medium text-sm mt-0.5">{selectedStudent.previous_school}</p>
                                            </div>
                                        )}
                                        {selectedStudent.personal_code && (
                                            <div className="bg-slate-800/30 p-3 rounded-xl border border-slate-800">
                                                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Cód. Personal</p>
                                                <p className="text-slate-200 font-medium text-sm mt-0.5 font-mono">{selectedStudent.personal_code}</p>
                                            </div>
                                        )}
                                        {selectedStudent.academy_code && (
                                            <div className="bg-purple-950/20 p-3 rounded-xl border border-purple-900/40">
                                                <p className="text-[10px] text-purple-400 uppercase font-bold tracking-wider">Cód. Academia ULTEC</p>
                                                <p className="text-purple-300 font-mono font-bold text-sm mt-0.5">{selectedStudent.academy_code}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Parent Links Section */}
                            <div className="pt-4 border-t border-slate-800">
                                <div className="flex items-center space-x-2 text-blue-400 font-bold mb-2 text-sm">
                                    <Link2 className="h-4 w-4" />
                                    <span>Accesos de Cuidados Familiares</span>
                                </div>
                                <p className="text-xs text-slate-400 mb-4">Usuarios registrados en la plataforma que tienen acceso al portal de este estudiante.</p>

                                <div className="space-y-3">
                                    {/* Link List */}
                                    {parentLinks?.filter((link: any) => link.student_id === selectedStudent.id).map((link: any) => (
                                        <div key={link.id} className="flex items-center justify-between p-3 bg-slate-800/50 border border-slate-700/60 rounded-xl">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="w-9 h-9 rounded-full bg-blue-600/20 border border-blue-500/30 text-blue-400 flex items-center justify-center font-bold shrink-0">
                                                    {link.profiles?.full_name?.charAt(0) || 'P'}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="font-bold text-slate-200 text-sm truncate">{link.profiles?.full_name}</p>
                                                    <p className="text-[11px] text-slate-400 truncate">{link.profiles?.email}</p>
                                                </div>
                                                <span className="ml-2 px-2 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] font-bold rounded-lg uppercase shrink-0">
                                                    {link.relationship}
                                                </span>
                                            </div>
                                            <button
                                                onClick={() => setDeleteLinkConfirmId(link.id)}
                                                className="p-2 text-red-400 hover:text-white hover:bg-red-600 rounded-lg transition-colors shrink-0 ml-2"
                                                title="Eliminar Vínculo"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}

                                    {parentLinks?.filter((link: any) => link.student_id === selectedStudent.id).length === 0 && (
                                        <div className="text-center py-5 bg-slate-800/30 rounded-xl border border-slate-800 border-dashed">
                                            <p className="text-xs text-slate-400">Ningún usuario tiene acceso al portal de este estudiante.</p>
                                        </div>
                                    )}

                                    {/* Add Link Form */}
                                    <div className="mt-4 p-4 bg-slate-800/40 border border-slate-700/60 rounded-2xl">
                                        <label className="block text-xs font-bold text-slate-300 mb-2">Vincular a un Padre / Encargado</label>
                                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                                            <div className="relative flex-1">
                                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                                <input
                                                    type="text"
                                                    placeholder="Buscar por nombre o correo (Mín 2 letras)..."
                                                    className="w-full pl-9 pr-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                                    value={selectedParent ? selectedParent.full_name : parentSearch}
                                                    onChange={e => { setParentSearch(e.target.value); setSelectedParent(null); }}
                                                />
                                                {parentResults && !selectedParent && parentSearch.length >= 2 && (
                                                    <div className="absolute z-10 bottom-full mb-1 w-full bg-slate-900 border border-slate-700 rounded-xl shadow-xl max-h-40 overflow-auto">
                                                        {parentResults.length > 0 ? parentResults.map((u: any) => (
                                                            <button key={u.id} onClick={() => { setSelectedParent(u); setParentSearch(u.full_name); }}
                                                                className="w-full text-left px-3 py-2.5 hover:bg-slate-800 text-xs font-medium text-slate-200 border-b border-slate-800 last:border-0">
                                                                {u.full_name} <span className="text-slate-400 text-[10px]">({u.email}) - Rol: {u.role}</span>
                                                            </button>
                                                        )) : (
                                                            <div className="px-3 py-2.5 text-xs text-slate-400">No se encontraron usuarios. Primero cree la cuenta en Gestión de Usuarios.</div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                            <button
                                                onClick={() => {
                                                    if (selectedParent) {
                                                        createLinkMutation.mutate({
                                                            parent_user_id: selectedParent.id,
                                                            student_id: selectedStudent.id,
                                                            relationship: 'parent'
                                                        });
                                                    }
                                                }}
                                                disabled={!selectedParent || createLinkMutation.isPending}
                                                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all disabled:opacity-50 text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-blue-600/20"
                                            >
                                                {createLinkMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                                                Vincular
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Modal de Confirmación para Eliminar Estudiante */}
            <ConfirmModal
                isOpen={!!deleteConfirmData}
                title={isSecretary ? "Solicitar Aprobación para Eliminar Estudiante" : "¿Eliminar Estudiante?"}
                description={
                    isSecretary ? (
                        <div className="space-y-3 text-left">
                            <p className="text-xs text-slate-400">
                                Por políticas de seguridad institucional, la eliminación de estudiantes debe ser autorizada por la <strong className="text-white">Dirección / Administración</strong>.
                            </p>
                            <p className="text-xs text-slate-300">
                                Estudiante: <strong className="text-amber-400">{deleteConfirmData?.name}</strong>
                            </p>
                            <div>
                                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">
                                    Motivo o justificación de la baja / eliminación (Obligatorio):
                                </label>
                                <textarea
                                    value={deletionReason}
                                    onChange={(e) => setDeletionReason(e.target.value)}
                                    placeholder="Indica el motivo (ej. Retiro voluntario, cambio de centro educativo, duplicidad, etc.)..."
                                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                                    rows={3}
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-1.5">
                            <p>¿Estás seguro de que deseas eliminar a <strong className="text-rose-400">{deleteConfirmData?.name}</strong>?</p>
                            <p className="text-[11px] text-slate-400">Esta acción no se puede deshacer y borrará permanentemente los datos del estudiante.</p>
                        </div>
                    )
                }
                confirmText={isSecretary ? "Enviar Solicitud a Administración" : "Sí, Eliminar"}
                cancelText="Cancelar"
                variant={isSecretary ? "warning" : "danger"}
                isLoading={isSecretary ? isSubmittingDeletionReq : deleteMutation.isPending}
                onConfirm={confirmDeleteStudent}
                onClose={() => {
                    setDeleteConfirmData(null);
                    setDeletionReason('');
                }}
            />

            {/* Modal de Confirmación para Eliminar Vínculo Familiar */}
            <ConfirmModal
                isOpen={!!deleteLinkConfirmId}
                title="¿Eliminar Vínculo Familiar?"
                description="El usuario familiar perderá inmediatamente el acceso al portal para consultar la información y calificaciones de este estudiante. ¿Deseas continuar?"
                confirmText="Sí, Desvincular"
                cancelText="Cancelar"
                variant="danger"
                isLoading={deleteLinkMutation.isPending}
                onConfirm={confirmDeleteLink}
                onClose={() => setDeleteLinkConfirmId(null)}
            />

            {/* Modal de Estado de Cuenta y Solvencia */}
            <StudentStatementModal
                isOpen={!!statementStudent}
                studentId={statementStudent?.id || null}
                studentName={statementStudent?.name}
                onClose={() => setStatementStudent(null)}
            />
        </div>
    );
};

export default StudentsList;

