import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { 
    ShieldCheck, Search, Printer, CheckCircle2, Clock, 
    AlertCircle, Building2, UserCheck, RefreshCw, Check, X,
    Layers, Loader2, Info
} from 'lucide-react';
import { credentialsService, type CredentialRequestItem, type StudentCredentialCard } from '../../services/credentialsService';
import { getBranches, type Branch } from '../branches/branchesService';
import { getCourses } from './academicService';
import CycleSelectorPills from '../../components/common/CycleSelectorPills';

export const StudentCredentialsAdmin: React.FC = () => {
    const [requests, setRequests] = useState<CredentialRequestItem[]>([]);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [courses, setCourses] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Filters
    const [activeTab, setActiveTab] = useState<'PENDING' | 'READY' | 'DELIVERED' | 'ALL'>('PENDING');
    const [selectedBranch, setSelectedBranch] = useState<string>('ALL');
    const [selectedYearFilter, setSelectedYearFilter] = useState<'ALL' | number>('ALL');
    const [searchQuery, setSearchQuery] = useState<string>('');

    // Modal for Individual Print / Preview
    const [selectedPrintStudent, setSelectedPrintStudent] = useState<StudentCredentialCard | null>(null);
    const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
    const [printQrUrl, setPrintQrUrl] = useState<string>('');
    const [isLoadingPrint, setIsLoadingPrint] = useState(false);

    // Delivery confirmation modal
    const [deliveryCandidate, setDeliveryCandidate] = useState<CredentialRequestItem | null>(null);
    const [isSubmittingStatus, setIsSubmittingStatus] = useState(false);

    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

    // Distinct cycles from courses and requests
    const distinctCycles = React.useMemo(() => {
        const years = new Set<number>();
        courses.forEach((c: any) => {
            if (c.academic_year) years.add(Number(c.academic_year));
        });
        requests.forEach((r: any) => {
            if (r.academic_year) years.add(Number(r.academic_year));
        });
        if (years.size === 0) {
            const currentYear = new Date().getFullYear();
            years.add(currentYear);
            years.add(currentYear + 1);
        }
        return Array.from(years).sort((a, b) => b - a);
    }, [courses, requests]);

    const fetchRequests = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await credentialsService.getCredentialRequests({
                status: activeTab,
                branch_id: selectedBranch !== 'ALL' ? selectedBranch : undefined,
                search: searchQuery.trim() || undefined,
                academic_year: selectedYearFilter !== 'ALL' ? selectedYearFilter : undefined
            });
            setRequests(data);
        } catch (err: any) {
            console.error('Error fetching credential requests:', err);
            setError(err.response?.data?.message || 'Error al cargar las solicitudes de carnets.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        getBranches().then((b: Branch[]) => setBranches(b)).catch(() => {});
        getCourses().then((c: any[]) => setCourses(c)).catch(() => {});
    }, []);

    useEffect(() => {
        fetchRequests();
    }, [activeTab, selectedBranch, selectedYearFilter]);

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        fetchRequests();
    };

    const handleMarkReady = async (reqItem: CredentialRequestItem) => {
        if (!confirm(`¿Confirmas que el carnet oficial de ${reqItem.full_name} está impreso y listo para recoger en la Secretaría?`)) {
            return;
        }

        setIsSubmittingStatus(true);
        try {
            await credentialsService.updateCredentialRequestStatus(reqItem.id, {
                status: 'READY',
                notes: 'Impreso y disponible para entrega presencial'
            });
            await fetchRequests();
        } catch (err: any) {
            alert(err.response?.data?.message || 'Error al actualizar estado.');
        } finally {
            setIsSubmittingStatus(false);
        }
    };

    const handleConfirmDelivery = async () => {
        if (!deliveryCandidate) return;

        setIsSubmittingStatus(true);
        try {
            await credentialsService.updateCredentialRequestStatus(deliveryCandidate.id, {
                status: 'DELIVERED',
                notes: 'Entregado en ventanilla física'
            });
            setDeliveryCandidate(null);
            await fetchRequests();
        } catch (err: any) {
            alert(err.response?.data?.message || 'Error al registrar entrega.');
        } finally {
            setIsSubmittingStatus(false);
        }
    };

    const handleOpenPrintPreview = async (studentId: string, targetYear?: number) => {
        setIsLoadingPrint(true);
        setIsPrintModalOpen(true);
        try {
            const card = await credentialsService.getStudentCredentialCard(
                studentId,
                targetYear ? { academic_year: targetYear } : undefined
            );
            setSelectedPrintStudent(card);

            if (card.verification_url) {
                const qr = await QRCode.toDataURL(card.verification_url, {
                    width: 320,
                    margin: 1,
                    color: { dark: '#000000', light: '#ffffff' }
                });
                setPrintQrUrl(qr);
            }
        } catch (err: any) {
            alert('Error al obtener datos para impresión del carnet.');
            setIsPrintModalOpen(false);
        } finally {
            setIsLoadingPrint(false);
        }
    };

    const handleTriggerPrint = () => {
        window.print();
    };

    // Metrics counters
    const pendingCount = requests.filter(r => r.status === 'PENDING').length;
    const readyCount = requests.filter(r => r.status === 'READY').length;
    const deliveredCount = requests.filter(r => r.status === 'DELIVERED').length;

    return (
        <div className="space-y-6 pb-20 animate-in fade-in duration-300">
            {/* Top Title & Stats Banner */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-blue/10 dark:bg-brand-blue/20 text-brand-blue text-xs font-bold uppercase tracking-wider mb-2">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Emisión Oficial y Control Presencial</span>
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                        Gestión de Carnets y Credenciales Oficiales
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Control de solicitudes, impresión física autorizada y registro de entrega en ventanilla.
                    </p>
                </div>

                {/* Counter Pills */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                    <div className="p-3 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-3 shrink-0">
                        <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold text-sm">
                            {pendingCount}
                        </div>
                        <div>
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Por Emitir</span>
                            <span className="text-xs font-bold text-slate-800 dark:text-white">Pendientes</span>
                        </div>
                    </div>

                    <div className="p-3 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-3 shrink-0">
                        <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-brand-blue flex items-center justify-center font-bold text-sm">
                            {readyCount}
                        </div>
                        <div>
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">En Secretaría</span>
                            <span className="text-xs font-bold text-slate-800 dark:text-white">Listos para Entrega</span>
                        </div>
                    </div>

                    <div className="p-3 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-3 shrink-0">
                        <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold text-sm">
                            {deliveredCount}
                        </div>
                        <div>
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Completados</span>
                            <span className="text-xs font-bold text-slate-800 dark:text-white">Entregados</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filter Tabs & Search Bar */}
            <div className="bg-white dark:bg-[#1c1f2a] p-4 rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-sm space-y-4">
                <div className="flex flex-col md:flex-row items-center justify-between gap-3">
                    {/* Status Tabs */}
                    <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl w-full md:w-auto overflow-x-auto no-scrollbar">
                        {[
                            { key: 'PENDING', label: 'Pendientes de Emisión', icon: Clock },
                            { key: 'READY', label: 'Listos en Plantel', icon: CheckCircle2 },
                            { key: 'DELIVERED', label: 'Historial Entregados', icon: UserCheck },
                            { key: 'ALL', label: 'Todas las Solicitudes', icon: Layers }
                        ].map(t => {
                            const Icon = t.icon;
                            const isSelected = activeTab === t.key;
                            return (
                                <button
                                    key={t.key}
                                    onClick={() => setActiveTab(t.key as any)}
                                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                                        isSelected
                                            ? 'bg-brand-blue text-white shadow-sm shadow-brand-blue/20'
                                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                    }`}
                                >
                                    <Icon className="w-3.5 h-3.5" />
                                    <span>{t.label}</span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Secondary Filters: Ciclo Lectivo & Sede */}
                    <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                        <CycleSelectorPills
                            cycles={distinctCycles}
                            selectedYear={selectedYearFilter}
                            onSelectYear={(year) => setSelectedYearFilter(year as any)}
                            maxVisiblePills={1}
                        />

                        {branches.length > 0 && (
                            <div className="flex items-center gap-2">
                                <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
                                <select
                                    value={selectedBranch}
                                    onChange={(e) => setSelectedBranch(e.target.value)}
                                    className="px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-blue/30 w-full md:w-48"
                                >
                                    <option value="ALL">Todas las Sedes</option>
                                    {branches.map(b => (
                                        <option key={b.id} value={b.id}>{b.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>
                </div>

                {/* Text Search */}
                <form onSubmit={handleSearchSubmit} className="flex gap-2">
                    <div className="relative flex-1">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Buscar por nombre de alumno, código personal o sede..."
                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-brand-blue"
                        />
                    </div>
                    <button
                        type="submit"
                        className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-brand-blue hover:text-white text-slate-700 dark:text-slate-300 font-bold text-xs rounded-2xl transition-all border border-slate-200 dark:border-slate-700 shrink-0"
                    >
                        Buscar
                    </button>
                </form>
            </div>

            {/* Results Grid / Table */}
            {loading ? (
                <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
                    <Loader2 className="w-8 h-8 animate-spin text-brand-blue" />
                    <p className="text-xs font-semibold">Cargando expedientes de credenciales...</p>
                </div>
            ) : error ? (
                <div className="p-8 text-center bg-white dark:bg-[#1c1f2a] rounded-3xl border border-rose-500/20 text-rose-500">
                    <AlertCircle className="w-8 h-8 mx-auto mb-2" />
                    <p className="text-sm font-bold">{error}</p>
                </div>
            ) : requests.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {requests.map(item => {
                        const isPending = item.status === 'PENDING';
                        const isReady = item.status === 'READY';
                        const isDelivered = item.status === 'DELIVERED';

                        return (
                            <div 
                                key={item.id}
                                className={`bg-white dark:bg-[#1c1f2a] rounded-3xl p-5 border transition-all duration-300 flex flex-col justify-between shadow-sm hover:shadow-md ${
                                    isReady ? 'border-blue-500/30 dark:border-blue-500/20 bg-blue-500/[0.02]' :
                                    isDelivered ? 'border-emerald-500/30 dark:border-emerald-500/20' :
                                    'border-slate-200/80 dark:border-white/10'
                                }`}
                            >
                                <div>
                                    {/* Top Status & Date */}
                                    <div className="flex items-center justify-between gap-2 mb-3">
                                        <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full ${
                                            isDelivered ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' :
                                            isReady ? 'bg-blue-500/10 text-brand-blue border border-blue-500/20 animate-pulse' :
                                            'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                                        }`}>
                                            {isDelivered ? '✓ Entregado en Plantel' :
                                             isReady ? 'Listo en Secretaría' : 'Pendiente de Emisión'}
                                        </span>

                                        <span className="text-[11px] text-slate-400 font-semibold">
                                            {new Date(item.requested_at).toLocaleDateString('es-ES')}
                                        </span>
                                    </div>

                                    {/* Student Info */}
                                    <div className="flex items-start gap-3.5 mb-3">
                                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-blue to-brand-purple flex items-center justify-center text-white font-black text-lg shadow-sm shrink-0">
                                            {item.full_name.charAt(0)?.toUpperCase()}
                                        </div>
                                        <div className="min-w-0">
                                            <h4 className="font-black text-sm text-slate-900 dark:text-white leading-snug truncate" title={item.full_name}>
                                                {item.full_name}
                                            </h4>
                                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                                <span className="text-[10px] font-mono font-bold text-brand-blue bg-brand-blue/5 dark:bg-brand-blue/15 px-1.5 py-0.5 rounded">
                                                    {item.personal_code}
                                                </span>
                                                {item.academic_year && (
                                                    <span className="text-[10px] font-bold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-900/30 border border-teal-200 dark:border-teal-800/50 px-1.5 py-0.5 rounded">
                                                        Ciclo {item.academic_year}
                                                    </span>
                                                )}
                                                <span className="text-[10px] text-slate-500 truncate">
                                                    {item.branch_name}
                                                </span>
                                            </div>
                                            <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 truncate">
                                                {item.courses[0] || 'Carrera Técnica'}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Reason / Notes */}
                                    <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700/50 text-xs text-slate-600 dark:text-slate-400 space-y-1 mb-4">
                                        <div className="flex items-center justify-between text-[10px] font-bold uppercase text-slate-400">
                                            <span>Motivo de Solicitud</span>
                                            <span className="text-brand-blue">{item.request_type === 'REPLACEMENT' ? 'Reposición' : 'Primer Carnet'}</span>
                                        </div>
                                        <p className="italic line-clamp-2">"{item.reason}"</p>
                                        {isDelivered && item.delivered_at && (
                                            <p className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 pt-1 border-t border-slate-200 dark:border-slate-700">
                                                Entregado: {new Date(item.delivered_at).toLocaleDateString('es-ES')} por {item.delivered_by || 'Administración'}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* Administrative Actions */}
                                <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                                    <div className="grid grid-cols-2 gap-2">
                                        {/* Action: Open Print Official PVC format */}
                                        <button
                                            onClick={() => handleOpenPrintPreview(
                                                item.student_id,
                                                selectedYearFilter !== 'ALL' ? Number(selectedYearFilter) : item.academic_year
                                            )}
                                            className="w-full py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors border border-slate-200 dark:border-slate-700"
                                        >
                                            <Printer className="w-3.5 h-3.5 text-brand-blue" />
                                            <span>Imprimir</span>
                                        </button>

                                        {/* Action: Toggle state */}
                                        {isPending ? (
                                            <button
                                                onClick={() => handleMarkReady(item)}
                                                disabled={isSubmittingStatus}
                                                className="w-full py-2.5 px-3 rounded-xl bg-brand-blue hover:bg-blue-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm shadow-blue-500/25 disabled:opacity-50"
                                            >
                                                <CheckCircle2 className="w-3.5 h-3.5" />
                                                <span>Listo en Plantel</span>
                                            </button>
                                        ) : isReady ? (
                                            <button
                                                onClick={() => setDeliveryCandidate(item)}
                                                disabled={isSubmittingStatus}
                                                className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm shadow-emerald-600/25 disabled:opacity-50"
                                            >
                                                <UserCheck className="w-3.5 h-3.5" />
                                                <span>Entregar</span>
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => handleMarkReady(item)}
                                                className="w-full py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 text-slate-500 font-semibold text-xs flex items-center justify-center gap-1"
                                            >
                                                <RefreshCw className="w-3 h-3" />
                                                <span>Re-emitir</span>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="p-12 text-center bg-white dark:bg-[#1c1f2a] rounded-3xl border border-dashed border-slate-300 dark:border-slate-700 space-y-3">
                    <ShieldCheck className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto" />
                    <h4 className="text-base font-bold text-slate-800 dark:text-white">No hay solicitudes en esta sección</h4>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                        {activeTab === 'PENDING' ? 'No hay carnets pendientes de impresión en este momento.' :
                         activeTab === 'READY' ? 'No hay credenciales en espera de ser recogidas en ventanilla.' :
                         'No se encontraron registros que coincidan con los filtros seleccionados.'}
                    </p>
                </div>
            )}

            {/* Delivery Confirmation Modal */}
            {deliveryCandidate && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                                <UserCheck className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-slate-900 dark:text-white">Registrar Entrega Presencial</h3>
                                <p className="text-xs text-slate-500">Confirmación de entrega física en ventanilla</p>
                            </div>
                        </div>

                        <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 space-y-2 text-xs">
                            <p className="text-slate-700 dark:text-slate-200">
                                <strong>Estudiante:</strong> {deliveryCandidate.full_name}
                            </p>
                            <p className="text-slate-700 dark:text-slate-200">
                                <strong>Código:</strong> {deliveryCandidate.personal_code}
                            </p>
                            <p className="text-slate-700 dark:text-slate-200">
                                <strong>Sede:</strong> {deliveryCandidate.branch_name}
                            </p>
                            <p className="text-slate-500 text-[11px] pt-1 border-t border-slate-200 dark:border-slate-700">
                                Funcionario responsable: <strong>{currentUser.full_name || currentUser.email || 'Administración'}</strong>
                            </p>
                        </div>

                        <p className="text-xs text-slate-500 leading-relaxed">
                            Al confirmar, el sistema sellará la fecha y hora exacta de recepción presencial del carnet de PVC y notificará automáticamente al estudiante y sus tutores.
                        </p>

                        <div className="flex gap-3 pt-2">
                            <button
                                onClick={() => setDeliveryCandidate(null)}
                                disabled={isSubmittingStatus}
                                className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleConfirmDelivery}
                                disabled={isSubmittingStatus}
                                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 disabled:opacity-50"
                            >
                                {isSubmittingStatus ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                                <span>Confirmar Entrega</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Official Print Preview Modal (CR80 Standard PVC Card Layout) */}
            {isPrintModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
                    <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-6">
                        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
                            <div className="flex items-center gap-2.5">
                                <Printer className="w-5 h-5 text-brand-blue" />
                                <div>
                                    <h3 className="text-lg font-black text-slate-900 dark:text-white">Formato de Impresión Oficial (PVC CR80)</h3>
                                    <p className="text-xs text-slate-500">
                                        Dimensiones estándar: 85.6 mm × 53.98 mm ({selectedPrintStudent ? selectedPrintStudent.cycle : 'Credencial Institucional'})
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsPrintModalOpen(false)}
                                className="p-2 rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {isLoadingPrint ? (
                            <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
                                <Loader2 className="w-8 h-8 animate-spin text-brand-blue" />
                                <p className="text-xs font-semibold">Generando plano de impresión de alta fidelidad...</p>
                            </div>
                        ) : selectedPrintStudent && (
                            <>
                                {/* Visual Card Layout in 2 sides: Front and Back */}
                                <div id="official-print-area" className="grid grid-cols-1 sm:grid-cols-2 gap-6 p-4 bg-slate-100 dark:bg-slate-950 rounded-2xl border border-slate-300 dark:border-slate-800">
                                    {/* Front Side */}
                                    <div 
                                        className="w-full aspect-[1/1.58] rounded-2xl p-4 text-white shadow-md relative overflow-hidden flex flex-col justify-between"
                                        style={{ background: 'linear-gradient(135deg, #091a3c 0%, #0d2858 50%, #051329 100%)' }}
                                    >
                                        <div>
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <span className="text-[8px] font-black uppercase tracking-widest text-teal-300 block">CENTRO TÉCNICO</span>
                                                    <h5 className="text-xs font-black text-white">ULTRA TECNOLOGÍA</h5>
                                                </div>
                                                <div className="w-6 h-6 rounded-lg bg-blue-600 flex items-center justify-center text-[10px] font-black text-white">
                                                    UT
                                                </div>
                                            </div>
                                            <div className="h-0.5 w-full bg-gradient-to-r from-teal-400 via-blue-500 to-transparent my-2" />
                                        </div>

                                        <div className="flex items-center gap-2.5 my-auto">
                                            <div className="w-16 h-20 rounded-xl bg-slate-800 border border-teal-400/50 flex items-center justify-center text-slate-300 font-black text-2xl shrink-0">
                                                {selectedPrintStudent.full_name.charAt(0)?.toUpperCase()}
                                            </div>
                                            <div className="min-w-0">
                                                <span className="text-[9px] font-mono font-bold bg-teal-400/20 text-teal-300 px-1.5 py-0.5 rounded inline-block">
                                                    {selectedPrintStudent.student_code}
                                                </span>
                                                <p className="font-black text-xs text-white line-clamp-2 mt-1">
                                                    {selectedPrintStudent.full_name}
                                                </p>
                                                <p className="text-[10px] text-slate-300 truncate mt-0.5">
                                                    {selectedPrintStudent.course_name}
                                                </p>
                                                <p className="text-[9px] text-slate-400 truncate">
                                                    {selectedPrintStudent.branch_name}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="pt-2 border-t border-white/10 flex items-end justify-between">
                                            <div>
                                                <span className="text-[8px] uppercase tracking-wider text-slate-400 block font-semibold">Vigencia</span>
                                                <span className="text-[10px] font-black text-teal-300">{selectedPrintStudent.cycle}</span>
                                            </div>
                                            {printQrUrl && (
                                                <div className="p-0.5 bg-white rounded-lg">
                                                    <img src={printQrUrl} alt="QR" className="w-10 h-10" />
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Back Side */}
                                    <div 
                                        className="w-full aspect-[1/1.58] rounded-2xl p-4 text-slate-200 shadow-md relative overflow-hidden flex flex-col justify-between"
                                        style={{ background: 'linear-gradient(135deg, #091a3c 0%, #0d2858 50%, #051329 100%)' }}
                                    >
                                        <div>
                                            <div className="flex items-center justify-between text-[9px] font-mono text-slate-300">
                                                <span>REVERSO OFICIAL</span>
                                                <span>{selectedPrintStudent.student_code}</span>
                                            </div>
                                            <div className="h-0.5 w-full bg-white/10 my-2" />
                                        </div>

                                        <div className="space-y-2 bg-slate-950/40 p-2.5 rounded-xl border border-white/5 text-[10px]">
                                            <div>
                                                <span className="text-[8px] text-slate-400 block uppercase">Contacto Emergencia</span>
                                                <p className="font-bold text-white truncate">{selectedPrintStudent.emergency_contact.name}</p>
                                                <p className="text-teal-300 font-mono">{selectedPrintStudent.emergency_contact.phone}</p>
                                            </div>
                                            <div>
                                                <span className="text-[8px] text-slate-400 block uppercase">Plantel Sede</span>
                                                <p className="font-semibold text-white truncate">{selectedPrintStudent.branch_name}</p>
                                            </div>
                                        </div>

                                        <div className="text-center pt-2 border-t border-white/10 space-y-1">
                                            <p className="text-[8px] text-slate-400 italic">Personal e intransferible. Ultra Tecnología.</p>
                                            <div className="h-4 w-36 mx-auto bg-white/90 rounded px-1 flex items-center justify-between">
                                                {[3, 1, 4, 2, 5, 1, 3, 2, 4, 1, 3, 5, 2, 4].map((w, i) => (
                                                    <div key={i} className="bg-black h-full" style={{ width: `${w * 1.5}px` }} />
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between pt-2">
                                    <div className="flex items-center gap-2 text-xs text-slate-500">
                                        <Info className="w-4 h-4 text-brand-blue" />
                                        <span>Utiliza papel credencial PVC o cartulina satinada 300g para impresión oficial.</span>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setIsPrintModalOpen(false)}
                                            className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs"
                                        >
                                            Cerrar
                                        </button>
                                        <button
                                            onClick={handleTriggerPrint}
                                            className="px-5 py-2.5 rounded-xl bg-brand-blue hover:bg-blue-600 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-blue-500/25"
                                        >
                                            <Printer className="w-4 h-4" />
                                            <span>Mandar a Imprimir</span>
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
