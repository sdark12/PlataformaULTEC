import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getAuditLogs, getAuditStats, type AuditLog } from './auditService';
import { getBranches } from '../branches/branchesService';
import {
    ShieldAlert, Search, Calendar, Download, RefreshCw, Loader2,
    Eye, X, Clock, User, Database, Globe, ChevronLeft, ChevronRight,
    Activity, LogIn, PlusCircle, Edit3, Trash2, Copy, Check,
    Building2, BookOpen, DollarSign, Receipt, Award, FileSpreadsheet,
    CalendarCheck, ClipboardList, Megaphone, AlertCircle, Sparkles,
    Settings, HeartHandshake, TrendingUp, BookMarked, Folder, Bell,
    Laptop
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { saveWorkbook } from '../../utils/fileDownloader';

const AuditLogs = () => {
    // Current authenticated user
    const currentUser = (() => {
        try {
            const u = localStorage.getItem('user');
            return u ? JSON.parse(u) : null;
        } catch {
            return null;
        }
    })();
    const isSuperAdmin = currentUser?.role === 'superadmin';

    // Filters and pagination state
    const [searchTerm, setSearchTerm] = useState('');
    const [filterAction, setFilterAction] = useState('ALL');
    const [filterEntity, setFilterEntity] = useState('ALL');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [selectedBranch, setSelectedBranch] = useState('all');
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(25);

    // Modal state
    const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [copiedData, setCopiedData] = useState(false);
    const [isExporting, setIsExporting] = useState(false);

    // Queries
    const { data: branches } = useQuery({
        queryKey: ['branches-list'],
        queryFn: getBranches,
    });

    const { data: logsResponse, isLoading, isError, refetch, isFetching } = useQuery({
        queryKey: ['audit-logs', page, limit, searchTerm, filterAction, filterEntity, startDate, endDate, selectedBranch],
        queryFn: () => getAuditLogs({
            page,
            limit,
            search: searchTerm,
            action: filterAction,
            entity: filterEntity,
            startDate,
            endDate,
            branchId: selectedBranch
        }),
    });

    const { data: stats } = useQuery({
        queryKey: ['audit-stats', selectedBranch],
        queryFn: () => getAuditStats(selectedBranch),
    });

    const logs = logsResponse?.data || [];
    const meta = logsResponse?.meta || { total: logs.length, page: 1, limit, totalPages: 1 };

    // Format relative time
    const formatRelativeTime = (dateStr: string) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return '';
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffMinutes < 1) return 'Hace un momento';
        if (diffMinutes < 60) return `Hace ${diffMinutes} min`;
        if (diffHours < 24) return `Hace ${diffHours} h`;
        if (diffDays === 1) return 'Ayer';
        if (diffDays < 7) return `Hace ${diffDays} días`;
        return date.toLocaleDateString('es-GT', { day: '2-digit', month: 'short' });
    };

    // Action badge renderer
    const getActionBadge = (action: string) => {
        switch (action) {
            case 'LOGIN':
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300 rounded-lg text-xs font-bold shadow-xs">
                        <LogIn className="w-3.5 h-3.5" />
                        ACCESO
                    </span>
                );
            case 'POST':
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 rounded-lg text-xs font-bold shadow-xs">
                        <PlusCircle className="w-3.5 h-3.5" />
                        CREACIÓN
                    </span>
                );
            case 'PUT':
            case 'PATCH':
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300 rounded-lg text-xs font-bold shadow-xs">
                        <Edit3 className="w-3.5 h-3.5" />
                        EDICIÓN
                    </span>
                );
            case 'DELETE':
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300 rounded-lg text-xs font-bold shadow-xs">
                        <Trash2 className="w-3.5 h-3.5" />
                        ELIMINAR
                    </span>
                );
            default:
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 rounded-lg text-xs font-bold">
                        {action}
                    </span>
                );
        }
    };

    // Entity configuration (Icon + Spanish name)
    const getEntityInfo = (entity: string) => {
        const mapping: Record<string, { label: string; icon: any; color: string }> = {
            'users': { label: 'Usuarios', icon: User, color: 'text-blue-500' },
            'auth': { label: 'Autenticación', icon: ShieldAlert, color: 'text-cyan-500' },
            'students': { label: 'Estudiantes', icon: Award, color: 'text-emerald-500' },
            'payments': { label: 'Pagos y Caja', icon: DollarSign, color: 'text-amber-500' },
            'invoices': { label: 'Facturas', icon: Receipt, color: 'text-teal-500' },
            'grades': { label: 'Calificaciones', icon: BookOpen, color: 'text-purple-500' },
            'subgrades': { label: 'Tareas / Actividades', icon: FileSpreadsheet, color: 'text-indigo-500' },
            'attendance': { label: 'Asistencia', icon: CalendarCheck, color: 'text-sky-500' },
            'assignments': { label: 'Asignaciones', icon: ClipboardList, color: 'text-violet-500' },
            'branches': { label: 'Sedes', icon: Building2, color: 'text-orange-500' },
            'announcements': { label: 'Circulares', icon: Megaphone, color: 'text-rose-500' },
            'discipline': { label: 'Disciplina', icon: AlertCircle, color: 'text-red-500' },
            'merits': { label: 'Méritos', icon: Sparkles, color: 'text-yellow-500' },
            'settings': { label: 'Configuración', icon: Settings, color: 'text-slate-500' },
            'parents': { label: 'Vínculos Familiares', icon: HeartHandshake, color: 'text-pink-500' },
            'promotions': { label: 'Promociones', icon: TrendingUp, color: 'text-emerald-600' },
            'courses': { label: 'Cursos', icon: BookMarked, color: 'text-blue-600' },
            'resources': { label: 'Recursos', icon: Folder, color: 'text-teal-600' },
            'notifications': { label: 'Notificaciones', icon: Bell, color: 'text-amber-600' },
        };
        return mapping[entity] || { label: entity || 'Sistema', icon: Database, color: 'text-slate-400' };
    };

    // Role badge
    const getRoleBadge = (role?: string) => {
        switch (role) {
            case 'superadmin':
                return <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">SuperAdmin</span>;
            case 'admin':
                return <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">Admin</span>;
            case 'secretary':
                return <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">Secretaría</span>;
            case 'instructor':
                return <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">Docente</span>;
            case 'student':
                return <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300">Estudiante</span>;
            case 'parent':
                return <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300">Familiar</span>;
            default:
                return <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">{role || 'Usuario'}</span>;
        }
    };

    // Reset all filters
    const handleResetFilters = () => {
        setSearchTerm('');
        setFilterAction('ALL');
        setFilterEntity('ALL');
        setStartDate('');
        setEndDate('');
        setSelectedBranch('all');
        setPage(1);
    };

    const hasActiveFilters = Boolean(
        searchTerm || filterAction !== 'ALL' || filterEntity !== 'ALL' || startDate || endDate || selectedBranch !== 'all'
    );

    // Copy JSON log to clipboard
    const handleCopyJson = async (data: any) => {
        try {
            await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
            setCopiedData(true);
            setTimeout(() => setCopiedData(false), 2000);
        } catch (err) {
            console.error('Failed to copy json:', err);
        }
    };

    // Export audit logs to Excel
    const handleExportExcel = async () => {
        setIsExporting(true);
        try {
            const exportRes = await getAuditLogs({
                search: searchTerm,
                action: filterAction,
                entity: filterEntity,
                startDate,
                endDate,
                branchId: selectedBranch,
                export: true
            });

            const dataset = exportRes.data || [];
            if (dataset.length === 0) {
                alert('No hay registros de auditoría para exportar.');
                return;
            }

            const rows = dataset.map((l: AuditLog) => {
                const entityInfo = getEntityInfo(l.entity);
                return {
                    'ID Evento': l.id,
                    'Fecha y Hora': new Intl.DateTimeFormat('es-GT', { dateStyle: 'short', timeStyle: 'medium' }).format(new Date(l.created_at)),
                    'Usuario Responsable': l.user?.full_name || 'Sistema / Desconocido',
                    'Correo Usuario': l.user?.email || 'N/A',
                    'Rol Usuario': l.user?.role || 'N/A',
                    'Acción': l.action === 'LOGIN' ? 'INICIO SESIÓN' : l.action === 'POST' ? 'CREACIÓN' : l.action === 'PUT' ? 'EDICIÓN' : l.action === 'DELETE' ? 'ELIMINACIÓN' : l.action,
                    'Módulo / Entidad': entityInfo.label,
                    'ID Objeto': l.entity_id || 'N/A',
                    'Sede': l.branch?.name || (l.branch_id ? String(l.branch_id) : 'Global'),
                    'Dirección IP': l.ip_address || 'N/A',
                    'Endpoint URL': l.metadata?.url || 'N/A',
                    'Estado HTTP': l.metadata?.status || 'N/A',
                    'Dispositivo': l.metadata?.user_agent || 'N/A',
                    'Datos Nuevos (JSON)': l.new_data ? JSON.stringify(l.new_data) : '',
                    'Datos Anteriores (JSON)': l.old_data ? JSON.stringify(l.old_data) : ''
                };
            });

            const worksheet = XLSX.utils.json_to_sheet(rows);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Auditoría ULTEC');
            await saveWorkbook(workbook, `Registro_Auditoria_ULTEC_${new Date().toISOString().slice(0, 10)}.xlsx`);
        } catch (error) {
            console.error('Error exporting audit logs:', error);
            alert('Error al exportar los registros de auditoría.');
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div className="max-w-7xl mx-auto pb-14 animate-in fade-in duration-500">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div>
                    <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
                        <div className="p-2.5 bg-gradient-to-tr from-indigo-500 to-blue-600 rounded-2xl text-white shadow-md shadow-indigo-500/20">
                            <ShieldAlert className="w-7 h-7" />
                        </div>
                        Registro de Auditoría y Seguridad
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 mt-1.5 text-sm sm:text-base">
                        Trazabilidad exhaustiva de accesos, creaciones, modificaciones y eliminaciones para cumplimiento y gobernanza.
                    </p>
                </div>

                <div className="flex items-center gap-2.5 w-full sm:w-auto">
                    <button
                        onClick={() => refetch()}
                        disabled={isFetching}
                        title="Actualizar registro"
                        className="px-3.5 py-2.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/60 font-medium text-sm flex items-center gap-2 transition-all shadow-xs disabled:opacity-50"
                    >
                        <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin text-indigo-500' : ''}`} />
                        <span className="hidden sm:inline">Refrescar</span>
                    </button>

                    <button
                        onClick={handleExportExcel}
                        disabled={isExporting || isLoading}
                        className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl font-semibold text-sm flex items-center gap-2 transition-all shadow-md shadow-emerald-600/20 disabled:opacity-50"
                    >
                        {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                        <span>Exportar a Excel</span>
                    </button>
                </div>
            </div>

            {/* KPI Metric Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5 mb-6">
                <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs flex flex-col justify-between">
                    <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-semibold">
                        <span>Total Eventos</span>
                        <Activity className="w-4 h-4 text-indigo-500" />
                    </div>
                    <div className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
                        {stats?.total ?? meta.total ?? 0}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">Acciones registradas</div>
                </div>

                <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs flex flex-col justify-between">
                    <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-semibold">
                        <span>Inicios de Sesión</span>
                        <LogIn className="w-4 h-4 text-cyan-500" />
                    </div>
                    <div className="mt-2 text-2xl font-black text-cyan-600 dark:text-cyan-400">
                        {stats?.logins ?? 0}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">Autenticaciones OK</div>
                </div>

                <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs flex flex-col justify-between">
                    <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-semibold">
                        <span>Creaciones</span>
                        <PlusCircle className="w-4 h-4 text-emerald-500" />
                    </div>
                    <div className="mt-2 text-2xl font-black text-emerald-600 dark:text-emerald-400">
                        {stats?.creates ?? 0}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">Nuevos registros</div>
                </div>

                <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs flex flex-col justify-between">
                    <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-semibold">
                        <span>Modificaciones</span>
                        <Edit3 className="w-4 h-4 text-indigo-500" />
                    </div>
                    <div className="mt-2 text-2xl font-black text-indigo-600 dark:text-indigo-400">
                        {stats?.updates ?? 0}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">Ediciones realizadas</div>
                </div>

                <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs flex flex-col justify-between">
                    <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-semibold">
                        <span>Eliminaciones</span>
                        <Trash2 className="w-4 h-4 text-rose-500" />
                    </div>
                    <div className="mt-2 text-2xl font-black text-rose-600 dark:text-rose-400">
                        {stats?.deletes ?? 0}
                    </div>
                    <div className="text-[11px] text-rose-500/80 mt-0.5">Acciones destructivas</div>
                </div>

                <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs flex flex-col justify-between">
                    <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-semibold">
                        <span>Actividad Hoy</span>
                        <Calendar className="w-4 h-4 text-violet-500" />
                    </div>
                    <div className="mt-2 text-2xl font-black text-violet-600 dark:text-violet-400">
                        {stats?.today ?? 0}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">En las últimas 24h</div>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-2xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800/80 shadow-xs mb-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3.5">
                    {/* Search Term */}
                    <div className="lg:col-span-4 relative">
                        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar por usuario, correo, IP o ID..."
                            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400"
                            value={searchTerm}
                            onChange={(e) => {
                                setSearchTerm(e.target.value);
                                setPage(1);
                            }}
                        />
                    </div>

                    {/* Action Filter */}
                    <div className="lg:col-span-2 relative">
                        <select
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm text-slate-700 dark:text-slate-200"
                            value={filterAction}
                            onChange={(e) => {
                                setFilterAction(e.target.value);
                                setPage(1);
                            }}
                        >
                            <option value="ALL">Todas las acciones</option>
                            <option value="LOGIN">Acceso (LOGIN)</option>
                            <option value="POST">Creación (POST)</option>
                            <option value="PUT">Edición (PUT)</option>
                            <option value="PATCH">Parche (PATCH)</option>
                            <option value="DELETE">Eliminación (DELETE)</option>
                        </select>
                    </div>

                    {/* Entity Filter */}
                    <div className="lg:col-span-2 relative">
                        <select
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm text-slate-700 dark:text-slate-200"
                            value={filterEntity}
                            onChange={(e) => {
                                setFilterEntity(e.target.value);
                                setPage(1);
                            }}
                        >
                            <option value="ALL">Todos los módulos</option>
                            <option value="users">Usuarios</option>
                            <option value="auth">Autenticación</option>
                            <option value="students">Estudiantes</option>
                            <option value="payments">Pagos y Caja</option>
                            <option value="invoices">Facturas</option>
                            <option value="grades">Calificaciones</option>
                            <option value="subgrades">Tareas y Subnotas</option>
                            <option value="attendance">Asistencias</option>
                            <option value="assignments">Asignaciones</option>
                            <option value="branches">Sedes</option>
                            <option value="announcements">Circulares</option>
                            <option value="discipline">Disciplina</option>
                            <option value="merits">Méritos</option>
                            <option value="settings">Configuración</option>
                            <option value="parents">Vínculos Familiares</option>
                            <option value="promotions">Promociones</option>
                            <option value="courses">Cursos</option>
                            <option value="resources">Recursos</option>
                            <option value="notifications">Notificaciones</option>
                        </select>
                    </div>

                    {/* Date Start */}
                    <div className="lg:col-span-2 relative">
                        <input
                            type="date"
                            title="Fecha Desde"
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs sm:text-sm text-slate-700 dark:text-slate-200"
                            value={startDate}
                            onChange={(e) => {
                                setStartDate(e.target.value);
                                setPage(1);
                            }}
                        />
                    </div>

                    {/* Date End */}
                    <div className="lg:col-span-2 relative">
                        <input
                            type="date"
                            title="Fecha Hasta"
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs sm:text-sm text-slate-700 dark:text-slate-200"
                            value={endDate}
                            onChange={(e) => {
                                setEndDate(e.target.value);
                                setPage(1);
                            }}
                        />
                    </div>
                </div>

                {/* Sub-row with Branch Filter (SuperAdmin) and Reset button */}
                <div className="flex flex-wrap items-center justify-between gap-3 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/60">
                    <div className="flex items-center gap-3">
                        {isSuperAdmin && branches && branches.length > 0 && (
                            <div className="flex items-center gap-2">
                                <Building2 className="w-4 h-4 text-slate-400" />
                                <select
                                    className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                                    value={selectedBranch}
                                    onChange={(e) => {
                                        setSelectedBranch(e.target.value);
                                        setPage(1);
                                    }}
                                >
                                    <option value="all">Todas las Sedes</option>
                                    {branches.map((b: any) => (
                                        <option key={b.id} value={b.id}>{b.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {hasActiveFilters && (
                            <button
                                onClick={handleResetFilters}
                                className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-900/20 dark:hover:bg-rose-900/40 text-rose-600 dark:text-rose-400 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors"
                            >
                                <X className="w-3.5 h-3.5" />
                                Limpiar filtros
                            </button>
                        )}
                    </div>

                    <div className="text-xs text-slate-500 dark:text-slate-400">
                        {meta.total} registro{meta.total !== 1 ? 's' : ''} encontrado{meta.total !== 1 ? 's' : ''}
                    </div>
                </div>
            </div>

            {/* Main Content Table */}
            {isLoading ? (
                <div className="flex flex-col justify-center items-center py-24 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md rounded-2xl border border-slate-200 dark:border-slate-800">
                    <Loader2 className="w-10 h-10 animate-spin text-indigo-500 mb-3" />
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Cargando registros de auditoría...</p>
                </div>
            ) : isError ? (
                <div className="bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 p-6 rounded-2xl text-center border border-rose-200 dark:border-rose-900/50 shadow-xs">
                    <AlertCircle className="w-8 h-8 mx-auto mb-2 text-rose-500" />
                    <h4 className="font-bold text-base mb-1">Error al consultar el registro de auditoría</h4>
                    <p className="text-sm max-w-md mx-auto">
                        Verifica que tengas rol de Administrador o SuperAdmin y cuentes con conexión al servidor.
                    </p>
                </div>
            ) : logs && logs.length > 0 ? (
                <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/80 dark:bg-slate-800/50 border-b border-slate-200/80 dark:border-slate-800/80 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                    <th className="px-5 py-3.5">Fecha y Hora</th>
                                    <th className="px-5 py-3.5">Usuario Responsable</th>
                                    <th className="px-5 py-3.5 text-center">Acción</th>
                                    <th className="px-5 py-3.5">Módulo / Recurso</th>
                                    <th className="px-5 py-3.5">Dirección IP</th>
                                    <th className="px-5 py-3.5 text-right">Detalle</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                                {logs.map((log) => {
                                    const entityInfo = getEntityInfo(log.entity);
                                    const EntityIcon = entityInfo.icon;

                                    return (
                                        <tr
                                            key={log.id}
                                            className="hover:bg-indigo-50/30 dark:hover:bg-indigo-950/20 transition-colors group"
                                        >
                                            {/* Date / Time */}
                                            <td className="px-5 py-3.5 whitespace-nowrap">
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                                                        {new Intl.DateTimeFormat('es-GT', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(log.created_at))}
                                                    </span>
                                                    <span className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                                                        <Clock className="w-3 h-3" />
                                                        {formatRelativeTime(log.created_at)}
                                                    </span>
                                                </div>
                                            </td>

                                            {/* User Info */}
                                            <td className="px-5 py-3.5 whitespace-nowrap">
                                                <div className="flex items-center gap-2.5">
                                                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500/20 to-blue-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs uppercase border border-indigo-200 dark:border-indigo-800">
                                                        {(log.user?.full_name || 'U').charAt(0)}
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                                                                {log.user?.full_name || 'Sistema / Automatizado'}
                                                            </span>
                                                            {getRoleBadge(log.user?.role)}
                                                        </div>
                                                        <span className="text-[11px] text-slate-400">
                                                            {log.user?.email || 'Sin correo asociado'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Action */}
                                            <td className="px-5 py-3.5 whitespace-nowrap text-center">
                                                {getActionBadge(log.action)}
                                            </td>

                                            {/* Entity / Module */}
                                            <td className="px-5 py-3.5 whitespace-nowrap">
                                                <div className="flex items-center gap-2">
                                                    <div className={`p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 ${entityInfo.color}`}>
                                                        <EntityIcon className="w-4 h-4" />
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                                                            {entityInfo.label}
                                                        </span>
                                                        {log.entity_id && (
                                                            <span className="text-[11px] text-slate-400 font-mono">
                                                                ID: {log.entity_id.length > 18 ? `${log.entity_id.slice(0, 8)}...` : log.entity_id}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>

                                            {/* IP Address */}
                                            <td className="px-5 py-3.5 whitespace-nowrap">
                                                <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 font-mono">
                                                    <Globe className="w-3.5 h-3.5 text-slate-400" />
                                                    <span>{log.ip_address || '127.0.0.1'}</span>
                                                </div>
                                            </td>

                                            {/* View Detail Button */}
                                            <td className="px-5 py-3.5 whitespace-nowrap text-right">
                                                <button
                                                    onClick={() => {
                                                        setSelectedLog(log);
                                                        setIsDetailModalOpen(true);
                                                    }}
                                                    className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-colors shadow-2xs"
                                                >
                                                    <Eye className="w-3.5 h-3.5" />
                                                    <span>Detalle</span>
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination Controls */}
                    <div className="flex flex-col sm:flex-row items-center justify-between px-5 py-3.5 border-t border-slate-200/80 dark:border-slate-800/80 gap-3">
                        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                            <span>Mostrar</span>
                            <select
                                className="px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs outline-none focus:ring-1 focus:ring-indigo-500"
                                value={limit}
                                onChange={(e) => {
                                    setLimit(parseInt(e.target.value, 10));
                                    setPage(1);
                                }}
                            >
                                <option value={15}>15</option>
                                <option value={25}>25</option>
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                            </select>
                            <span>registros por página</span>
                        </div>

                        <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500 dark:text-slate-400 mr-2">
                                Página {meta.page} de {Math.max(1, meta.totalPages)}
                            </span>
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={meta.page <= 1}
                                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none transition-colors"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => setPage(p => Math.min(meta.totalPages, p + 1))}
                                disabled={meta.page >= meta.totalPages}
                                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none transition-colors"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-2xl border border-slate-200/80 dark:border-slate-800/80 p-12 text-center flex flex-col items-center justify-center shadow-xs">
                    <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-400 flex items-center justify-center mb-3">
                        <ShieldAlert className="w-8 h-8" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-1">
                        No se encontraron registros de auditoría
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md">
                        {hasActiveFilters
                            ? 'No hay registros que coincidan con los filtros y fechas seleccionados.'
                            : 'El registro de auditoría está vacío. Las acciones de los usuarios comenzarán a registrarse aquí.'}
                    </p>
                    {hasActiveFilters && (
                        <button
                            onClick={handleResetFilters}
                            className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-700 transition-colors shadow-xs"
                        >
                            Restablecer todos los filtros
                        </button>
                    )}
                </div>
            )}

            {/* Modal: Full Audit Log Detail */}
            {isDetailModalOpen && selectedLog && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40">
                            <div className="flex items-center gap-3">
                                {getActionBadge(selectedLog.action)}
                                <div>
                                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                                        Detalle del Registro #{selectedLog.id}
                                    </h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        Módulo {getEntityInfo(selectedLog.entity).label}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsDetailModalOpen(false)}
                                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 overflow-y-auto space-y-5">
                            {/* Summary Grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                {/* User Info Card */}
                                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200/60 dark:border-slate-700/60">
                                    <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                                        <User className="w-3.5 h-3.5 text-indigo-500" />
                                        Usuario Responsable
                                    </div>
                                    <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                                        {selectedLog.user?.full_name || 'Sistema / Anonimo'}
                                    </p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                        {selectedLog.user?.email || 'N/A'}
                                    </p>
                                    <div className="mt-2 flex items-center gap-2">
                                        {getRoleBadge(selectedLog.user?.role)}
                                        {selectedLog.branch && (
                                            <span className="text-[11px] text-slate-500 font-medium">
                                                • Sede: {selectedLog.branch.name}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Network & Date Card */}
                                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200/60 dark:border-slate-700/60">
                                    <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                                        <Globe className="w-3.5 h-3.5 text-cyan-500" />
                                        Contexto de Red
                                    </div>
                                    <div className="flex items-center justify-between text-xs py-0.5">
                                        <span className="text-slate-500">Dirección IP:</span>
                                        <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                                            {selectedLog.ip_address || '127.0.0.1'}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between text-xs py-0.5">
                                        <span className="text-slate-500">Fecha exacta:</span>
                                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                                            {new Intl.DateTimeFormat('es-GT', { dateStyle: 'short', timeStyle: 'medium' }).format(new Date(selectedLog.created_at))}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between text-xs py-0.5">
                                        <span className="text-slate-500">ID Entidad:</span>
                                        <span className="font-mono text-[11px] text-slate-600 dark:text-slate-300">
                                            {selectedLog.entity_id || 'N/A'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Technical Metadata */}
                            {selectedLog.metadata && (
                                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 text-xs">
                                    <div className="flex items-center gap-2 font-bold text-slate-500 uppercase tracking-wider mb-2">
                                        <Laptop className="w-3.5 h-3.5 text-indigo-500" />
                                        Información Técnica de la Petición
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-600 dark:text-slate-300">
                                        {selectedLog.metadata.url && (
                                            <div>
                                                <span className="text-slate-400 font-medium">Endpoint URL: </span>
                                                <span className="font-mono text-[11px] bg-slate-200/60 dark:bg-slate-700/60 px-1.5 py-0.5 rounded">
                                                    {selectedLog.metadata.url}
                                                </span>
                                            </div>
                                        )}
                                        {selectedLog.metadata.status && (
                                            <div>
                                                <span className="text-slate-400 font-medium">Estado HTTP: </span>
                                                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                                    {selectedLog.metadata.status} OK
                                                </span>
                                            </div>
                                        )}
                                        {selectedLog.metadata.user_agent && (
                                            <div className="sm:col-span-2 truncate" title={selectedLog.metadata.user_agent}>
                                                <span className="text-slate-400 font-medium">Dispositivo / Agente: </span>
                                                <span className="text-[11px]">{selectedLog.metadata.user_agent}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Payload: new_data */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                                        <Database className="w-3.5 h-3.5 text-emerald-500" />
                                        Datos Guardados / Modificados (`new_data`)
                                    </span>
                                    {selectedLog.new_data && (
                                        <button
                                            onClick={() => handleCopyJson(selectedLog.new_data)}
                                            className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                                        >
                                            {copiedData ? (
                                                <>
                                                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                                                    <span className="text-emerald-500 font-semibold">¡Copiado!</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Copy className="w-3.5 h-3.5" />
                                                    <span>Copiar JSON</span>
                                                </>
                                            )}
                                        </button>
                                    )}
                                </div>

                                <div className="p-4 bg-slate-950 text-slate-100 rounded-2xl font-mono text-xs overflow-x-auto max-h-60 border border-slate-800">
                                    {selectedLog.new_data ? (
                                        <pre className="whitespace-pre-wrap leading-relaxed">
                                            {JSON.stringify(selectedLog.new_data, null, 2)}
                                        </pre>
                                    ) : (
                                        <span className="text-slate-500 italic">No hay contenido de cuerpo adicional registrado (Acción DELETE o sin payload).</span>
                                    )}
                                </div>
                            </div>

                            {/* Payload: old_data (if available) */}
                            {selectedLog.old_data && (
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                                            <Database className="w-3.5 h-3.5 text-rose-500" />
                                            Datos Anteriores (`old_data`)
                                        </span>
                                    </div>
                                    <div className="p-4 bg-slate-950 text-slate-100 rounded-2xl font-mono text-xs overflow-x-auto max-h-48 border border-slate-800">
                                        <pre className="whitespace-pre-wrap leading-relaxed">
                                            {JSON.stringify(selectedLog.old_data, null, 2)}
                                        </pre>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="px-6 py-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 flex justify-end">
                            <button
                                onClick={() => setIsDetailModalOpen(false)}
                                className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white dark:bg-slate-700 dark:hover:bg-slate-600 rounded-xl text-xs font-bold transition-colors"
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AuditLogs;
