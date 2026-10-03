import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
    Banknote, TrendingUp, AlertTriangle, Users, 
    Calendar, Download, FileText, RefreshCw, Loader2, 
    Search, Building2, MessageSquare, Clock
} from 'lucide-react';
import { getDebtAgingReport } from './intelligenceService';
import { getCourses } from '../academic/academicService';
import type { TopDebtor } from '../../types/intelligence';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { savePdfDoc, saveWorkbook } from '../../utils/fileDownloader';
import { CycleSelectorPills } from '../../components/common/CycleSelectorPills';

export const DebtAgingDashboard = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCourse, setSelectedCourse] = useState<string>('all');
    const [selectedYearFilter, setSelectedYearFilter] = useState<'ALL' | number>('ALL');
    const [isExportingPdf, setIsExportingPdf] = useState(false);
    const [isExportingExcel, setIsExportingExcel] = useState(false);

    // Full catalog of courses for stable dropdown
    const { data: coursesList } = useQuery({
        queryKey: ['academicCoursesList'],
        queryFn: getCourses,
        staleTime: 1000 * 60 * 5,
    });

    // Unique academic cycles from courses
    const distinctCycles = useMemo(() => {
        const years = new Set<number>();
        coursesList?.forEach((c: any) => {
            if (c.academic_year) years.add(c.academic_year);
        });
        return Array.from(years).sort((a, b) => b - a);
    }, [coursesList]);

    const { data, isLoading, refetch, isRefetching } = useQuery({
        queryKey: ['debtAgingReport', selectedCourse, selectedYearFilter],
        queryFn: () => getDebtAgingReport({
            course_id: selectedCourse !== 'all' ? selectedCourse : undefined,
            academic_year: selectedYearFilter !== 'ALL' ? selectedYearFilter : undefined
        }),
    });

    const summary = data?.summary || {
        total_debt: 0,
        total_debtors: 0,
        total_students: 0,
        delinquency_rate: 0,
        current_month_expected: 0,
        current_month_collected: 0,
        collection_rate_pct: 0,
        next_month_projection: 0
    };

    const agingBuckets = data?.aging_buckets || [];
    const branchComparison = data?.branch_comparison || [];
    const topDebtors = data?.top_debtors || [];

    // Stable courses list filtered by academic cycle
    const availableCourses = useMemo(() => {
        if (coursesList && coursesList.length > 0) {
            let list = coursesList;
            if (selectedYearFilter !== 'ALL') {
                list = list.filter((c: any) => (c.academic_year || 2026) === selectedYearFilter);
            }
            return list.map(c => ({
                id: c.id,
                name: c.name,
                academic_year: c.academic_year || 2026
            }));
        }
        const coursesSet = new Set<string>();
        topDebtors.forEach(d => d.courses.forEach(c => coursesSet.add(c)));
        return Array.from(coursesSet).sort().map(name => ({ id: name, name, academic_year: 2026 }));
    }, [coursesList, selectedYearFilter, topDebtors]);

    // Reset selectedCourse if no longer in filtered courses
    useEffect(() => {
        if (selectedCourse !== 'all' && availableCourses.length > 0) {
            const exists = availableCourses.some(c => c.id === selectedCourse);
            if (!exists) {
                setSelectedCourse('all');
            }
        }
    }, [availableCourses, selectedCourse]);

    // Filtered debtors for table
    const filteredDebtors = useMemo(() => {
        const q = searchTerm.toLowerCase().trim();
        if (!q) return topDebtors;
        return topDebtors.filter(d =>
            d.full_name.toLowerCase().includes(q) ||
            d.code.toLowerCase().includes(q) ||
            d.branch_name.toLowerCase().includes(q) ||
            (d.guardian_name && d.guardian_name.toLowerCase().includes(q))
        );
    }, [topDebtors, searchTerm]);

    const handleWhatsAppPayment = (debtor: TopDebtor) => {
        const phone = debtor.guardian_phone || debtor.phone;
        if (!phone) {
            alert('Este estudiante no tiene número de teléfono registrado.');
            return;
        }
        const cleanPhone = phone.replace(/[^0-9]/g, '');
        const targetNumber = cleanPhone.length === 8 ? `502${cleanPhone}` : cleanPhone;
        const msg = encodeURIComponent(
            `Estimado(a) tutor de ${debtor.full_name}, le saludamos del Departamento de Administración de ULTRA TECNOLOGÍA (Sede ${debtor.branch_name}). Nos comunicamos cordialmente para recordarle que presenta un saldo pendiente de colegiatura por Q${debtor.total_debt.toLocaleString('es-GT', { minimumFractionDigits: 2 })} correspondiente a los meses: ${debtor.overdue_months.join(', ')}. Puede realizar su pago en secretaría o por transferencia para mantener al día el expediente del estudiante. ¡Muchas gracias!`
        );
        window.open(`https://wa.me/${targetNumber}?text=${msg}`, '_blank');
    };

    // PDF Export
    const handleExportPdf = () => {
        if (!data) return;
        setIsExportingPdf(true);
        try {
            const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter' });

            doc.setFontSize(16);
            doc.setFont('helvetica', 'bold');
            doc.text('ULTRA TECNOLOGÍA — ANÁLISIS DE CARTERA VENCIDA Y ANTIGÜEDAD DE SALDOS', 14, 15);
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.text(`Fecha de emisión: ${new Date().toLocaleDateString('es-GT', { day: '2-digit', month: 'long', year: 'numeric' })} | Población Total: ${summary.total_students} alumnos`, 14, 21);

            // KPI Summary table
            autoTable(doc, {
                startY: 25,
                head: [['Métrica Financiera', 'Valor Registrado', 'Interpretación Institucional']],
                body: [
                    ['Total Cartera Vencida en Calle', `Q ${summary.total_debt.toLocaleString('es-GT', { minimumFractionDigits: 2 })}`, 'Monto acumulado de cuotas pendientes'],
                    ['Tasa de Cobranza del Mes en Curso', `${summary.collection_rate_pct}%`, `Recaudado Q${summary.current_month_collected.toLocaleString()} de Meta Q${summary.current_month_expected.toLocaleString()}`],
                    ['Índice de Morosidad Institucional', `${summary.delinquency_rate}%`, `${summary.total_debtors} de ${summary.total_students} estudiantes con mora`],
                    ['Proyección de Recaudación Próximo Mes', `Q ${summary.next_month_projection.toLocaleString('es-GT', { minimumFractionDigits: 2 })}`, 'Basada en las tarifas de matrículas activas']
                ],
                theme: 'grid',
                headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
                styles: { fontSize: 8.5 }
            });

            // Aging buckets table
            const finalY1 = (doc as any).lastAutoTable?.finalY || 60;
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text('Distribución por Antigüedad de Deuda (Aging Buckets)', 14, finalY1 + 10);

            autoTable(doc, {
                startY: finalY1 + 14,
                head: [['Ventana de Antigüedad', 'Monto Adeudado (Q)', 'Estudiantes en Mora', 'Porcentaje de la Deuda']],
                body: agingBuckets.map(b => [
                    b.label,
                    `Q ${b.amount.toLocaleString('es-GT', { minimumFractionDigits: 2 })}`,
                    `${b.student_count} alumnos`,
                    `${b.percentage}%`
                ]),
                theme: 'striped',
                headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
                styles: { fontSize: 8 }
            });

            // Top debtors table
            const finalY2 = (doc as any).lastAutoTable?.finalY || 110;
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text('Listado Priorizado de Alumnos con Mayor Deuda (Top Deudores)', 14, finalY2 + 10);

            autoTable(doc, {
                startY: finalY2 + 14,
                head: [['#', 'Estudiante', 'Código', 'Sede', 'Carrera', 'Meses en Mora', 'Días Mora', 'Deuda Total (Q)', 'Tutor / Teléfono']],
                body: topDebtors.map((d, index) => [
                    index + 1,
                    d.full_name,
                    d.code,
                    d.branch_name,
                    d.courses.join(', '),
                    d.overdue_months.join(', '),
                    `${d.oldest_due_days} días`,
                    `Q ${d.total_debt.toLocaleString('es-GT', { minimumFractionDigits: 2 })}`,
                    d.guardian_name ? `${d.guardian_name} (${d.guardian_phone || 'S/N'})` : 'No registrado'
                ]),
                theme: 'grid',
                headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
                styles: { fontSize: 7.5, cellPadding: 2 },
                columnStyles: {
                    6: { halign: 'center' },
                    7: { fontStyle: 'bold', halign: 'right' }
                }
            });

            savePdfDoc(doc, `Cartera_Vencida_ULTEC_${new Date().toISOString().slice(0, 10)}.pdf`);
        } catch (err) {
            console.error('Error generating PDF:', err);
            alert('Hubo un error al generar el PDF.');
        } finally {
            setIsExportingPdf(false);
        }
    };

    // Excel Export
    const handleExportExcel = () => {
        if (!data) return;
        setIsExportingExcel(true);
        try {
            const rows = topDebtors.map(d => ({
                'Código': d.code,
                'Estudiante': d.full_name,
                'Sede': d.branch_name,
                'Carrera / Cursos': d.courses.join(', '),
                'Meses en Mora': d.overdue_months.join(', '),
                'Días de Mora Máx': d.oldest_due_days,
                'Total Adeudado (Q)': d.total_debt,
                'Tutor': d.guardian_name || 'N/A',
                'Teléfono Tutor': d.guardian_phone || 'N/A',
                'Teléfono Estudiante': d.phone || 'N/A'
            }));

            const worksheet = XLSX.utils.json_to_sheet(rows);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Top Deudores');
            saveWorkbook(workbook, `Cartera_Vencida_ULTEC_${new Date().toISOString().slice(0, 10)}.xlsx`);
        } catch (err) {
            console.error('Error exporting Excel:', err);
            alert('Hubo un error al exportar a Excel.');
        } finally {
            setIsExportingExcel(false);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            
            {/* Top KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                
                {/* Total Debt */}
                <div className="p-5 rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-gradient-to-br from-rose-50/60 to-rose-100/30 dark:from-rose-950/20 dark:to-rose-900/20 shadow-sm flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                            <Banknote className="w-4 h-4" />
                            Cartera Vencida Total
                        </span>
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-rose-200/50 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300">
                            GLOBAL
                        </span>
                    </div>
                    <div className="mt-3">
                        <span className="text-2xl sm:text-3xl font-black text-rose-700 dark:text-rose-300">
                            Q {summary.total_debt.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                            Distribuido en <strong>{summary.total_debtors}</strong> estudiantes con saldo
                        </p>
                    </div>
                </div>

                {/* Collection Rate */}
                <div className="p-5 rounded-2xl border border-emerald-200 dark:border-emerald-900/60 bg-gradient-to-br from-emerald-50/60 to-emerald-100/30 dark:from-emerald-950/20 dark:to-emerald-900/20 shadow-sm flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                            <TrendingUp className="w-4 h-4" />
                            Tasa de Cobranza del Mes
                        </span>
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-200/50 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300">
                            MES EN CURSO
                        </span>
                    </div>
                    <div className="mt-3">
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl sm:text-3xl font-black text-emerald-700 dark:text-emerald-300">
                                {summary.collection_rate_pct}%
                            </span>
                            <span className="text-xs text-emerald-600 font-bold">
                                recaudado
                            </span>
                        </div>
                        {/* Mini progress bar */}
                        <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full mt-2 overflow-hidden">
                            <div 
                                className="h-full bg-emerald-500 rounded-full transition-all duration-500" 
                                style={{ width: `${Math.min(100, summary.collection_rate_pct)}%` }} 
                            />
                        </div>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1.5">
                            Q{summary.current_month_collected.toLocaleString()} de Q{summary.current_month_expected.toLocaleString()} meta
                        </p>
                    </div>
                </div>

                {/* Delinquency Rate */}
                <div className="p-5 rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-gradient-to-br from-amber-50/60 to-amber-100/30 dark:from-amber-950/20 dark:to-amber-900/20 shadow-sm flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                            <AlertTriangle className="w-4 h-4" />
                            Índice de Morosidad
                        </span>
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-200/50 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300">
                            POBLACIÓN
                        </span>
                    </div>
                    <div className="mt-3">
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl sm:text-3xl font-black text-amber-700 dark:text-amber-300">
                                {summary.delinquency_rate}%
                            </span>
                            <span className="text-xs text-amber-600 font-bold">
                                en mora
                            </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                            {summary.total_debtors} alumnos de {summary.total_students} matriculados
                        </p>
                    </div>
                </div>

                {/* Projection */}
                <div className="p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-brand-blue dark:text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                            <Calendar className="w-4 h-4" />
                            Proyección Mes Próximo
                        </span>
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
                            FACTURABLE
                        </span>
                    </div>
                    <div className="mt-3">
                        <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
                            Q {summary.next_month_projection.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                            Basado en cuotas mensuales de matrículas activas
                        </p>
                    </div>
                </div>
            </div>

            {/* Aging Buckets Visual Distribution */}
            <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                            <Clock className="w-5 h-5 text-brand-blue dark:text-blue-400" />
                            Matriz de Antigüedad de Saldos (Aging Buckets)
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            Desglose temporal de la cartera vencida según días transcurridos desde la fecha de exigibilidad.
                        </p>
                    </div>
                </div>

                {/* Grid of Buckets */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 pt-2">
                    {agingBuckets.map((bucket) => {
                        const isSevere = bucket.key === 'over_90';
                        const isHigh = bucket.key === '61_90';
                        const isMid = bucket.key === '31_60';

                        const colorClasses = isSevere 
                            ? 'border-rose-300 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-300' :
                            isHigh
                            ? 'border-orange-300 dark:border-orange-900/60 bg-orange-50/50 dark:bg-orange-950/20 text-orange-700 dark:text-orange-300' :
                            isMid
                            ? 'border-amber-300 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-300' :
                            'border-blue-300 dark:border-blue-900/60 bg-blue-50/50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300';

                        const barColor = isSevere ? 'bg-rose-500' : isHigh ? 'bg-orange-500' : isMid ? 'bg-amber-500' : 'bg-blue-500';

                        return (
                            <div key={bucket.key} className={`p-4 rounded-2xl border shadow-sm ${colorClasses}`}>
                                <span className="text-[11px] font-bold uppercase tracking-wider block">
                                    {bucket.label}
                                </span>
                                <div className="mt-2 flex items-baseline justify-between">
                                    <span className="text-xl font-black">
                                        Q {bucket.amount.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                    <span className="text-xs font-bold font-mono">
                                        {bucket.percentage}%
                                    </span>
                                </div>
                                <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full mt-2.5 overflow-hidden">
                                    <div 
                                        className={`h-full rounded-full ${barColor}`} 
                                        style={{ width: `${Math.min(100, bucket.percentage)}%` }} 
                                    />
                                </div>
                                <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-2 block">
                                    {bucket.student_count} estudiante(s) en este tramo
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Branch Comparison Table (if multiple branches available) */}
            {branchComparison.length > 1 && (
                <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3">
                    <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-brand-blue dark:text-blue-400" />
                        Comparativa de Cartera Vencida por Sede
                    </h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead>
                                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider">
                                    <th className="py-2.5 px-3">Sede Plantel</th>
                                    <th className="py-2.5 px-3">Cartera Vencida (Q)</th>
                                    <th className="py-2.5 px-3">Alumnos en Mora</th>
                                    <th className="py-2.5 px-3">Meta Mensual (Q)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                                {branchComparison.map(b => (
                                    <tr key={b.branch_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                        <td className="py-3 px-3 font-bold text-slate-800 dark:text-slate-200">{b.branch_name}</td>
                                        <td className="py-3 px-3 font-black text-rose-600 dark:text-rose-400">
                                            Q {b.total_debt.toLocaleString('es-GT', { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className="py-3 px-3 text-slate-600 dark:text-slate-400">{b.debtors_count} alumnos</td>
                                        <td className="py-3 px-3 text-slate-600 dark:text-slate-400">
                                            Q {b.expected_income.toLocaleString('es-GT', { minimumFractionDigits: 2 })}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Filter and Search Bar */}
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
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

                <div className="flex flex-wrap items-center gap-2">
                    {/* Academic Year Pills (Scalable Hybrid) */}
                    <CycleSelectorPills
                        cycles={distinctCycles}
                        selectedYear={selectedYearFilter}
                        onSelectYear={setSelectedYearFilter}
                        maxVisiblePills={2}
                    />

                    {/* Course Filter */}
                    <select
                        value={selectedCourse}
                        onChange={(e) => setSelectedCourse(e.target.value)}
                        className="py-2.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-blue max-w-[240px] truncate"
                    >
                        <option value="all">
                            Todas las Carreras {selectedYearFilter !== 'ALL' ? `(Ciclo ${selectedYearFilter})` : ''}
                        </option>
                        {availableCourses.map(c => (
                            <option key={c.id} value={c.id}>
                                [Ciclo {c.academic_year}] {c.name}
                            </option>
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
                        disabled={isExportingPdf || !topDebtors.length}
                        className="py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                        title="Exportar informe de cartera en PDF"
                    >
                        {isExportingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5 text-rose-500" />}
                        <span className="hidden sm:inline">PDF</span>
                    </button>

                    {/* Export Excel */}
                    <button
                        onClick={handleExportExcel}
                        disabled={isExportingExcel || !topDebtors.length}
                        className="py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                        title="Exportar cartera en Excel"
                    >
                        {isExportingExcel ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5 text-emerald-500" />}
                        <span className="hidden sm:inline">Excel</span>
                    </button>
                </div>
            </div>

            {/* Top Debtors Table */}
            <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                            <Users className="w-5 h-5 text-rose-500" />
                            Listado Priorizado de Alumnos con Mayor Deuda ({filteredDebtors.length})
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            Ordenados por monto acumulado y días de antigüedad. Acciones directas de cobro preventivo.
                        </p>
                    </div>
                </div>

                {isLoading && (
                    <div className="flex flex-col items-center justify-center p-12 text-slate-400">
                        <Loader2 className="w-8 h-8 animate-spin text-brand-blue mb-2" />
                        <span className="text-xs font-bold">Analizando antigüedad de saldos...</span>
                    </div>
                )}

                {!isLoading && filteredDebtors.length === 0 && (
                    <div className="p-10 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-400 text-xs">
                        No hay deudores registrados con los filtros aplicados.
                    </div>
                )}

                {!isLoading && filteredDebtors.length > 0 && (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead>
                                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider">
                                    <th className="py-3 px-3">Estudiante</th>
                                    <th className="py-3 px-3">Sede / Carrera</th>
                                    <th className="py-3 px-3">Meses en Mora</th>
                                    <th className="py-3 px-3">Antigüedad Máx</th>
                                    <th className="py-3 px-3 text-right">Deuda Total</th>
                                    <th className="py-3 px-3">Tutor / Contacto</th>
                                    <th className="py-3 px-3 text-center">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                                {filteredDebtors.map((debtor) => (
                                    <tr key={debtor.student_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                        
                                        {/* Name & Code */}
                                        <td className="py-3 px-3">
                                            <div className="font-bold text-slate-800 dark:text-slate-200">
                                                {debtor.full_name}
                                            </div>
                                            <div className="font-mono text-[10px] text-slate-400">
                                                {debtor.code}
                                            </div>
                                        </td>

                                        {/* Branch & Course */}
                                        <td className="py-3 px-3">
                                            <div className="text-slate-700 dark:text-slate-300 font-bold">
                                                {debtor.branch_name}
                                            </div>
                                            <div className="text-[10px] text-slate-400 truncate max-w-[160px]">
                                                {debtor.courses.join(', ')}
                                            </div>
                                        </td>

                                        {/* Overdue Months */}
                                        <td className="py-3 px-3">
                                            <div className="flex flex-wrap gap-1">
                                                {debtor.overdue_months.map((m, i) => (
                                                    <span key={i} className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
                                                        {m}
                                                    </span>
                                                ))}
                                            </div>
                                        </td>

                                        {/* Days overdue */}
                                        <td className="py-3 px-3">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                                debtor.oldest_due_days > 60 ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300' :
                                                debtor.oldest_due_days > 30 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' :
                                                'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                                            }`}>
                                                {debtor.oldest_due_days} días
                                            </span>
                                        </td>

                                        {/* Total Debt */}
                                        <td className="py-3 px-3 text-right">
                                            <span className="font-black text-rose-600 dark:text-rose-400 text-sm">
                                                Q {debtor.total_debt.toLocaleString('es-GT', { minimumFractionDigits: 2 })}
                                            </span>
                                        </td>

                                        {/* Guardian */}
                                        <td className="py-3 px-3">
                                            <div className="text-slate-800 dark:text-slate-200">
                                                {debtor.guardian_name || 'No registrado'}
                                            </div>
                                            <div className="font-mono text-[10px] text-slate-400">
                                                {debtor.guardian_phone || debtor.phone || 'Sin teléfono'}
                                            </div>
                                        </td>

                                        {/* Actions */}
                                        <td className="py-3 px-3 text-center">
                                            <button
                                                onClick={() => handleWhatsAppPayment(debtor)}
                                                className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900 transition-colors"
                                                title="Enviar aviso de cobro por WhatsApp institucional"
                                            >
                                                <MessageSquare className="w-3.5 h-3.5" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DebtAgingDashboard;
