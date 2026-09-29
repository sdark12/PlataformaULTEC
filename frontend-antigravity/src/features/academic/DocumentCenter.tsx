import { useState } from 'react';
import { getCurrentUser } from '../../features/auth/authService';
import { 
    FileBadge, 
    FileText, 
    ShieldCheck, 
    Clock, 
    CheckCircle2, 
    XCircle, 
    Search, 
    Check, 
    X, 
    Loader2, 
    Eye,
    UserX,
    Scroll,
    User,
    GraduationCap
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getAllDocumentAuthorizations, updateDocumentAuthorization } from './gradeService';
import ReportCard from './ReportCard';
import Certificates from './Certificates';

const DocumentCenter = () => {
    const user = getCurrentUser();
    const role = user?.role;
    const canSeeCertificates = ['admin', 'superadmin', 'secretary'].includes(role || '');
    const isAdmin = ['admin', 'superadmin'].includes(role || '');
    const [activeTab, setActiveTab] = useState<'boletas' | 'constancias' | 'solicitudes'>('boletas');
    const [targetStudentId, setTargetStudentId] = useState<string | null>(null);

    // Filter & search states for authorizations tab
    const [authSearch, setAuthSearch] = useState('');
    const [authFilter, setAuthFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'DELIVERED' | 'REJECTED' | 'CONSUMED'>('ALL');
    const [authTypeFilter, setAuthTypeFilter] = useState<'ALL' | 'STUDENT_DELETION' | 'COURSE_ACTA' | 'REPORT_CARD' | 'GRADES_CERTIFICATE'>('ALL');
    const [processingId, setProcessingId] = useState<number | null>(null);

    const queryClient = useQueryClient();

    // Query authorizations for staff
    const { data: authorizations = [], isLoading: loadingAuths } = useQuery({
        queryKey: ['all-doc-authorizations'],
        queryFn: () => getAllDocumentAuthorizations(),
        enabled: canSeeCertificates,
        refetchInterval: 12000 // periodic background polling for fresh updates
    });

    const pendingCount = authorizations.filter(a => a.status === 'PENDING').length;
    const approvedCount = authorizations.filter(a => a.status === 'APPROVED').length;
    const deliveredCount = authorizations.filter(a => a.status === 'DELIVERED').length;
    const rejectedCount = authorizations.filter(a => a.status === 'REJECTED').length;

    const handleUpdateStatus = async (id: number, newStatus: 'APPROVED' | 'REJECTED', docType?: string, targetName?: string) => {
        if (!isAdmin) return;
        if (docType === 'STUDENT_DELETION' && newStatus === 'APPROVED') {
            const confirmed = window.confirm(`⚠️ ¿Está seguro de APROBAR la baja definitiva y ELIMINAR al estudiante "${targetName || 'seleccionado'}"?\n\nEsta acción borrará de forma permanente al estudiante del sistema.`);
            if (!confirmed) return;
        }
        setProcessingId(id);
        try {
            await updateDocumentAuthorization(id, newStatus);
            await queryClient.invalidateQueries({ queryKey: ['all-doc-authorizations'] });
            await queryClient.invalidateQueries({ queryKey: ['report_auth_status'] });
            await queryClient.invalidateQueries({ queryKey: ['students'] });
            await queryClient.invalidateQueries({ queryKey: ['course_acta_auth'] });
        } catch (err: any) {
            console.error('Error al actualizar autorización:', err);
            alert(err?.response?.data?.error || err?.response?.data?.message || 'Error al actualizar estado de la autorización');
        } finally {
            setProcessingId(null);
        }
    };

    const handleMarkDelivered = async (id: number) => {
        if (!isAdmin && !['secretary'].includes(role || '')) {
            alert('No tienes permisos para registrar la entrega.');
            return;
        }
        if (!window.confirm('¿Confirmas que el estudiante o tutor ha recibido físicamente la boleta oficial sellada en las oficinas del plantel?')) {
            return;
        }
        setProcessingId(id);
        try {
            await updateDocumentAuthorization(id, 'DELIVERED', 'Entrega física completada en oficinas del plantel');
            await queryClient.invalidateQueries({ queryKey: ['all-doc-authorizations'] });
            await queryClient.invalidateQueries({ queryKey: ['report_auth_status'] });
            alert('¡Entrega física registrada exitosamente! El trámite se actualizó a "Entregada".');
        } catch (err: any) {
            alert(`Error al registrar la entrega: ${err?.message || 'Error desconocido'}`);
        } finally {
            setProcessingId(null);
        }
    };

    const handleViewStudentReport = (studentId: string) => {
        setTargetStudentId(studentId);
        setActiveTab('boletas');
    };

    // Filtered authorizations list
    const filteredAuths = authorizations.filter(a => {
        if (authFilter !== 'ALL' && a.status !== authFilter) return false;
        if (authTypeFilter !== 'ALL' && a.document_type !== authTypeFilter) return false;
        if (authSearch.trim()) {
            const query = authSearch.toLowerCase();
            const matchName = a.student_name?.toLowerCase().includes(query);
            const matchCourse = a.course_name?.toLowerCase().includes(query);
            const matchRequester = a.requester_name?.toLowerCase().includes(query);
            const matchCode = a.personal_code?.toLowerCase().includes(query);
            const matchDoc = a.identification_document?.toLowerCase().includes(query);
            const matchReason = a.reason?.toLowerCase().includes(query);
            if (!matchName && !matchCourse && !matchRequester && !matchCode && !matchDoc && !matchReason) return false;
        }
        return true;
    });

    const getDocTypeBadge = (type: string) => {
        switch (type) {
            case 'STUDENT_DELETION':
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/25">
                        <UserX className="w-3 h-3 text-rose-500 shrink-0" />
                        Baja Estudiante
                    </span>
                );
            case 'COURSE_ACTA':
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-500/25">
                        <Scroll className="w-3 h-3 text-indigo-500 shrink-0" />
                        Acta de Curso
                    </span>
                );
            case 'GRADES_CERTIFICATE':
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-500/25">
                        <GraduationCap className="w-3 h-3 text-purple-500 shrink-0" />
                        Constancia de Notas
                    </span>
                );
            case 'REPORT_CARD':
            default:
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/25">
                        <FileText className="w-3 h-3 text-blue-500 shrink-0" />
                        Boleta Oficial
                    </span>
                );
        }
    };

    // If student, they only see Boletas
    if (!canSeeCertificates) {
        return <ReportCard />;
    }

    return (
        <div className="max-w-7xl mx-auto pb-36 sm:pb-16 px-3 sm:px-6 lg:px-8 animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8 print:hidden pt-2">
                <div className="flex items-center gap-3.5">
                    <div className="p-3 bg-gradient-to-tr from-brand-blue/15 to-purple-600/15 border border-brand-blue/20 rounded-2xl shadow-sm shrink-0">
                        <FileBadge className="h-6 w-6 sm:h-7 sm:w-7 text-brand-blue dark:text-blue-400" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                                Centro de Documentos
                            </h1>
                            <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-brand-blue/10 dark:bg-brand-blue/20 text-brand-blue dark:text-blue-400 border border-brand-blue/20">
                                OFICIAL
                            </span>
                        </div>
                        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                            Gestión y emisión segura de boletas consolidadas, constancias y autorizaciones de descarga.
                        </p>
                    </div>
                </div>

                {/* Quick pending badge for desktop/PC */}
                {pendingCount > 0 && (
                    <button
                        onClick={() => setActiveTab('solicitudes')}
                        className="hidden sm:flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-700 dark:text-amber-400 text-xs font-bold hover:bg-amber-500/20 transition-all shadow-sm"
                    >
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                        </span>
                        <span>{pendingCount} solicitud(es) pendiente(s) de autorización</span>
                    </button>
                )}
            </div>

            {/* Segmented Switcher for Tabs */}
            <div className="p-1.5 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 mb-6 sm:mb-8 max-w-2xl grid grid-cols-3 gap-1.5 shadow-inner print:hidden">
                <button
                    onClick={() => setActiveTab('boletas')}
                    className={`flex items-center justify-center gap-1.5 sm:gap-2 py-2.5 sm:py-3 px-2 sm:px-4 rounded-xl font-bold text-xs sm:text-sm transition-all duration-200 active:scale-[0.98] ${
                        activeTab === 'boletas'
                            ? 'bg-white dark:bg-slate-900 text-brand-blue dark:text-blue-400 shadow-sm border border-slate-200/60 dark:border-slate-700/60'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                >
                    <FileText className="w-4 h-4 shrink-0" />
                    <span className="truncate">Boletas</span>
                </button>
                <button
                    onClick={() => setActiveTab('constancias')}
                    className={`flex items-center justify-center gap-1.5 sm:gap-2 py-2.5 sm:py-3 px-2 sm:px-4 rounded-xl font-bold text-xs sm:text-sm transition-all duration-200 active:scale-[0.98] ${
                        activeTab === 'constancias'
                            ? 'bg-white dark:bg-slate-900 text-brand-blue dark:text-blue-400 shadow-sm border border-slate-200/60 dark:border-slate-700/60'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                >
                    <FileBadge className="w-4 h-4 shrink-0" />
                    <span className="truncate">Constancias</span>
                </button>
                <button
                    onClick={() => setActiveTab('solicitudes')}
                    className={`flex items-center justify-center gap-1.5 sm:gap-2 py-2.5 sm:py-3 px-2 sm:px-4 rounded-xl font-bold text-xs sm:text-sm transition-all duration-200 active:scale-[0.98] relative ${
                        activeTab === 'solicitudes'
                            ? 'bg-white dark:bg-slate-900 text-brand-blue dark:text-blue-400 shadow-sm border border-slate-200/60 dark:border-slate-700/60'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                >
                    <ShieldCheck className="w-4 h-4 shrink-0" />
                    <span className="truncate">Solicitudes</span>
                    {pendingCount > 0 && (
                        <span className="px-1.5 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-black shrink-0">
                            {pendingCount}
                        </span>
                    )}
                </button>
            </div>

            {/* Tab Views */}
            <div className={activeTab === 'boletas' ? 'block' : 'hidden'}>
                <ReportCard isEmbedded={true} initialStudentId={targetStudentId} />
            </div>
            
            <div className={activeTab === 'constancias' ? 'block' : 'hidden'}>
                <Certificates isEmbedded={true} />
            </div>

            {/* Solicitudes de Autorización Tab */}
            {activeTab === 'solicitudes' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                    {/* Metrics Summary Strip */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 shadow-sm">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total</span>
                                <FileText className="w-4 h-4 text-slate-400" />
                            </div>
                            <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                                {authorizations.length}
                            </div>
                            <span className="text-[11px] text-slate-400">Solicitudes registradas</span>
                        </div>

                        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 shadow-sm">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wider">Pendientes</span>
                                <Clock className="w-4 h-4 text-amber-500" />
                            </div>
                            <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
                                {pendingCount}
                            </div>
                            <span className="text-[11px] text-amber-700/80 dark:text-amber-300/80">Requieren respuesta</span>
                        </div>

                        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 shadow-sm">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">Aprobadas</span>
                                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            </div>
                            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                                {approvedCount}
                            </div>
                            <span className="text-[11px] text-emerald-700/80 dark:text-emerald-300/80">Descarga autorizada</span>
                        </div>

                        <div className="p-4 rounded-2xl bg-teal-500/10 border border-teal-500/20 shadow-sm">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-teal-700 dark:text-teal-300 uppercase tracking-wider">Entregadas</span>
                                <Check className="w-4 h-4 text-teal-500" />
                            </div>
                            <div className="text-2xl font-black text-teal-600 dark:text-teal-400 mt-1">
                                {deliveredCount}
                            </div>
                            <span className="text-[11px] text-teal-700/80 dark:text-teal-300/80">Recogidas en plantel</span>
                        </div>

                        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 shadow-sm col-span-2 sm:col-span-1">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-rose-700 dark:text-rose-300 uppercase tracking-wider">Rechazadas</span>
                                <XCircle className="w-4 h-4 text-rose-500" />
                            </div>
                            <div className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">
                                {rejectedCount}
                            </div>
                            <span className="text-[11px] text-rose-700/80 dark:text-rose-300/80">No autorizadas</span>
                        </div>
                    </div>

                    {/* Filter & Search Bar */}
                    <div className="bg-white dark:bg-slate-900/90 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col gap-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            {/* Search Input */}
                            <div className="relative flex-1">
                                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                <input
                                    type="text"
                                    className="w-full pl-10 pr-9 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white rounded-xl focus:ring-4 focus:ring-brand-blue/10 focus:border-brand-blue outline-none text-xs sm:text-sm font-medium transition-all"
                                    placeholder="Buscar por estudiante, curso, solicitante o motivo..."
                                    value={authSearch}
                                    onChange={(e) => setAuthSearch(e.target.value)}
                                />
                                {authSearch && (
                                    <button
                                        onClick={() => setAuthSearch('')}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>

                            {/* Status Filter Chips */}
                            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
                                {(['ALL', 'PENDING', 'APPROVED', 'DELIVERED', 'REJECTED', 'CONSUMED'] as const).map((status) => {
                                    const labels: Record<string, string> = {
                                        ALL: 'Todas',
                                        PENDING: 'Pendientes',
                                        APPROVED: 'Aprobadas',
                                        DELIVERED: 'Entregadas',
                                        REJECTED: 'Rechazadas',
                                        CONSUMED: 'Finalizadas'
                                    };
                                    const isSelected = authFilter === status;
                                    return (
                                        <button
                                            key={status}
                                            onClick={() => setAuthFilter(status)}
                                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                                                isSelected
                                                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm'
                                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                                            }`}
                                        >
                                            {labels[status]}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Type Filter Chips */}
                        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-2 border-t border-slate-100 dark:border-slate-800/60">
                            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1 shrink-0">Tipo:</span>
                            {[
                                { key: 'ALL', label: 'Todos los tipos' },
                                { key: 'STUDENT_DELETION', label: '⚠️ Bajas de Estudiante' },
                                { key: 'COURSE_ACTA', label: '📑 Actas Oficiales' },
                                { key: 'REPORT_CARD', label: '📄 Boletas de Notas' },
                                { key: 'GRADES_CERTIFICATE', label: '🎓 Constancias de Notas' }
                            ].map(t => (
                                <button
                                    key={t.key}
                                    onClick={() => setAuthTypeFilter(t.key as any)}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                                        authTypeFilter === t.key
                                            ? 'bg-brand-blue/15 text-brand-blue dark:text-blue-400 border border-brand-blue/30 font-bold'
                                            : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                                    }`}
                                >
                                    {t.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Table View for PC / Large Screens */}
                    <div className="hidden md:block bg-white dark:bg-slate-900/90 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-[11px] font-black uppercase text-slate-400 tracking-wider">
                                    <tr>
                                        <th className="py-3.5 px-4">Tipo</th>
                                        <th className="py-3.5 px-4">Destinatario / Registro</th>
                                        <th className="py-3.5 px-4">Solicitado Por</th>
                                        <th className="py-3.5 px-4">Motivo / Justificación</th>
                                        <th className="py-3.5 px-4">Fecha</th>
                                        <th className="py-3.5 px-4">Estado</th>
                                        <th className="py-3.5 px-4 text-right">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                                    {loadingAuths ? (
                                        <tr>
                                            <td colSpan={7} className="py-12 text-center text-slate-500">
                                                <Loader2 className="w-6 h-6 animate-spin mx-auto text-brand-blue mb-2" />
                                                <span>Cargando solicitudes de autorización...</span>
                                            </td>
                                        </tr>
                                    ) : filteredAuths.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="py-12 text-center text-slate-400 text-sm">
                                                No se encontraron solicitudes que coincidan con los filtros.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredAuths.map((req) => (
                                            <tr key={req.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                                                <td className="py-3.5 px-4 whitespace-nowrap">
                                                    {getDocTypeBadge(req.document_type)}
                                                </td>
                                                <td className="py-3.5 px-4">
                                                    {req.document_type === 'COURSE_ACTA' ? (
                                                        <div className="flex items-center gap-2.5">
                                                            <div className="w-8 h-8 rounded-lg bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 font-black text-xs flex items-center justify-center shrink-0">
                                                                <Scroll className="w-4 h-4" />
                                                            </div>
                                                            <div>
                                                                <div className="font-bold text-slate-900 dark:text-white">
                                                                    {req.course_name || req.student_name || 'Curso'}
                                                                </div>
                                                                <div className="text-[11px] text-slate-400 font-mono">
                                                                    ID: {req.student_id.substring(0, 8).toUpperCase()}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-2.5">
                                                            <div className={`w-8 h-8 rounded-full font-black text-xs flex items-center justify-center shrink-0 ${
                                                                req.document_type === 'STUDENT_DELETION'
                                                                    ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                                                                    : 'bg-brand-blue/15 text-brand-blue'
                                                            }`}>
                                                                {req.student_name?.charAt(0)?.toUpperCase() || 'E'}
                                                            </div>
                                                            <div>
                                                                <div className="font-bold text-slate-900 dark:text-white">
                                                                    {req.student_name || 'Estudiante'}
                                                                </div>
                                                                <div className="text-[11px] text-slate-400">
                                                                    DPI: {req.identification_document || 'Sin DPI'} • Cód: {req.personal_code || 'N/A'}
                                                                </div>
                                                                {req.document_type === 'REPORT_CARD' && (
                                                                    <div className="mt-1">
                                                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300">
                                                                            📄 {req.cycle_name || req.course_name || 'Boleta General / Consolidada'}
                                                                        </span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="py-3.5 px-4 text-xs text-slate-700 dark:text-slate-300 whitespace-nowrap">
                                                    <div className="flex items-center gap-1.5 font-medium">
                                                        <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                                        <span className="truncate max-w-[130px]">{req.requester_name || 'Personal ULTEC'}</span>
                                                    </div>
                                                </td>
                                                <td className="py-3.5 px-4 text-xs text-slate-600 dark:text-slate-300 max-w-xs">
                                                    <p className="line-clamp-2" title={req.reason}>
                                                        {req.reason || 'Sin justificación registrada'}
                                                    </p>
                                                </td>
                                                <td className="py-3.5 px-4 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                                                    {req.requested_at ? new Date(req.requested_at).toLocaleDateString('es-GT', {
                                                        day: '2-digit',
                                                        month: 'short',
                                                        year: 'numeric',
                                                        hour: '2-digit',
                                                        minute: '2-digit'
                                                    }) : 'N/A'}
                                                </td>
                                                <td className="py-3.5 px-4 whitespace-nowrap">
                                                    {req.status === 'DELIVERED' ? (
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20">
                                                            <Check className="w-3 h-3" />
                                                            Entregada
                                                        </span>
                                                    ) : req.status === 'APPROVED' ? (
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                                            <Check className="w-3 h-3" />
                                                            Aprobada
                                                        </span>
                                                    ) : req.status === 'REJECTED' ? (
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                                                            <X className="w-3 h-3" />
                                                            Rechazada
                                                        </span>
                                                    ) : req.status === 'CONSUMED' ? (
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20">
                                                            <Check className="w-3 h-3" />
                                                            Finalizada
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                                            <Clock className="w-3 h-3" />
                                                            Pendiente
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="py-3.5 px-4 text-right whitespace-nowrap">
                                                    <div className="flex items-center justify-end gap-1.5 flex-wrap">
                                                        {/* Staff delivery button for both Admin and Secretary */}
                                                        {(req.status === 'APPROVED' || req.status === 'CONSUMED') && req.document_type !== 'STUDENT_DELETION' && (
                                                            <button
                                                                onClick={() => handleMarkDelivered(req.id)}
                                                                disabled={processingId === req.id}
                                                                className="px-2.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-lg text-xs flex items-center gap-1 transition-all shadow-sm active:scale-95 disabled:opacity-50"
                                                                title="Registrar que el estudiante ya recogió físicamente el documento en oficinas"
                                                            >
                                                                {processingId === req.id ? (
                                                                    <Loader2 className="w-3 h-3 animate-spin" />
                                                                ) : (
                                                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                                                )}
                                                                <span>Registrar Entrega</span>
                                                            </button>
                                                        )}

                                                        {req.status === 'DELIVERED' && (
                                                            <span className="px-2 py-1 bg-teal-100 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 font-bold text-xs rounded-lg flex items-center gap-1">
                                                                <Check className="w-3.5 h-3.5" />
                                                                <span>Entregada</span>
                                                            </span>
                                                        )}

                                                        {isAdmin ? (
                                                            <>
                                                                {req.status === 'PENDING' && (
                                                                    <>
                                                                        {req.document_type === 'STUDENT_DELETION' ? (
                                                                            <button
                                                                                onClick={() => handleUpdateStatus(req.id, 'APPROVED', req.document_type, req.student_name)}
                                                                                disabled={processingId === req.id}
                                                                                className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-xs flex items-center gap-1 transition-all shadow-sm active:scale-95 disabled:opacity-50"
                                                                                title="Aprobar solicitud y eliminar definitivamente al estudiante"
                                                                            >
                                                                                {processingId === req.id ? (
                                                                                    <Loader2 className="w-3 h-3 animate-spin" />
                                                                                ) : (
                                                                                    <UserX className="w-3 h-3" />
                                                                                )}
                                                                                <span>Aprobar y Eliminar</span>
                                                                            </button>
                                                                        ) : (
                                                                            <button
                                                                                onClick={() => handleUpdateStatus(req.id, 'APPROVED', req.document_type, req.student_name)}
                                                                                disabled={processingId === req.id}
                                                                                className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs flex items-center gap-1 transition-all shadow-sm active:scale-95 disabled:opacity-50"
                                                                                title="Aprobar descarga de documento oficial"
                                                                            >
                                                                                {processingId === req.id ? (
                                                                                    <Loader2 className="w-3 h-3 animate-spin" />
                                                                                ) : (
                                                                                    <Check className="w-3 h-3" />
                                                                                )}
                                                                                <span>Aprobar</span>
                                                                            </button>
                                                                        )}
                                                                        <button
                                                                            onClick={() => handleUpdateStatus(req.id, 'REJECTED', req.document_type, req.student_name)}
                                                                            disabled={processingId === req.id}
                                                                            className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-900/20 dark:hover:bg-rose-900/30 text-rose-600 dark:text-rose-400 font-bold rounded-lg text-xs flex items-center gap-1 transition-all active:scale-95 disabled:opacity-50"
                                                                            title="Rechazar solicitud"
                                                                        >
                                                                            <X className="w-3 h-3" />
                                                                            <span>Rechazar</span>
                                                                        </button>
                                                                    </>
                                                                )}
                                                                {req.status === 'APPROVED' && req.document_type !== 'STUDENT_DELETION' && (
                                                                    <button
                                                                        onClick={() => handleUpdateStatus(req.id, 'REJECTED', req.document_type, req.student_name)}
                                                                        disabled={processingId === req.id}
                                                                        className="px-2 py-1 text-xs text-rose-500 hover:text-rose-700 hover:underline font-bold"
                                                                        title="Revocar acceso de descarga"
                                                                    >
                                                                        Revocar
                                                                    </button>
                                                                )}
                                                                {req.status === 'CONSUMED' && req.document_type !== 'STUDENT_DELETION' && (
                                                                    <>
                                                                        <button
                                                                            onClick={() => handleUpdateStatus(req.id, 'APPROVED', req.document_type, req.student_name)}
                                                                            disabled={processingId === req.id}
                                                                            className="px-2 py-1 text-xs text-emerald-600 hover:text-emerald-700 hover:underline font-bold"
                                                                            title="Reactivar autorización de descarga"
                                                                        >
                                                                            Reactivar
                                                                        </button>
                                                                        <button
                                                                            onClick={() => handleUpdateStatus(req.id, 'REJECTED', req.document_type, req.student_name)}
                                                                            disabled={processingId === req.id}
                                                                            className="px-2 py-1 text-xs text-rose-500 hover:text-rose-700 hover:underline font-bold"
                                                                            title="Rechazar trámite"
                                                                        >
                                                                            Rechazar
                                                                        </button>
                                                                    </>
                                                                )}
                                                                {req.status === 'REJECTED' && req.document_type !== 'STUDENT_DELETION' && (
                                                                    <button
                                                                        onClick={() => handleUpdateStatus(req.id, 'APPROVED', req.document_type, req.student_name)}
                                                                        disabled={processingId === req.id}
                                                                        className="px-2 py-1 text-xs text-emerald-600 hover:text-emerald-700 hover:underline font-bold"
                                                                        title="Aprobar autorización"
                                                                    >
                                                                        Aprobar
                                                                    </button>
                                                                )}

                                                                {req.document_type === 'REPORT_CARD' && (
                                                                    <button
                                                                        onClick={() => handleViewStudentReport(req.student_id)}
                                                                        className="p-1.5 text-slate-500 hover:text-brand-blue dark:hover:text-blue-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                                                        title="Ver boleta del estudiante"
                                                                    >
                                                                        <Eye className="w-4 h-4" />
                                                                    </button>
                                                                )}
                                                            </>
                                                        ) : (
                                                            <div className="text-right flex items-center gap-1.5">
                                                                {req.status === 'PENDING' && (
                                                                    <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400">
                                                                        En revisión por Dirección
                                                                    </span>
                                                                )}
                                                                {req.status === 'APPROVED' && req.document_type !== 'REPORT_CARD' && (
                                                                    <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                                                                        {req.document_type === 'STUDENT_DELETION' ? 'Baja aprobada' : 'Descarga autorizada'}
                                                                    </span>
                                                                )}
                                                                {req.status === 'REJECTED' && (
                                                                    <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400">
                                                                        Solicitud rechazada
                                                                    </span>
                                                                )}
                                                                {req.document_type === 'REPORT_CARD' && (
                                                                    <button
                                                                        onClick={() => handleViewStudentReport(req.student_id)}
                                                                        className="p-1.5 text-slate-500 hover:text-brand-blue dark:hover:text-blue-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ml-1"
                                                                        title="Ver boleta del estudiante"
                                                                    >
                                                                        <Eye className="w-4 h-4" />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Card View for Mobile / Compact Screens */}
                    <div className="md:hidden space-y-3">
                        {loadingAuths ? (
                            <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-500">
                                <Loader2 className="w-6 h-6 animate-spin mx-auto text-brand-blue mb-2" />
                                <span>Cargando solicitudes...</span>
                            </div>
                        ) : filteredAuths.length === 0 ? (
                            <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-400 text-sm">
                                No se encontraron solicitudes.
                            </div>
                        ) : (
                            filteredAuths.map((req) => (
                                <div 
                                    key={req.id}
                                    className="p-4 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3"
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                            {getDocTypeBadge(req.document_type)}
                                        </div>

                                        {req.status === 'DELIVERED' ? (
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-500/10 text-teal-600 border border-teal-500/20 shrink-0">
                                                Entregada
                                            </span>
                                        ) : req.status === 'APPROVED' ? (
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 shrink-0">
                                                Aprobada
                                            </span>
                                        ) : req.status === 'REJECTED' ? (
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 border border-rose-500/20 shrink-0">
                                                Rechazada
                                            </span>
                                        ) : req.status === 'CONSUMED' ? (
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-500/10 text-slate-600 border border-slate-500/20 shrink-0">
                                                Finalizada
                                            </span>
                                        ) : (
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20 shrink-0">
                                                Pendiente
                                            </span>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-3">
                                        {req.document_type === 'COURSE_ACTA' ? (
                                            <div className="w-9 h-9 rounded-xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 font-black text-sm flex items-center justify-center shrink-0">
                                                <Scroll className="w-4 h-4" />
                                            </div>
                                        ) : (
                                            <div className={`w-9 h-9 rounded-full font-black text-sm flex items-center justify-center shrink-0 ${
                                                req.document_type === 'STUDENT_DELETION'
                                                    ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                                                    : 'bg-brand-blue/15 text-brand-blue'
                                            }`}>
                                                {req.student_name?.charAt(0)?.toUpperCase() || 'E'}
                                            </div>
                                        )}
                                        <div>
                                            <div className="font-bold text-slate-900 dark:text-white text-sm">
                                                {req.document_type === 'COURSE_ACTA' ? (req.course_name || req.student_name || 'Curso') : (req.student_name || 'Estudiante')}
                                            </div>
                                            <div className="text-[11px] text-slate-400">
                                                {req.document_type === 'COURSE_ACTA' ? (
                                                    <span>Curso ID: {req.student_id.substring(0, 8).toUpperCase()}</span>
                                                ) : (
                                                    <span>DPI: {req.identification_document || 'N/A'} • Cód: {req.personal_code || 'N/A'}</span>
                                                )}
                                            </div>
                                            {req.document_type === 'REPORT_CARD' && (
                                                <div className="mt-1">
                                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300">
                                                        📄 {req.cycle_name || req.course_name || 'Boleta General / Consolidada'}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {req.requester_name && (
                                        <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                                            <User className="w-3.5 h-3.5 text-slate-400" />
                                            <span>Solicitado por: <strong>{req.requester_name}</strong></span>
                                        </div>
                                    )}

                                    {req.reason && (
                                        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300">
                                            <span className="font-bold text-slate-400 block text-[10px] uppercase">Motivo</span>
                                            {req.reason}
                                        </div>
                                    )}

                                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/60 text-xs">
                                        <span className="text-[11px] text-slate-400">
                                            {req.requested_at ? new Date(req.requested_at).toLocaleDateString('es-GT', {
                                                day: '2-digit',
                                                month: 'short'
                                            }) : ''}
                                        </span>

                                        <div className="flex items-center gap-1.5 flex-wrap justify-end">
                                            {/* Staff delivery button */}
                                            {(req.status === 'APPROVED' || req.status === 'CONSUMED') && req.document_type !== 'STUDENT_DELETION' && (
                                                <button
                                                    onClick={() => handleMarkDelivered(req.id)}
                                                    disabled={processingId === req.id}
                                                    className="px-2.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-lg text-xs flex items-center gap-1 shadow-sm active:scale-95 disabled:opacity-50"
                                                    title="Registrar que el estudiante ya recogió físicamente el documento en oficinas"
                                                >
                                                    {processingId === req.id ? (
                                                        <Loader2 className="w-3 h-3 animate-spin" />
                                                    ) : (
                                                        <CheckCircle2 className="w-3 h-3" />
                                                    )}
                                                    <span>Registrar Entrega</span>
                                                </button>
                                            )}

                                            {req.status === 'DELIVERED' && (
                                                <span className="px-2 py-1 bg-teal-100 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 font-bold text-xs rounded-lg flex items-center gap-1">
                                                    <Check className="w-3 h-3" />
                                                    <span>Entregada</span>
                                                </span>
                                            )}

                                            {req.document_type === 'REPORT_CARD' && (
                                                <button
                                                    onClick={() => handleViewStudentReport(req.student_id)}
                                                    className="px-2.5 py-1.5 text-xs font-bold text-brand-blue dark:text-blue-400 hover:bg-brand-blue/10 rounded-lg transition-colors"
                                                >
                                                    Ver Boleta
                                                </button>
                                            )}

                                            {isAdmin ? (
                                                <>
                                                    {req.status === 'PENDING' ? (
                                                        <>
                                                            {req.document_type === 'STUDENT_DELETION' ? (
                                                                <button
                                                                    onClick={() => handleUpdateStatus(req.id, 'APPROVED', req.document_type, req.student_name)}
                                                                    disabled={processingId === req.id}
                                                                    className="px-3 py-1.5 bg-rose-600 text-white font-bold rounded-lg text-xs transition-all shadow-sm"
                                                                >
                                                                    Aprobar Baja
                                                                </button>
                                                            ) : (
                                                                <button
                                                                    onClick={() => handleUpdateStatus(req.id, 'APPROVED', req.document_type, req.student_name)}
                                                                    disabled={processingId === req.id}
                                                                    className="px-3 py-1.5 bg-emerald-600 text-white font-bold rounded-lg text-xs transition-all shadow-sm"
                                                                >
                                                                    Aprobar
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={() => handleUpdateStatus(req.id, 'REJECTED', req.document_type, req.student_name)}
                                                                disabled={processingId === req.id}
                                                                className="px-3 py-1.5 bg-rose-50 text-rose-600 font-bold rounded-lg text-xs"
                                                            >
                                                                Rechazar
                                                            </button>
                                                        </>
                                                    ) : req.status === 'APPROVED' && req.document_type !== 'STUDENT_DELETION' ? (
                                                        <button
                                                            onClick={() => handleUpdateStatus(req.id, 'REJECTED', req.document_type, req.student_name)}
                                                            disabled={processingId === req.id}
                                                            className="text-xs text-rose-500 font-bold hover:underline"
                                                        >
                                                            Revocar
                                                        </button>
                                                    ) : req.status === 'CONSUMED' && req.document_type !== 'STUDENT_DELETION' ? (
                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                onClick={() => handleUpdateStatus(req.id, 'APPROVED', req.document_type, req.student_name)}
                                                                disabled={processingId === req.id}
                                                                className="text-xs text-emerald-600 font-bold hover:underline"
                                                            >
                                                                Reactivar
                                                            </button>
                                                            <button
                                                                onClick={() => handleUpdateStatus(req.id, 'REJECTED', req.document_type, req.student_name)}
                                                                disabled={processingId === req.id}
                                                                className="text-xs text-rose-500 font-bold hover:underline"
                                                            >
                                                                Rechazar
                                                            </button>
                                                        </div>
                                                    ) : req.status === 'REJECTED' && req.document_type !== 'STUDENT_DELETION' ? (
                                                        <button
                                                            onClick={() => handleUpdateStatus(req.id, 'APPROVED', req.document_type, req.student_name)}
                                                            disabled={processingId === req.id}
                                                            className="text-xs text-emerald-600 font-bold hover:underline"
                                                        >
                                                            Aprobar
                                                        </button>
                                                    ) : null}
                                                </>
                                            ) : (
                                                <div className="text-[11px] font-bold text-slate-500">
                                                    {req.status === 'PENDING' && <span className="text-amber-600">En revisión</span>}
                                                    {req.status === 'APPROVED' && <span className="text-emerald-600">Aprobado</span>}
                                                    {req.status === 'CONSUMED' && <span className="text-slate-500">Finalizada</span>}
                                                    {req.status === 'REJECTED' && <span className="text-rose-600">Rechazado</span>}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default DocumentCenter;
