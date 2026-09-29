import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getUsers, getUserStats, exportUsers, updateUser, createUser, resetUserPassword, deleteUser, syncParentLinks } from './userService';
import { useDebounce } from '../../hooks/useDebounce';
import { getStudents } from '../academic/academicService';
import { getBranches } from '../branches/branchesService';
import {
    Loader2, Users, Search, Edit2, Shield, Mail, CheckCircle, XCircle, Plus,
    Link as LinkIcon, KeyRound, Trash2, AlertTriangle, Building2, Phone, X,
    Download, Copy, Check, Eye, EyeOff, Sparkles, UserCheck, UserX,
    ChevronLeft, ChevronRight, Clock, HeartHandshake
} from 'lucide-react';
import ConfirmModal from '../../components/ui/ConfirmModal';
import * as XLSX from 'xlsx';
import { saveWorkbook } from '../../utils/fileDownloader';
import PasswordStrengthMeter from '../../components/ui/PasswordStrengthMeter';
import { validatePassword } from '../../utils/passwordValidator';

const UsersList = () => {
    const queryClient = useQueryClient();
    const [selectedUser, setSelectedUser] = useState<any>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editForm, setEditForm] = useState({
        full_name: '',
        role: 'student',
        email: '',
        phone: '',
        active: true,
        student_id: '',
        branch_id: '',
        student_links: [] as Array<{ student_id: string; relationship: string }>
    });
    const [editChildSelect, setEditChildSelect] = useState({ student_id: '', relationship: 'padre' });

    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [userToDelete, setUserToDelete] = useState<any>(null);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [createForm, setCreateForm] = useState({
        full_name: '',
        role: 'student',
        email: '',
        password: '',
        phone: '',
        student_id: '',
        branch_id: '',
        student_links: [] as Array<{ student_id: string; relationship: string }>
    });
    const [createChildSelect, setCreateChildSelect] = useState({ student_id: '', relationship: 'padre' });

    // Modal de Vínculos Familiares Rápidos (Padres ↔ Hijos)
    const [familyModalUser, setFamilyModalUser] = useState<any>(null);
    const [familyLinks, setFamilyLinks] = useState<Array<{ student_id: string; relationship: string }>>([]);
    const [newChildSelect, setNewChildSelect] = useState({ student_id: '', relationship: 'padre' });
    const [familySuccessMsg, setFamilySuccessMsg] = useState('');
    const [familyErrorMsg, setFamilyErrorMsg] = useState('');

    const [searchTerm, setSearchTerm] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    // Modal de Contraseña y Helpers
    const [isResetModalOpen, setIsResetModalOpen] = useState(false);
    const [resetForm, setResetForm] = useState({
        userId: '',
        newPassword: '',
        confirmPassword: ''
    });
    const [showPassword, setShowPassword] = useState(false);
    const [copiedCredentials, setCopiedCredentials] = useState(false);

    // Estado para confirmación rápida de toggle Activo / Inactivo
    const [statusConfirmUser, setStatusConfirmUser] = useState<any>(null);

    // Filtros
    const [selectedRole, setSelectedRole] = useState('all');
    const [selectedStatus, setSelectedStatus] = useState('all'); // 'all' | 'active' | 'inactive'

    // Paginación y Exportación
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(25);
    const [isExporting, setIsExporting] = useState(false);

    // Debounce de 300ms para evitar ráfagas de consultas al escribir en el buscador
    const debouncedSearchTerm = useDebounce(searchTerm, 300);

    // Consulta de usuarios paginada y filtrada server-side
    const { data: usersResponse, isLoading, isError, isFetching } = useQuery({
        queryKey: ['users', page, limit, debouncedSearchTerm, selectedRole, selectedStatus],
        queryFn: () => getUsers(page, limit, debouncedSearchTerm, selectedRole, selectedStatus),
    });

    const users = Array.isArray(usersResponse?.data) ? usersResponse.data : (Array.isArray(usersResponse) ? usersResponse : []);
    const meta = usersResponse?.meta || null;

    // Métricas globales ultrarrápidas mediante endpoint dedicado /api/users/stats
    const { data: userStats } = useQuery({
        queryKey: ['users-stats'],
        queryFn: () => getUserStats(),
    });

    const totalUsersCount = userStats?.total ?? (meta?.total || 0);
    const activeUsersCount = userStats?.active ?? 0;
    const inactiveUsersCount = userStats?.inactive ?? Math.max(0, totalUsersCount - activeUsersCount);

    const { data: students } = useQuery({
        queryKey: ['students-list'],
        queryFn: () => getStudents(),
    });

    const { data: branches } = useQuery({
        queryKey: ['branches-list'],
        queryFn: getBranches,
    });

    const createMutation = useMutation({
        mutationFn: createUser,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
            queryClient.invalidateQueries({ queryKey: ['users-stats'] });
            queryClient.invalidateQueries({ queryKey: ['students-list'] });
            setIsCreateModalOpen(false);
            setCreateForm({ full_name: '', role: 'student', email: '', password: '', phone: '', student_id: '', branch_id: '', student_links: [] });
            setCreateChildSelect({ student_id: '', relationship: 'padre' });
            setErrorMsg('');
        },
        onError: (err: any) => {
            console.error('Error creating user:', err);
            setErrorMsg(err.response?.data?.message || 'Error al crear usuario.');
        }
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: any }) => updateUser(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
            queryClient.invalidateQueries({ queryKey: ['users-metrics'] });
            queryClient.invalidateQueries({ queryKey: ['students-list'] });
            setIsEditModalOpen(false);
            setEditForm({ full_name: '', role: 'student', email: '', phone: '', active: true, student_id: '', branch_id: '', student_links: [] });
            setEditChildSelect({ student_id: '', relationship: 'padre' });
            setErrorMsg('');
        },
        onError: (err: any) => {
            console.error('Error updating user:', err);
            setErrorMsg(err.response?.data?.message || 'Error al actualizar usuario.');
        }
    });

    // Sincronización rápida de vínculos familiares
    const syncFamilyMutation = useMutation({
        mutationFn: ({ parentUserId, links }: { parentUserId: string; links: any[] }) =>
            syncParentLinks(parentUserId, links),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
            queryClient.invalidateQueries({ queryKey: ['students-list'] });
            setFamilySuccessMsg('¡Vínculos familiares actualizados con éxito!');
            setTimeout(() => {
                setFamilyModalUser(null);
                setFamilySuccessMsg('');
            }, 1200);
        },
        onError: (err: any) => {
            console.error('Error syncing family links:', err);
            setFamilyErrorMsg(err.response?.data?.message || 'Error al actualizar vínculos.');
        }
    });

    const openFamilyModal = (user: any) => {
        setFamilyModalUser(user);
        setFamilySuccessMsg('');
        setFamilyErrorMsg('');
        const existing = (user.parent_links || []).map((l: any) => ({
            student_id: l.student_id,
            relationship: l.relationship || 'padre'
        }));
        setFamilyLinks(existing);
        setNewChildSelect({ student_id: '', relationship: 'padre' });
    };

    const formatLastLogin = (dateStr?: string) => {
        if (!dateStr) return null;
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return null;
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffSecs = Math.floor(diffMs / 1000);
        const diffMins = Math.floor(diffSecs / 60);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffSecs < 60) return 'Hace un momento';
        if (diffMins < 60) return `Hace ${diffMins} min`;
        if (diffHours < 24) return `Hace ${diffHours} h`;
        if (diffDays === 1) return 'Ayer';
        if (diffDays < 7) return `Hace ${diffDays} días`;
        return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
    };

    // Toggle rápido de estado (Activo / Inactivo)
    const toggleStatusMutation = useMutation({
        mutationFn: ({ id, active }: { id: string; active: boolean }) => updateUser(id, { active }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
            queryClient.invalidateQueries({ queryKey: ['users-stats'] });
            setStatusConfirmUser(null);
        },
        onError: (err: any) => {
            console.error('Error toggling status:', err);
            alert(err.response?.data?.message || 'Error al cambiar el estado del usuario.');
        }
    });

    const deleteMutation = useMutation({
        mutationFn: deleteUser,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
            queryClient.invalidateQueries({ queryKey: ['users-stats'] });
            queryClient.invalidateQueries({ queryKey: ['students-list'] });
            setIsDeleteModalOpen(false);
            setUserToDelete(null);
            setErrorMsg('');
        },
        onError: (err: any) => {
            console.error('Error deleting user:', err);
            setErrorMsg(err.response?.data?.message || 'Error al eliminar usuario.');
        }
    });

    const resetPasswordMutation = useMutation({
        mutationFn: resetUserPassword,
        onSuccess: () => {
            setSuccessMsg('Contraseña actualizada correctamente.');
            setTimeout(() => {
                setIsResetModalOpen(false);
                setSuccessMsg('');
            }, 2000);
            setResetForm({ userId: '', newPassword: '', confirmPassword: '' });
            setErrorMsg('');
        },
        onError: (err: any) => {
            console.error('Error resetting password:', err);
            setErrorMsg(err.response?.data?.message || 'Error al restablecer contraseña.');
        }
    });

    const openEditModal = (user: any) => {
        setSelectedUser(user);

        let linkedStudentId = '';
        if (students && user.id) {
            const student = students.find((s: any) => s.user_id === user.id);
            if (student) {
                linkedStudentId = student.id;
            }
        }

        const existingLinks = (user.parent_links || []).map((l: any) => ({
            student_id: l.student_id,
            relationship: l.relationship || 'padre'
        }));

        setEditForm({
            full_name: user.full_name || '',
            role: user.role || 'student',
            email: user.email || '',
            phone: user.phone || '',
            active: user.active !== false,
            student_id: linkedStudentId,
            branch_id: user.branch_id || '',
            student_links: existingLinks
        });
        setEditChildSelect({ student_id: '', relationship: 'padre' });
        setIsEditModalOpen(true);
    };

    const handleUpdate = (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg('');
        if (!editForm.full_name) {
            setErrorMsg('El nombre es obligatorio.');
            return;
        }

        const payload: any = { ...editForm };
        if (payload.role !== 'student') {
            payload.student_id = '';
        }
        if (payload.role !== 'parent') {
            delete payload.student_links;
        }

        updateMutation.mutate({ id: selectedUser.id, data: payload });
    };

    const confirmDelete = (user: any) => {
        setUserToDelete(user);
        setIsDeleteModalOpen(true);
    };

    const handleDelete = () => {
        if (userToDelete) {
            deleteMutation.mutate(userToDelete.id);
        }
    };

    const handleCreate = (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg('');
        if (!createForm.full_name || !createForm.email || !createForm.password) {
            setErrorMsg('Nombre, correo y contraseña son obligatorios.');
            return;
        }

        const pwdCheck = validatePassword(createForm.password, createForm.role);
        if (!pwdCheck.isValid) {
            setErrorMsg(`Contraseña no segura: ${pwdCheck.errors.join(', ')}.`);
            return;
        }

        const payload: any = { ...createForm };
        if (payload.role !== 'student') {
            payload.student_id = '';
        }
        if (payload.role !== 'parent') {
            delete payload.student_links;
        }

        createMutation.mutate(payload);
    };

    const handleResetPassword = (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg('');
        setSuccessMsg('');

        if (!resetForm.newPassword || !resetForm.confirmPassword) {
            setErrorMsg('Por favor complete todos los campos.');
            return;
        }

        if (resetForm.newPassword !== resetForm.confirmPassword) {
            setErrorMsg('Las contraseñas no coinciden.');
            return;
        }

        const pwdCheck = validatePassword(resetForm.newPassword, selectedUser?.role);
        if (!pwdCheck.isValid) {
            setErrorMsg(`Contraseña no segura: ${pwdCheck.errors.join(', ')}.`);
            return;
        }

        resetPasswordMutation.mutate({
            userId: resetForm.userId,
            newPassword: resetForm.newPassword
        });
    };

    // Generador automático de contraseña temporal de alta seguridad
    const generateSecurePassword = (target: 'reset' | 'create' = 'reset') => {
        const special = ['!', '@', '#', '$', '%', '*', '&'][Math.floor(Math.random() * 7)];
        const uppers = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
        const lowers = 'abcdefghijkmnpqrstuvwxyz';
        const digits = '23456789';
        
        let randomChars = '';
        for (let i = 0; i < 2; i++) {
            randomChars += uppers.charAt(Math.floor(Math.random() * uppers.length));
            randomChars += lowers.charAt(Math.floor(Math.random() * lowers.length));
            randomChars += digits.charAt(Math.floor(Math.random() * digits.length));
        }
        const generated = `Ultec${new Date().getFullYear()}${special}${randomChars}`;
        
        if (target === 'reset') {
            setResetForm(prev => ({
                ...prev,
                newPassword: generated,
                confirmPassword: generated
            }));
            setShowPassword(true);
        } else {
            setCreateForm(prev => ({
                ...prev,
                password: generated
            }));
        }
    };

    // Copiar credenciales al portapapeles
    const copyCredentials = async () => {
        if (!selectedUser || !resetForm.newPassword) return;
        const text = `*Credenciales de Acceso - Plataforma ULTEC*\n\n` +
            `👤 *Usuario:* ${selectedUser.full_name}\n` +
            `📧 *Correo:* ${selectedUser.email}\n` +
            `🔑 *Contraseña Temporal:* ${resetForm.newPassword}\n\n` +
            `🌐 *Enlace:* https://plataformaultec.duckdns.org\n` +
            `ℹ️ _Por seguridad, te recomendamos cambiarla tras tu primer inicio de sesión._`;
        try {
            await navigator.clipboard.writeText(text);
            setCopiedCredentials(true);
            setTimeout(() => setCopiedCredentials(false), 2500);
        } catch (err) {
            console.error('Failed to copy', err);
        }
    };

    // Exportar usuarios a Excel bajo demanda
    const exportToExcel = async () => {
        setIsExporting(true);
        try {
            const dataset = await exportUsers(debouncedSearchTerm, selectedRole, selectedStatus);
            if (!dataset || dataset.length === 0) {
                alert('No hay usuarios para exportar.');
                return;
            }

            const dataToExport = dataset.map((u: any) => {
                const branchObj = branches?.find((b: any) => b.id === u.branch_id);
                const roleBadge = getRoleBadge(u.role);
                const linkedChildren = u.role === 'parent'
                    ? (u.parent_links || []).map((l: any) => `${l.students?.full_name || 'Estudiante'} (${l.relationship || 'Tutor'})`).join(', ') || 'Sin hijos vinculados'
                    : (u.role === 'student' && u.student_profile ? `${u.student_profile.personal_code || u.student_profile.academy_code}` : 'N/A');

                return {
                    'Nombre Completo': u.full_name || 'Sin Nombre',
                    'Correo / Usuario': u.email || 'N/A',
                    'Teléfono': u.phone || 'N/A',
                    'Rol': roleBadge.label,
                    'Sede': branchObj ? branchObj.name : 'Acceso Global (Todas)',
                    'Estudiantes / Hijos': linkedChildren,
                    'Estado': u.active !== false ? 'Activo' : 'Inactivo',
                    'Último Acceso': u.last_login_at ? new Date(u.last_login_at).toLocaleString('es-ES') : 'Sin registros',
                    'IP Último Acceso': u.last_login_ip || 'N/A',
                    'Fecha de Registro': u.created_at ? new Date(u.created_at).toLocaleDateString('es-ES') : 'N/A'
                };
            });

            const worksheet = XLSX.utils.json_to_sheet(dataToExport);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Directorio Usuarios");
            await saveWorkbook(workbook, `Directorio_Usuarios_ULTEC_${new Date().toISOString().slice(0, 10)}.xlsx`);
        } catch (error) {
            console.error('Error exportando usuarios:', error);
            alert('Error al exportar usuarios.');
        } finally {
            setIsExporting(false);
        }
    };

    // Usuarios obtenidos del servidor (ya vienen filtrados y paginados con índices)
    const filteredUsers = Array.isArray(users) ? users : [];

    const getRoleBadge = (role: string) => {
        switch (role?.toLowerCase()) {
            case 'superadmin':
                return { label: 'Superadmin', bg: 'bg-rose-500/10 text-rose-500 border-rose-500/20' };
            case 'admin':
                return { label: 'Admin', bg: 'bg-purple-500/10 text-purple-500 border-purple-500/20' };
            case 'secretary':
                return { label: 'Secretaría', bg: 'bg-blue-500/10 text-blue-500 border-blue-500/20' };
            case 'instructor':
                return { label: 'Instructor', bg: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' };
            case 'student':
                return { label: 'Estudiante', bg: 'bg-amber-500/10 text-amber-500 border-amber-500/20' };
            case 'parent':
                return { label: 'Padre', bg: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20' };
            default:
                return { label: role || 'Usuario', bg: 'bg-slate-500/10 text-slate-500 border-slate-500/20' };
        }
    };

    if (isLoading && (!users || users.length === 0)) return (
        <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
            <Loader2 className="animate-spin h-12 w-12 text-brand-blue" />
            <p className="text-slate-400 font-medium animate-pulse">Cargando usuarios...</p>
        </div>
    );

    return (
        <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-500 pb-16 sm:pb-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                    <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Gestión de Usuarios</h2>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">Administra los accesos, roles y sedes de la plataforma.</p>
                </div>
                <div className="flex items-center gap-2 self-stretch sm:self-auto">
                    <button
                        onClick={exportToExcel}
                        disabled={isExporting}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-all shadow-sm active:scale-95 font-semibold text-xs sm:text-sm shrink-0 cursor-pointer"
                        title="Exportar directorio de usuarios a Excel"
                    >
                        {isExporting ? <Loader2 className="h-4 w-4 animate-spin text-emerald-500" /> : <Download className="h-4 w-4 text-emerald-500" />}
                        <span>Exportar Excel</span>
                    </button>
                    <button
                        onClick={() => {
                            setErrorMsg('');
                            setCreateForm({ full_name: '', role: 'student', email: '', password: '', phone: '', student_id: '', branch_id: '', student_links: [] });
                            setCreateChildSelect({ student_id: '', relationship: 'padre' });
                            setIsCreateModalOpen(true);
                        }}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-brand-blue text-white rounded-xl hover:bg-blue-600 transition-all shadow-sm active:scale-95 font-semibold text-xs sm:text-sm shrink-0 border border-white/10 cursor-pointer"
                    >
                        <Plus className="h-4 w-4" />
                        <span>Nuevo</span>
                    </button>
                </div>
            </div>

            {/* Quick Metrics KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                <div className="glass-card p-4 rounded-2xl border border-slate-200/80 dark:border-white/10 flex items-center justify-between shadow-sm">
                    <div>
                        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Usuarios</p>
                        <p className="text-2xl font-black text-slate-900 dark:text-white mt-0.5">{totalUsersCount}</p>
                    </div>
                    <div className="h-10 w-10 rounded-xl bg-brand-blue/10 dark:bg-brand-blue/20 text-brand-blue dark:text-blue-400 flex items-center justify-center font-bold">
                        <Users className="h-5 w-5" />
                    </div>
                </div>
                <div 
                    onClick={() => { setSelectedStatus(selectedStatus === 'active' ? 'all' : 'active'); setPage(1); }}
                    className={`glass-card p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between shadow-sm ${
                        selectedStatus === 'active' 
                            ? 'ring-2 ring-emerald-500/50 bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800' 
                            : 'border-slate-200/80 dark:border-white/10 hover:border-emerald-400/40'
                    }`}
                    title="Clic para filtrar solo usuarios activos"
                >
                    <div>
                        <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
                            Usuarios Activos
                        </p>
                        <p className="text-2xl font-black text-emerald-700 dark:text-emerald-300 mt-0.5">{activeUsersCount}</p>
                    </div>
                    <div className="h-10 w-10 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                        <UserCheck className="h-5 w-5" />
                    </div>
                </div>
                <div 
                    onClick={() => { setSelectedStatus(selectedStatus === 'inactive' ? 'all' : 'inactive'); setPage(1); }}
                    className={`glass-card p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between shadow-sm ${
                        selectedStatus === 'inactive' 
                            ? 'ring-2 ring-rose-500/50 bg-rose-50/50 dark:bg-rose-950/20 border-rose-300 dark:border-rose-800' 
                            : 'border-slate-200/80 dark:border-white/10 hover:border-rose-400/40'
                    }`}
                    title="Clic para filtrar solo usuarios inactivos o suspendidos"
                >
                    <div>
                        <p className="text-xs font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full bg-rose-500 inline-block"></span>
                            Inactivos / Suspendidos
                        </p>
                        <p className="text-2xl font-black text-rose-700 dark:text-rose-300 mt-0.5">{inactiveUsersCount}</p>
                    </div>
                    <div className="h-10 w-10 rounded-xl bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center font-bold">
                        <UserX className="h-5 w-5" />
                    </div>
                </div>
            </div>

            {/* Search Bar & Status Pills */}
            <div className="space-y-3">
                <div className="relative group">
                    <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400 dark:text-slate-500 group-focus-within:text-brand-blue transition-colors" />
                    <input
                        type="text"
                        placeholder="Buscar por nombre, correo o teléfono..."
                        className="w-full pl-10 pr-9 py-2.5 bg-white/70 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-brand-blue/20 focus:border-brand-blue transition-all shadow-sm placeholder:text-slate-400"
                        value={searchTerm}
                        onChange={(e) => {
                            setSearchTerm(e.target.value);
                            setPage(1);
                        }}
                    />
                    {isFetching && !isLoading && (
                        <div className="absolute right-9 top-3 text-brand-blue animate-spin pointer-events-none">
                            <Loader2 className="h-4 w-4" />
                        </div>
                    )}
                    {searchTerm && (
                        <button
                            onClick={() => setSearchTerm('')}
                            className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    )}
                </div>

                {/* Status Segment Control */}
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-400 dark:text-slate-500 mr-1 hidden sm:inline">Estado:</span>
                    <button
                        onClick={() => { setSelectedStatus('all'); setPage(1); }}
                        className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                            selectedStatus === 'all'
                                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                        }`}
                    >
                        Todos ({totalUsersCount})
                    </button>
                    <button
                        onClick={() => { setSelectedStatus('active'); setPage(1); }}
                        className={`px-3 py-1 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                            selectedStatus === 'active'
                                ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-500/30'
                                : 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40 hover:bg-emerald-100'
                        }`}
                    >
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                        Activos ({activeUsersCount})
                    </button>
                    <button
                        onClick={() => { setSelectedStatus('inactive'); setPage(1); }}
                        className={`px-3 py-1 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                            selectedStatus === 'inactive'
                                ? 'bg-rose-600 text-white shadow-sm ring-2 ring-rose-500/30'
                                : 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800/40 hover:bg-rose-100'
                        }`}
                    >
                        <span className="h-1.5 w-1.5 rounded-full bg-rose-500"></span>
                        Inactivos ({inactiveUsersCount})
                    </button>
                </div>
            </div>

            {/* Role Pills Scroller */}
            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                {[
                    { id: 'all', label: 'Todos los Roles' },
                    { id: 'admin', label: 'Administradores' },
                    { id: 'superadmin', label: 'Superadmins' },
                    { id: 'secretary', label: 'Secretaría' },
                    { id: 'instructor', label: 'Instructores' },
                    { id: 'student', label: 'Estudiantes' },
                    { id: 'parent', label: 'Padres' }
                ].map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => {
                            setSelectedRole(tab.id);
                            setPage(1);
                        }}
                        className={`px-3.5 py-1.5 text-xs font-bold rounded-full transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                            selectedRole === tab.id
                                ? 'bg-brand-blue text-white shadow-sm ring-2 ring-brand-blue/30'
                                : 'bg-white dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {isError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center space-x-3">
                    <span className="font-medium">Hubo un problema al cargar los usuarios.</span>
                </div>
            )}

            {/* MOBILE FEED (Cards) - block md:hidden */}
            <div className="block md:hidden space-y-3">
                {filteredUsers?.map((user: any) => {
                    const badge = getRoleBadge(user.role);
                    const userBranch = branches?.find((b: any) => b.id === user.branch_id);
                    return (
                        <div key={user.id} className="glass-card p-4 rounded-2xl border border-slate-200/80 dark:border-white/10 space-y-3 shadow-sm">
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex items-center space-x-3 min-w-0">
                                    <div className="h-11 w-11 rounded-full bg-gradient-to-tr from-brand-blue/20 to-brand-purple/20 text-brand-blue dark:text-brand-teal border border-brand-blue/10 flex items-center justify-center font-bold uppercase shadow-sm shrink-0 text-sm">
                                        {user.full_name?.charAt(0) || 'U'}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="font-bold text-slate-900 dark:text-slate-100 text-sm truncate">{user.full_name || 'Sin Nombre'}</p>
                                        <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${badge.bg}`}>
                                                <Shield className="h-3 w-3 shrink-0" />
                                                <span>{badge.label}</span>
                                            </span>
                                            {user.role === 'parent' && (
                                                user.parent_links && user.parent_links.length > 0 ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => openFamilyModal(user)}
                                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/40 transition cursor-pointer"
                                                        title={`Hijos: ${user.parent_links.map((l: any) => l.students?.full_name).join(', ')}`}
                                                    >
                                                        <HeartHandshake className="h-3 w-3 shrink-0 text-indigo-500" />
                                                        <span>{user.parent_links.length} {user.parent_links.length === 1 ? 'Hijo' : 'Hijos'}</span>
                                                    </button>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() => openFamilyModal(user)}
                                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/40 transition cursor-pointer"
                                                        title="Clic para vincular estudiantes a este padre"
                                                    >
                                                        <AlertTriangle className="h-3 w-3 shrink-0 text-amber-500" />
                                                        <span>Sin hijos</span>
                                                    </button>
                                                )
                                            )}
                                            {user.role === 'student' && user.student_profile && (
                                                <span className="text-[10px] font-mono font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                                                    {user.student_profile.personal_code || user.student_profile.academy_code}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Status Toggle Badge */}
                                <button
                                    type="button"
                                    onClick={() => setStatusConfirmUser(user)}
                                    className={`shrink-0 inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-bold transition-all shadow-sm active:scale-95 cursor-pointer ${
                                        user.active !== false
                                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/30'
                                            : 'bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-400 border border-rose-300 dark:border-rose-500/30'
                                    }`}
                                    title="Toca para cambiar estado"
                                >
                                    {user.active !== false ? (
                                        <>
                                            <CheckCircle className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                                            <span>Activo</span>
                                        </>
                                    ) : (
                                        <>
                                            <XCircle className="h-3 w-3 text-rose-600 dark:text-rose-400" />
                                            <span>Inactivo</span>
                                        </>
                                    )}
                                </button>
                            </div>

                            {/* Details */}
                            <div className="text-xs space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800/60">
                                <div className="flex items-center text-slate-600 dark:text-slate-300">
                                    <Mail className="h-3.5 w-3.5 mr-2 text-slate-400 dark:text-slate-500 shrink-0" />
                                    <span className="truncate">{user.email || 'Sin correo registrado'}</span>
                                </div>
                                {user.phone && (
                                    <div className="flex items-center text-slate-600 dark:text-slate-300">
                                        <Phone className="h-3.5 w-3.5 mr-2 text-slate-400 dark:text-slate-500 shrink-0" />
                                        <span>{user.phone}</span>
                                    </div>
                                )}
                                <div className="flex items-center text-slate-500 dark:text-slate-400 text-[11px]">
                                    <Building2 className="h-3.5 w-3.5 mr-2 text-slate-400 shrink-0" />
                                    <span>{userBranch ? userBranch.name : 'Todas las Sedes (Global)'}</span>
                                </div>
                                <div className="flex items-center text-slate-500 dark:text-slate-400 text-[11px]" title={user.last_login_at ? `Último acceso: ${new Date(user.last_login_at).toLocaleString()}${user.last_login_ip ? ` (IP: ${user.last_login_ip})` : ''}` : 'Sin inicios de sesión registrados'}>
                                    <Clock className="h-3.5 w-3.5 mr-2 text-slate-400 dark:text-slate-500 shrink-0" />
                                    {user.last_login_at ? (
                                        <span className="truncate">Acceso: <strong className="text-slate-700 dark:text-slate-300 font-medium">{formatLastLogin(user.last_login_at)}</strong></span>
                                    ) : (
                                        <span className="text-slate-400 dark:text-slate-500 italic">Sin accesos aún</span>
                                    )}
                                </div>
                            </div>

                            {/* Action Buttons: ALWAYS visible and easily clickable on touch devices */}
                            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/60">
                                {user.role === 'parent' && (
                                    <button
                                        type="button"
                                        onClick={() => openFamilyModal(user)}
                                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 rounded-lg text-xs font-semibold border border-indigo-200 dark:border-indigo-800/40 active:scale-95"
                                        title="Gestionar Hijos Vinculados"
                                    >
                                        <HeartHandshake className="h-3.5 w-3.5" />
                                        <span>Hijos</span>
                                    </button>
                                )}
                                <button
                                    onClick={() => {
                                        setErrorMsg('');
                                        setSuccessMsg('');
                                        setResetForm({ userId: user.id, newPassword: '', confirmPassword: '' });
                                        setSelectedUser(user);
                                        setShowPassword(false);
                                        setIsResetModalOpen(true);
                                    }}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 rounded-lg text-xs font-semibold border border-amber-200 dark:border-amber-800/40 active:scale-95"
                                    title="Cambiar Contraseña"
                                >
                                    <KeyRound className="h-3.5 w-3.5" />
                                    <span>Clave</span>
                                </button>
                                <button
                                    onClick={() => openEditModal(user)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 dark:bg-blue-950/30 text-brand-blue dark:text-blue-400 rounded-lg text-xs font-semibold border border-blue-200 dark:border-blue-800/40 active:scale-95"
                                    title="Editar Usuario"
                                >
                                    <Edit2 className="h-3.5 w-3.5" />
                                    <span>Editar</span>
                                </button>
                                <button
                                    onClick={() => confirmDelete(user)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 rounded-lg text-xs font-semibold border border-rose-200 dark:border-rose-800/40 active:scale-95"
                                    title="Eliminar Usuario"
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    <span>Borrar</span>
                                </button>
                            </div>
                        </div>
                    );
                })}

                {filteredUsers?.length === 0 && (
                    <div className="glass-card p-8 rounded-2xl text-center">
                        <div className="h-12 w-12 bg-white/50 dark:bg-slate-800/50 rounded-full flex items-center justify-center text-slate-300 dark:text-slate-600 mx-auto mb-3">
                            <Users className="h-6 w-6" />
                        </div>
                        <p className="text-slate-900 dark:text-white font-bold text-sm">No se encontraron usuarios</p>
                        <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">Intenta con otro término de búsqueda o cambia los filtros.</p>
                    </div>
                )}
            </div>

            {/* DESKTOP TABLE - hidden md:block */}
            <div className="hidden md:block glass-card rounded-3xl overflow-hidden border border-slate-200/80 dark:border-white/10 shadow-sm">
                <div className="min-w-full inline-block align-middle">
                    <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700/50">
                        <thead className="bg-slate-50/70 dark:bg-slate-800/80">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Usuario</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Contacto</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Sede</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Estado</th>
                                <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                            {filteredUsers?.map((user: any) => {
                                const userBranch = branches?.find((b: any) => b.id === user.branch_id);
                                const badge = getRoleBadge(user.role);
                                return (
                                    <tr key={user.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center space-x-3.5">
                                                <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-brand-blue/20 to-brand-purple/20 text-brand-blue dark:text-brand-teal border border-brand-blue/10 flex items-center justify-center font-bold uppercase shadow-sm shrink-0">
                                                    {user.full_name?.charAt(0) || 'U'}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-900 dark:text-slate-100 text-sm">{user.full_name || 'Sin Nombre'}</p>
                                                    <div className="flex flex-wrap items-center mt-1 gap-1.5">
                                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${badge.bg}`}>
                                                            <Shield className="h-2.5 w-2.5 shrink-0" />
                                                            <span>{badge.label}</span>
                                                        </span>
                                                        {user.role === 'parent' && (
                                                            user.parent_links && user.parent_links.length > 0 ? (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => openFamilyModal(user)}
                                                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/40 transition cursor-pointer"
                                                                    title={`Hijos vinculados: ${user.parent_links.map((l: any) => l.students?.full_name).join(', ')}`}
                                                                >
                                                                    <HeartHandshake className="h-2.5 w-2.5 shrink-0 text-indigo-500" />
                                                                    <span>{user.parent_links.length} {user.parent_links.length === 1 ? 'Hijo' : 'Hijos'}</span>
                                                                </button>
                                                            ) : (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => openFamilyModal(user)}
                                                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/40 transition cursor-pointer"
                                                                    title="Clic para vincular estudiantes a este padre"
                                                                >
                                                                    <AlertTriangle className="h-2.5 w-2.5 shrink-0 text-amber-500" />
                                                                    <span>Sin hijos</span>
                                                                </button>
                                                            )
                                                        )}
                                                        {user.role === 'student' && user.student_profile && (
                                                            <span className="text-[10px] font-mono font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                                                                {user.student_profile.personal_code || user.student_profile.academy_code}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="space-y-1">
                                                <div className="flex items-center text-slate-700 dark:text-slate-300 text-xs">
                                                    <Mail className="h-3.5 w-3.5 mr-2 text-slate-400 dark:text-slate-500 shrink-0" />
                                                    <span className="truncate max-w-[220px] font-mono">{user.email || 'N/A'}</span>
                                                </div>
                                                {user.phone && (
                                                    <div className="flex items-center text-slate-500 dark:text-slate-400 text-xs">
                                                        <Phone className="h-3.5 w-3.5 mr-2 text-slate-400 shrink-0" />
                                                        <span>{user.phone}</span>
                                                    </div>
                                                )}
                                                <div className="flex items-center text-slate-500 dark:text-slate-400 text-[11px]" title={user.last_login_at ? `Último acceso: ${new Date(user.last_login_at).toLocaleString()}${user.last_login_ip ? ` (IP: ${user.last_login_ip})` : ''}` : 'Sin inicios de sesión registrados'}>
                                                    <Clock className="h-3.5 w-3.5 mr-2 text-slate-400 dark:text-slate-500 shrink-0" />
                                                    {user.last_login_at ? (
                                                        <span className="truncate">Acceso: <strong className="text-slate-700 dark:text-slate-300 font-medium">{formatLastLogin(user.last_login_at)}</strong></span>
                                                    ) : (
                                                        <span className="text-slate-400 dark:text-slate-500 italic">Sin accesos aún</span>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {user.branch_id && userBranch ? (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-50 dark:bg-blue-500/10 text-brand-blue dark:text-blue-300 border border-blue-200 dark:border-blue-500/20">
                                                    <Building2 className="h-3.5 w-3.5 shrink-0 text-brand-blue dark:text-blue-400" />
                                                    <span>{userBranch.name}</span>
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                                                    <Building2 className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                                                    <span>Todas las Sedes</span>
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <button
                                                type="button"
                                                onClick={() => setStatusConfirmUser(user)}
                                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all shadow-sm active:scale-95 cursor-pointer ${
                                                    user.active !== false
                                                        ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:hover:bg-emerald-500/25 border border-emerald-300 dark:border-emerald-500/30'
                                                        : 'bg-rose-100 text-rose-800 hover:bg-rose-200 dark:bg-rose-500/15 dark:text-rose-400 dark:hover:bg-rose-500/25 border border-rose-300 dark:border-rose-500/30'
                                                }`}
                                                title={user.active !== false ? 'Clic para suspender acceso' : 'Clic para activar acceso'}
                                            >
                                                {user.active !== false ? (
                                                    <>
                                                        <CheckCircle className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                                                        <span>Activo</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <XCircle className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
                                                        <span>Inactivo</span>
                                                    </>
                                                )}
                                            </button>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-1.5">
                                                {user.role === 'parent' && (
                                                    <button
                                                        type="button"
                                                        onClick={() => openFamilyModal(user)}
                                                        className="inline-flex items-center justify-center p-2 rounded-xl text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-600 dark:hover:text-white border border-indigo-200/80 dark:border-indigo-800/40 transition-all shadow-sm active:scale-95 cursor-pointer"
                                                        title="Gestionar Hijos Vinculados"
                                                    >
                                                        <HeartHandshake className="h-4 w-4" />
                                                    </button>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setErrorMsg('');
                                                        setSuccessMsg('');
                                                        setResetForm({ userId: user.id, newPassword: '', confirmPassword: '' });
                                                        setSelectedUser(user);
                                                        setShowPassword(false);
                                                        setIsResetModalOpen(true);
                                                    }}
                                                    className="inline-flex items-center justify-center p-2 rounded-xl text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-500 hover:text-white dark:hover:bg-amber-500 dark:hover:text-white border border-amber-200/80 dark:border-amber-800/40 transition-all shadow-sm active:scale-95 cursor-pointer"
                                                    title="Restablecer Contraseña"
                                                >
                                                    <KeyRound className="h-4 w-4" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => openEditModal(user)}
                                                    className="inline-flex items-center justify-center p-2 rounded-xl text-brand-blue dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 hover:bg-brand-blue hover:text-white dark:hover:bg-blue-600 dark:hover:text-white border border-blue-200/80 dark:border-blue-800/40 transition-all shadow-sm active:scale-95 cursor-pointer"
                                                    title="Editar Usuario"
                                                >
                                                    <Edit2 className="h-4 w-4" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => confirmDelete(user)}
                                                    className="inline-flex items-center justify-center p-2 rounded-xl text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-600 hover:text-white dark:hover:bg-rose-600 dark:hover:text-white border border-rose-200/80 dark:border-rose-800/40 transition-all shadow-sm active:scale-95 cursor-pointer"
                                                    title="Eliminar Usuario"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {filteredUsers?.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-8 py-20 text-center">
                                        <div className="flex flex-col items-center justify-center space-y-4">
                                            <div className="h-16 w-16 bg-white/50 dark:bg-slate-800/50 rounded-full flex items-center justify-center text-slate-300 dark:text-slate-600">
                                                <Users className="h-8 w-8" />
                                            </div>
                                            <div>
                                                <p className="text-slate-900 dark:text-white font-bold">No se encontraron usuarios</p>
                                                <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Intenta con otro término de búsqueda o ajusta los filtros.</p>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Pagination Controls */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-200 dark:border-slate-700/50 pt-5">
                <div className="flex items-center gap-3 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                    <span>Filas por página:</span>
                    <select
                        value={limit}
                        onChange={(e) => {
                            setLimit(Number(e.target.value));
                            setPage(1);
                        }}
                        className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 text-xs font-semibold focus:outline-none cursor-pointer"
                    >
                        <option value={15}>15</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                    </select>
                    <span>
                        {meta ? (
                            <>Mostrando <strong className="text-slate-900 dark:text-white">{(meta.page - 1) * meta.limit + 1}</strong> - <strong className="text-slate-900 dark:text-white">{Math.min(meta.page * meta.limit, meta.total)}</strong> de <strong className="text-brand-blue">{meta.total}</strong> usuarios</>
                        ) : (
                            <>Total: <strong className="text-brand-blue">{filteredUsers.length}</strong> usuarios</>
                        )}
                    </span>
                </div>
                <div className="flex items-center space-x-2">
                    <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="px-3.5 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all font-semibold text-xs flex items-center gap-1 shadow-sm active:scale-95 cursor-pointer"
                    >
                        <ChevronLeft className="h-4 w-4" />
                        <span>Anterior</span>
                    </button>
                    <div className="px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-lg">
                        Página {page} {meta?.totalPages ? `de ${meta.totalPages}` : ''}
                    </div>
                    <button
                        onClick={() => setPage(p => meta?.totalPages ? Math.min(meta.totalPages, p + 1) : p + 1)}
                        disabled={meta ? page >= meta.totalPages : filteredUsers.length < limit}
                        className="px-3.5 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all font-semibold text-xs flex items-center gap-1 shadow-sm active:scale-95 cursor-pointer"
                    >
                        <span>Siguiente</span>
                        <ChevronRight className="h-4 w-4" />
                    </button>
                </div>
            </div>

            {/* Status Toggle Confirm Modal */}
            {statusConfirmUser && (
                <ConfirmModal
                    isOpen={!!statusConfirmUser}
                    variant={statusConfirmUser.active !== false ? 'warning' : 'success'}
                    title={statusConfirmUser.active !== false ? '¿Suspender acceso de usuario?' : '¿Reactivar acceso de usuario?'}
                    message={
                        <div className="space-y-2 text-sm text-slate-300">
                            <p>
                                {statusConfirmUser.active !== false
                                    ? `¿Estás seguro de suspender el acceso de ${statusConfirmUser.full_name || statusConfirmUser.email}? El usuario no podrá iniciar sesión en la plataforma mientras esté inactivo.`
                                    : `¿Deseas reactivar el acceso de ${statusConfirmUser.full_name || statusConfirmUser.email}? Podrá volver a iniciar sesión con sus credenciales habituales.`}
                            </p>
                            <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/60 text-xs text-slate-400 space-y-1">
                                <p><strong className="text-white">Correo:</strong> {statusConfirmUser.email}</p>
                                <p><strong className="text-white">Rol:</strong> {statusConfirmUser.role}</p>
                            </div>
                        </div>
                    }
                    confirmText={statusConfirmUser.active !== false ? 'Sí, Suspender' : 'Sí, Activar'}
                    cancelText="Cancelar"
                    isLoading={toggleStatusMutation.isPending}
                    onConfirm={() => {
                        toggleStatusMutation.mutate({
                            id: statusConfirmUser.id,
                            active: !(statusConfirmUser.active !== false)
                        });
                    }}
                    onClose={() => setStatusConfirmUser(null)}
                />
            )}

            {/* Create Modal */}
            {isCreateModalOpen && createPortal(
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4">
                    <div className="absolute inset-0 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setIsCreateModalOpen(false)} />

                    <div className="bg-slate-900 text-white rounded-2xl sm:rounded-3xl w-full max-w-lg shadow-2xl relative z-10 overflow-hidden animate-in zoom-in-95 duration-200 max-h-[92vh] flex flex-col border border-slate-800">
                        {/* Header */}
                        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/90 shrink-0">
                            <div className="flex items-center gap-2.5">
                                <div className="h-9 w-9 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold">
                                    <Plus className="h-5 w-5" />
                                </div>
                                <div>
                                    <h3 className="text-base sm:text-lg font-bold">Nuevo Usuario</h3>
                                    <p className="text-[11px] text-slate-400">Crea un nuevo acceso a la plataforma.</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsCreateModalOpen(false)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <form onSubmit={handleCreate} className="flex-1 flex flex-col overflow-hidden">
                            <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
                                {errorMsg && (
                                    <div className="bg-red-900/30 border border-red-800 text-red-400 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium">
                                        {errorMsg}
                                    </div>
                                )}

                                <div className="space-y-3.5">
                                    <div>
                                        <label className="text-xs font-bold text-slate-300 ml-0.5">Nombre Completo *</label>
                                        <input
                                            type="text"
                                            required
                                            className="w-full mt-1.5 px-3.5 py-2.5 bg-slate-800/80 border border-slate-700 text-white rounded-xl focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-500 text-sm"
                                            value={createForm.full_name}
                                            onChange={(e) => setCreateForm({ ...createForm, full_name: e.target.value })}
                                            placeholder="Ej: Ana Gómez"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-xs font-bold text-slate-300 ml-0.5">Correo Electrónico *</label>
                                        <input
                                            type="email"
                                            required
                                            className="w-full mt-1.5 px-3.5 py-2.5 bg-slate-800/80 border border-slate-700 text-white rounded-xl focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-500 text-sm"
                                            value={createForm.email}
                                            onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                                            placeholder="correo@ejemplo.com"
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                        <div>
                                            <div className="flex items-center justify-between">
                                                <label className="text-xs font-bold text-slate-300 ml-0.5">Contraseña *</label>
                                                <button
                                                    type="button"
                                                    onClick={() => generateSecurePassword('create')}
                                                    className="text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-semibold cursor-pointer"
                                                >
                                                    <Sparkles className="w-3 h-3" />
                                                    <span>Generar Segura</span>
                                                </button>
                                            </div>
                                            <input
                                                type="text"
                                                required
                                                className="w-full mt-1.5 px-3.5 py-2.5 bg-slate-800/80 border border-slate-700 text-white rounded-xl focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-500 text-sm font-mono"
                                                value={createForm.password}
                                                onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                                                placeholder="Mínimo 8 caracteres"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-slate-300 ml-0.5">Rol *</label>
                                            <select
                                                className="w-full mt-1.5 px-3.5 py-2.5 bg-slate-800/80 border border-slate-700 text-white rounded-xl focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 outline-none transition-all text-sm cursor-pointer"
                                                value={createForm.role}
                                                onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}
                                            >
                                                <option value="student">Estudiante / Alumno</option>
                                                <option value="parent">Padre / Madre de Familia</option>
                                                <option value="instructor">Instructor / Profesor</option>
                                                <option value="secretary">Secretario(a)</option>
                                                <option value="admin">Administrador</option>
                                                <option value="superadmin">Superadmin</option>
                                            </select>
                                        </div>
                                    </div>
                                    <PasswordStrengthMeter password={createForm.password} role={createForm.role} />

                                    <div>
                                        <label className="text-xs font-bold text-slate-300 ml-0.5 flex items-center">
                                            <Building2 className="h-3.5 w-3.5 mr-1.5 text-slate-400" />
                                            Sede (Opcional)
                                        </label>
                                        <select
                                            className="w-full mt-1.5 px-3.5 py-2.5 bg-slate-800/80 border border-slate-700 text-white rounded-xl focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 outline-none transition-all text-sm cursor-pointer"
                                            value={createForm.branch_id}
                                            onChange={(e) => setCreateForm({ ...createForm, branch_id: e.target.value })}
                                        >
                                            <option value="">-- Sin sede asignada (Acceso Global) --</option>
                                            {branches?.map((branch: any) => (
                                                <option key={branch.id} value={branch.id}>{branch.name}</option>
                                            ))}
                                        </select>
                                        <p className="text-[11px] text-slate-400 mt-1 px-0.5">
                                            Si se asigna una sede, este usuario solo accederá a dicha sede.
                                        </p>
                                    </div>

                                    {createForm.role === 'student' && (
                                        <div className="p-3 bg-slate-800/50 rounded-xl border border-slate-700/60 space-y-1.5">
                                            <label className="text-xs font-bold text-slate-300 ml-0.5 flex items-center">
                                                <LinkIcon className="h-3.5 w-3.5 mr-1.5 text-brand-teal" />
                                                Enlazar a Estudiante (Opcional)
                                            </label>
                                            <select
                                                className="w-full mt-1.5 px-3.5 py-2.5 bg-slate-800 border border-slate-700 text-white rounded-xl focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 outline-none transition-all text-sm cursor-pointer"
                                                value={createForm.student_id}
                                                onChange={(e) => {
                                                    const studentId = e.target.value;
                                                    const selectedStudent = students?.find((s: any) => s.id === studentId);
                                                    setCreateForm({
                                                        ...createForm,
                                                        student_id: studentId,
                                                        full_name: selectedStudent ? selectedStudent.full_name : createForm.full_name
                                                    });
                                                }}
                                            >
                                                <option value="">-- No enlazar por ahora --</option>
                                                {students
                                                    ?.filter((s: any) => !s.user_id)
                                                    ?.map((st: any) => (
                                                        <option key={st.id} value={st.id}>{st.full_name}</option>
                                                    ))
                                                }
                                            </select>
                                            <p className="text-[11px] text-slate-400 px-0.5">
                                                Permite que el alumno vea su perfil académico al iniciar sesión.
                                            </p>
                                        </div>
                                    )}

                                    {createForm.role === 'parent' && (
                                        <div className="p-3.5 bg-indigo-950/20 rounded-xl border border-indigo-800/40 space-y-3">
                                            <div className="flex items-center justify-between">
                                                <label className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                                                    <HeartHandshake className="h-4 w-4 text-indigo-400" />
                                                    <span>Vincular Hijos / Estudiantes ({createForm.student_links.length})</span>
                                                </label>
                                            </div>

                                            {/* Selector to add child */}
                                            <div className="flex flex-col sm:flex-row gap-2">
                                                <select
                                                    className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 text-white rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 outline-none cursor-pointer"
                                                    value={createChildSelect.student_id}
                                                    onChange={(e) => setCreateChildSelect({ ...createChildSelect, student_id: e.target.value })}
                                                >
                                                    <option value="">-- Seleccionar Estudiante --</option>
                                                    {students?.map((st: any) => {
                                                        const isAlreadyLinked = createForm.student_links.some((l: any) => l.student_id === st.id);
                                                        return (
                                                            <option key={st.id} value={st.id} disabled={isAlreadyLinked}>
                                                                {st.full_name} {st.personal_code ? `(${st.personal_code})` : ''} {isAlreadyLinked ? '✓ (Ya agregado)' : ''}
                                                            </option>
                                                        );
                                                    })}
                                                </select>
                                                <select
                                                    className="w-full sm:w-28 px-3 py-2 bg-slate-800 border border-slate-700 text-white rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 outline-none cursor-pointer"
                                                    value={createChildSelect.relationship}
                                                    onChange={(e) => setCreateChildSelect({ ...createChildSelect, relationship: e.target.value })}
                                                >
                                                    <option value="padre">Padre</option>
                                                    <option value="madre">Madre</option>
                                                    <option value="tutor">Tutor</option>
                                                    <option value="familiar">Familiar</option>
                                                </select>
                                                <button
                                                    type="button"
                                                    disabled={!createChildSelect.student_id}
                                                    onClick={() => {
                                                        if (!createChildSelect.student_id) return;
                                                        if (createForm.student_links.some((l: any) => l.student_id === createChildSelect.student_id)) return;
                                                        setCreateForm({
                                                            ...createForm,
                                                            student_links: [...createForm.student_links, { student_id: createChildSelect.student_id, relationship: createChildSelect.relationship || 'padre' }]
                                                        });
                                                        setCreateChildSelect({ student_id: '', relationship: 'padre' });
                                                    }}
                                                    className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-1 shrink-0"
                                                >
                                                    <Plus className="h-4 w-4" />
                                                    <span>Agregar</span>
                                                </button>
                                            </div>

                                            {/* Existing chips */}
                                            {createForm.student_links.length > 0 ? (
                                                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                                                    {createForm.student_links.map((link: any) => {
                                                        const studentObj = students?.find((s: any) => s.id === link.student_id);
                                                        return (
                                                            <div key={link.student_id} className="p-2 bg-slate-800/90 rounded-xl border border-slate-700 flex items-center justify-between text-xs">
                                                                <span className="font-semibold text-white truncate max-w-[200px]">
                                                                    {studentObj?.full_name || 'Estudiante'}
                                                                    <span className="ml-1.5 text-[10px] text-indigo-400 font-normal">({link.relationship || 'padre'})</span>
                                                                </span>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setCreateForm({
                                                                            ...createForm,
                                                                            student_links: createForm.student_links.filter((l: any) => l.student_id !== link.student_id)
                                                                        });
                                                                    }}
                                                                    className="p-1 text-rose-400 hover:text-rose-200"
                                                                >
                                                                    <X className="h-3.5 w-3.5" />
                                                                </button>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            ) : (
                                                <p className="text-[11px] text-slate-400">Puedes vincular uno o varios estudiantes ahora, o gestionarlos luego desde la lista.</p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="flex items-center justify-end gap-2.5 px-5 py-3.5 bg-slate-900 border-t border-slate-800 shrink-0">
                                <button
                                    type="button"
                                    onClick={() => setIsCreateModalOpen(false)}
                                    className="px-4 py-2 bg-slate-800 text-slate-300 font-semibold text-xs sm:text-sm rounded-xl hover:bg-slate-700 transition active:scale-95 cursor-pointer"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={createMutation.isPending}
                                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs sm:text-sm rounded-xl shadow-sm transition active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                                >
                                    {createMutation.isPending ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <span>Crear Usuario</span>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}

            {/* Edit Modal */}
            {isEditModalOpen && createPortal(
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4">
                    <div className="absolute inset-0 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setIsEditModalOpen(false)} />

                    <div className="bg-slate-900 text-white rounded-2xl sm:rounded-3xl w-full max-w-lg shadow-2xl relative z-10 overflow-hidden animate-in zoom-in-95 duration-200 max-h-[92vh] flex flex-col border border-slate-800">
                        {/* Header */}
                        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/90 shrink-0">
                            <div className="flex items-center gap-2.5">
                                <div className="h-9 w-9 rounded-xl bg-blue-500/20 text-brand-blue border border-blue-500/30 flex items-center justify-center font-bold">
                                    <Edit2 className="h-5 w-5" />
                                </div>
                                <div>
                                    <h3 className="text-base sm:text-lg font-bold">Editar Usuario</h3>
                                    <p className="text-[11px] text-slate-400">Modifica los detalles y permisos del usuario.</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsEditModalOpen(false)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <form onSubmit={handleUpdate} className="flex-1 flex flex-col overflow-hidden">
                            <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
                                {errorMsg && (
                                    <div className="bg-red-900/30 border border-red-800 text-red-400 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium">
                                        {errorMsg}
                                    </div>
                                )}

                                <div className="space-y-3.5">
                                    <div>
                                        <label className="text-xs font-bold text-slate-300 ml-0.5">Nombre Completo *</label>
                                        <input
                                            type="text"
                                            required
                                            className="w-full mt-1.5 px-3.5 py-2.5 bg-slate-800/80 border border-slate-700 text-white rounded-xl focus:ring-2 focus:ring-brand-blue/40 focus:border-brand-blue outline-none transition-all placeholder:text-slate-500 text-sm"
                                            value={editForm.full_name}
                                            onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                                        />
                                    </div>

                                    <div>
                                        <label className="text-xs font-bold text-slate-300 ml-0.5">Correo Electrónico (Solo lectura)</label>
                                        <input
                                            type="email"
                                            disabled
                                            className="w-full mt-1.5 px-3.5 py-2.5 bg-slate-800/40 border border-slate-700/50 text-slate-400 rounded-xl outline-none cursor-not-allowed text-sm"
                                            value={editForm.email}
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 items-center">
                                        <div>
                                            <label className="text-xs font-bold text-slate-300 ml-0.5">Rol</label>
                                            <select
                                                className="w-full mt-1.5 px-3.5 py-2.5 bg-slate-800/80 border border-slate-700 text-white rounded-xl focus:ring-2 focus:ring-brand-blue/40 focus:border-brand-blue outline-none transition-all text-sm cursor-pointer"
                                                value={editForm.role}
                                                onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                                            >
                                                <option value="student">Estudiante</option>
                                                <option value="parent">Padre / Madre de Familia</option>
                                                <option value="instructor">Instructor</option>
                                                <option value="secretary">Secretaría</option>
                                                <option value="admin">Administrador</option>
                                                <option value="superadmin">Superadmin</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-slate-300 ml-0.5">Estado</label>
                                            <div className="mt-1.5 flex items-center h-[42px] px-3 bg-slate-800/40 border border-slate-700 rounded-xl">
                                                <label className="flex items-center space-x-3 cursor-pointer group">
                                                    <div className="relative flex items-center justify-center">
                                                        <input
                                                            type="checkbox"
                                                            className="peer sr-only"
                                                            checked={editForm.active}
                                                            onChange={(e) => setEditForm({ ...editForm, active: e.target.checked })}
                                                        />
                                                        <div className="w-10 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500 shadow-inner"></div>
                                                    </div>
                                                    <span className={`text-xs font-bold select-none ${editForm.active ? 'text-emerald-400' : 'text-slate-400'}`}>
                                                        {editForm.active ? 'Activo' : 'Inactivo'}
                                                    </span>
                                                </label>
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-xs font-bold text-slate-300 ml-0.5 flex items-center">
                                            <Building2 className="h-3.5 w-3.5 mr-1.5 text-slate-400" />
                                            Sede Asignada
                                        </label>
                                        <select
                                            className="w-full mt-1.5 px-3.5 py-2.5 bg-slate-800/80 border border-slate-700 text-white rounded-xl focus:ring-2 focus:ring-brand-blue/40 focus:border-brand-blue outline-none transition-all text-sm cursor-pointer"
                                            value={editForm.branch_id}
                                            onChange={(e) => setEditForm({ ...editForm, branch_id: e.target.value })}
                                        >
                                            <option value="">-- Ninguna (Acceso global) --</option>
                                            {branches?.map((branch: any) => (
                                                <option key={branch.id} value={branch.id}>{branch.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {editForm.role === 'student' && (
                                        <div className="p-3 bg-slate-800/50 rounded-xl border border-slate-700/60 space-y-1.5">
                                            <label className="text-xs font-bold text-slate-300 ml-0.5 flex items-center">
                                                <LinkIcon className="h-3.5 w-3.5 mr-1.5 text-brand-teal" />
                                                Estudiante Enlazado (Opcional)
                                            </label>
                                            <select
                                                className="w-full mt-1.5 px-3.5 py-2.5 bg-slate-800 border border-slate-700 text-white rounded-xl focus:ring-2 focus:ring-brand-blue/40 focus:border-brand-blue outline-none transition-all text-sm cursor-pointer"
                                                value={editForm.student_id || ''}
                                                onChange={(e) => {
                                                    const studentId = e.target.value;
                                                    setEditForm({
                                                        ...editForm,
                                                        student_id: studentId
                                                    });
                                                }}
                                            >
                                                <option value="">-- No enlazar a nadie --</option>
                                                {students
                                                    ?.filter((s: any) => !s.user_id || s.user_id === selectedUser?.id)
                                                    ?.map((st: any) => (
                                                        <option key={st.id} value={st.id}>{st.full_name}</option>
                                                    ))
                                                }
                                            </select>
                                        </div>
                                    )}

                                    {editForm.role === 'parent' && (
                                        <div className="p-3.5 bg-indigo-950/20 rounded-xl border border-indigo-800/40 space-y-3">
                                            <div className="flex items-center justify-between">
                                                <label className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                                                    <HeartHandshake className="h-4 w-4 text-indigo-400" />
                                                    <span>Estudiantes Vinculados (Hijos) ({editForm.student_links.length})</span>
                                                </label>
                                            </div>

                                            {/* Selector to add child */}
                                            <div className="flex flex-col sm:flex-row gap-2">
                                                <select
                                                    className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 text-white rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 outline-none cursor-pointer"
                                                    value={editChildSelect.student_id}
                                                    onChange={(e) => setEditChildSelect({ ...editChildSelect, student_id: e.target.value })}
                                                >
                                                    <option value="">-- Seleccionar Estudiante --</option>
                                                    {students?.map((st: any) => {
                                                        const isAlreadyLinked = editForm.student_links.some((l: any) => l.student_id === st.id);
                                                        return (
                                                            <option key={st.id} value={st.id} disabled={isAlreadyLinked}>
                                                                {st.full_name} {st.personal_code ? `(${st.personal_code})` : ''} {isAlreadyLinked ? '✓ (Ya agregado)' : ''}
                                                            </option>
                                                        );
                                                    })}
                                                </select>
                                                <select
                                                    className="w-full sm:w-28 px-3 py-2 bg-slate-800 border border-slate-700 text-white rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 outline-none cursor-pointer"
                                                    value={editChildSelect.relationship}
                                                    onChange={(e) => setEditChildSelect({ ...editChildSelect, relationship: e.target.value })}
                                                >
                                                    <option value="padre">Padre</option>
                                                    <option value="madre">Madre</option>
                                                    <option value="tutor">Tutor</option>
                                                    <option value="familiar">Familiar</option>
                                                </select>
                                                <button
                                                    type="button"
                                                    disabled={!editChildSelect.student_id}
                                                    onClick={() => {
                                                        if (!editChildSelect.student_id) return;
                                                        if (editForm.student_links.some((l: any) => l.student_id === editChildSelect.student_id)) return;
                                                        setEditForm({
                                                            ...editForm,
                                                            student_links: [...editForm.student_links, { student_id: editChildSelect.student_id, relationship: editChildSelect.relationship || 'padre' }]
                                                        });
                                                        setEditChildSelect({ student_id: '', relationship: 'padre' });
                                                    }}
                                                    className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-1 shrink-0"
                                                >
                                                    <Plus className="h-4 w-4" />
                                                    <span>Agregar</span>
                                                </button>
                                            </div>

                                            {/* Existing chips */}
                                            {editForm.student_links.length > 0 ? (
                                                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                                                    {editForm.student_links.map((link: any) => {
                                                        const studentObj = students?.find((s: any) => s.id === link.student_id);
                                                        return (
                                                            <div key={link.student_id} className="p-2 bg-slate-800/90 rounded-xl border border-slate-700 flex items-center justify-between text-xs">
                                                                <span className="font-semibold text-white truncate max-w-[200px]">
                                                                    {studentObj?.full_name || 'Estudiante'}
                                                                    <span className="ml-1.5 text-[10px] text-indigo-400 font-normal">({link.relationship || 'padre'})</span>
                                                                </span>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setEditForm({
                                                                            ...editForm,
                                                                            student_links: editForm.student_links.filter((l: any) => l.student_id !== link.student_id)
                                                                        });
                                                                    }}
                                                                    className="p-1 text-rose-400 hover:text-rose-200"
                                                                >
                                                                    <X className="h-3.5 w-3.5" />
                                                                </button>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            ) : (
                                                <p className="text-[11px] text-slate-400">Puedes vincular uno o varios estudiantes asociados a este padre de familia.</p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="flex items-center justify-end gap-2.5 px-5 py-3.5 bg-slate-900 border-t border-slate-800 shrink-0">
                                <button
                                    type="button"
                                    onClick={() => setIsEditModalOpen(false)}
                                    className="px-4 py-2 bg-slate-800 text-slate-300 font-semibold text-xs sm:text-sm rounded-xl hover:bg-slate-700 transition active:scale-95 cursor-pointer"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={updateMutation.isPending}
                                    className="px-5 py-2 bg-brand-blue hover:bg-blue-600 text-white font-semibold text-xs sm:text-sm rounded-xl shadow-sm transition active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                                >
                                    {updateMutation.isPending ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <span>Guardar Cambios</span>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}

            {/* Reset Password Modal */}
            {isResetModalOpen && createPortal(
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4">
                    <div className="absolute inset-0 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => !resetPasswordMutation.isPending && setIsResetModalOpen(false)} />

                    <div className="bg-slate-900 text-white rounded-2xl sm:rounded-3xl w-full max-w-sm shadow-2xl relative z-10 overflow-hidden animate-in zoom-in-95 duration-200 max-h-[92vh] flex flex-col border border-slate-800">
                        {/* Header */}
                        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/90 shrink-0">
                            <div className="flex items-center gap-2.5">
                                <div className="h-9 w-9 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center font-bold">
                                    <KeyRound className="h-5 w-5" />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold">Cambiar Contraseña</h3>
                                    <p className="text-[11px] text-slate-400 truncate max-w-[180px]">{selectedUser?.full_name}</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => !resetPasswordMutation.isPending && setIsResetModalOpen(false)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <form onSubmit={handleResetPassword} className="flex-1 flex flex-col overflow-hidden">
                            <div className="p-4 sm:p-6 space-y-3.5 overflow-y-auto flex-1 custom-scrollbar">
                                {errorMsg && (
                                    <div className="bg-red-900/30 border border-red-800 text-red-400 px-3.5 py-2.5 rounded-xl text-xs font-medium">
                                        {errorMsg}
                                    </div>
                                )}

                                {successMsg && (
                                    <div className="bg-green-900/30 border border-green-800 text-green-400 px-3.5 py-2.5 rounded-xl text-xs font-medium flex items-center gap-2">
                                        <CheckCircle className="w-4 h-4" /> {successMsg}
                                    </div>
                                )}

                                {/* User Info Card */}
                                <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/60 flex items-center justify-between gap-2">
                                    <div className="min-w-0">
                                        <p className="text-xs font-bold text-white truncate">{selectedUser?.full_name}</p>
                                        <p className="text-[11px] text-slate-400 truncate font-mono">{selectedUser?.email}</p>
                                    </div>
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/30 shrink-0">
                                        {selectedUser?.role}
                                    </span>
                                </div>

                                {/* Helpers: Generar y Copiar */}
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => generateSecurePassword('reset')}
                                        className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-semibold transition active:scale-95 shadow-sm cursor-pointer"
                                    >
                                        <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                                        <span>Generar Automática</span>
                                    </button>
                                    {resetForm.newPassword && (
                                        <button
                                            type="button"
                                            onClick={copyCredentials}
                                            className={`inline-flex items-center justify-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold transition active:scale-95 shadow-sm border cursor-pointer ${
                                                copiedCredentials 
                                                    ? 'bg-emerald-600 text-white border-emerald-500' 
                                                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                                            }`}
                                            title="Copiar datos de acceso para enviar al usuario"
                                        >
                                            {copiedCredentials ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5 text-slate-400" />}
                                            <span>{copiedCredentials ? '¡Copiado!' : 'Copiar'}</span>
                                        </button>
                                    )}
                                </div>

                                <div>
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-bold text-slate-300 ml-0.5">Nueva Contraseña</label>
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1"
                                        >
                                            {showPassword ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                                            <span>{showPassword ? 'Ocultar' : 'Ver'}</span>
                                        </button>
                                    </div>
                                    <div className="relative">
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            required
                                            className="w-full mt-1.5 px-3.5 py-2.5 bg-slate-800/80 border border-slate-700 text-white rounded-xl focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 outline-none transition-all placeholder:text-slate-500 text-sm font-mono"
                                            value={resetForm.newPassword}
                                            onChange={(e) => setResetForm({ ...resetForm, newPassword: e.target.value })}
                                            placeholder="Mínimo 8 caracteres"
                                        />
                                    </div>
                                    <PasswordStrengthMeter password={resetForm.newPassword} role={selectedUser?.role} />
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-slate-300 ml-0.5">Confirmar Contraseña</label>
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        required
                                        className="w-full mt-1.5 px-3.5 py-2.5 bg-slate-800/80 border border-slate-700 text-white rounded-xl focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 outline-none transition-all placeholder:text-slate-500 text-sm font-mono"
                                        value={resetForm.confirmPassword}
                                        onChange={(e) => setResetForm({ ...resetForm, confirmPassword: e.target.value })}
                                        placeholder="Repite la contraseña"
                                        minLength={6}
                                    />
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="flex items-center justify-end gap-2 px-5 py-3.5 bg-slate-900 border-t border-slate-800 shrink-0">
                                <button
                                    type="button"
                                    onClick={() => setIsResetModalOpen(false)}
                                    disabled={resetPasswordMutation.isPending || !!successMsg}
                                    className="px-4 py-2 bg-slate-800 text-slate-300 font-semibold text-xs sm:text-sm rounded-xl hover:bg-slate-700 transition active:scale-95 disabled:opacity-50 cursor-pointer"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={resetPasswordMutation.isPending || !!successMsg}
                                    className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white font-semibold text-xs sm:text-sm rounded-xl shadow-sm transition active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                                >
                                    {resetPasswordMutation.isPending ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <span>Actualizar</span>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}

            {/* Delete Modal */}
            {isDeleteModalOpen && createPortal(
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4">
                    <div className="absolute inset-0 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => !deleteMutation.isPending && setIsDeleteModalOpen(false)} />

                    <div className="bg-slate-900 text-white rounded-2xl sm:rounded-3xl w-full max-w-sm shadow-2xl relative z-10 overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-800">
                        {/* Header */}
                        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/90">
                            <div className="flex items-center gap-2.5">
                                <div className="h-9 w-9 rounded-xl bg-red-500/20 text-red-400 border border-red-500/30 flex items-center justify-center font-bold">
                                    <Trash2 className="h-5 w-5" />
                                </div>
                                <h3 className="text-base font-bold">Eliminar Usuario</h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => !deleteMutation.isPending && setIsDeleteModalOpen(false)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="p-5 text-center space-y-3">
                            <div className="mx-auto w-12 h-12 bg-red-500/10 border border-red-500/20 text-red-400 rounded-full flex items-center justify-center">
                                <AlertTriangle className="w-6 h-6" />
                            </div>
                            <p className="text-sm text-slate-300">
                                ¿Estás seguro que deseas eliminar permanentemente a <strong className="text-white">{userToDelete?.full_name}</strong>?
                            </p>
                            <p className="text-xs text-red-400 font-medium">Esta acción no se puede deshacer.</p>
                        </div>

                        <div className="flex gap-2 p-5 pt-0">
                            <button
                                type="button"
                                onClick={() => setIsDeleteModalOpen(false)}
                                disabled={deleteMutation.isPending}
                                className="flex-1 px-4 py-2 bg-slate-800 text-slate-300 font-semibold text-xs sm:text-sm rounded-xl hover:bg-slate-700 transition active:scale-95 disabled:opacity-50 cursor-pointer"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleDelete}
                                disabled={deleteMutation.isPending}
                                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold text-xs sm:text-sm rounded-xl shadow-sm transition active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                            >
                                {deleteMutation.isPending ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <span>Eliminar</span>
                                )}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Quick Family Links Modal */}
            {familyModalUser && createPortal(
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4">
                    <div className="absolute inset-0 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => !syncFamilyMutation.isPending && setFamilyModalUser(null)} />
                    <div className="bg-slate-900 text-white rounded-2xl sm:rounded-3xl w-full max-w-lg shadow-2xl relative z-10 overflow-hidden animate-in zoom-in-95 duration-200 max-h-[92vh] flex flex-col border border-slate-800">
                        {/* Header */}
                        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/90 shrink-0">
                            <div className="flex items-center gap-2.5">
                                <div className="h-9 w-9 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center font-bold">
                                    <HeartHandshake className="h-5 w-5" />
                                </div>
                                <div>
                                    <h3 className="text-base sm:text-lg font-bold">Vínculos Familiares</h3>
                                    <p className="text-[11px] text-slate-400 truncate max-w-[240px] sm:max-w-none">
                                        Padre/Tutor: <strong className="text-white">{familyModalUser.full_name}</strong>
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setFamilyModalUser(null)}
                                disabled={syncFamilyMutation.isPending}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
                            {familySuccessMsg && (
                                <div className="bg-emerald-900/40 border border-emerald-700 text-emerald-300 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2">
                                    <Check className="h-4 w-4" />
                                    <span>{familySuccessMsg}</span>
                                </div>
                            )}
                            {familyErrorMsg && (
                                <div className="bg-rose-900/40 border border-rose-700 text-rose-300 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold">
                                    {familyErrorMsg}
                                </div>
                            )}

                            {/* Add new link box */}
                            <div className="p-4 bg-slate-800/60 rounded-2xl border border-slate-700/60 space-y-3">
                                <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                                    <Plus className="h-4 w-4 text-indigo-400" />
                                    <span>Vincular un Estudiante / Hijo</span>
                                </label>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                                    <div className="sm:col-span-2">
                                        <select
                                            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 text-white rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 outline-none cursor-pointer"
                                            value={newChildSelect.student_id}
                                            onChange={(e) => setNewChildSelect({ ...newChildSelect, student_id: e.target.value })}
                                        >
                                            <option value="">-- Seleccionar Estudiante --</option>
                                            {students?.map((st: any) => {
                                                const isAlreadyLinked = familyLinks.some(l => l.student_id === st.id);
                                                return (
                                                    <option key={st.id} value={st.id} disabled={isAlreadyLinked}>
                                                        {st.full_name} {st.personal_code ? `(${st.personal_code})` : ''} {isAlreadyLinked ? '✓ (Ya vinculado)' : ''}
                                                    </option>
                                                );
                                            })}
                                        </select>
                                    </div>
                                    <div>
                                        <select
                                            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 text-white rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 outline-none cursor-pointer"
                                            value={newChildSelect.relationship}
                                            onChange={(e) => setNewChildSelect({ ...newChildSelect, relationship: e.target.value })}
                                        >
                                            <option value="padre">Padre</option>
                                            <option value="madre">Madre</option>
                                            <option value="tutor">Tutor Legal</option>
                                            <option value="familiar">Familiar / Encargado</option>
                                        </select>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    disabled={!newChildSelect.student_id}
                                    onClick={() => {
                                        if (!newChildSelect.student_id) return;
                                        if (familyLinks.some(l => l.student_id === newChildSelect.student_id)) return;
                                        setFamilyLinks([...familyLinks, { student_id: newChildSelect.student_id, relationship: newChildSelect.relationship || 'padre' }]);
                                        setNewChildSelect({ student_id: '', relationship: 'padre' });
                                    }}
                                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 shadow-sm active:scale-98 cursor-pointer"
                                >
                                    <Plus className="h-4 w-4" />
                                    <span>Agregar a la Familia</span>
                                </button>
                            </div>

                            {/* List of current links */}
                            <div className="space-y-2.5">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-slate-300">
                                        Hijos Vinculados ({familyLinks.length})
                                    </span>
                                    {familyLinks.length === 0 && (
                                        <span className="text-[11px] text-amber-400">Sin hijos actualmente</span>
                                    )}
                                </div>

                                {familyLinks.length === 0 ? (
                                    <div className="p-6 bg-slate-800/30 rounded-2xl border border-dashed border-slate-700 text-center">
                                        <p className="text-xs text-slate-400">No hay estudiantes vinculados a este padre de familia.</p>
                                        <p className="text-[11px] text-slate-500 mt-1">Selecciona uno en el buscador arriba y presiona "Agregar a la Familia".</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                                        {familyLinks.map((link) => {
                                            const studentObj = students?.find((s: any) => s.id === link.student_id);
                                            return (
                                                <div key={link.student_id} className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/80 flex items-center justify-between gap-3">
                                                    <div className="flex items-center gap-2.5 min-w-0">
                                                        <div className="h-8 w-8 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-xs shrink-0">
                                                            {studentObj?.full_name?.charAt(0) || 'E'}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="text-xs sm:text-sm font-bold text-white truncate">
                                                                {studentObj?.full_name || 'Estudiante'}
                                                            </p>
                                                            <p className="text-[10px] text-slate-400 font-mono">
                                                                {studentObj?.personal_code || studentObj?.academy_code || 'ID: ' + link.student_id.slice(0, 8)}
                                                            </p>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-2 shrink-0">
                                                        <select
                                                            value={link.relationship}
                                                            onChange={(e) => {
                                                                const updatedRel = e.target.value;
                                                                setFamilyLinks(familyLinks.map(l => l.student_id === link.student_id ? { ...l, relationship: updatedRel } : l));
                                                            }}
                                                            className="px-2 py-1 bg-slate-900 border border-slate-700 text-indigo-300 rounded-lg text-xs font-semibold focus:outline-none cursor-pointer"
                                                        >
                                                            <option value="padre">Padre</option>
                                                            <option value="madre">Madre</option>
                                                            <option value="tutor">Tutor Legal</option>
                                                            <option value="familiar">Familiar</option>
                                                        </select>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setFamilyLinks(familyLinks.filter(l => l.student_id !== link.student_id));
                                                            }}
                                                            className="p-1.5 text-rose-400 hover:text-white hover:bg-rose-500/20 rounded-lg transition cursor-pointer"
                                                            title="Quitar vínculo"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-end gap-2.5 px-5 py-3.5 bg-slate-900 border-t border-slate-800 shrink-0">
                            <button
                                type="button"
                                onClick={() => setFamilyModalUser(null)}
                                disabled={syncFamilyMutation.isPending}
                                className="px-4 py-2 bg-slate-800 text-slate-300 font-semibold text-xs sm:text-sm rounded-xl hover:bg-slate-700 transition active:scale-95 cursor-pointer"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                disabled={syncFamilyMutation.isPending}
                                onClick={() => {
                                    syncFamilyMutation.mutate({
                                        parentUserId: familyModalUser.id,
                                        links: familyLinks
                                    });
                                }}
                                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs sm:text-sm rounded-xl shadow-sm transition active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                            >
                                {syncFamilyMutation.isPending ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <span>Guardar Vínculos Familiares</span>
                                )}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default UsersList;
