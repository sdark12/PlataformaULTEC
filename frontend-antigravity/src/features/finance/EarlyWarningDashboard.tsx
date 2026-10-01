import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
    AlertTriangle, ShieldAlert, ShieldCheck, 
    Search, RefreshCw, MessageSquare, 
    FileText, Download, Loader2, Sparkles
} from 'lucide-react';
import { getEarlyWarningReport } from './intelligenceService';
import { getCourses } from '../academic/academicService';
import { InterventionModal } from './InterventionModal';
import type { StudentRiskProfile, RiskLevel } from '../../types/intelligence';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { savePdfDoc, saveWorkbook } from '../../utils/fileDownloader';

export const EarlyWarningDashboard = () => {
    const [riskFilter, setRiskFilter] = useState<'all' | RiskLevel>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCourse, setSelectedCourse] = useState<string>('all');
    const [selectedStudentForIntervention, setSelectedStudentForIntervention] = useState<StudentRiskProfile | null>(null);
    const [isInterventionModalOpen, setIsInterventionModalOpen] = useState(false);
    const [isExportingPdf, setIsExportingPdf] = useState(false);
    const [isExportingExcel, setIsExportingExcel] = useState(false);

    // Full catalog of courses for stable dropdown
    const { data: coursesList } = useQuery({
        queryKey: ['academicCoursesList'],
        queryFn: getCourses,
        staleTime: 1000 * 60 * 5,
    });

    const { data, isLoading, refetch, isRefetching } = useQuery({
        queryKey: ['earlyWarningReport', selectedCourse],
        queryFn: () => getEarlyWarningReport({ 
            course_id: selectedCourse !== 'all' ? selectedCourse : undefined 
        }),
    });

    // Stable courses list combining academicService and student courses fallback
    const availableCourses = useMemo(() => {
        if (coursesList && coursesList.length > 0) {
            return coursesList.map(c => ({ id: c.id, name: c.name }));
        }
        if (!data?.students) return [];
        const coursesSet = new Set<string>();
        data.students.forEach(s => s.courses.forEach(c => coursesSet.add(c)));
        return Array.from(coursesSet).sort().map(name => ({ id: name, name }));
    }, [coursesList, data?.students]);

    // Client-side filtering for fast interactive search & risk tab
    const filteredStudents = useMemo(() => {
        if (!data?.students) return [];
        return data.students.filter(student => {
            const matchesRisk = riskFilter === 'all' || student.risk_level === riskFilter;
            const q = searchTerm.toLowerCase().trim();
            const matchesSearch = !q || 
                student.full_name.toLowerCase().includes(q) ||
                student.code.toLowerCase().includes(q) ||
                (student.guardian_name && student.guardian_name.toLowerCase().includes(q)) ||
                student.branch_name.toLowerCase().includes(q);
            return matchesRisk && matchesSearch;
        });
    }, [data?.students, riskFilter, searchTerm]);

    const summary = data?.summary || {
        total_students: 0,
        critical_count: 0,
        moderate_count: 0,
        low_count: 0,
        critical_pct: 0,
        moderate_pct: 0,
        low_pct: 0,
        avg_retention_index: 100
    };

    const handleOpenIntervention = (student: StudentRiskProfile) => {
        setSelectedStudentForIntervention(student);
        setIsInterventionModalOpen(true);
    };

    const handleWhatsApp = (student: StudentRiskProfile) => {
        const phone = student.guardian_phone || student.phone;
        if (!phone) {
            alert('Este estudiante no tiene número de teléfono registrado.');
            return;
        }
        // Clean phone digits
        const cleanPhone = phone.replace(/[^0-9]/g, '');
        const targetNumber = cleanPhone.length === 8 ? `502${cleanPhone}` : cleanPhone;
        const studentName = student.full_name;
        const msg = encodeURIComponent(
            `Estimado(a) padre/tutor de ${studentName}, le saludamos de la Dirección de ULTRA TECNOLOGÍA (Sede ${student.branch_name}). Deseamos coordinar una breve sesión de seguimiento para revisar el progreso académico del estudiante. Por favor indíquenos cuándo le resulta conveniente comunicarse con nosotros.`
        );
        window.open(`https://wa.me/${targetNumber}?text=${msg}`, '_blank');
    };

    // PDF Export
    const handleExportPdf = () => {
        if (!data?.students) return;
        setIsExportingPdf(true);
        try {
            const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter' });

            // Title
            doc.setFontSize(16);
            doc.setFont('helvetica', 'bold');
            doc.text('ULTRA TECNOLOGÍA — SISTEMA DE ALERTA TEMPRANA Y RETENCIÓN ESCOLAR', 14, 15);
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.text(`Fecha de emisión: ${new Date().toLocaleDateString('es-GT', { day: '2-digit', month: 'long', year: 'numeric' })} | Total Estudiantes Evaluados: ${summary.total_students}`, 14, 21);

            // Summary table
            autoTable(doc, {
                startY: 25,
                head: [['Métrica de Inteligencia', 'Cantidad', 'Porcentaje', 'Diagnóstico Institucional']],
                body: [
                    ['🔴 Riesgo Crítico (Deserción Inminente)', `${summary.critical_count} alumnos`, `${summary.critical_pct}%`, 'Requiere intervención inmediata de dirección y secretaría'],
                    ['🟡 Riesgo Moderado (En Observación)', `${summary.moderate_count} alumnos`, `${summary.moderate_pct}%`, 'Monitoreo de asistencia y seguimiento de primera cuota vencida'],
                    ['🟢 Bajo Riesgo (Estable)', `${summary.low_count} alumnos`, `${summary.low_pct}%`, 'Comportamiento regular y retención saludable'],
                    ['🛡️ Índice Promedio de Retención Escolar', `${summary.avg_retention_index} / 100`, 'Promedio Global', 'Salud global del ciclo formativo']
                ],
                theme: 'grid',
                headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
                styles: { fontSize: 8.5 }
            });

            // Students table
            const finalY = (doc as any).lastAutoTable?.finalY || 60;
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text('Matriz Priorizada de Estudiantes y Factores de Riesgo', 14, finalY + 10);

            const tableRows = filteredStudents.map((s, index) => [
                index + 1,
                s.full_name,
                s.code,
                s.branch_name,
                s.courses.join(', '),
                `${s.ire_score}/100\n(${s.risk_level.toUpperCase()})`,
                `${s.factors.attendance.percentage}% (${s.factors.attendance.consecutive_absences} faltas seguidas)`,
                `${s.factors.academic.average_grade} pts`,
                s.factors.financial.overdue_months > 0 ? `${s.factors.financial.overdue_months}m (Q${s.factors.financial.total_debt})` : 'Al día',
                s.guardian_name ? `${s.guardian_name} (${s.guardian_phone || 'S/N'})` : 'No registrado',
                s.interventions.total_count > 0 ? `${s.interventions.total_count} registradas` : 'Sin seguimiento'
            ]);

            autoTable(doc, {
                startY: finalY + 14,
                head: [['#', 'Estudiante', 'Código', 'Sede', 'Carrera', 'IRE', 'Asistencia', 'Promedio', 'Mora', 'Tutor / Teléfono', 'Intervenciones']],
                body: tableRows,
                theme: 'striped',
                headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
                styles: { fontSize: 7.5, cellPadding: 2 },
                columnStyles: {
                    5: { fontStyle: 'bold', halign: 'center' },
                    6: { halign: 'center' },
                    7: { halign: 'center' },
                    8: { halign: 'center' }
                }
            });

            savePdfDoc(doc, `Reporte_Alerta_Temprana_ULTEC_${new Date().toISOString().slice(0, 10)}.pdf`);
        } catch (err) {
            console.error('Error generating PDF:', err);
            alert('Hubo un error al generar el PDF.');
        } finally {
            setIsExportingPdf(false);
        }
    };

    // Excel Export
    const handleExportExcel = () => {
        if (!data?.students) return;
        setIsExportingExcel(true);
        try {
            const rows = filteredStudents.map(s => ({
                'Código': s.code,
                'Estudiante': s.full_name,
                'Sede': s.branch_name,
                'Carrera / Cursos': s.courses.join(', '),
                'Nivel de Riesgo': s.risk_level.toUpperCase(),
                'Puntaje IRE (0-100)': s.ire_score,
                'Asistencia %': `${s.factors.attendance.percentage}%`,
                'Faltas Consecutivas': s.factors.attendance.consecutive_absences,
                'Promedio Calificaciones': s.factors.academic.average_grade,
                'Materias Reprobadas': s.factors.academic.failing_units,
                'Meses en Mora': s.factors.financial.overdue_months,
                'Deuda Total (Q)': s.factors.financial.total_debt,
                'Tutor': s.guardian_name || 'N/A',
                'Teléfono Tutor': s.guardian_phone || 'N/A',
                'Teléfono Alumno': s.phone || 'N/A',
                'Intervenciones Registradas': s.interventions.total_count,
                'Disparadores de Alerta': s.risk_triggers.join('; ')
            }));

            const worksheet = XLSX.utils.json_to_sheet(rows);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Alerta Temprana');
            saveWorkbook(workbook, `Alerta_Temprana_ULTEC_${new Date().toISOString().slice(0, 10)}.xlsx`);
        } catch (err) {
            console.error('Error exporting Excel:', err);
            alert('Hubo un error al exportar a Excel.');
        } finally {
            setIsExportingExcel(false);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            
            {/* Top KPI Banner */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Critical */}
                <div 
                    onClick={() => setRiskFilter(riskFilter === 'critical' ? 'all' : 'critical')}
                    className={`p-5 rounded-2xl border transition-all cursor-pointer shadow-sm relative overflow-hidden ${
                        riskFilter === 'critical' 
                            ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-700 ring-2 ring-rose-500' 
                            : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-rose-200 dark:hover:border-rose-900'
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                            Riesgo Crítico
                        </span>
                        <ShieldAlert className="w-5 h-5 text-rose-500 opacity-80" />
                    </div>
                    <div className="mt-3 flex items-baseline gap-2">
                        <span className="text-3xl font-black text-rose-700 dark:text-rose-300">
                            {summary.critical_count}
                        </span>
                        <span className="text-xs text-rose-600/80 dark:text-rose-400/80 font-bold">
                            alumnos ({summary.critical_pct}%)
                        </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                        Deserción inminente (intervención inmediata)
                    </p>
                </div>

                {/* Moderate */}
                <div 
                    onClick={() => setRiskFilter(riskFilter === 'moderate' ? 'all' : 'moderate')}
                    className={`p-5 rounded-2xl border transition-all cursor-pointer shadow-sm relative overflow-hidden ${
                        riskFilter === 'moderate' 
                            ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700 ring-2 ring-amber-500' 
                            : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-amber-200 dark:hover:border-amber-900'
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                            Riesgo Moderado
                        </span>
                        <AlertTriangle className="w-5 h-5 text-amber-500 opacity-80" />
                    </div>
                    <div className="mt-3 flex items-baseline gap-2">
                        <span className="text-3xl font-black text-amber-700 dark:text-amber-300">
                            {summary.moderate_count}
                        </span>
                        <span className="text-xs text-amber-600/80 dark:text-amber-400/80 font-bold">
                            alumnos ({summary.moderate_pct}%)
                        </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                        En observación preventiva (asistencia / mora)
                    </p>
                </div>

                {/* Low / Healthy */}
                <div 
                    onClick={() => setRiskFilter(riskFilter === 'low' ? 'all' : 'low')}
                    className={`p-5 rounded-2xl border transition-all cursor-pointer shadow-sm relative overflow-hidden ${
                        riskFilter === 'low' 
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 ring-2 ring-emerald-500' 
                            : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-emerald-200 dark:hover:border-emerald-900'
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                            Bajo Riesgo
                        </span>
                        <ShieldCheck className="w-5 h-5 text-emerald-500 opacity-80" />
                    </div>
                    <div className="mt-3 flex items-baseline gap-2">
                        <span className="text-3xl font-black text-emerald-700 dark:text-emerald-300">
                            {summary.low_count}
                        </span>
                        <span className="text-xs text-emerald-600/80 dark:text-emerald-400/80 font-bold">
                            alumnos ({summary.low_pct}%)
                        </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                        Desempeño y retención escolar regular
                    </p>
                </div>

                {/* Overall IRE Score */}
                <div className="p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-gradient-to-br from-brand-blue/5 to-indigo-500/10 dark:from-brand-blue/15 dark:to-indigo-500/20 shadow-sm flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-brand-blue dark:text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                            <Sparkles className="w-4 h-4" />
                            Índice IRE Global
                        </span>
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 border border-brand-blue/20">
                            RETENCIÓN
                        </span>
                    </div>
                    <div className="mt-2">
                        <div className="flex items-baseline justify-between">
                            <span className="text-3xl font-black text-slate-900 dark:text-white">
                                {summary.avg_retention_index}
                            </span>
                            <span className="text-xs text-slate-500 dark:text-slate-400 font-bold">
                                de 100 pts
                            </span>
                        </div>
                        {/* Progress Bar */}
                        <div className="w-full h-2.5 bg-slate-200 dark:bg-slate-700 rounded-full mt-2 overflow-hidden">
                            <div 
                                className={`h-full rounded-full transition-all duration-500 ${
                                    summary.avg_retention_index >= 80 ? 'bg-emerald-500' :
                                    summary.avg_retention_index >= 65 ? 'bg-amber-500' : 'bg-rose-500'
                                }`}
                                style={{ width: `${Math.min(100, summary.avg_retention_index)}%` }}
                            />
                        </div>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                        Población total evaluada: <strong>{summary.total_students}</strong>
                    </p>
                </div>
            </div>

            {/* Filter and Control Bar */}
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
                {/* Search */}
                <div className="relative flex-1">
                    <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Buscar por nombre, código UT, tutor o sede..."
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-blue"
                    />
                </div>

                {/* Course selector */}
                <div className="flex items-center gap-2">
                    <select
                        value={selectedCourse}
                        onChange={(e) => setSelectedCourse(e.target.value)}
                        className="py-2.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-blue"
                    >
                        <option value="all">Todas las Carreras / Cursos</option>
                        {availableCourses.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>

                    {/* Refresh */}
                    <button
                        onClick={() => refetch()}
                        disabled={isLoading || isRefetching}
                        className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                        title="Actualizar datos"
                    >
                        <RefreshCw className={`w-4 h-4 ${isRefetching ? 'animate-spin text-brand-blue' : ''}`} />
                    </button>

                    {/* Export PDF */}
                    <button
                        onClick={handleExportPdf}
                        disabled={isExportingPdf || !data?.students?.length}
                        className="py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                        title="Exportar informe en PDF"
                    >
                        {isExportingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5 text-rose-500" />}
                        <span className="hidden sm:inline">PDF</span>
                    </button>

                    {/* Export Excel */}
                    <button
                        onClick={handleExportExcel}
                        disabled={isExportingExcel || !data?.students?.length}
                        className="py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                        title="Exportar hoja de cálculo en Excel"
                    >
                        {isExportingExcel ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5 text-emerald-500" />}
                        <span className="hidden sm:inline">Excel</span>
                    </button>
                </div>
            </div>

            {/* Quick Segmented Tabs for Risk Level */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
                <button
                    onClick={() => setRiskFilter('all')}
                    className={`py-1.5 px-3.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                        riskFilter === 'all'
                            ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                >
                    Todos ({summary.total_students})
                </button>
                <button
                    onClick={() => setRiskFilter('critical')}
                    className={`py-1.5 px-3.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                        riskFilter === 'critical'
                            ? 'bg-rose-600 text-white shadow-sm ring-2 ring-rose-500/40'
                            : 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/50'
                    }`}
                >
                    <span className="w-2 h-2 rounded-full bg-rose-500" />
                    Riesgo Crítico ({summary.critical_count})
                </button>
                <button
                    onClick={() => setRiskFilter('moderate')}
                    className={`py-1.5 px-3.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                        riskFilter === 'moderate'
                            ? 'bg-amber-600 text-white shadow-sm ring-2 ring-amber-500/40'
                            : 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/50'
                    }`}
                >
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    Riesgo Moderado ({summary.moderate_count})
                </button>
                <button
                    onClick={() => setRiskFilter('low')}
                    className={`py-1.5 px-3.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                        riskFilter === 'low'
                            ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-500/40'
                            : 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/50'
                    }`}
                >
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    Bajo Riesgo ({summary.low_count})
                </button>
            </div>

            {/* Students List */}
            {isLoading && (
                <div className="flex flex-col items-center justify-center p-16 text-slate-400">
                    <Loader2 className="w-8 h-8 animate-spin text-brand-blue mb-2" />
                    <span className="text-xs font-bold">Calculando Índice de Retención Escolar (IRE)...</span>
                </div>
            )}

            {!isLoading && filteredStudents.length === 0 && (
                <div className="p-12 text-center rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50">
                    <ShieldCheck className="w-12 h-12 text-emerald-500 mx-auto mb-3 opacity-80" />
                    <h3 className="font-black text-sm text-slate-900 dark:text-white">
                        No se encontraron estudiantes en este criterio
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                        {searchTerm ? 'Intenta modificar el término de búsqueda.' : 'No hay alumnos registrados bajo esta clasificación de riesgo actualmente.'}
                    </p>
                </div>
            )}

            {!isLoading && filteredStudents.length > 0 && (
                <div className="grid grid-cols-1 gap-3.5">
                    {filteredStudents.map((student) => {
                        const isCrit = student.risk_level === 'critical';
                        const isMod = student.risk_level === 'moderate';

                        return (
                            <div
                                key={student.id}
                                className={`p-4 sm:p-5 rounded-2xl border transition-all duration-200 bg-white dark:bg-slate-900 shadow-sm hover:shadow-md ${
                                    isCrit ? 'border-l-4 border-l-rose-500 border-slate-200/80 dark:border-slate-800' :
                                    isMod ? 'border-l-4 border-l-amber-500 border-slate-200/80 dark:border-slate-800' :
                                    'border-l-4 border-l-emerald-500 border-slate-200/80 dark:border-slate-800'
                                }`}
                            >
                                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                                    
                                    {/* Student Info */}
                                    <div className="flex items-start gap-3.5 min-w-0">
                                        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-sm shrink-0 shadow-sm ${
                                            isCrit ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300' :
                                            isMod ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' :
                                            'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                                        }`}>
                                            {student.full_name.slice(0, 2).toUpperCase()}
                                        </div>

                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <h3 className="font-black text-sm sm:text-base text-slate-900 dark:text-white truncate">
                                                    {student.full_name}
                                                </h3>
                                                <span className="font-mono text-[11px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold border border-slate-200/60 dark:border-slate-700">
                                                    {student.code}
                                                </span>
                                                <span className="text-[11px] font-bold text-slate-400">
                                                    • {student.branch_name}
                                                </span>
                                            </div>

                                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                                                {student.courses.join(', ')}
                                            </p>

                                            {/* Triggers badges */}
                                            {student.risk_triggers.length > 0 && (
                                                <div className="flex flex-wrap gap-1.5 mt-2">
                                                    {student.risk_triggers.map((trigger, i) => (
                                                        <span 
                                                            key={i}
                                                            className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border flex items-center gap-1 ${
                                                                isCrit 
                                                                    ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200 dark:border-rose-900' 
                                                                    : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-900'
                                                            }`}
                                                        >
                                                            <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
                                                            {trigger}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Factor Breakdown Bars */}
                                    <div className="grid grid-cols-3 gap-3 py-2 px-3 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-100 dark:border-slate-800 text-center shrink-0 min-w-[280px]">
                                        {/* Asistencia */}
                                        <div>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                                                Asistencia
                                            </span>
                                            <span className={`text-xs font-black block mt-0.5 ${
                                                student.factors.attendance.percentage < 70 ? 'text-rose-600 dark:text-rose-400' :
                                                student.factors.attendance.percentage < 85 ? 'text-amber-600 dark:text-amber-400' :
                                                'text-emerald-600 dark:text-emerald-400'
                                            }`}>
                                                {student.factors.attendance.percentage}%
                                            </span>
                                            <span className="text-[9px] text-slate-400">
                                                {student.factors.attendance.score}/40 pts
                                            </span>
                                        </div>

                                        {/* Calificaciones */}
                                        <div>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                                                Promedio
                                            </span>
                                            <span className={`text-xs font-black block mt-0.5 ${
                                                student.factors.academic.average_grade < 60 ? 'text-rose-600 dark:text-rose-400' :
                                                student.factors.academic.average_grade < 75 ? 'text-amber-600 dark:text-amber-400' :
                                                'text-emerald-600 dark:text-emerald-400'
                                            }`}>
                                                {student.factors.academic.average_grade} pts
                                            </span>
                                            <span className="text-[9px] text-slate-400">
                                                {student.factors.academic.score}/35 pts
                                            </span>
                                        </div>

                                        {/* Finanzas / Mora */}
                                        <div>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                                                Mora
                                            </span>
                                            <span className={`text-xs font-black block mt-0.5 ${
                                                student.factors.financial.overdue_months > 1 ? 'text-rose-600 dark:text-rose-400' :
                                                student.factors.financial.overdue_months === 1 ? 'text-amber-600 dark:text-amber-400' :
                                                'text-emerald-600 dark:text-emerald-400'
                                            }`}>
                                                {student.factors.financial.overdue_months > 0 ? `${student.factors.financial.overdue_months} mes(es)` : 'Al día'}
                                            </span>
                                            <span className="text-[9px] text-slate-400">
                                                {student.factors.financial.score}/20 pts
                                            </span>
                                        </div>
                                    </div>

                                    {/* Score & Action buttons */}
                                    <div className="flex items-center justify-between lg:justify-end gap-3 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100 dark:border-slate-800">
                                        {/* IRE Score Badge */}
                                        <div className="text-right">
                                            <div className="flex items-baseline gap-1 justify-end">
                                                <span className={`text-xl font-black ${
                                                    isCrit ? 'text-rose-600 dark:text-rose-400' :
                                                    isMod ? 'text-amber-600 dark:text-amber-400' :
                                                    'text-emerald-600 dark:text-emerald-400'
                                                }`}>
                                                    {student.ire_score}
                                                </span>
                                                <span className="text-[10px] font-bold text-slate-400">/100</span>
                                            </div>
                                            <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${
                                                isCrit ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300' :
                                                isMod ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' :
                                                'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                                            }`}>
                                                IRE {student.risk_level.toUpperCase()}
                                            </span>
                                        </div>

                                        {/* WhatsApp Tutor button */}
                                        <button
                                            onClick={() => handleWhatsApp(student)}
                                            className="p-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 transition-colors"
                                            title="Contactar al tutor por WhatsApp institucional"
                                        >
                                            <MessageSquare className="w-4 h-4" />
                                        </button>

                                        {/* Interventions button */}
                                        <button
                                            onClick={() => handleOpenIntervention(student)}
                                            className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm active:scale-95 ${
                                                student.interventions.total_count > 0
                                                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200/80 dark:border-slate-700'
                                                    : 'bg-brand-blue hover:bg-blue-600 text-white'
                                            }`}
                                        >
                                            <FileText className="w-3.5 h-3.5" />
                                            <span>
                                                {student.interventions.total_count > 0 
                                                    ? `${student.interventions.total_count} Acciones` 
                                                    : 'Intervenir'}
                                            </span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Modal for student retention follow-up */}
            <InterventionModal
                student={selectedStudentForIntervention}
                isOpen={isInterventionModalOpen}
                onClose={() => {
                    setIsInterventionModalOpen(false);
                    setSelectedStudentForIntervention(null);
                }}
            />
        </div>
    );
};

export default EarlyWarningDashboard;
