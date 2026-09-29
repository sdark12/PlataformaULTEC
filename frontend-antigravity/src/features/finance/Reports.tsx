import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getFinancialReport, getPendingPaymentsReport } from './reportService';
import { downloadInvoicePdf } from './invoiceService';
import { getCurrentUser } from '../auth/authService';
import { 
    Loader2, Search, Printer, TrendingUp, CreditCard, Receipt, 
    AlignJustify, AlertTriangle, Users, Download, SlidersHorizontal, 
    X, Calendar, Banknote, Building2
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { saveWorkbook, savePdfDoc } from '../../utils/fileDownloader';

const Reports = () => {
    const user = getCurrentUser();
    const isSecretary = user?.role === 'secretary';

    const [activeTab, setActiveTab] = useState<'income' | 'pending'>('income');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [filterMethod, setFilterMethod] = useState('');
    const [isExportingExcel, setIsExportingExcel] = useState(false);
    const [isExportingPdf, setIsExportingPdf] = useState(false);
    const [sortConfigIncome, setSortConfigIncome] = useState<{ field: string; order: 'asc' | 'desc' }[]>([
        { field: 'payment_date', order: 'desc' }
    ]);
    const [sortConfigPending, setSortConfigPending] = useState<{ field: string; order: 'asc' | 'desc' }[]>([
        { field: 'student_name', order: 'asc' }
    ]);
    const [filterCoursePending, setFilterCoursePending] = useState('');
    const [minMonthsPending, setMinMonthsPending] = useState<number>(0);
    const [groupByStudent, setGroupByStudent] = useState(false);
    const [isFiltersOpen, setIsFiltersOpen] = useState(false);

    const activeIncomeFiltersCount = (startDate ? 1 : 0) + (endDate ? 1 : 0) + (filterMethod ? 1 : 0);
    const activePendingFiltersCount = (filterCoursePending ? 1 : 0) + (minMonthsPending > 0 ? 1 : 0) + (groupByStudent ? 1 : 0);

    const { data: report, isLoading } = useQuery({
        queryKey: ['financialReport', isSecretary ? 'today' : startDate, isSecretary ? 'today' : endDate],
        queryFn: () => getFinancialReport(isSecretary ? '' : startDate, isSecretary ? '' : endDate),
    });

    const { data: pendingReport, isLoading: isLoadingPending } = useQuery({
        queryKey: ['pendingPaymentsReport'],
        queryFn: getPendingPaymentsReport,
    });

    const uniqueMethods = Array.from(new Set(report?.map(item => item.method).filter(Boolean))).sort();
    const uniqueCoursesPending = Array.from(new Set(pendingReport?.map(item => item.course_name).filter(Boolean))).sort();

    const filteredReport = report?.filter((item) => {
        const studentName = item.student_name || '';
        const courseName = item.course_name || '';

        const matchesSearch =
            studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            courseName.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesMethod = filterMethod ? item.method === filterMethod : true;

        return matchesSearch && matchesMethod;
    }).sort((a: any, b: any) => {
        for (const config of sortConfigIncome) {
            let valA = a[config.field];
            let valB = b[config.field];

            if (typeof valA === 'string') {
                valA = valA.toLowerCase();
                valB = valB.toLowerCase();
            }

            if (valA < valB) return config.order === 'asc' ? -1 : 1;
            if (valA > valB) return config.order === 'asc' ? 1 : -1;
        }
        return 0;
    });

    const handleSortIncome = (field: string) => {
        setSortConfigIncome(prev => {
            const existingIndex = prev.findIndex(c => c.field === field);
            const newOrder: 'asc' | 'desc' = (existingIndex === 0 && prev[0].order === 'asc') ? 'desc' : 'asc';
            const filtered = prev.filter(c => c.field !== field);
            return [{ field, order: newOrder }, ...filtered].slice(0, 3);
        });
    };

    const getSortIndicatorIncome = (field: string) => {
        const index = sortConfigIncome.findIndex(c => c.field === field);
        if (index === -1) return null;
        const order = sortConfigIncome[index].order;
        return (
            <span className="inline-flex items-center text-[9px] gap-0.5 whitespace-nowrap bg-brand-success/10 text-brand-success px-1 rounded animate-in fade-in zoom-in duration-300">
                {order === 'asc' ? '↑' : '↓'}
                {sortConfigIncome.length > 1 && <span className="font-black opacity-70">{index + 1}</span>}
            </span>
        );
    };

    const totalIncome = filteredReport?.reduce((sum, item) => sum + Number(item.amount), 0) || 0;
    const transactionCount = filteredReport?.length || 0;
    const averageTicket = transactionCount > 0 ? totalIncome / transactionCount : 0;

    // Desglose para arqueo y corte de caja de secretaría
    const cashIncome = filteredReport?.filter(i => i.method === 'CASH').reduce((sum, item) => sum + Number(item.amount), 0) || 0;
    const transferIncome = filteredReport?.filter(i => i.method === 'TRANSFER' || i.method === 'DEPOSIT').reduce((sum, item) => sum + Number(item.amount), 0) || 0;
    const cardIncome = filteredReport?.filter(i => i.method === 'CARD').reduce((sum, item) => sum + Number(item.amount), 0) || 0;

    const baseFilteredPending = pendingReport?.filter((item) => {
        const studentName = item.student_name || '';
        const courseName = item.course_name || '';
        const matchesSearch = studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            courseName.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCourse = filterCoursePending ? item.course_name === filterCoursePending : true;
        const matchesMonths = item.months_overdue >= minMonthsPending;

        return matchesSearch && matchesCourse && matchesMonths;
    }).sort((a, b) => {
        for (const config of sortConfigPending) {
            let valA: any = a[config.field as keyof typeof a];
            let valB: any = b[config.field as keyof typeof b];

            if (typeof valA === 'string') {
                valA = valA.toLowerCase();
                valB = valB.toLowerCase();
            }

            if (valA < valB) return config.order === 'asc' ? -1 : 1;
            if (valA > valB) return config.order === 'asc' ? 1 : -1;
        }
        return 0;
    });

    const finalPendingList: any[] = groupByStudent
        ? Object.values(baseFilteredPending?.reduce((acc: any, curr: any) => {
            if (!acc[curr.student_name]) {
                acc[curr.student_name] = { ...curr, courses_count: 1 };
            } else {
                acc[curr.student_name].pending_amount += curr.pending_amount;
                acc[curr.student_name].monthly_fee += curr.monthly_fee;
                acc[curr.student_name].months_overdue = Math.max(acc[curr.student_name].months_overdue, curr.months_overdue);
                acc[curr.student_name].courses_count++;
                acc[curr.student_name].course_name = `Varios Cursos (${acc[curr.student_name].courses_count})`;
            }
            return acc;
        }, {}) || []) as any[]
        : (baseFilteredPending || []);

    const handleSortPending = (field: string) => {
        setSortConfigPending(prev => {
            const existingIndex = prev.findIndex(c => c.field === field);
            const newOrder: 'asc' | 'desc' = (existingIndex === 0 && prev[0].order === 'asc') ? 'desc' : 'asc';
            const filtered = prev.filter(c => c.field !== field);
            return [{ field, order: newOrder }, ...filtered].slice(0, 3);
        });
    };

    const getSortIndicator = (field: string) => {
        const index = sortConfigPending.findIndex(c => c.field === field);
        if (index === -1) return null;
        const order = sortConfigPending[index].order;
        return (
            <span className="inline-flex items-center text-[9px] gap-0.5 whitespace-nowrap bg-brand-blue/10 text-brand-blue px-1 rounded animate-in fade-in zoom-in duration-300">
                {order === 'asc' ? '↑' : '↓'}
                {sortConfigPending.length > 1 && <span className="font-black opacity-70">{index + 1}</span>}
            </span>
        );
    };

    const totalPendingDebt = finalPendingList?.reduce((sum, item) => sum + Number(item.pending_amount), 0) || 0;

    const generatePDF = async () => {
        setIsExportingPdf(true);
        try {
            const doc = isSecretary && activeTab === 'income' 
                ? new jsPDF({ orientation: 'portrait', format: 'letter' })
                : new jsPDF({ orientation: 'landscape', format: 'letter' });

            const title = isSecretary && activeTab === 'income'
                ? 'ULTEC - COMPROBANTE DE CORTE DE CAJA DIARIO'
                : (activeTab === 'income' ? 'REPORTE FINANCIERO DE INGRESOS' : 'REPORTE DE ALUMNOS MOROSOS');

            doc.setFontSize(isSecretary && activeTab === 'income' ? 15 : 18);
            doc.text(title, 14, 20);

            doc.setFontSize(9);
            doc.setTextColor(100, 100, 100);

            if (isSecretary && activeTab === 'income') {
                const todayFormatted = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
                doc.text(`Fecha del Turno: ${todayFormatted}`, 14, 26);
                doc.text(`Cajero(a) / Operador: ${user?.full_name || 'Secretaría'}`, 14, 31);
                doc.text(`Hora de Generación: ${new Date().toLocaleTimeString('es-GT')}`, 14, 36);

                // Cuadro Resumen de Arqueo
                doc.setDrawColor(220, 220, 220);
                doc.setFillColor(248, 250, 252);
                doc.roundedRect(14, 40, 187, 16, 2, 2, 'FD');

                doc.setFontSize(9.5);
                doc.setTextColor(15, 23, 42);
                doc.text(`TOTAL COBRADO: Q ${totalIncome.toFixed(2)}`, 18, 47);
                doc.setFontSize(8);
                doc.setTextColor(71, 85, 105);
                doc.text(`Efectivo: Q ${cashIncome.toFixed(2)}  |  Depósitos/Transf: Q ${transferIncome.toFixed(2)}  |  Tarjetas: Q ${cardIncome.toFixed(2)}  |  Recibos: ${transactionCount}`, 18, 52);
            } else if (activeTab === 'income') {
                const periodText = (startDate || endDate)
                    ? `Período: ${startDate ? formatDate(startDate) : 'Inicio'} al ${endDate ? formatDate(endDate) : 'A la fecha'}`
                    : 'Histórico Completo';
                doc.text(periodText, 14, 30);
                doc.text(`Total Ingresos: Q${totalIncome.toFixed(2)} | Transacciones: ${transactionCount}`, 14, 36);
            } else {
                doc.text(`Generado el: ${new Date().toLocaleDateString('es-ES')}`, 14, 30);
            }

            const tableHeaders = activeTab === 'income'
                ? ['No.', 'Fecha', 'Estudiante', 'Curso', 'Método', 'Monto']
                : ['No.', 'Estudiante', 'Curso', 'Cuota Mensual', 'Meses Pendientes', 'Deuda Total'];

            const tableData = activeTab === 'income'
                ? (filteredReport?.map((item, idx) => [
                    idx + 1,
                    formatDate(item.payment_date),
                    item.student_name,
                    item.course_name,
                    item.method,
                    `Q${Number(item.amount).toFixed(2)}`
                ]) || [])
                : (finalPendingList?.map((item, idx) => [
                    idx + 1,
                    item.student_name,
                    item.course_name,
                    `Q${Number(item.monthly_fee).toFixed(2)}`,
                    item.months_overdue,
                    `Q${Number(item.pending_amount).toFixed(2)}`
                ]) || []);

            autoTable(doc, {
                startY: isSecretary && activeTab === 'income' ? 60 : 42,
                head: [tableHeaders],
                body: tableData,
                theme: 'grid',
                headStyles: {
                    fillColor: isSecretary && activeTab === 'income' ? [13, 148, 136] : (activeTab === 'income' ? [5, 150, 105] : [225, 29, 72]),
                    fontSize: 8,
                    halign: 'center',
                    cellPadding: 1.5
                },
                bodyStyles: {
                    fontSize: 7.5,
                    halign: 'center',
                    cellPadding: 1
                },
                columnStyles: {
                    0: { halign: 'center', cellWidth: 10 },
                    1: { halign: 'left', cellWidth: 'auto' },
                    2: { halign: 'left', cellWidth: 'auto' },
                    3: { halign: 'left', cellWidth: 'auto' },
                    4: { halign: 'center', cellWidth: 20 },
                    [tableHeaders.length - 1]: { halign: 'right', fontStyle: 'bold', cellWidth: 32 }
                },
                styles: {
                    overflow: 'linebreak',
                    lineColor: [220, 220, 220],
                    lineWidth: 0.1,
                    cellPadding: 0.8
                },
                tableWidth: isSecretary && activeTab === 'income' ? 187 : 'wrap',
                margin: { left: 14 },
                didParseCell: function (data) {
                    if (activeTab === 'pending' && data.section === 'body') {
                        if (data.column.index === 5) {
                            data.cell.styles.textColor = [190, 18, 60];
                        }
                        if (data.column.index === 4 && Number(data.cell.raw) > 0) {
                            data.cell.styles.fontStyle = 'bold';
                            data.cell.styles.textColor = [190, 18, 60];
                        }
                    }
                    if (activeTab === 'income' && data.section === 'body' && data.column.index === 5) {
                        data.cell.styles.textColor = [5, 120, 87];
                    }
                }
            });

            // Si es secretaria, agregar firmas de entrega y recepción de caja
            if (isSecretary && activeTab === 'income') {
                const finalY = (doc as any).lastAutoTable?.finalY || 160;
                const signY = Math.min(finalY + 30, 240);
                doc.setFontSize(8.5);
                doc.setTextColor(50, 50, 50);
                
                doc.text('_____________________________________', 25, signY);
                doc.text(`Entregado por: ${user?.full_name || 'Secretaría'}`, 25, signY + 5);
                doc.text('Cajero(a) de Turno', 25, signY + 9);

                doc.text('_____________________________________', 120, signY);
                doc.text('Recibido por: Administración / Contabilidad', 120, signY + 5);
                doc.text('Firma y Sello de Recepción', 120, signY + 9);
            }

            const fileName = isSecretary && activeTab === 'income'
                ? `Corte_Caja_${(user?.full_name || 'Secretaria').replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`
                : `${activeTab === 'income' ? 'Reporte_Ingresos' : 'Reporte_Morosos'}_${new Date().toISOString().split('T')[0]}.pdf`;
            await savePdfDoc(doc, fileName);
        } catch (err: any) {
            console.error('Error generando PDF:', err);
            alert(`Error al generar PDF: ${err?.message || 'Error inesperado'}`);
        } finally {
            setIsExportingPdf(false);
        }
    };

    const exportToExcel = async () => {
        setIsExportingExcel(true);
        try {
            let worksheet;
            let workbook;
            let fileName;

            if (activeTab === 'income') {
                if (!filteredReport || filteredReport.length === 0) {
                    alert('No hay registros de ingresos para exportar en este período.');
                    return;
                }
                const dataToExport = filteredReport.map((item, idx) => ({
                    'No.': idx + 1,
                    'Fecha': formatDate(item.payment_date),
                    'Estudiante': item.student_name,
                    'Curso': item.course_name,
                    'Método': item.method,
                    'Monto (Q)': Number(item.amount)
                }));
                worksheet = XLSX.utils.json_to_sheet(dataToExport);
                workbook = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(workbook, worksheet, isSecretary ? "Corte_Diario" : "Ingresos");
                fileName = isSecretary
                    ? `Corte_Caja_${(user?.full_name || 'Secretaria').replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`
                    : `Reporte_Ingresos_${new Date().toISOString().split('T')[0]}.xlsx`;
            } else {
                if (!finalPendingList || finalPendingList.length === 0) {
                    alert('No hay registros de morosos para exportar.');
                    return;
                }
                const dataToExport = finalPendingList.map((item, idx) => ({
                    'No.': idx + 1,
                    'Estudiante': item.student_name,
                    'Curso': item.course_name,
                    'Cuota Mensual (Q)': Number(item.monthly_fee),
                    'Meses Pendientes': item.months_overdue,
                    'Deuda Total (Q)': Number(item.pending_amount)
                }));
                worksheet = XLSX.utils.json_to_sheet(dataToExport);
                workbook = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(workbook, worksheet, "Morosos");
                fileName = `Reporte_Morosos_${new Date().toISOString().split('T')[0]}.xlsx`;
            }

            await saveWorkbook(workbook, fileName);
        } catch (err: any) {
            console.error('Error exportando Excel:', err);
            alert(`Error al exportar Excel: ${err?.message || 'Error inesperado'}`);
        } finally {
            setIsExportingExcel(false);
        }
    };

    // Helper para formatear fechas de UTC a Local correctamente y evitar el corrimiento de día
    const formatDate = (dateString: string) => {
        if (!dateString) return '';
        const parts = dateString.split('T')[0].split('-');
        // Crear la fecha forzando la hora local al mediodía para evitar cambios de fecha por zona horaria
        const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 12, 0, 0);
        return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    return (
        <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-500 pb-16 sm:pb-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 print:hidden">
                <div>
                    <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
                        {isSecretary ? 'Mi Corte de Caja Diario' : 'Reportes Financieros'}
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                        {isSecretary
                            ? 'Arqueo y liquidación en tiempo real de tus cobros del día.'
                            : 'Análisis de ingresos y registros de transacciones.'}
                    </p>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                        onClick={exportToExcel}
                        disabled={isExportingExcel}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-semibold text-xs sm:text-sm shadow-sm transition active:scale-95 border border-white/10 disabled:opacity-50"
                    >
                        {isExportingExcel ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                        <span>{isExportingExcel ? 'Exportando...' : (isSecretary ? 'Corte en Excel' : 'Exportar Excel')}</span>
                    </button>
                    <button
                        onClick={generatePDF}
                        disabled={isExportingPdf}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-brand-blue hover:bg-blue-600 text-white rounded-xl font-semibold text-xs sm:text-sm shadow-sm transition active:scale-95 border border-white/10 disabled:opacity-50"
                    >
                        {isExportingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
                        <span>{isExportingPdf ? 'Generando...' : (isSecretary ? 'Imprimir Corte (PDF)' : 'Exportar PDF')}</span>
                    </button>
                </div>
            </div>

            {/* Turno Banner para Secretaría */}
            {isSecretary && (
                <div className="p-3.5 bg-gradient-to-r from-emerald-500/10 via-brand-teal/10 to-transparent border border-emerald-500/20 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm print:hidden">
                    <div className="flex items-center gap-2.5">
                        <span className="relative flex h-2.5 w-2.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                        </span>
                        <div>
                            <p className="text-xs font-bold text-slate-800 dark:text-white capitalize">
                                📅 Turno de Hoy: {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                            </p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                Visualizando únicamente los cobros realizados por ti hoy. Esta vista se reinicia automáticamente a las 00:00 hrs.
                            </p>
                        </div>
                    </div>
                    <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 self-start sm:self-auto whitespace-nowrap">
                        Cajero(a): {user?.full_name || 'Secretaría'}
                    </span>
                </div>
            )}

            {/* Print Header (Only visible when printing) */}
            <div className="hidden print:block mb-8 text-center pb-6 border-b-2 border-slate-200">
                <h1 className="text-2xl font-bold text-slate-900 uppercase tracking-wider">
                    {isSecretary && activeTab === 'income' ? 'Comprobante de Corte de Caja Diario' : (activeTab === 'income' ? 'Reporte Financiero de Ingresos' : 'Reporte de Alumnos Morosos')}
                </h1>
                {activeTab === 'income' && (
                    isSecretary ? (
                        <p className="text-slate-600 mt-2">
                            Fecha: {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} • Cajero(a): {user?.full_name || 'Secretaría'}
                        </p>
                    ) : (
                        (startDate || endDate) ? (
                            <p className="text-slate-600 mt-2">
                                Período: {startDate ? formatDate(startDate) : 'Inicio'} al {endDate ? formatDate(endDate) : 'A la fecha'}
                            </p>
                        ) : (
                            <p className="text-slate-600 mt-2">Histórico Completo</p>
                        )
                    )
                )}
                {activeTab === 'pending' && <p className="text-slate-600 mt-2">A la fecha actual</p>}
            </div>

            {/* Tabs */}
            <div className="flex p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl print:hidden max-w-md shadow-inner border border-slate-200/50 dark:border-slate-700/50">
                <button
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                        activeTab === 'income'
                            ? 'bg-white dark:bg-slate-900 text-brand-blue shadow-sm border border-slate-200/60 dark:border-slate-700'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                    onClick={() => setActiveTab('income')}
                >
                    <AlignJustify className="w-4 h-4" />
                    <span>{isSecretary ? 'Mi Turno (Hoy)' : 'Ingresos Generales'}</span>
                </button>
                <button
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                        activeTab === 'pending'
                            ? 'bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 shadow-sm border border-slate-200/60 dark:border-slate-700'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                    onClick={() => setActiveTab('pending')}
                >
                    <AlertTriangle className="w-4 h-4" />
                    <span>Morosos</span>
                </button>
            </div>

            {/* Summary Cards */}
            {activeTab === 'income' ? (
                isSecretary ? (
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                        {/* Card 1: Total Hoy */}
                        <div className="glass-card p-4 sm:p-5 border border-slate-200 dark:border-white/10 flex items-center space-x-3.5 hover:border-emerald-500/50 transition-colors">
                            <div className="h-11 w-11 sm:h-13 sm:w-13 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center border border-emerald-500/20 shadow-inner shrink-0">
                                <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest truncate">Total Cobrado Hoy</p>
                                <h3 className="text-lg sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight truncate">Q{totalIncome.toFixed(2)}</h3>
                                <span className="text-[10px] text-emerald-500 font-bold">{transactionCount} recibos emitidos</span>
                            </div>
                        </div>

                        {/* Card 2: Efectivo */}
                        <div className="glass-card p-4 sm:p-5 border border-slate-200 dark:border-white/10 flex items-center space-x-3.5 hover:border-brand-blue/50 transition-colors">
                            <div className="h-11 w-11 sm:h-13 sm:w-13 bg-brand-blue/10 text-brand-blue rounded-2xl flex items-center justify-center border border-brand-blue/20 shadow-inner shrink-0">
                                <Banknote className="h-5 w-5 sm:h-6 sm:w-6" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest truncate">Efectivo en Caja</p>
                                <h3 className="text-lg sm:text-2xl font-black text-brand-blue tracking-tight truncate">Q{cashIncome.toFixed(2)}</h3>
                                <span className="text-[10px] text-slate-400">Dinero en mano</span>
                            </div>
                        </div>

                        {/* Card 3: Boletas / Transferencias */}
                        <div className="glass-card p-4 sm:p-5 border border-slate-200 dark:border-white/10 flex items-center space-x-3.5 hover:border-brand-purple/50 transition-colors">
                            <div className="h-11 w-11 sm:h-13 sm:w-13 bg-brand-purple/10 text-brand-purple rounded-2xl flex items-center justify-center border border-brand-purple/20 shadow-inner shrink-0">
                                <Building2 className="h-5 w-5 sm:h-6 sm:w-6" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest truncate">Depósito / Boleta</p>
                                <h3 className="text-lg sm:text-2xl font-black text-brand-purple tracking-tight truncate">Q{transferIncome.toFixed(2)}</h3>
                                <span className="text-[10px] text-slate-400">Comprobantes</span>
                            </div>
                        </div>

                        {/* Card 4: Tarjetas */}
                        <div className="glass-card p-4 sm:p-5 border border-slate-200 dark:border-white/10 flex items-center space-x-3.5 hover:border-amber-500/50 transition-colors">
                            <div className="h-11 w-11 sm:h-13 sm:w-13 bg-amber-500/10 text-amber-500 rounded-2xl flex items-center justify-center border border-amber-500/20 shadow-inner shrink-0">
                                <CreditCard className="h-5 w-5 sm:h-6 sm:w-6" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest truncate">Tarjeta / POS</p>
                                <h3 className="text-lg sm:text-2xl font-black text-amber-500 tracking-tight truncate">Q{cardIncome.toFixed(2)}</h3>
                                <span className="text-[10px] text-slate-400">Vouchers</span>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-6">
                        <div className="col-span-2 md:col-span-1 glass-card p-4 sm:p-6 border border-slate-200 dark:border-white/10 flex items-center space-x-3.5 sm:space-x-5 hover:border-brand-success/50 transition-colors">
                            <div className="h-12 w-12 sm:h-16 sm:w-16 bg-brand-success/10 text-brand-success rounded-2xl flex items-center justify-center border border-brand-success/20 print:border print:border-emerald-200 shadow-inner shrink-0">
                                <TrendingUp className="h-6 w-6 sm:h-8 sm:w-8" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest truncate">Ingresos Totales</p>
                                <h3 className="text-xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight truncate">Q{totalIncome.toFixed(2)}</h3>
                            </div>
                        </div>

                        <div className="glass-card p-4 sm:p-6 border border-slate-200 dark:border-white/10 flex items-center space-x-3.5 sm:space-x-5 hover:border-brand-blue/50 transition-colors">
                            <div className="h-12 w-12 sm:h-16 sm:w-16 bg-brand-blue/10 text-brand-blue rounded-2xl flex items-center justify-center border border-brand-blue/20 print:border print:border-blue-200 shadow-inner shrink-0">
                                <Receipt className="h-6 w-6 sm:h-8 sm:w-8" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest truncate">Transacciones</p>
                                <h3 className="text-xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight truncate">{transactionCount}</h3>
                            </div>
                        </div>

                        <div className="glass-card p-4 sm:p-6 border border-slate-200 dark:border-white/10 flex items-center space-x-3.5 sm:space-x-5 hover:border-brand-purple/50 transition-colors">
                            <div className="h-12 w-12 sm:h-16 sm:w-16 bg-brand-purple/10 text-brand-purple rounded-2xl flex items-center justify-center border border-brand-purple/20 print:border print:border-indigo-200 shadow-inner shrink-0">
                                <CreditCard className="h-6 w-6 sm:h-8 sm:w-8" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest truncate">Ticket Prom.</p>
                                <h3 className="text-xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight truncate">Q{averageTicket.toFixed(2)}</h3>
                            </div>
                        </div>
                    </div>
                )
            ) : (
                <div className="grid grid-cols-2 gap-3 sm:gap-6">
                    <div className="glass-card p-4 sm:p-6 border border-slate-200 dark:border-white/10 flex items-center space-x-3.5 sm:space-x-5 hover:border-brand-danger/50 transition-colors">
                        <div className="h-12 w-12 sm:h-16 sm:w-16 bg-brand-danger/10 text-brand-danger rounded-2xl flex items-center justify-center border border-brand-danger/20 print:border print:border-rose-200 shadow-inner shrink-0">
                            <AlertTriangle className="h-6 w-6 sm:h-8 sm:w-8" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest truncate">Deuda Total</p>
                            <h3 className="text-lg sm:text-3xl font-black text-rose-600 dark:text-rose-400 tracking-tight truncate">Q{totalPendingDebt.toFixed(2)}</h3>
                        </div>
                    </div>

                    <div className="glass-card p-4 sm:p-6 border border-slate-200 dark:border-white/10 flex items-center space-x-3.5 sm:space-x-5 hover:border-brand-warning/50 transition-colors">
                        <div className="h-12 w-12 sm:h-16 sm:w-16 bg-brand-warning/10 text-brand-warning rounded-2xl flex items-center justify-center border border-brand-warning/20 print:border print:border-amber-200 shadow-inner shrink-0">
                            <Users className="h-6 w-6 sm:h-8 sm:w-8" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest truncate">Morosos</p>
                            <h3 className="text-xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight truncate">{finalPendingList?.length || 0}</h3>
                        </div>
                    </div>
                </div>
            )}

            {/* Search & Filter Controls */}
            <div className="space-y-3 print:hidden">
                <div className="flex gap-2">
                    <div className="relative flex-1 group">
                        <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400 group-focus-within:text-brand-blue transition-colors" />
                        <input
                            type="text"
                            placeholder="Buscar alumno o curso..."
                            className="w-full pl-10 pr-9 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-brand-blue/20 focus:border-brand-blue transition-all placeholder:text-slate-400 shadow-sm"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        {searchTerm && (
                            <button
                                onClick={() => setSearchTerm('')}
                                className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        )}
                    </div>

                    <button
                        onClick={() => setIsFiltersOpen(!isFiltersOpen)}
                        className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border text-sm font-semibold transition-all shadow-sm ${
                            isFiltersOpen || (activeTab === 'income' ? activeIncomeFiltersCount > 0 : activePendingFiltersCount > 0)
                                ? 'bg-brand-blue/10 border-brand-blue text-brand-blue dark:bg-brand-blue/20'
                                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                    >
                        <SlidersHorizontal className="h-4 w-4" />
                        <span className="hidden sm:inline">Filtros</span>
                        {(activeTab === 'income' ? activeIncomeFiltersCount : activePendingFiltersCount) > 0 && (
                            <span className="w-5 h-5 rounded-full bg-brand-blue text-white text-[11px] font-black flex items-center justify-center ml-0.5">
                                {activeTab === 'income' ? activeIncomeFiltersCount : activePendingFiltersCount}
                            </span>
                        )}
                    </button>
                </div>

                {/* Collapsible Filter Panel */}
                {isFiltersOpen && (
                    <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-lg space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                Filtros {activeTab === 'income' ? 'de Ingresos' : 'de Morosos'}
                            </span>
                            <button
                                onClick={() => {
                                    if (activeTab === 'income') {
                                        setStartDate('');
                                        setEndDate('');
                                        setFilterMethod('');
                                    } else {
                                        setFilterCoursePending('');
                                        setMinMonthsPending(0);
                                        setGroupByStudent(false);
                                    }
                                }}
                                className="text-xs font-semibold text-brand-blue hover:underline"
                            >
                                Limpiar filtros
                            </button>
                        </div>

                        {activeTab === 'income' ? (
                            isSecretary ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block mb-1">Período de Turno</label>
                                        <div className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl px-3 py-2 text-xs font-semibold flex items-center gap-2">
                                            <Calendar className="h-3.5 w-3.5 text-brand-teal" />
                                            <span>Turno de Hoy (Fijo)</span>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block mb-1">Método de Pago</label>
                                        <select
                                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-brand-blue"
                                            value={filterMethod}
                                            onChange={(e) => setFilterMethod(e.target.value)}
                                        >
                                            <option value="">Todos los métodos</option>
                                            {uniqueMethods.map((m: any) => (
                                                <option key={m} value={m}>{m}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block mb-1">Fecha Desde</label>
                                        <input
                                            type="date"
                                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-brand-blue"
                                            value={startDate}
                                            onChange={(e) => setStartDate(e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block mb-1">Fecha Hasta</label>
                                        <input
                                            type="date"
                                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-brand-blue"
                                            value={endDate}
                                            onChange={(e) => setEndDate(e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block mb-1">Método de Pago</label>
                                        <select
                                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-brand-blue"
                                            value={filterMethod}
                                            onChange={(e) => setFilterMethod(e.target.value)}
                                        >
                                            <option value="">Todos los métodos</option>
                                            {uniqueMethods.map((m: any) => (
                                                <option key={m} value={m}>{m}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            )
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block mb-1">Curso</label>
                                    <select
                                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-brand-blue"
                                        value={filterCoursePending}
                                        onChange={(e) => setFilterCoursePending(e.target.value)}
                                    >
                                        <option value="">Todos los cursos</option>
                                        {uniqueCoursesPending.map((c: any) => (
                                            <option key={c} value={c}>{c}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block mb-1">Meses de Atraso</label>
                                    <select
                                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-brand-blue"
                                        value={minMonthsPending}
                                        onChange={(e) => setMinMonthsPending(Number(e.target.value))}
                                    >
                                        <option value="0">Cualquier mes</option>
                                        <option value="1">+1 Mes</option>
                                        <option value="2">+2 Meses</option>
                                        <option value="3">+3 Meses</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="flex items-center gap-3 p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl cursor-pointer">
                                        <input
                                            type="checkbox"
                                            className="rounded text-brand-blue focus:ring-brand-blue"
                                            checked={groupByStudent}
                                            onChange={(e) => setGroupByStudent(e.target.checked)}
                                        />
                                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Agrupar por alumno</span>
                                    </label>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {(activeTab === 'income' ? isLoading : isLoadingPending) ? (
                <div className="flex justify-center p-12"><Loader2 className="animate-spin h-8 w-8 text-brand-blue" /></div>
            ) : (
                <>
                    {/* MOBILE FEED (Cards) - block md:hidden */}
                    <div className="block md:hidden space-y-3">
                        {activeTab === 'income' ? (
                            <>
                                {filteredReport?.map((item, idx) => (
                                    <div key={idx} className="glass-card p-4 rounded-2xl border border-slate-200/80 dark:border-white/10 space-y-2.5 shadow-sm">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[11px] font-black text-slate-400">#{idx + 1}</span>
                                                    <h4 className="font-bold text-slate-900 dark:text-white text-sm truncate">{item.student_name}</h4>
                                                </div>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">{item.course_name}</p>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                                                    +Q{Number(item.amount).toFixed(2)}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/80 text-[11px]">
                                            <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 font-medium">
                                                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                                <span>{formatDate(item.payment_date)}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                                    {item.method}
                                                </span>
                                                {item.id && (
                                                    <button
                                                        onClick={() => downloadInvoicePdf(item.id, item.student_name)}
                                                        title="Descargar Recibo"
                                                        className="px-2 py-0.5 rounded-md bg-brand-blue/10 text-brand-blue text-[10px] font-bold flex items-center gap-1 active:scale-95 transition-all"
                                                    >
                                                        <Printer className="h-3 w-3" />
                                                        <span>Recibo</span>
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                {filteredReport?.length === 0 && (
                                    <div className="glass-card p-8 rounded-2xl text-center text-slate-500 dark:text-slate-400 text-sm">
                                        No hay transacciones registradas en este período.
                                    </div>
                                )}
                            </>
                        ) : (
                            <>
                                {finalPendingList?.map((item, idx) => (
                                    <div key={idx} className="glass-card p-4 rounded-2xl border border-slate-200/80 dark:border-white/10 space-y-2.5 shadow-sm">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[11px] font-black text-slate-400">#{idx + 1}</span>
                                                    <h4 className="font-bold text-slate-900 dark:text-white text-sm truncate">{item.student_name}</h4>
                                                </div>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">{item.course_name}</p>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <span className="text-sm font-black text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 px-2 py-0.5 rounded-md border border-rose-500/20">
                                                    Q{Number(item.pending_amount).toFixed(2)}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/80 text-[11px]">
                                            <span className="text-slate-500 dark:text-slate-400 font-medium">
                                                Cuota: Q{Number(item.monthly_fee).toFixed(2)}
                                            </span>
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                                                {item.months_overdue} {item.months_overdue === 1 ? 'mes pendiente' : 'meses pendientes'}
                                            </span>
                                        </div>
                                    </div>
                                ))}

                                {finalPendingList?.length === 0 && (
                                    <div className="glass-card p-8 rounded-2xl text-center text-slate-500 dark:text-slate-400 text-sm">
                                        Todos los alumnos están al día.
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* DESKTOP TABLE - hidden md:block */}
                    <div className="hidden md:block glass-card rounded-3xl overflow-hidden border border-slate-200 dark:border-white/10 shadow-sm">
                        <div className="overflow-x-auto">
                            {activeTab === 'income' ? (
                                <table className="w-full text-left">
                                    <thead className="bg-slate-50/50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700/50">
                                        <tr>
                                            <th className="px-6 py-5 text-center text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest w-12">No.</th>
                                            <th className="px-6 py-5 text-left text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors group select-none" onClick={() => handleSortIncome('payment_date')}>
                                                <div className="flex items-center gap-2">
                                                    Fecha
                                                    {getSortIndicatorIncome('payment_date')}
                                                </div>
                                            </th>
                                            <th className="px-6 py-5 text-left text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors group select-none" onClick={() => handleSortIncome('student_name')}>
                                                <div className="flex items-center gap-2">
                                                    Estudiante
                                                    {getSortIndicatorIncome('student_name')}
                                                </div>
                                            </th>
                                            <th className="px-6 py-5 text-left text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors group select-none" onClick={() => handleSortIncome('course_name')}>
                                                <div className="flex items-center gap-2">
                                                    Curso
                                                    {getSortIndicatorIncome('course_name')}
                                                </div>
                                            </th>
                                            <th className="px-6 py-5 text-left text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest text-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors group select-none" onClick={() => handleSortIncome('method')}>
                                                <div className="flex items-center justify-center gap-2">
                                                    Método
                                                    {getSortIndicatorIncome('method')}
                                                </div>
                                            </th>
                                            <th className="px-6 py-5 text-left text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest text-right cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors group select-none" onClick={() => handleSortIncome('amount')}>
                                                <div className="flex items-center justify-end gap-2">
                                                    Monto
                                                    {getSortIndicatorIncome('amount')}
                                                </div>
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 bg-white/50 dark:bg-transparent">
                                        {filteredReport?.map((item, idx) => (
                                            <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition group print:break-inside-avoid">
                                                <td className="px-6 py-4 text-center text-slate-400 text-xs font-medium">{idx + 1}</td>
                                                <td className="px-6 py-4 text-slate-500 dark:text-slate-400 font-medium">
                                                    {formatDate(item.payment_date)}
                                                </td>
                                                <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">{item.student_name}</td>
                                                <td className="px-6 py-4 text-slate-600 dark:text-slate-300 bg-slate-50/50 dark:bg-slate-800/30 font-medium">{item.course_name}</td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className="inline-flex items-center justify-center px-3 py-1 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 print:border-none print:p-0 print:bg-transparent print:text-slate-800">
                                                        {item.method}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 font-black text-brand-success text-right bg-brand-success/5 dark:bg-brand-success/10 group-hover:bg-brand-success/10 transition-colors">
                                                    <div className="flex items-center justify-end gap-2.5">
                                                        <span>Q{Number(item.amount).toFixed(2)}</span>
                                                        {item.id && (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    downloadInvoicePdf(item.id, item.student_name);
                                                                }}
                                                                title="Descargar Recibo Oficial"
                                                                className="p-1.5 rounded-lg bg-brand-blue/10 hover:bg-brand-blue/20 text-brand-blue transition-all"
                                                            >
                                                                <Printer className="h-3.5 w-3.5" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                        {filteredReport?.length === 0 && (
                                            <tr>
                                                <td colSpan={6} className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
                                                    No hay transacciones en este período.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            ) : (
                                <table className="w-full text-left">
                                    <thead className="bg-slate-50/50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700/50">
                                        <tr>
                                            <th className="px-6 py-5 text-center text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest w-12">No.</th>
                                            <th className="px-6 py-5 text-left text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors group select-none" onClick={() => handleSortPending('student_name')}>
                                                <div className="flex items-center gap-2">
                                                    Estudiante
                                                    {getSortIndicator('student_name')}
                                                </div>
                                            </th>
                                            <th className="px-6 py-5 text-left text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors group select-none" onClick={() => handleSortPending('course_name')}>
                                                <div className="flex items-center gap-2">
                                                    Curso
                                                    {getSortIndicator('course_name')}
                                                </div>
                                            </th>
                                            <th className="px-6 py-5 text-left text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest text-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors group select-none" onClick={() => handleSortPending('monthly_fee')}>
                                                <div className="flex items-center justify-center gap-2">
                                                    Cuota Mensual
                                                    {getSortIndicator('monthly_fee')}
                                                </div>
                                            </th>
                                            <th className="px-6 py-5 text-left text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest text-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors group select-none" onClick={() => handleSortPending('months_overdue')}>
                                                <div className="flex items-center justify-center gap-2">
                                                    Meses Pendientes
                                                    {getSortIndicator('months_overdue')}
                                                </div>
                                            </th>
                                            <th className="px-6 py-5 text-left text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest text-right cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors group select-none" onClick={() => handleSortPending('pending_amount')}>
                                                <div className="flex items-center justify-end gap-2">
                                                    Deuda Total
                                                    {getSortIndicator('pending_amount')}
                                                </div>
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 bg-white/50 dark:bg-transparent">
                                        {finalPendingList?.map((item, idx) => (
                                            <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition group print:break-inside-avoid">
                                                <td className="px-6 py-4 text-center text-slate-400 text-xs font-medium">{idx + 1}</td>
                                                <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">{item.student_name}</td>
                                                <td className="px-6 py-4 text-slate-600 dark:text-slate-300 bg-slate-50/50 dark:bg-slate-800/30 font-medium">{item.course_name}</td>
                                                <td className="px-6 py-4 text-center text-slate-500 dark:text-slate-400 font-medium">Q{Number(item.monthly_fee).toFixed(2)}</td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className="inline-flex items-center justify-center px-3 py-1 rounded-lg text-xs font-bold bg-brand-danger/10 text-brand-danger border border-brand-danger/20 print:border-none print:p-0 print:bg-transparent print:text-rose-800">
                                                        {item.months_overdue}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 font-black text-brand-danger text-right bg-brand-danger/5 dark:bg-brand-danger/10 group-hover:bg-brand-danger/10 transition-colors">Q{Number(item.pending_amount).toFixed(2)}</td>
                                            </tr>
                                        ))}
                                        {finalPendingList?.length === 0 && (
                                            <tr>
                                                <td colSpan={6} className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
                                                    Todos los alumnos están al día.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </>
            )}

            {/* Print Styles */}
            <style dangerouslySetInnerHTML={{
                __html: `
                @media print {
                    @page { margin: 15mm; size: letter; }
                    body { background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    #root { height: auto !important; overflow: visible !important; }
                    .print\\:hidden { display: none !important; }
                    .print\\:block { display: block !important; }
                    .print\\:border { border-width: 1px !important; }
                    .print\\:border-emerald-200 { border-color: #a7f3d0 !important; }
                    .print\\:border-blue-200 { border-color: #bfdbfe !important; }
                    .print\\:border-indigo-200 { border-color: #c7d2fe !important; }
                }
            `}} />
        </div>
    );
};

export default Reports;
