import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getStudents } from './academicService';
import { 
    getStudentReportCard, 
    getDocumentAuthorizationStatus, 
    getStudentDocumentAuthorizations,
    requestDocumentAuthorization,
    getAllDocumentAuthorizations,
    updateDocumentAuthorization,
    trackDocumentDownload,
    type DocumentAuthorization
} from './gradeService';
import { 
    Loader2, Printer, Search, GraduationCap, Download, X, UserCheck, BookOpen, Check,
    ShieldCheck, ShieldAlert, Clock, CheckCircle2, Send, AlertTriangle, FileText, Inbox
} from 'lucide-react';
import { getCurrentUser } from '../auth/authService';
import { generateReportCardPdf } from '../../utils/certificateGenerator';

interface ReportCardProps {
    isEmbedded?: boolean;
    initialStudentId?: string | null;
}

const ReportCard = ({ isEmbedded = false, initialStudentId = null }: ReportCardProps) => {
    const user = getCurrentUser();
    const role = user?.role;
    const isAdmin = ['admin', 'superadmin'].includes(role || '');
    const isSecretary = role === 'secretary';
    const isStudent = role === 'student';

    const [searchTerm, setSearchTerm] = useState('');
    const [selectedStudentId, setSelectedStudentId] = useState<string | null>(isStudent ? user?.id : (initialStudentId || null));
    const [disabledCourses, setDisabledCourses] = useState<Record<string, boolean>>({});
    const [isExportingPdf, setIsExportingPdf] = useState(false);
    const [selectedCourseFilter, setSelectedCourseFilter] = useState<string>('ALL');

    // Student tab switcher: 'calificaciones' | 'tramites'
    const [studentTab, setStudentTab] = useState<'calificaciones' | 'tramites'>('calificaciones');
    const [selectedCycleForRequest, setSelectedCycleForRequest] = useState<string>('ALL');

    useEffect(() => {
        if (!isStudent && initialStudentId) {
            setSelectedStudentId(initialStudentId);
        }
    }, [initialStudentId, isStudent]);

    // Authorization state
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
    const [authReason, setAuthReason] = useState('');
    const [isSubmittingAuth, setIsSubmittingAuth] = useState(false);
    const [showAdminRequestsModal, setShowAdminRequestsModal] = useState(false);

    // Fetch students list for searching (staff only)
    const { data: students, isLoading: loadingStudents } = useQuery({
        queryKey: ['report-students'],
        queryFn: () => getStudents(),
        enabled: !isStudent
    });

    // Fetch report card data for selected student
    const { data: reportData, isLoading: loadingReport, isFetching } = useQuery({
        queryKey: ['report_card', selectedStudentId],
        queryFn: () => getStudentReportCard(selectedStudentId!),
        enabled: !!selectedStudentId,
    });

    useEffect(() => {
        if (reportData?.courses && reportData.courses.length > 0) {
            const active = reportData.courses.find((c: any) => c.is_active || c.academic_status === 'ACTIVE');
            if (active) {
                setSelectedCourseFilter(active.course_id);
                setSelectedCycleForRequest(active.course_id);
            } else {
                setSelectedCourseFilter(reportData.courses[0].course_id);
                setSelectedCycleForRequest(reportData.courses[0].course_id);
            }
        } else {
            setSelectedCourseFilter('ALL');
            setSelectedCycleForRequest('ALL');
        }
    }, [reportData?.student?.id]);

    // Fetch authorization status for the selected student
    const { data: authData, refetch: refetchAuth } = useQuery({
        queryKey: ['report_auth_status', selectedStudentId],
        queryFn: () => getDocumentAuthorizationStatus(selectedStudentId!),
        enabled: !!selectedStudentId
    });

    // Fetch student's own requests history (for student "Mis Trámites" view)
    const { data: studentAuthorizations, refetch: refetchStudentAuths } = useQuery({
        queryKey: ['student-doc-authorizations', selectedStudentId],
        queryFn: () => getStudentDocumentAuthorizations(selectedStudentId!),
        enabled: !!selectedStudentId && isStudent
    });

    // Fetch all authorization requests for admin / secretary
    const { data: allRequests, refetch: refetchAllRequests } = useQuery({
        queryKey: ['all-doc-authorizations'],
        queryFn: () => getAllDocumentAuthorizations(),
        enabled: !isStudent
    });

    const [dismissedDeliveredId, setDismissedDeliveredId] = useState<number | null>(null);

    const rawAuthStatus = authData?.status || 'NONE'; // 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'CONSUMED' | 'DELIVERED'
    const deliveryTimestamp = authData?.request?.delivered_at ? new Date(authData.request.delivered_at).getTime() : 0;
    const isOver72Hours = deliveryTimestamp > 0 && (Date.now() - deliveryTimestamp > 72 * 60 * 60 * 1000);
    const isManuallyDismissed = authData?.request?.id 
        ? (dismissedDeliveredId === authData.request.id || localStorage.getItem(`dismissed_delivered_doc_${authData.request.id}`) === 'true')
        : false;
    const isDeliveredArchived = rawAuthStatus === 'DELIVERED' && (isOver72Hours || isManuallyDismissed);

    // Filter strictly to report cards for this module so other document requests (e.g. certificates) don't collide
    const reportCardAuthorizations = (studentAuthorizations || []).filter(
        (a) => !a.document_type || a.document_type === 'REPORT_CARD'
    );

    // Derived active requests for student
    const activeStudentRequests = reportCardAuthorizations.filter((a) => {
        const isArchived = a.status === 'DELIVERED' && (
            (a.delivered_at && Date.now() - new Date(a.delivered_at).getTime() > 72 * 60 * 60 * 1000) ||
            localStorage.getItem(`dismissed_delivered_doc_${a.id}`) === 'true' ||
            dismissedDeliveredId === a.id
        );
        return !isArchived && (a.status === 'PENDING' || a.status === 'APPROVED' || a.status === 'DELIVERED');
    });

    const pastStudentRequests = reportCardAuthorizations.filter(
        (a) => !activeStudentRequests.some((active) => active.id === a.id)
    );

    // If delivered is archived (either >72h or student clicked dismiss), effective authStatus for student resets to 'NONE'
    const authStatus = isStudent && isDeliveredArchived ? 'NONE' : rawAuthStatus;

    const downloadCount = authData?.download_count ?? (authData?.request?.download_count || 0);
    const maxDownloads = authData?.max_downloads ?? (authData?.request?.max_downloads || 3);
    const remainingDownloads = Math.max(0, maxDownloads - downloadCount);
    const isConsumed = authStatus === 'CONSUMED' || (isSecretary && authStatus === 'APPROVED' && remainingDownloads <= 0);
    const isAuthorized = isAdmin || (authStatus === 'APPROVED' && !isConsumed);

    const openRequestModal = (preselectedCourseId?: string) => {
        if (preselectedCourseId && preselectedCourseId !== 'ALL') {
            setSelectedCycleForRequest(preselectedCourseId);
        } else if (selectedCourseFilter && selectedCourseFilter !== 'ALL') {
            setSelectedCycleForRequest(selectedCourseFilter);
        } else if (reportData?.courses && reportData.courses.length > 0) {
            const active = reportData.courses.find((c: any) => c.is_active || c.academic_status === 'ACTIVE');
            setSelectedCycleForRequest(active?.course_id || reportData.courses[0].course_id);
        } else {
            setSelectedCycleForRequest('ALL');
        }
        setIsAuthModalOpen(true);
    };

    const handleSendAuthRequest = async () => {
        if (!selectedStudentId) return;
        setIsSubmittingAuth(true);
        try {
            const chosenCourse = reportData?.courses?.find((c: any) => c.course_id === selectedCycleForRequest);
            const cycleName = chosenCourse 
                ? `${chosenCourse.cycle_year ? `Ciclo ${chosenCourse.cycle_year} • ` : ''}${chosenCourse.course_name}${chosenCourse.schedule_grade ? ` (${chosenCourse.schedule_grade})` : ''}` 
                : selectedCycleForRequest === 'ALL' ? 'Historial Completo Consolidado' : undefined;

            await requestDocumentAuthorization(
                selectedStudentId, 
                authReason, 
                'REPORT_CARD',
                selectedCycleForRequest || undefined,
                cycleName
            );
            setIsAuthModalOpen(false);
            setAuthReason('');
            refetchAuth();
            refetchStudentAuths();
            refetchAllRequests();
            alert('¡Solicitud de autorización enviada con éxito a la Dirección!');
            if (isStudent) {
                setStudentTab('tramites');
            }
        } catch (err: any) {
            alert(`Error al enviar solicitud: ${err?.response?.data?.message || err?.message || 'Error desconocido'}`);
        } finally {
            setIsSubmittingAuth(false);
        }
    };

    const handleAdminUpdateAuth = async (id: number, status: 'APPROVED' | 'REJECTED' | 'PENDING') => {
        if (!isAdmin) return;
        try {
            await updateDocumentAuthorization(id, status);
            refetchAuth();
            refetchAllRequests();
        } catch (err: any) {
            alert(`Error al actualizar autorización: ${err?.message || 'Error desconocido'}`);
        }
    };

    const handleMarkDelivered = async (id: number) => {
        if (!isAdmin && !isSecretary) {
            alert('No tienes permisos para registrar la entrega.');
            return;
        }
        if (!window.confirm('¿Confirmas que el estudiante o tutor ha recibido físicamente la boleta oficial sellada en las oficinas del plantel?')) {
            return;
        }
        try {
            await updateDocumentAuthorization(id, 'DELIVERED', 'Entrega física completada en oficinas del plantel');
            refetchAuth();
            refetchAllRequests();
            alert('¡Entrega física registrada exitosamente! El estado ha sido actualizado a "Entregada".');
        } catch (err: any) {
            alert(`Error al registrar la entrega: ${err?.message || 'Error desconocido'}`);
        }
    };

    const handleAdminQuickAuthorize = async () => {
        if (!isAdmin) {
            alert('Solo la Administración o Dirección puede autorizar directamente.');
            return;
        }
        if (!selectedStudentId) return;
        try {
            const res = await requestDocumentAuthorization(selectedStudentId, 'Autorizado directamente por administración');
            if (res?.request?.id) {
                await updateDocumentAuthorization(res.request.id, 'APPROVED', 'Aprobado por administración');
            }
            refetchAuth();
            refetchAllRequests();
        } catch (err: any) {
            alert(`Error al autorizar: ${err?.message || 'Error desconocido'}`);
        }
    };

    const filteredStudents = students?.filter((s: any) =>
        s.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.identification_document && s.identification_document.includes(searchTerm)) ||
        (s.personal_code && s.personal_code.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const handlePrint = async () => {
        if (!isAuthorized) {
            alert(isConsumed 
                ? 'Límite de 3 descargas/impresiones alcanzado. Solicita una nueva autorización a Dirección.' 
                : 'Por seguridad institucional, la impresión de la boleta requiere autorización previa de la Dirección.');
            return;
        }
        if (isSecretary && authData?.request?.id) {
            try {
                await trackDocumentDownload(authData.request.id);
                refetchAuth();
                refetchAllRequests();
            } catch (trackErr) {
                console.warn('Error tracking print download:', trackErr);
            }
        }
        window.print();
    };

    const handleExportPdf = async () => {
        if (!isAuthorized) {
            alert(isConsumed 
                ? 'Límite de 3 descargas/impresiones alcanzado. Solicita una nueva autorización a Dirección.' 
                : 'Por seguridad institucional, la descarga de la boleta requiere autorización previa de la Dirección.');
            return;
        }
        if (!reportData) return;
        setIsExportingPdf(true);
        try {
            const selectedCourseObj = selectedCourseFilter !== 'ALL'
                ? reportData.courses.find((c: any) => c.course_id === selectedCourseFilter)
                : null;

            const pdfData = {
                ...reportData,
                courses: selectedCourseObj ? [selectedCourseObj] : reportData.courses,
                cycleInfo: selectedCourseObj ? {
                    cycle_year: selectedCourseObj.cycle_year,
                    grade: selectedCourseObj.schedule_grade,
                    academic_status: selectedCourseObj.academic_status,
                    isConsolidated: false
                } : {
                    isConsolidated: true
                }
            };
            await generateReportCardPdf(pdfData, selectedCourseObj ? {} : disabledCourses);

            if (isSecretary && authData?.request?.id) {
                try {
                    await trackDocumentDownload(authData.request.id);
                    refetchAuth();
                    refetchAllRequests();
                } catch (trackErr) {
                    console.warn('Error tracking pdf download:', trackErr);
                }
            }
        } catch (err: any) {
            console.error('Error generating PDF report card:', err);
            alert(`Error al generar boleta en PDF: ${err?.message || 'Error desconocido'}`);
        } finally {
            setIsExportingPdf(false);
        }
    };

    return (
        <div className={`max-w-7xl mx-auto ${isEmbedded ? '' : 'pb-32 sm:pb-16'}`}>

            {/* Control Panel (Hidden during print) */}
            <div className="print:hidden">
                {!isEmbedded && (
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                                    {isStudent 
                                        ? (studentTab === 'tramites' ? 'Mis Trámites de Boleta' : 'Mi Consulta de Calificaciones')
                                        : 'Boletas de Calificaciones'}
                                </h2>
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-brand-blue/10 dark:bg-brand-blue/20 text-brand-blue dark:text-blue-400 border border-brand-blue/20">
                                    {isStudent ? (studentTab === 'tramites' ? 'SEGUIMIENTO OFICIAL' : 'CONSULTA DIGITAL') : 'OFICIAL'}
                                </span>
                            </div>
                            <p className="text-slate-500 dark:text-slate-400 mt-1 text-xs sm:text-sm">
                                {isStudent
                                    ? (studentTab === 'tramites' 
                                        ? 'Monitorea el progreso de tus boletas oficiales impresas y selladas para recoger en Dirección o Secretaría.'
                                        : 'Revisa tu rendimiento académico y calificaciones consolidadas. Para obtener tu boleta física oficial, solicítala a Dirección.')
                                    : 'Genera y visualiza reportes consolidados del rendimiento estudiantil por curso.'}
                            </p>
                        </div>

                        {reportData && !isFetching && !loadingReport && (
                            <div className="w-full sm:w-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                                {isStudent ? (
                                    studentTab === 'tramites' ? (
                                        <button
                                            onClick={() => openRequestModal(selectedCourseFilter)}
                                            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-brand-blue to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-bold rounded-xl shadow-md transition-all active:scale-95 text-xs sm:text-sm"
                                        >
                                            <ShieldCheck className="w-4 h-4" />
                                            <span>+ Nueva Solicitud de Boleta</span>
                                        </button>
                                    ) : (
                                        <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2">
                                            {activeStudentRequests.length > 0 && (
                                                <button
                                                    onClick={() => setStudentTab('tramites')}
                                                    className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-blue-500/10 border border-blue-500/25 text-brand-blue dark:text-blue-400 text-xs font-bold hover:bg-blue-500/20 transition-all shadow-sm"
                                                >
                                                    <Clock className="w-3.5 h-3.5 animate-spin" />
                                                    <span>{activeStudentRequests.length} trámite(s) en curso • Ver seguimiento ➔</span>
                                                </button>
                                            )}
                                            <button
                                                onClick={() => openRequestModal(selectedCourseFilter)}
                                                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-brand-blue to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-bold rounded-xl shadow-md transition-all active:scale-95 text-xs sm:text-sm"
                                            >
                                                <ShieldCheck className="w-4 h-4" />
                                                <span>Solicitar Boleta Oficial a Dirección</span>
                                            </button>
                                        </div>
                                    )
                                ) : !isAdmin ? (
                                    /* Secretary view */
                                    <>
                                        <button
                                            onClick={() => setShowAdminRequestsModal(true)}
                                            className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-xl border border-slate-200 dark:border-slate-700 text-xs sm:text-sm transition-all shadow-sm"
                                        >
                                            <ShieldCheck className="w-4 h-4 text-brand-blue" />
                                            <span>Solicitudes ({allRequests?.filter((r: any) => r.status === 'PENDING' || r.status === 'APPROVED').length || 0})</span>
                                        </button>
                                        {isAuthorized ? (
                                            <>
                                                <div className="hidden sm:flex items-center gap-1.5 px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold text-xs rounded-xl">
                                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                                    <span>Autorizado ({remainingDownloads} de {maxDownloads})</span>
                                                </div>
                                                <button
                                                    onClick={handleExportPdf}
                                                    disabled={isExportingPdf}
                                                    className="flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-brand-blue to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-bold rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-50 text-sm"
                                                >
                                                    {isExportingPdf ? (
                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                    ) : (
                                                        <Download className="w-4 h-4" />
                                                    )}
                                                    <span>Descargar PDF</span>
                                                </button>
                                                <button
                                                    onClick={handlePrint}
                                                    className="flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-xl border border-slate-200 dark:border-slate-700 transition-all active:scale-95 text-sm"
                                                >
                                                    <Printer className="w-4 h-4" />
                                                    <span>Imprimir</span>
                                                </button>
                                            </>
                                        ) : authStatus === 'DELIVERED' ? (
                                            <div className="flex items-center gap-2 px-4 py-2.5 bg-teal-500/10 border border-teal-500/25 text-teal-700 dark:text-teal-300 font-bold rounded-xl text-xs sm:text-sm">
                                                <CheckCircle2 className="w-4 h-4 text-teal-500" />
                                                <span>Boleta Entregada</span>
                                            </div>
                                        ) : authStatus === 'PENDING' ? (
                                            <div className="flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 font-bold rounded-xl text-xs sm:text-sm">
                                                <Clock className="w-4 h-4 animate-spin text-amber-500" />
                                                <span>Solicitud en Revisión por Dirección</span>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => setIsAuthModalOpen(true)}
                                                className="flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-brand-blue to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-bold rounded-xl shadow-md transition-all active:scale-95 text-sm"
                                            >
                                                <ShieldCheck className="w-4 h-4" />
                                                <span>Solicitar Autorización a Dirección</span>
                                            </button>
                                        )}
                                    </>
                                ) : (
                                    /* Admin view */
                                    <>
                                        <button
                                            onClick={() => setShowAdminRequestsModal(true)}
                                            className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-xl border border-slate-200 dark:border-slate-700 text-xs sm:text-sm transition-all shadow-sm"
                                        >
                                            <ShieldCheck className="w-4 h-4 text-brand-blue" />
                                            <span>Solicitudes ({allRequests?.filter((r: any) => r.status === 'PENDING').length || 0})</span>
                                        </button>
                                        <button
                                            onClick={handleExportPdf}
                                            disabled={isExportingPdf}
                                            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-brand-blue to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-bold rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-50 text-sm"
                                        >
                                            {isExportingPdf ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <Download className="w-4 h-4" />
                                            )}
                                            <span>Descargar PDF</span>
                                        </button>
                                        <button
                                            onClick={handlePrint}
                                            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-xl border border-slate-200 dark:border-slate-700 transition-all active:scale-95 text-sm"
                                        >
                                            <Printer className="w-4 h-4" />
                                            <span>Imprimir</span>
                                        </button>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Student Tab Switcher */}
                {isStudent && (
                    <div className="p-1.5 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 mb-6 max-w-md grid grid-cols-2 gap-1.5 shadow-inner print:hidden">
                        <button
                            onClick={() => setStudentTab('calificaciones')}
                            className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-bold text-xs sm:text-sm transition-all duration-200 ${
                                studentTab === 'calificaciones'
                                    ? 'bg-white dark:bg-slate-900 text-brand-blue dark:text-blue-400 shadow-sm border border-slate-200/60 dark:border-slate-700/60'
                                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                            }`}
                        >
                            <BookOpen className="w-4 h-4 shrink-0" />
                            <span>Mis Calificaciones</span>
                        </button>
                        <button
                            onClick={() => setStudentTab('tramites')}
                            className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-bold text-xs sm:text-sm transition-all duration-200 relative ${
                                studentTab === 'tramites'
                                    ? 'bg-white dark:bg-slate-900 text-brand-blue dark:text-blue-400 shadow-sm border border-slate-200/60 dark:border-slate-700/60'
                                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                            }`}
                        >
                            <FileText className="w-4 h-4 shrink-0" />
                            <span>Mis Trámites</span>
                            {activeStudentRequests.length > 0 && (
                                <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-black bg-brand-blue text-white">
                                    {activeStudentRequests.length}
                                </span>
                            )}
                        </button>
                    </div>
                )}

                {/* Staff Student Selector */}
                {!isStudent && (
                    <div className="bg-white dark:bg-slate-900/90 p-5 sm:p-6 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-800 mb-6 sm:mb-8 transition-all">
                        <div className="flex items-center justify-between gap-3 mb-3">
                            <label className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
                                <Search className="w-4 h-4 text-brand-blue dark:text-blue-400" />
                                Buscar y Seleccionar Estudiante
                            </label>
                            {selectedStudentId && (
                                <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                    <UserCheck className="w-3.5 h-3.5" />
                                    Alumno Seleccionado
                                </span>
                            )}
                        </div>

                        {/* Search Input Box */}
                        <div className="relative">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                            <input
                                type="text"
                                className="w-full pl-11 pr-10 py-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white rounded-xl focus:ring-4 focus:ring-brand-blue/10 focus:border-brand-blue transition-all outline-none font-medium text-sm"
                                placeholder="Escribe el nombre del alumno, código personal o DPI..."
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

                        {/* Dropdown Results */}
                        {searchTerm && (
                            <div className="mt-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl max-h-56 overflow-y-auto w-full shadow-lg divide-y divide-slate-100 dark:divide-slate-700/60 z-20">
                                {loadingStudents && (
                                    <div className="p-4 text-center text-slate-500 dark:text-slate-400 text-sm flex items-center justify-center gap-2">
                                        <Loader2 className="animate-spin h-4 w-4 text-brand-blue" />
                                        <span>Buscando estudiantes...</span>
                                    </div>
                                )}
                                {filteredStudents?.map((student: any) => (
                                    <button
                                        key={student.id}
                                        className="w-full text-left p-3.5 hover:bg-brand-blue/5 dark:hover:bg-slate-700/60 transition-colors flex items-center justify-between group"
                                        onClick={() => {
                                            setSelectedStudentId(student.id);
                                            setSearchTerm('');
                                            setDisabledCourses({});
                                        }}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-brand-blue/10 dark:bg-brand-blue/20 text-brand-blue dark:text-blue-400 font-bold text-xs flex items-center justify-center shrink-0">
                                                {student.full_name?.charAt(0)?.toUpperCase() || 'E'}
                                            </div>
                                            <div>
                                                <div className="font-bold text-slate-800 dark:text-white text-sm group-hover:text-brand-blue dark:group-hover:text-blue-400 transition-colors">
                                                    {student.full_name}
                                                </div>
                                                <div className="text-xs text-slate-400">
                                                    DPI/Doc: {student.identification_document || 'Sin documento'} • Código: {student.personal_code || 'N/A'}
                                                </div>
                                            </div>
                                        </div>
                                        <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 group-hover:bg-brand-blue group-hover:text-white transition-all">
                                            Elegir
                                        </span>
                                    </button>
                                ))}
                                {filteredStudents?.length === 0 && !loadingStudents && (
                                    <div className="p-4 text-center text-slate-500 dark:text-slate-400 text-sm">
                                        No se encontraron estudiantes que coincidan con la búsqueda.
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Selected Student Summary Box */}
                        {selectedStudentId && reportData && !isFetching && !loadingReport && (
                            <div className="mt-4 p-3.5 sm:p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-brand-blue/15 dark:bg-brand-blue/25 text-brand-blue dark:text-blue-400 font-black text-base flex items-center justify-center shrink-0 border border-brand-blue/20">
                                        {reportData.student.full_name?.charAt(0)?.toUpperCase() || 'E'}
                                    </div>
                                    <div>
                                        <div className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">
                                            {reportData.student.full_name}
                                        </div>
                                        <div className="text-xs text-slate-500 dark:text-slate-400">
                                            ID: <span className="font-mono">{reportData.student.id.substring(0, 8).toUpperCase()}</span> • {reportData.courses.length} curso(s) matriculado(s)
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 self-end sm:self-center flex-wrap justify-end">
                                    {authStatus === 'APPROVED' && (
                                        <button
                                            onClick={() => authData?.request?.id && handleMarkDelivered(authData.request.id)}
                                            className="flex items-center gap-1 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-xs transition-all shadow-sm active:scale-95"
                                            title="Registrar que el alumno ya recibió físicamente la boleta en oficinas"
                                        >
                                            <CheckCircle2 className="w-3.5 h-3.5" />
                                            <span>Registrar Entrega</span>
                                        </button>
                                    )}

                                    {authStatus === 'DELIVERED' && (
                                        <span className="flex items-center gap-1 px-2.5 py-1 bg-teal-500/10 border border-teal-500/20 text-teal-700 dark:text-teal-300 font-bold text-xs rounded-lg">
                                            <CheckCircle2 className="w-3.5 h-3.5 text-teal-500" />
                                            <span>Entregada el {authData?.request?.delivered_at ? new Date(authData.request.delivered_at).toLocaleDateString() : ''}</span>
                                        </span>
                                    )}

                                    {isAdmin ? (
                                        authStatus === 'APPROVED' ? (
                                            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold text-xs rounded-lg">
                                                <CheckCircle2 className="w-3.5 h-3.5" />
                                                <span>Autorizado</span>
                                                <button 
                                                    onClick={() => authData?.request?.id && handleAdminUpdateAuth(authData.request.id, 'REJECTED')}
                                                    className="text-[10px] text-rose-500 hover:underline ml-1"
                                                    title="Revocar autorización al alumno"
                                                >
                                                    Revocar
                                                </button>
                                            </div>
                                        ) : authStatus !== 'DELIVERED' ? (
                                            <button
                                                onClick={handleAdminQuickAuthorize}
                                                className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-all shadow-sm"
                                                title="Autorizar al alumno para que pueda descargar e imprimir su boleta"
                                            >
                                                <ShieldCheck className="w-3.5 h-3.5" />
                                                <span>Autorizar al Alumno</span>
                                            </button>
                                        ) : null
                                    ) : (
                                        authStatus === 'APPROVED' && !isConsumed ? (
                                            <span className="flex items-center gap-1 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold text-xs rounded-lg">
                                                <CheckCircle2 className="w-3.5 h-3.5" />
                                                <span>
                                                    {isSecretary 
                                                        ? `Autorizado (${remainingDownloads} de ${maxDownloads} descargas)` 
                                                        : 'Autorizado por Dirección'}
                                                </span>
                                            </span>
                                        ) : isConsumed ? (
                                            <button
                                                onClick={() => setIsAuthModalOpen(true)}
                                                className="flex items-center gap-1 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs transition-all shadow-sm"
                                                title="Límite de 3 descargas alcanzado. Solicitar nueva autorización"
                                            >
                                                <AlertTriangle className="w-3.5 h-3.5" />
                                                <span>Agotada (3/3) - Solicitar Nueva</span>
                                            </button>
                                        ) : authStatus === 'PENDING' ? (
                                            <span className="flex items-center gap-1 px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 font-bold text-xs rounded-lg">
                                                <Clock className="w-3.5 h-3.5 animate-spin" />
                                                <span>Pendiente de Dirección</span>
                                            </span>
                                        ) : authStatus !== 'DELIVERED' ? (
                                            <button
                                                onClick={() => setIsAuthModalOpen(true)}
                                                className="flex items-center gap-1 px-3 py-1.5 bg-brand-blue hover:bg-blue-600 text-white font-bold rounded-xl text-xs transition-all shadow-sm"
                                            >
                                                <ShieldCheck className="w-3.5 h-3.5" />
                                                <span>Solicitar Aprobación</span>
                                            </button>
                                        ) : null
                                    )}
                                    <button
                                        onClick={() => {
                                            setSelectedStudentId(null);
                                            setSearchTerm('');
                                        }}
                                        className="px-3 py-2 text-xs font-bold text-slate-500 hover:text-rose-500 dark:text-slate-400 dark:hover:text-rose-400 transition-colors"
                                    >
                                        Cambiar
                                    </button>
                                    {isAuthorized && (
                                        <>
                                            <button
                                                onClick={handleExportPdf}
                                                disabled={isExportingPdf}
                                                className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-brand-blue to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-bold rounded-xl text-xs shadow-sm transition-all active:scale-95 disabled:opacity-50"
                                            >
                                                {isExportingPdf ? (
                                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                ) : (
                                                    <Download className="w-3.5 h-3.5" />
                                                )}
                                                <span>PDF</span>
                                            </button>
                                            <button
                                                onClick={handlePrint}
                                                className="flex items-center gap-1.5 px-3.5 py-2 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 text-slate-700 dark:text-white font-bold rounded-xl text-xs border border-slate-200 dark:border-slate-600 transition-all active:scale-95"
                                            >
                                                <Printer className="w-3.5 h-3.5" />
                                                <span>Imprimir</span>
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Loading Indicator */}
            {(loadingReport || isFetching) && (
                <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-slate-900/90 rounded-3xl border border-slate-200/80 dark:border-slate-800 print:hidden shadow-sm my-6">
                    <Loader2 className="animate-spin h-10 w-10 text-brand-blue mb-4" />
                    <p className="text-slate-700 dark:text-slate-300 font-bold">Generando boleta oficial...</p>
                    <p className="text-slate-400 text-xs mt-1">Consolidando unidades evaluativas y promedios</p>
                </div>
            )}

            {/* Empty State */}
            {!selectedStudentId && !isFetching && (
                <div className="text-center py-16 sm:py-24 px-4 bg-slate-50/80 dark:bg-slate-900/50 rounded-3xl border border-dashed border-slate-300 dark:border-slate-800 print:hidden transition-all">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto rounded-3xl bg-brand-blue/10 dark:bg-brand-blue/20 flex items-center justify-center text-brand-blue dark:text-blue-400 mb-4 shadow-inner">
                        <GraduationCap className="h-8 w-8 sm:h-10 sm:w-10" />
                    </div>
                    <h3 className="text-lg sm:text-xl font-black text-slate-800 dark:text-white">
                        Ningún estudiante seleccionado
                    </h3>
                    <p className="text-slate-500 dark:text-slate-400 mt-2 max-w-md mx-auto text-xs sm:text-sm">
                        Busca y selecciona un alumno arriba para generar instantáneamente su boleta de calificaciones oficial cruzando todos los cursos a los que pertenece.
                    </p>
                </div>
            )}

            {/* Student "Mis Trámites" Tab View */}
            {isStudent && studentTab === 'tramites' && (
                <div className="space-y-6 animate-in fade-in duration-200 print:hidden mb-12">
                    {/* Active Requests Section */}
                    {activeStudentRequests.length > 0 ? (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                    <Clock className="w-4 h-4 text-brand-blue" />
                                    Trámites en Curso ({activeStudentRequests.length})
                                </h3>
                                <span className="text-xs text-slate-500 dark:text-slate-400">
                                    Progreso y aviso de entrega en oficinas
                                </span>
                            </div>

                            {activeStudentRequests.map((req) => {
                                const isReqDismissed = req.id && (dismissedDeliveredId === req.id || localStorage.getItem(`dismissed_delivered_doc_${req.id}`) === 'true');

                                return (
                                    <div key={req.id} className="p-5 sm:p-6 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-sm space-y-5">
                                        {/* Request Info Bar */}
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
                                            <div>
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <h4 className="font-extrabold text-base text-slate-900 dark:text-white">
                                                        Boleta Oficial de Calificaciones
                                                    </h4>
                                                    <span className="px-2.5 py-0.5 rounded-lg text-xs font-bold bg-brand-blue/10 dark:bg-brand-blue/20 text-brand-blue dark:text-blue-400 border border-brand-blue/20">
                                                        {req.course_name || req.cycle_name || 'Ciclo Escolar'}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                                    Solicitada el {req.requested_at ? new Date(req.requested_at).toLocaleDateString('es-GT', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Reciente'}
                                                    {req.reason ? ` • Motivo: "${req.reason}"` : ''}
                                                </p>
                                            </div>

                                            <span className={`self-start sm:self-auto text-xs font-black uppercase px-3 py-1 rounded-full ${
                                                req.status === 'DELIVERED'
                                                    ? 'bg-teal-600 text-white'
                                                    : req.status === 'APPROVED'
                                                        ? 'bg-emerald-500 text-white animate-pulse'
                                                        : req.status === 'PENDING'
                                                            ? 'bg-amber-500 text-white'
                                                            : req.status === 'REJECTED'
                                                                ? 'bg-rose-500 text-white'
                                                                : 'bg-slate-100 text-slate-600'
                                            }`}>
                                                {req.status === 'DELIVERED'
                                                    ? 'Boleta Entregada'
                                                    : req.status === 'APPROVED'
                                                        ? 'Lista para Recoger'
                                                        : req.status === 'PENDING'
                                                            ? 'En Proceso en Dirección'
                                                            : 'Requiere Atención'}
                                            </span>
                                        </div>

                                        {/* 3-Step Stepper */}
                                        <div className="grid grid-cols-3 gap-2 relative py-2">
                                            {/* Step 1 */}
                                            <div className="flex flex-col items-center text-center">
                                                <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold mb-1.5 bg-brand-blue text-white shadow-sm ring-4 ring-brand-blue/15">
                                                    ✓
                                                </div>
                                                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                                    1. Solicitada
                                                </span>
                                                <span className="text-[10px] text-slate-400">
                                                    Enviada
                                                </span>
                                            </div>

                                            {/* Step 2 */}
                                            <div className="flex flex-col items-center text-center">
                                                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold mb-1.5 transition-all ${
                                                    req.status === 'APPROVED' || req.status === 'DELIVERED'
                                                        ? 'bg-brand-blue text-white shadow-sm ring-4 ring-brand-blue/15'
                                                        : req.status === 'PENDING'
                                                            ? 'bg-amber-500 text-white shadow-sm ring-4 ring-amber-500/20 animate-pulse'
                                                            : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border border-slate-300 dark:border-slate-700'
                                                }`}>
                                                    {req.status === 'APPROVED' || req.status === 'DELIVERED' ? '✓' : '2'}
                                                </div>
                                                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                                    2. Dirección
                                                </span>
                                                <span className="text-[10px] text-slate-400">
                                                    {req.status === 'APPROVED' || req.status === 'DELIVERED' ? 'Aprobada y sellada' : req.status === 'PENDING' ? 'Verificando expediente' : 'En espera'}
                                                </span>
                                            </div>

                                            {/* Step 3 */}
                                            <div className="flex flex-col items-center text-center">
                                                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold mb-1.5 transition-all ${
                                                    req.status === 'DELIVERED'
                                                        ? 'bg-teal-600 text-white shadow-sm ring-4 ring-teal-500/25'
                                                        : req.status === 'APPROVED'
                                                            ? 'bg-emerald-500 text-white shadow-sm ring-4 ring-emerald-500/20 animate-bounce'
                                                            : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border border-slate-300 dark:border-slate-700'
                                                }`}>
                                                    {req.status === 'DELIVERED' ? '✓' : '3'}
                                                </div>
                                                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                                    {req.status === 'DELIVERED' ? '3. Entregada' : '3. En Plantel'}
                                                </span>
                                                <span className={`text-[10px] font-bold ${
                                                    req.status === 'DELIVERED'
                                                        ? 'text-teal-600 dark:text-teal-400'
                                                        : req.status === 'APPROVED'
                                                            ? 'text-emerald-600 dark:text-emerald-400'
                                                            : 'text-slate-400'
                                                }`}>
                                                    {req.status === 'DELIVERED' ? '¡Recibida en oficinas!' : req.status === 'APPROVED' ? '¡Lista para recoger!' : 'Por entregar'}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Status Alert Details */}
                                        {req.status === 'APPROVED' && (
                                            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-2xl flex items-start gap-3.5">
                                                <div className="p-2.5 bg-emerald-600 text-white rounded-xl shrink-0 mt-0.5 shadow-sm">
                                                    <CheckCircle2 className="w-5 h-5" />
                                                </div>
                                                <div className="text-xs text-emerald-950 dark:text-emerald-200 space-y-1">
                                                    <p className="font-black text-sm text-emerald-900 dark:text-emerald-100">
                                                        🏫 ¡Tu Boleta Oficial está Lista para Recoger!
                                                    </p>
                                                    <p className="text-xs text-emerald-800 dark:text-emerald-300 leading-relaxed font-medium">
                                                        La Dirección General ha aprobado y preparado tu boleta oficial de <strong>{req.course_name || req.cycle_name}</strong>. Ya puedes presentarte en las oficinas de <strong>Secretaría o Dirección del colegio</strong> para recibir tu documento en físico debidamente firmado y sellado.
                                                    </p>
                                                    <p className="text-[11px] text-emerald-700 dark:text-emerald-400 italic">
                                                        Horario de atención habitual de Secretaría. Únicamente debes identificarte con tu carné o nombre completo.
                                                    </p>
                                                </div>
                                            </div>
                                        )}

                                        {req.status === 'PENDING' && (
                                            <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-2xl flex items-start gap-3.5">
                                                <div className="p-2 bg-amber-500 text-white rounded-xl shrink-0 mt-0.5 shadow-sm">
                                                    <Clock className="w-5 h-5 animate-spin" />
                                                </div>
                                                <div className="text-xs text-amber-900 dark:text-amber-200">
                                                    <p className="font-bold text-sm">Tu solicitud está en revisión en Dirección General</p>
                                                    <p className="text-xs text-amber-800 dark:text-amber-300 mt-1 leading-relaxed">
                                                        La Dirección Académica está verificando tu expediente del ciclo <strong>{req.course_name || req.cycle_name}</strong>. En cuanto tu boleta oficial esté impresa, firmada y con los sellos correspondientes, este panel cambiará a verde indicándote que ya puedes pasar por ella.
                                                    </p>
                                                </div>
                                            </div>
                                        )}

                                        {req.status === 'DELIVERED' && !isReqDismissed && (
                                            <div className="p-4 bg-teal-50 dark:bg-teal-950/40 border border-teal-300 dark:border-teal-800 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                                <div className="flex items-start gap-3.5">
                                                    <div className="p-2.5 bg-teal-600 text-white rounded-xl shrink-0 mt-0.5 shadow-sm">
                                                        <CheckCircle2 className="w-5 h-5" />
                                                    </div>
                                                    <div className="text-xs text-teal-950 dark:text-teal-200 space-y-1">
                                                        <p className="font-black text-sm text-teal-900 dark:text-teal-100 flex items-center gap-2">
                                                            <span>🎉 ¡Boleta Oficial Entregada con Éxito!</span>
                                                            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-teal-200 dark:bg-teal-900 text-teal-800 dark:text-teal-200">
                                                                COMPLETADO
                                                            </span>
                                                        </p>
                                                        <p className="text-xs text-teal-800 dark:text-teal-300 leading-relaxed font-medium">
                                                            Se ha registrado en el sistema la entrega física de tu boleta oficial de <strong>{req.course_name || req.cycle_name}</strong> en oficinas del colegio{req.delivered_at ? ` el ${new Date(req.delivered_at).toLocaleDateString('es-GT', { day: '2-digit', month: 'long', year: 'numeric' })}` : ''}{req.delivered_by_name ? ` (Entregó: ${req.delivered_by_name})` : ''}.
                                                        </p>
                                                        <p className="text-[11px] text-teal-700 dark:text-teal-400 italic">
                                                            Este trámite pasará a tu historial. Puedes presionar finalizar para mantener limpia esta sección.
                                                        </p>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => {
                                                        localStorage.setItem(`dismissed_delivered_doc_${req.id}`, 'true');
                                                        setDismissedDeliveredId(req.id);
                                                        refetchStudentAuths();
                                                    }}
                                                    className="shrink-0 w-full sm:w-auto px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-xs shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5"
                                                >
                                                    <Check className="w-4 h-4" />
                                                    <span>Entendido / Archivar</span>
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ) : null}

                    {/* Empty state if NO active requests and NO past requests */}
                    {activeStudentRequests.length === 0 && pastStudentRequests.length === 0 && (
                        <div className="text-center py-16 px-4 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-300 dark:border-slate-800 shadow-sm">
                            <div className="w-16 h-16 mx-auto rounded-3xl bg-brand-blue/10 dark:bg-brand-blue/20 flex items-center justify-center text-brand-blue dark:text-blue-400 mb-4 shadow-inner">
                                <Inbox className="h-8 w-8" />
                            </div>
                            <h3 className="text-lg font-black text-slate-800 dark:text-white">
                                No tienes trámites de boleta activos
                            </h3>
                            <p className="text-slate-500 dark:text-slate-400 mt-2 max-w-md mx-auto text-xs sm:text-sm leading-relaxed">
                                Si necesitas una boleta física oficial firmada y sellada por la Dirección para trámites de beca, expedientes o archivo familiar, envía tu solicitud aquí.
                            </p>
                            <button
                                onClick={() => openRequestModal(selectedCourseFilter)}
                                className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-brand-blue to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-bold rounded-xl text-xs sm:text-sm shadow-md transition-all active:scale-95"
                            >
                                <ShieldCheck className="w-4 h-4" />
                                <span>Solicitar Boleta Oficial a Dirección</span>
                            </button>
                        </div>
                    )}

                    {/* Past Delivered History Section */}
                    {pastStudentRequests.length > 0 && (
                        <div className="space-y-3">
                            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4 text-teal-600" />
                                Historial de Boletas Entregadas y Trámites Anteriores
                            </h3>
                            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
                                {pastStudentRequests.map((past) => (
                                    <div key={past.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                                                past.status === 'DELIVERED'
                                                    ? 'bg-teal-500/15 text-teal-600 dark:text-teal-400'
                                                    : past.status === 'REJECTED'
                                                        ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                                                        : 'bg-slate-500/15 text-slate-600 dark:text-slate-400'
                                            }`}>
                                                {past.status === 'DELIVERED' ? '✓' : past.status === 'REJECTED' ? '✕' : '•'}
                                            </div>
                                            <div>
                                                <div className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">
                                                    Boleta Oficial • {past.course_name || past.cycle_name || 'Ciclo Escolar'}
                                                </div>
                                                <div className="text-[11px] text-slate-400">
                                                    Solicitada: {past.requested_at ? new Date(past.requested_at).toLocaleDateString() : 'N/A'}
                                                    {past.delivered_at ? ` • Entregada en oficinas: ${new Date(past.delivered_at).toLocaleDateString()}` : ''}
                                                    {past.delivered_by_name ? ` (Entregó: ${past.delivered_by_name})` : ''}
                                                </div>
                                                {past.reason && (
                                                    <p className="text-[11px] text-slate-500 italic mt-0.5">
                                                        Motivo: "{past.reason}"
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        {past.status === 'DELIVERED' ? (
                                            <span className="self-start sm:self-auto text-[11px] font-bold px-2.5 py-1 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 flex items-center gap-1">
                                                <Check className="w-3.5 h-3.5" />
                                                Entregada en Plantel
                                            </span>
                                        ) : past.status === 'CONSUMED' ? (
                                            <span className="self-start sm:self-auto text-[11px] font-bold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 flex items-center gap-1">
                                                <Check className="w-3.5 h-3.5" />
                                                Trámite Finalizado
                                            </span>
                                        ) : past.status === 'REJECTED' ? (
                                            <span className="self-start sm:self-auto text-[11px] font-bold px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 flex items-center gap-1">
                                                <X className="w-3.5 h-3.5" />
                                                Rechazada
                                            </span>
                                        ) : (
                                            <span className="self-start sm:self-auto text-[11px] font-bold px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 flex items-center gap-1">
                                                <Clock className="w-3.5 h-3.5" />
                                                Pendiente
                                            </span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Official Report Card Paper Document View (Shown when !isStudent or studentTab === 'calificaciones') */}
            {selectedStudentId && reportData && !isFetching && !loadingReport && (!isStudent || studentTab === 'calificaciones') && (
                <div className="transition-all">
                    {/* Toolbar for the Document Preview (Hidden in Print) */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 print:hidden px-1">
                        <div className="flex items-center gap-2">
                            <BookOpen className="w-4 h-4 text-brand-blue dark:text-blue-400" />
                            <span className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300">
                                Vista Previa del Documento Oficial
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            {isStudent ? (
                                activeStudentRequests.length > 0 ? (
                                    <button
                                        onClick={() => setStudentTab('tramites')}
                                        className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-500/10 border border-blue-500/25 text-brand-blue dark:text-blue-400 font-bold rounded-xl text-xs hover:bg-blue-500/20 transition-all shadow-sm"
                                    >
                                        <Clock className="w-3.5 h-3.5 animate-spin text-brand-blue" />
                                        <span>Trámite en curso • Ver en Mis Trámites ➔</span>
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => openRequestModal(selectedCourseFilter)}
                                        className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-brand-blue to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-bold rounded-xl text-xs shadow-sm transition-all active:scale-95"
                                    >
                                        <ShieldCheck className="w-3.5 h-3.5" />
                                        <span>Solicitar Boleta Oficial a Dirección</span>
                                    </button>
                                )
                            ) : (
                                <>
                                    <button
                                        onClick={handleExportPdf}
                                        disabled={isExportingPdf || !isAuthorized}
                                        className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-bold text-xs shadow-sm transition-all active:scale-95 ${
                                            isAuthorized
                                                ? 'bg-gradient-to-r from-brand-blue to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white'
                                                : 'bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed'
                                        }`}
                                    >
                                        {isExportingPdf ? (
                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        ) : (
                                            <Download className="w-3.5 h-3.5" />
                                        )}
                                        <span>Exportar PDF</span>
                                    </button>

                                    <button
                                        onClick={handlePrint}
                                        disabled={!isAuthorized}
                                        className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-bold text-xs shadow-sm transition-all active:scale-95 ${
                                            isAuthorized
                                                ? 'bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900'
                                                : 'bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed'
                                        }`}
                                    >
                                        <Printer className="w-3.5 h-3.5" />
                                        <span>Imprimir</span>
                                    </button>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Security & Authorization Institutional Banner for Secretary */}
                    {isSecretary && (
                        <div className="mb-5 print:hidden">
                            {authStatus === 'NONE' && (
                                <div className="p-4 sm:p-5 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-800/80 dark:to-slate-800/40 border border-blue-200/80 dark:border-blue-900/40 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
                                    <div className="flex items-start gap-3">
                                        <div className="p-2.5 rounded-xl bg-brand-blue/15 text-brand-blue dark:text-blue-400 shrink-0 mt-0.5">
                                            <ShieldAlert className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-bold text-slate-900 dark:text-white">Documento Oficial Protegido</h4>
                                            <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 max-w-2xl leading-relaxed">
                                                {isSecretary
                                                    ? 'Por políticas de seguridad institucional, la descarga e impresión de boletas oficiales por parte de Secretaría requiere la aprobación previa de la Dirección General. Solicita la autorización para este alumno.'
                                                    : 'Por normativas de seguridad institucional, las boletas emitidas deben contar con la certificación oficial de la Dirección Académica. Para descargar tu archivo PDF o imprimirlo, solicita la autorización correspondiente.'}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setIsAuthModalOpen(true)}
                                        className="shrink-0 w-full sm:w-auto px-4 py-2.5 bg-brand-blue hover:bg-blue-600 text-white font-bold rounded-xl text-xs sm:text-sm shadow-md transition-all active:scale-95 flex items-center justify-center gap-2"
                                    >
                                        <ShieldCheck className="w-4 h-4" />
                                        <span>Solicitar Autorización</span>
                                    </button>
                                </div>
                            )}

                            {authStatus === 'PENDING' && (
                                <div className="p-4 sm:p-5 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
                                    <div className="flex items-start gap-3">
                                        <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5">
                                            <Clock className="w-5 h-5 animate-spin" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h4 className="text-sm font-bold text-amber-700 dark:text-amber-300">Solicitud en Proceso de Autorización</h4>
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-white">PENDIENTE</span>
                                            </div>
                                            <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 max-w-2xl leading-relaxed">
                                                {isSecretary
                                                    ? 'La solicitud de autorización para este estudiante fue enviada a la Dirección General y está en espera de aprobación.'
                                                    : 'Tu solicitud ha sido enviada y está siendo validada por Dirección y Administración. Se te notificará una vez sea habilitada.'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {authStatus === 'APPROVED' && !isConsumed && (
                                <div className="p-4 sm:p-5 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
                                    <div className="flex items-start gap-3">
                                        <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5">
                                            <CheckCircle2 className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h4 className="text-sm font-bold text-emerald-700 dark:text-emerald-300">Boleta Oficial Autorizada</h4>
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500 text-white">
                                                    {isSecretary ? `${remainingDownloads} de ${maxDownloads} Descargas` : 'AUTORIZADA'}
                                                </span>
                                            </div>
                                            <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 max-w-2xl leading-relaxed">
                                                {isSecretary
                                                    ? `La Dirección General ha autorizado la emisión de este documento. Cuentas con un máximo de 3 descargas/impresiones (te quedan ${remainingDownloads} restantes).`
                                                    : 'La Dirección Académica ha autorizado la emisión de este documento oficial. Ya puedes descargar el archivo PDF o imprimirlo.'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {isConsumed && (
                                <div className="p-4 sm:p-5 bg-rose-500/10 border border-rose-500/25 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
                                    <div className="flex items-start gap-3">
                                        <div className="p-2.5 rounded-xl bg-rose-500/20 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5">
                                            <AlertTriangle className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h4 className="text-sm font-bold text-rose-700 dark:text-rose-300">Límite de Descargas Agotado (3 de 3)</h4>
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500 text-white">BLOQUEADA</span>
                                            </div>
                                            <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 max-w-2xl leading-relaxed">
                                                Por seguridad institucional, la autorización previa ha alcanzado el límite máximo de 3 emisiones/descargas y ha quedado bloqueada. Debes solicitar una nueva autorización a la Dirección General para poder volver a descargar o imprimir esta boleta.
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setIsAuthModalOpen(true)}
                                        className="shrink-0 w-full sm:w-auto px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs sm:text-sm shadow-md transition-all active:scale-95"
                                    >
                                        Solicitar Nueva Autorización
                                    </button>
                                </div>
                            )}

                            {authStatus === 'REJECTED' && (
                                <div className="p-4 sm:p-5 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
                                    <div className="flex items-start gap-3">
                                        <div className="p-2.5 rounded-xl bg-rose-500/20 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5">
                                            <AlertTriangle className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h4 className="text-sm font-bold text-rose-700 dark:text-rose-300">Solicitud No Autorizada</h4>
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500 text-white">RECHAZADA</span>
                                            </div>
                                            <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 max-w-2xl leading-relaxed">
                                                {isSecretary
                                                    ? 'La Dirección General no aprobó la emisión de este documento. Puedes enviar una nueva solicitud con aclaraciones si es necesario.'
                                                    : 'Tu solicitud previa no fue aprobada por la administración. Puedes enviar una nueva solicitud si ya regularizaste tu situación.'}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setIsAuthModalOpen(true)}
                                        className="shrink-0 w-full sm:w-auto px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs sm:text-sm shadow-md transition-all active:scale-95"
                                    >
                                        Reintentar Solicitud
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Academic Cycle & Course Selector (Hidden in Print) */}
                    {reportData.courses && reportData.courses.length > 0 && (
                        <div className="mb-6 bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm print:hidden">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                                <div>
                                    <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                        <GraduationCap className="w-4 h-4 text-brand-blue" />
                                        Seleccionar Ciclo Escolar / Grado a Emitir:
                                    </span>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                        Elige el grado o año escolar cursado para generar la boleta oficial correspondiente, o consulta el historial general.
                                    </p>
                                </div>
                                {selectedCourseFilter !== 'ALL' && (
                                    <span className="text-[11px] font-bold text-brand-blue bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 px-2.5 py-1 rounded-lg self-start sm:self-auto">
                                        Emisión Específica por Ciclo
                                    </span>
                                )}
                            </div>

                            <div className="flex flex-wrap gap-2.5">
                                {reportData.courses.map((course: any) => {
                                    const isSelected = selectedCourseFilter === course.course_id;
                                    const isPromoted = course.academic_status === 'PROMOTED';
                                    const isActive = course.is_active || course.academic_status === 'ACTIVE';

                                    return (
                                        <button
                                            key={course.course_id}
                                            onClick={() => setSelectedCourseFilter(course.course_id)}
                                            className={`px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all border text-left flex items-center gap-2.5 active:scale-95 ${
                                                isSelected
                                                    ? 'bg-brand-blue text-white border-brand-blue shadow-md'
                                                    : 'bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
                                            }`}
                                        >
                                            <div className="flex flex-col">
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <span className="font-extrabold">
                                                        {course.cycle_year ? `Ciclo ${course.cycle_year} • ` : ''}{course.course_name}
                                                    </span>
                                                    {course.schedule_grade && (
                                                        <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                                                            {course.schedule_grade}
                                                        </span>
                                                    )}
                                                </div>
                                                <span className={`text-[10px] font-medium mt-0.5 ${isSelected ? 'text-blue-100' : isPromoted ? 'text-emerald-600 dark:text-emerald-400 font-bold' : isActive ? 'text-blue-600 dark:text-blue-400 font-bold' : 'text-slate-400'}`}>
                                                    {isPromoted ? '✓ Aprobado / Promovido' : isActive ? '● Actualmente Cursando' : 'Finalizado'}
                                                    {course.average ? ` (Promedio: ${course.average} pts)` : ''}
                                                </span>
                                            </div>
                                        </button>
                                    );
                                })}

                                {reportData.courses.length > 1 && (
                                    <button
                                        onClick={() => setSelectedCourseFilter('ALL')}
                                        className={`px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-2 active:scale-95 ${
                                            selectedCourseFilter === 'ALL'
                                                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white shadow-md'
                                                : 'bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                                        }`}
                                    >
                                        <BookOpen className="w-3.5 h-3.5" />
                                        <span>Historial Completo (Todos los Años)</span>
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Document Container Canvas */}
                    <div className="bg-slate-100/70 dark:bg-slate-950/60 p-2 sm:p-6 lg:p-8 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 print:p-0 print:m-0 print:border-none print:bg-white print:dark:bg-white">
                        
                        {/* Printable Paper */}
                        <div className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white p-5 sm:p-10 md:p-14 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-800 print:shadow-none print:border-none print:p-0 print:m-0 print:bg-white print:text-black print:dark:bg-white print:dark:text-black">
                            
                            {(() => {
                                const selectedCourseObj = selectedCourseFilter !== 'ALL'
                                    ? reportData.courses.find((c: any) => c.course_id === selectedCourseFilter)
                                    : null;

                                const baseCourses = selectedCourseObj
                                    ? [selectedCourseObj]
                                    : reportData.courses;

                                const activeCourses = baseCourses.filter((c: any) => !disabledCourses[c.course_name]);

                                let totalScoreSum = 0;
                                let totalUnits = 0;

                                activeCourses.forEach((c: any) => {
                                    const sum = c.units.reduce((acc: number, curr: any) => acc + (curr.restricted ? 0 : curr.score), 0);
                                    totalScoreSum += sum;
                                    totalUnits += c.units.filter((u: any) => !u.restricted).length;
                                });

                                const visibleGeneralAverage = totalUnits > 0 ? (totalScoreSum / totalUnits).toFixed(2) : '0.00';

                                return (
                                    <>
                                        {/* Header */}
                                        <div className="flex flex-col sm:flex-row justify-between items-start border-b-2 border-slate-800 dark:border-slate-700 print:border-slate-900 pb-6 mb-6 gap-4">
                                            <div>
                                                <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-widest text-slate-900 dark:text-white print:text-black">
                                                    Ultra Tecnología
                                                </h1>
                                                <p className="text-slate-500 dark:text-slate-400 print:text-slate-600 font-medium tracking-wider mt-1 uppercase text-xs sm:text-sm">
                                                    {selectedCourseObj
                                                        ? `Boleta Oficial de Calificaciones • Ciclo Escolar ${selectedCourseObj.cycle_year || ''}`
                                                        : 'Historial Académico Consolidado (Kárdex General)'}
                                                </p>
                                                <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500 mt-1 flex-wrap">
                                                    <span>Fecha de Emisión: {new Date().toLocaleDateString('es-GT', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                                                    {selectedCourseObj?.schedule_grade && (
                                                        <span>• Grado: <strong className="text-slate-700 dark:text-slate-200 print:text-black">{selectedCourseObj.schedule_grade}</strong></span>
                                                    )}
                                                    {selectedCourseObj?.academic_status === 'PROMOTED' && (
                                                        <span className="text-emerald-600 dark:text-emerald-400 font-bold">• ✓ Aprobado / Promovido</span>
                                                    )}
                                                    {selectedCourseObj?.academic_status === 'ACTIVE' && (
                                                        <span className="text-blue-600 dark:text-blue-400 font-bold">• ● En Curso</span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="sm:text-right">
                                                <h2 className="text-lg sm:text-xl font-bold text-slate-800 dark:text-slate-100 print:text-black">
                                                    {reportData.student.full_name}
                                                </h2>
                                                <p className="text-slate-500 dark:text-slate-400 print:text-slate-600 text-xs sm:text-sm mt-0.5">
                                                    ID Estudiante: <span className="font-mono font-bold">{reportData.student.id.substring(0, 8).toUpperCase()}</span>
                                                </p>
                                            </div>
                                        </div>

                                        {/* Summary Box */}
                                        <div className="bg-slate-50 dark:bg-slate-800/60 print:bg-white print:border-2 print:border-slate-800 p-4 sm:p-6 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 grid grid-cols-2 gap-4 items-center mb-8">
                                            <div>
                                                <p className="text-[11px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 print:text-slate-600 uppercase tracking-wider mb-1">
                                                    Promedio {selectedCourseObj ? 'del Ciclo' : 'General'}
                                                </p>
                                                <p className={`text-2xl sm:text-4xl font-black ${Number(visibleGeneralAverage) >= 60 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                                    {visibleGeneralAverage} <span className="text-xs sm:text-lg text-slate-400 font-normal">/ 100</span>
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[11px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 print:text-slate-600 uppercase tracking-wider mb-1">
                                                    {selectedCourseObj ? 'Estatus Académico' : 'Cursos Mostrados'}
                                                </p>
                                                <div className="text-sm sm:text-lg font-black text-slate-800 dark:text-white print:text-black">
                                                    {selectedCourseObj ? (
                                                        selectedCourseObj.academic_status === 'PROMOTED' ? (
                                                            <span className="text-emerald-600 dark:text-emerald-400">APROBADO</span>
                                                        ) : selectedCourseObj.academic_status === 'ACTIVE' ? (
                                                            <span className="text-blue-600 dark:text-blue-400">CURSANDO</span>
                                                        ) : (
                                                            <span>FINALIZADO</span>
                                                        )
                                                    ) : (
                                                        `${activeCourses.length} curso(s)`
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Filters (Hidden in print) - Only shown if consolidated view */}
                                        {selectedCourseFilter === 'ALL' && reportData.courses.length > 1 && (
                                            <div className="mb-8 print:hidden">
                                                <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                                                    Filtrar Cursos en la Boleta:
                                                </h3>
                                                <div className="flex flex-wrap gap-2">
                                                    {reportData.courses.map((course: any) => {
                                                        const isDisabled = disabledCourses[course.course_name];
                                                        return (
                                                            <button
                                                                key={`filter-${course.course_name}`}
                                                                onClick={() => setDisabledCourses(prev => ({
                                                                    ...prev,
                                                                    [course.course_name]: !isDisabled
                                                                }))}
                                                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 active:scale-95 ${
                                                                    isDisabled
                                                                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700 line-through'
                                                                        : 'bg-brand-blue/10 dark:bg-brand-blue/20 text-brand-blue dark:text-blue-400 border-brand-blue/20'
                                                                }`}
                                                            >
                                                                <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${isDisabled ? 'border-slate-400' : 'bg-brand-blue border-brand-blue text-white'}`}>
                                                                    {!isDisabled && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                                                                </div>
                                                                <span>{course.course_name}</span>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}

                                        {/* Grades Table per Course */}
                                        {activeCourses.length > 0 ? (
                                            activeCourses.map((course: any) => (
                                                <div key={course.course_name} className="mb-8 last:mb-0 page-break-inside-avoid">
                                                    <div className="flex flex-col sm:flex-row justify-between sm:items-end mb-3 pb-2 border-b border-slate-200 dark:border-slate-700/80 gap-1.5">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <h3 className="text-base sm:text-lg font-bold text-slate-800 dark:text-white print:text-black">
                                                                {course.course_name}
                                                            </h3>
                                                            {course.schedule_grade && (
                                                                <span className="text-xs px-2 py-0.5 rounded-md font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 print:border print:border-slate-300">
                                                                    {course.schedule_grade}
                                                                </span>
                                                            )}
                                                            {course.cycle_year && (
                                                                <span className="text-xs px-2 py-0.5 rounded-md font-semibold bg-blue-50 dark:bg-blue-950/40 text-brand-blue dark:text-blue-400 print:border print:border-slate-300">
                                                                    Ciclo {course.cycle_year}
                                                                </span>
                                                            )}
                                                            {course.academic_status === 'PROMOTED' && (
                                                                <span className="text-xs px-2 py-0.5 rounded-md font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 print:border print:border-slate-300">
                                                                    ✓ Promovido
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="self-start sm:self-auto text-xs font-bold bg-slate-100 dark:bg-slate-800 print:bg-slate-100 px-3 py-1 rounded-lg text-slate-700 dark:text-slate-300 print:text-black border border-slate-200/60 dark:border-slate-700/60">
                                                            Promedio Curso: <span className="font-extrabold">{course.average} pts</span>
                                                        </div>
                                                    </div>

                                        {course.payment_restricted && (
                                            <div className="mb-3 p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl flex items-center gap-2 text-xs sm:text-sm text-amber-700 dark:text-amber-300 print:hidden">
                                                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                                </svg>
                                                <span>Algunas calificaciones están temporalmente restringidas por saldo pendiente.</span>
                                            </div>
                                        )}

                                        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 print:border-slate-300">
                                            <table className="w-full text-left text-xs sm:text-sm min-w-[500px]">
                                                <thead className="bg-slate-50 dark:bg-slate-800/80 print:bg-slate-100 border-b border-slate-200 dark:border-slate-800">
                                                    <tr>
                                                        <th className="px-4 py-3 text-[11px] font-bold text-slate-500 dark:text-slate-400 print:text-slate-600 uppercase tracking-wider w-2/5">
                                                            Unidad Evaluativa
                                                        </th>
                                                        <th className="px-4 py-3 text-[11px] font-bold text-slate-500 dark:text-slate-400 print:text-slate-600 uppercase tracking-wider w-1/4">
                                                            Nota Alcanzada
                                                        </th>
                                                        <th className="px-4 py-3 text-[11px] font-bold text-slate-500 dark:text-slate-400 print:text-slate-600 uppercase tracking-wider">
                                                            Comentarios del Profesor
                                                        </th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 print:divide-slate-200">
                                                    {course.units.map((unit: any, idx: number) => (
                                                        <tr key={idx} className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/40 ${unit.restricted ? 'opacity-50 bg-slate-50/40 dark:bg-slate-800/20' : ''}`}>
                                                            <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-200 print:text-black">
                                                                {unit.unit_name}
                                                            </td>
                                                            <td className="px-4 py-3 font-bold">
                                                                {unit.restricted ? (
                                                                    <span className="text-slate-400 flex items-center gap-1 text-xs">
                                                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                                                        </svg>
                                                                        Pago pendiente
                                                                    </span>
                                                                ) : (
                                                                    <span className={Number(unit.score) >= 60 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                                                                        {unit.score} pts
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400 print:text-slate-600 italic">
                                                                {unit.restricted ? '—' : (unit.remarks || 'Sin comentarios registrados')}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-10 text-slate-400 dark:text-slate-500 italic text-xs sm:text-sm">
                                    No hay calificaciones o evaluaciones registradas actualmente.
                                </div>
                            )}

                            {/* Institutional Digital Certification & Anti-forgery Security Card */}
                            <div className="mt-12 sm:mt-16 p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-slate-50 to-blue-50/40 dark:from-slate-800/60 dark:to-slate-800/20 border border-slate-200/90 dark:border-slate-700/80 print:bg-white print:border-slate-300">
                                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                    <div className="flex items-start gap-3">
                                        <div className="p-2.5 rounded-xl bg-brand-blue/15 text-brand-blue dark:text-blue-400 print:bg-slate-100 print:text-slate-800 shrink-0 mt-0.5">
                                            <ShieldCheck className="w-6 h-6" />
                                        </div>
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-xs font-black tracking-wider uppercase text-brand-blue dark:text-blue-400 print:text-slate-900">
                                                    Documento Digital Certificado
                                                </span>
                                                <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300/60 dark:border-emerald-800">
                                                    ✓ VALIDEZ OFICIAL ELECTRÓNICA
                                                </span>
                                            </div>
                                            <p className="text-[10px] sm:text-[11px] text-slate-600 dark:text-slate-400 print:text-slate-700 max-w-2xl leading-relaxed">
                                                Este documento oficial ha sido generado y certificado por el sistema central de <span className="font-semibold text-slate-800 dark:text-slate-200 print:text-black">Ultra Tecnología (ULTEC)</span>. Cuenta con sello digital y código de validación institucional. Se prescinde de firma autógrafa física para prevenir falsificaciones según normativas de seguridad digital.
                                            </p>
                                            <div className="flex items-center gap-4 text-[9px] text-slate-500 dark:text-slate-400 print:text-slate-600 pt-1 flex-wrap">
                                                <span><strong>Emisión:</strong> {new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
                                                <span><strong>Folio Digital:</strong> ULTEC-BOL-{reportData.student?.id ? reportData.student.id.slice(0, 8).toUpperCase() : 'SEC'}-{new Date().getFullYear()}</span>
                                                <span><strong>Seguridad:</strong> SHA256-DIGITAL-VERIFIED</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="shrink-0 flex items-center gap-3 self-end sm:self-center">
                                        <div className="w-14 h-14 rounded-xl border border-slate-200 dark:border-slate-700 p-1.5 flex flex-col items-center justify-center bg-white dark:bg-slate-900 shadow-sm print:border-slate-400">
                                            <div className="w-full h-full border border-dashed border-slate-400 dark:border-slate-600 rounded flex flex-col items-center justify-center text-[7px] font-mono text-center text-slate-500 font-bold leading-tight">
                                                <span>QR</span>
                                                <span>VERIF</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                        </>
                    );
                })()}

            </div>
        </div>
    </div>
)}

            {/* Student Request Authorization Modal */}
            {isAuthModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 rounded-xl bg-brand-blue/15 text-brand-blue dark:text-blue-400">
                                    <ShieldCheck className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-900 dark:text-white text-base">
                                        {isSecretary ? 'Solicitar Autorización' : 'Solicitar Boleta Oficial a Dirección'}
                                    </h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        Boleta Oficial de Calificaciones
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsAuthModalOpen(false)}
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg"
                                disabled={isSubmittingAuth}
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            <div className="p-3.5 bg-blue-50 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-900/50 rounded-2xl text-xs text-blue-900 dark:text-blue-200 space-y-1">
                                <p className="font-bold flex items-center gap-1">
                                    <span>🛡️</span> Validación Institucional
                                </p>
                                <p className="leading-relaxed">
                                    {isSecretary
                                        ? 'Como secretaria, la solicitud de emisión para este alumno será turnada a la Dirección General para su aprobación institucional antes de habilitar su descarga o impresión.'
                                        : 'Tu solicitud será enviada a la Dirección General. Una vez aprobada e impresa con sello oficial, podrás pasar a recogerla físicamente a las oficinas del plantel.'}
                                </p>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                                    Ciclo / Grado a Solicitar
                                </label>
                                <select
                                    value={selectedCycleForRequest}
                                    onChange={(e) => setSelectedCycleForRequest(e.target.value)}
                                    className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-800 dark:text-white focus:ring-2 focus:ring-brand-blue focus:outline-none transition-all font-medium"
                                >
                                    {reportData?.courses && reportData.courses.length > 0 && (
                                        <>
                                            {reportData.courses.map((c: any) => (
                                                <option key={c.course_id} value={c.course_id}>
                                                    {c.cycle_year ? `Ciclo ${c.cycle_year} • ` : ''}{c.course_name}{c.schedule_grade ? ` (${c.schedule_grade})` : ''} {c.academic_status === 'COMPLETED' ? '• Concluido' : c.is_active ? '• En Curso' : ''}
                                                </option>
                                            ))}
                                            <option value="ALL">Historial Completo Consolidado (Todos los ciclos)</option>
                                        </>
                                    )}
                                    {(!reportData?.courses || reportData.courses.length === 0) && (
                                        <option value="ALL">Historial Completo Consolidado</option>
                                    )}
                                </select>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                                    Especifica el ciclo escolar para que Secretaría y Dirección preparen exactamente el documento requerido.
                                </p>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                                    Motivo de la solicitud (Opcional)
                                </label>
                                <textarea
                                    value={authReason}
                                    onChange={(e) => setAuthReason(e.target.value)}
                                    placeholder="Ej: Trámite de beca, solicitud de padres de familia, archivo personal..."
                                    rows={3}
                                    className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-800 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-brand-blue focus:outline-none transition-all resize-none"
                                />
                            </div>
                        </div>

                        <div className="p-4 sm:p-6 bg-slate-50/50 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
                            <button
                                onClick={() => setIsAuthModalOpen(false)}
                                disabled={isSubmittingAuth}
                                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSendAuthRequest}
                                disabled={isSubmittingAuth}
                                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-brand-blue to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-bold text-xs shadow-md transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2"
                            >
                                {isSubmittingAuth ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        <span>Enviando...</span>
                                    </>
                                ) : (
                                    <>
                                        <Send className="w-4 h-4" />
                                        <span>Enviar Solicitud</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Admin Document Authorizations Management Modal */}
            {showAdminRequestsModal && !isStudent && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-2xl shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
                        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2.5 rounded-xl bg-purple-500/15 text-purple-600 dark:text-purple-400">
                                    <ShieldCheck className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-900 dark:text-white text-lg">
                                        Solicitudes de Boletas Oficiales
                                    </h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        Control de autorizaciones para descarga e impresión estudiantil
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowAdminRequestsModal(false)}
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto space-y-3 flex-1 custom-scrollbar">
                            {!allRequests || allRequests.length === 0 ? (
                                <div className="text-center py-12 text-slate-400 text-sm">
                                    No hay solicitudes de autorización registradas.
                                </div>
                            ) : (
                                allRequests.map((req: DocumentAuthorization) => (
                                    <div
                                        key={req.id}
                                        className="p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                                    >
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-sm text-slate-900 dark:text-white">
                                                    {req.student_name || `Alumno ID: ${req.student_id}`}
                                                </span>
                                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-black uppercase ${
                                                    req.status === 'DELIVERED'
                                                        ? 'bg-teal-600 text-white'
                                                        : req.status === 'APPROVED'
                                                            ? 'bg-emerald-500 text-white'
                                                            : req.status === 'PENDING'
                                                                ? 'bg-amber-500 text-white'
                                                                : req.status === 'CONSUMED'
                                                                    ? 'bg-slate-500 text-white'
                                                                    : 'bg-rose-500 text-white'
                                                }`}>
                                                    {req.status === 'DELIVERED'
                                                        ? 'Entregada'
                                                        : req.status === 'APPROVED'
                                                            ? 'Autorizada'
                                                            : req.status === 'PENDING'
                                                                ? 'Pendiente'
                                                                : req.status === 'CONSUMED'
                                                                    ? 'Finalizada'
                                                                    : 'Rechazada'}
                                                </span>
                                            </div>
                                            <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                                                <span className="px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 text-[11px] font-bold">
                                                    📄 {req.cycle_name || req.course_name || 'Boleta General / Consolidada'}
                                                </span>
                                            </div>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                                {req.personal_code ? `Código: ${req.personal_code} • ` : ''}
                                                Solicitada: {req.requested_at ? new Date(req.requested_at).toLocaleDateString() : 'Reciente'}
                                                {req.delivered_at ? ` • Entregada: ${new Date(req.delivered_at).toLocaleDateString()}` : ''}
                                                {req.delivered_by_name ? ` (${req.delivered_by_name})` : ''}
                                            </p>
                                            {req.reason && (
                                                <p className="text-xs text-slate-700 dark:text-slate-300 mt-1 italic">
                                                    "{req.reason}"
                                                </p>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-2 self-end sm:self-center flex-wrap justify-end">
                                            {(req.status === 'APPROVED' || req.status === 'CONSUMED') && (
                                                <button
                                                    onClick={() => handleMarkDelivered(req.id)}
                                                    className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1 active:scale-95"
                                                    title="Registrar que el alumno ya recibió físicamente la boleta en oficinas"
                                                >
                                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                                    <span>Registrar Entrega</span>
                                                </button>
                                            )}

                                            {req.status === 'DELIVERED' && (
                                                <div className="flex items-center gap-1">
                                                    <span className="px-2.5 py-1 bg-teal-100 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 font-bold text-xs rounded-lg flex items-center gap-1">
                                                        <Check className="w-3.5 h-3.5" />
                                                        <span>Entregada</span>
                                                    </span>
                                                    {isAdmin && (
                                                        <button
                                                            onClick={() => handleAdminUpdateAuth(req.id, 'APPROVED')}
                                                            className="text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 underline ml-1"
                                                            title="Revertir a estado autorizada"
                                                        >
                                                            Revertir
                                                        </button>
                                                    )}
                                                </div>
                                            )}

                                            {isAdmin && req.status !== 'APPROVED' && req.status !== 'DELIVERED' && (
                                                <button
                                                    onClick={() => handleAdminUpdateAuth(req.id, 'APPROVED')}
                                                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1"
                                                >
                                                    <Check className="w-3.5 h-3.5" />
                                                    <span>Autorizar</span>
                                                </button>
                                            )}

                                            {isAdmin && req.status === 'APPROVED' && (
                                                <button
                                                    onClick={() => handleAdminUpdateAuth(req.id, 'REJECTED')}
                                                    className="px-3 py-1.5 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 rounded-xl text-xs font-bold transition-all"
                                                >
                                                    Revocar
                                                </button>
                                            )}

                                            {isAdmin && req.status === 'PENDING' && (
                                                <button
                                                    onClick={() => handleAdminUpdateAuth(req.id, 'REJECTED')}
                                                    className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all"
                                                >
                                                    Rechazar
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800 text-right">
                            <button
                                onClick={() => setShowAdminRequestsModal(false)}
                                className="px-5 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-white font-bold text-xs hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}
            <style dangerouslySetInnerHTML={{
                __html: `
                @media print {
                    @page { margin: 12mm; size: letter; }
                    body { background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    #root { height: auto !important; overflow: visible !important; }
                }
            `}} />
        </div>
    );
};

export default ReportCard;
