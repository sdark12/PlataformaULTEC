import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getIncidents, createIncident, updateIncident, resolveIncident, deleteIncident, type DisciplineIncident } from './disciplineService';
import { getCourses, getStudents, type Course } from './academicService';
import {
    Loader2, ShieldAlert, Plus, X, Search, CheckCircle2, AlertTriangle, AlertOctagon, Star,
    Trash2, MessageSquare, Calendar, User, BookOpen, Check
} from 'lucide-react';

const INCIDENT_TYPES: Record<string, { label: string; color: string; bg: string; icon: any }> = {
    positive: { label: 'Positivo', color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800', icon: Star },
    warning: { label: 'Advertencia', color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800', icon: AlertTriangle },
    minor: { label: 'Falta Menor', color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800', icon: AlertTriangle },
    major: { label: 'Falta Mayor', color: 'text-rose-600', bg: 'bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800', icon: AlertOctagon },
    suspension: { label: 'Suspensión', color: 'text-red-700', bg: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800', icon: AlertOctagon },
};

const SEVERITY_LEVELS: Record<string, { label: string; dot: string }> = {
    low: { label: 'Baja', dot: 'bg-emerald-500' },
    medium: { label: 'Media', dot: 'bg-amber-500' },
    high: { label: 'Alta', dot: 'bg-orange-500' },
    critical: { label: 'Crítica', dot: 'bg-rose-500' },
};

const getTypeStyle = (type: string) => INCIDENT_TYPES[type] || INCIDENT_TYPES.warning;
const getSeverityStyle = (severity: string) => SEVERITY_LEVELS[severity] || SEVERITY_LEVELS.low;

const DisciplineModule = () => {
    const queryClient = useQueryClient();
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('');
    const [filterResolved, setFilterResolved] = useState('');
    const [resolveModal, setResolveModal] = useState<string | null>(null);
    const [resolveNotes, setResolveNotes] = useState('');

    // Form state
    const [form, setForm] = useState({
        student_id: '', course_id: '', incident_type: 'warning', severity: 'low',
        title: '', description: '', action_taken: '', incident_date: new Date().toISOString().split('T')[0],
        parent_notified: false
    });

    const resetForm = () => {
        setForm({
            student_id: '', course_id: '', incident_type: 'warning', severity: 'low',
            title: '', description: '', action_taken: '', incident_date: new Date().toISOString().split('T')[0],
            parent_notified: false
        });
        setEditingId(null);
        setShowForm(false);
    };

    // Queries
    const { data: incidents, isLoading } = useQuery({
        queryKey: ['discipline-incidents', filterType, filterResolved],
        queryFn: () => getIncidents({ incident_type: filterType || undefined, resolved: filterResolved || undefined }),
    });

    const { data: students } = useQuery({
        queryKey: ['students-list-all'],
        queryFn: () => getStudents(),
    });

    const { data: courses } = useQuery({
        queryKey: ['courses'],
        queryFn: getCourses,
    });

    // Mutations
    const createMutation = useMutation({
        mutationFn: (data: any) => createIncident(data),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['discipline-incidents'] }); resetForm(); },
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: any }) => updateIncident(id, data),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['discipline-incidents'] }); resetForm(); },
    });

    const resolveMutation = useMutation({
        mutationFn: ({ id, notes }: { id: string; notes: string }) => resolveIncident(id, notes),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['discipline-incidents'] }); setResolveModal(null); setResolveNotes(''); },
    });

    const deleteMutation = useMutation({
        mutationFn: deleteIncident,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['discipline-incidents'] }),
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.student_id || !form.title) return;
        if (editingId) {
            updateMutation.mutate({ id: editingId, data: form });
        } else {
            createMutation.mutate(form);
        }
    };

    const startEdit = (incident: DisciplineIncident) => {
        setForm({
            student_id: incident.student_id,
            course_id: incident.course_id || '',
            incident_type: incident.incident_type,
            severity: incident.severity,
            title: incident.title,
            description: incident.description || '',
            action_taken: incident.action_taken || '',
            incident_date: incident.incident_date,
            parent_notified: incident.parent_notified,
        });
        setEditingId(incident.id);
        setShowForm(true);
    };

    const handleDelete = (id: string) => {
        if (window.confirm('¿Estás seguro de eliminar esta incidencia? Esta acción no se puede deshacer.')) {
            deleteMutation.mutate(id);
        }
    };

    // Filter incidents by search term
    const studentsList = Array.isArray(students) ? students : (students as any)?.data || [];

    const filteredIncidents = incidents?.filter((inc) => {
        const matchSearch = !searchTerm || 
            inc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            inc.students?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            inc.description?.toLowerCase().includes(searchTerm.toLowerCase());
        return matchSearch;
    });

    const formatDate = (d: string) => {
        if (!d) return '—';
        return new Date(d).toLocaleDateString('es-GT', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    return (
        <div className="max-w-7xl mx-auto pb-12 animate-in fade-in duration-500">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
                <div>
                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Disciplina e Incidencias</h2>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">Gestión de reportes de conducta, advertencias e incidentes estudiantiles.</p>
                </div>
                <button
                    onClick={() => { resetForm(); setShowForm(true); }}
                    className="bg-brand-blue hover:bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 transition-all active:scale-95 shadow-sm shadow-blue-500/20"
                >
                    <Plus className="w-4 h-4" /> Nuevo Reporte
                </button>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3 mb-6">
                <div className="relative flex-1 min-w-[200px] max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Buscar por título, estudiante..."
                        className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue outline-none transition-all"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none cursor-pointer"
                >
                    <option value="">Todos los tipos</option>
                    {Object.entries(INCIDENT_TYPES).map(([key, val]) => (
                        <option key={key} value={key}>{val.label}</option>
                    ))}
                </select>
                <select
                    value={filterResolved}
                    onChange={(e) => setFilterResolved(e.target.value)}
                    className="px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none cursor-pointer"
                >
                    <option value="">Todos</option>
                    <option value="false">Pendientes</option>
                    <option value="true">Resueltas</option>
                </select>
            </div>

            {/* Incidents List */}
            {isLoading ? (
                <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-brand-blue" /></div>
            ) : !filteredIncidents || filteredIncidents.length === 0 ? (
                <div className="text-center py-20 glass-card">
                    <ShieldAlert className="w-16 h-16 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">No hay incidencias registradas</h3>
                    <p className="text-sm text-slate-500 mt-2">Los reportes de conducta aparecerán aquí.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filteredIncidents.map((incident) => {
                        const typeStyle = getTypeStyle(incident.incident_type);
                        const sevStyle = getSeverityStyle(incident.severity);
                        const TypeIcon = typeStyle.icon;
                        return (
                            <div key={incident.id} className={`bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 shadow-sm overflow-hidden transition-all hover:shadow-md ${incident.resolved ? 'opacity-70' : ''}`}>
                                <div className="p-5 flex items-start gap-4">
                                    {/* Icon */}
                                    <div className={`p-3 rounded-xl border shrink-0 ${typeStyle.bg}`}>
                                        <TypeIcon className={`w-5 h-5 ${typeStyle.color}`} />
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <h4 className="font-bold text-slate-900 dark:text-white text-base">{incident.title}</h4>
                                                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${typeStyle.bg} ${typeStyle.color}`}>
                                                        {typeStyle.label}
                                                    </span>
                                                    <span className="flex items-center gap-1 text-[10px] font-bold text-slate-500">
                                                        <span className={`w-2 h-2 rounded-full ${sevStyle.dot}`} />
                                                        {sevStyle.label}
                                                    </span>
                                                    {incident.resolved && (
                                                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                                                            ✓ Resuelta
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500">
                                                    <span className="flex items-center gap-1"><User className="w-3 h-3" /> {incident.students?.full_name || 'Sin estudiante'}</span>
                                                    {incident.courses && <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" /> {incident.courses.name}</span>}
                                                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {formatDate(incident.incident_date)}</span>
                                                    {incident.reporter && <span>Reportado por: {incident.reporter.full_name}</span>}
                                                </div>
                                            </div>
                                            {/* Actions */}
                                            <div className="flex items-center gap-1 shrink-0">
                                                {!incident.resolved && (
                                                    <button
                                                        onClick={() => setResolveModal(incident.id)}
                                                        className="p-2 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-emerald-600 transition-colors"
                                                        title="Marcar como resuelta"
                                                    >
                                                        <CheckCircle2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => startEdit(incident)}
                                                    className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 transition-colors"
                                                    title="Editar"
                                                >
                                                    <MessageSquare className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(incident.id)}
                                                    className="p-2 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/20 text-rose-500 transition-colors"
                                                    title="Eliminar"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Description & Action */}
                                        {incident.description && (
                                            <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">{incident.description}</p>
                                        )}
                                        {incident.action_taken && (
                                            <p className="text-sm mt-1.5"><span className="font-bold text-slate-700 dark:text-slate-300">Acción tomada:</span> <span className="text-slate-500">{incident.action_taken}</span></p>
                                        )}
                                        {incident.resolved && incident.resolution_notes && (
                                            <p className="text-sm mt-1.5 italic text-emerald-600 dark:text-emerald-400">
                                                Resolución: {incident.resolution_notes}
                                                {incident.resolver && ` — ${incident.resolver.full_name}`}
                                            </p>
                                        )}
                                        <div className="flex items-center gap-3 mt-2">
                                            {incident.parent_notified && (
                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                                                    Padre notificado
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Create / Edit Modal */}
            {showForm && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
                        <div className="flex justify-between items-center p-6 border-b border-slate-100 dark:border-slate-700 shrink-0">
                            <h3 className="text-xl font-bold text-slate-800 dark:text-white">
                                {editingId ? 'Editar Incidencia' : 'Nuevo Reporte de Disciplina'}
                            </h3>
                            <button onClick={resetForm} className="text-slate-400 hover:text-slate-600 bg-slate-100 dark:bg-slate-700 p-2 rounded-full transition-colors">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto">
                            {/* Student Selection */}
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Estudiante *</label>
                                <select
                                    required
                                    value={form.student_id}
                                    onChange={(e) => setForm({ ...form, student_id: e.target.value })}
                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue transition-all"
                                >
                                    <option value="">Seleccionar estudiante...</option>
                                    {studentsList?.map((s: any) => (
                                        <option key={s.id} value={s.id}>{s.full_name} {s.personal_code ? `(${s.personal_code})` : ''}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {/* Type */}
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Tipo de Incidencia</label>
                                    <select
                                        value={form.incident_type}
                                        onChange={(e) => setForm({ ...form, incident_type: e.target.value })}
                                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl outline-none"
                                    >
                                        {Object.entries(INCIDENT_TYPES).map(([key, val]) => (
                                            <option key={key} value={key}>{val.label}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Severity */}
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Severidad</label>
                                    <select
                                        value={form.severity}
                                        onChange={(e) => setForm({ ...form, severity: e.target.value })}
                                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl outline-none"
                                    >
                                        {Object.entries(SEVERITY_LEVELS).map(([key, val]) => (
                                            <option key={key} value={key}>{val.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Title */}
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Título del Reporte *</label>
                                <input
                                    required
                                    type="text"
                                    value={form.title}
                                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                                    placeholder="Ej. Falta al reglamento de convivencia"
                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue transition-all"
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {/* Course (optional) */}
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Curso (opcional)</label>
                                    <select
                                        value={form.course_id}
                                        onChange={(e) => setForm({ ...form, course_id: e.target.value })}
                                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl outline-none"
                                    >
                                        <option value="">Sin curso</option>
                                        {courses?.map((c: Course) => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Date */}
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Fecha del Incidente</label>
                                    <input
                                        type="date"
                                        value={form.incident_date}
                                        onChange={(e) => setForm({ ...form, incident_date: e.target.value })}
                                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl outline-none"
                                    />
                                </div>
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Descripción</label>
                                <textarea
                                    value={form.description}
                                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                                    placeholder="Detalle lo ocurrido..."
                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl outline-none resize-none h-24"
                                />
                            </div>

                            {/* Action Taken */}
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Acción Tomada</label>
                                <input
                                    type="text"
                                    value={form.action_taken}
                                    onChange={(e) => setForm({ ...form, action_taken: e.target.value })}
                                    placeholder="Ej. Llamada de atención verbal, citación a padres..."
                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl outline-none"
                                />
                            </div>

                            {/* Parent Notified */}
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={form.parent_notified}
                                    onChange={(e) => setForm({ ...form, parent_notified: e.target.checked })}
                                    className="rounded border-slate-300 text-brand-blue focus:ring-brand-blue/20 w-5 h-5"
                                />
                                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Padre/tutor fue notificado</span>
                            </label>

                            {/* Buttons */}
                            <div className="pt-4 flex gap-3">
                                <button
                                    type="button"
                                    onClick={resetForm}
                                    className="flex-1 px-4 py-3 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={createMutation.isPending || updateMutation.isPending}
                                    className="flex-1 px-4 py-3 bg-brand-blue text-white font-bold rounded-xl hover:bg-blue-600 transition-colors active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {(createMutation.isPending || updateMutation.isPending) ? (
                                        <><Loader2 className="w-5 h-5 animate-spin" /> Guardando...</>
                                    ) : (
                                        <>{editingId ? <Check className="w-5 h-5" /> : <Plus className="w-5 h-5" />} {editingId ? 'Actualizar' : 'Registrar'}</>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Resolve Modal */}
            {resolveModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-slate-100 dark:border-slate-700">
                            <h3 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                                Resolver Incidencia
                            </h3>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Notas de Resolución (opcional)</label>
                                <textarea
                                    value={resolveNotes}
                                    onChange={(e) => setResolveNotes(e.target.value)}
                                    placeholder="Ej. Se habló con el padre, asunto conciliado..."
                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl outline-none resize-none h-24"
                                />
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => { setResolveModal(null); setResolveNotes(''); }}
                                    className="flex-1 px-4 py-3 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={() => resolveMutation.mutate({ id: resolveModal, notes: resolveNotes })}
                                    disabled={resolveMutation.isPending}
                                    className="flex-1 px-4 py-3 bg-emerald-500 text-white font-bold rounded-xl hover:bg-emerald-600 transition-colors active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {resolveMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                                    Marcar Resuelta
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DisciplineModule;
