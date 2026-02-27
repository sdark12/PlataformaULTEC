import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getFinancialReport, getPendingPaymentsReport } from './reportService';
import { Loader2, Search, Filter, Printer, TrendingUp, CreditCard, Receipt, AlignJustify, AlertTriangle, Users } from 'lucide-react';

const Reports = () => {
    const [activeTab, setActiveTab] = useState<'income' | 'pending'>('income');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [filterMethod, setFilterMethod] = useState('');

    const { data: report, isLoading } = useQuery({
        queryKey: ['financialReport', startDate, endDate],
        queryFn: () => getFinancialReport(startDate, endDate),
    });

    const { data: pendingReport, isLoading: isLoadingPending } = useQuery({
        queryKey: ['pendingPaymentsReport'],
        queryFn: getPendingPaymentsReport,
    });

    const uniqueMethods = Array.from(new Set(report?.map(item => item.method).filter(Boolean))).sort();

    const filteredReport = report?.filter((item) => {
        const studentName = item.student_name || '';
        const courseName = item.course_name || '';

        const matchesSearch =
            studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            courseName.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesMethod = filterMethod ? item.method === filterMethod : true;

        return matchesSearch && matchesMethod;
    });

    const totalIncome = filteredReport?.reduce((sum, item) => sum + Number(item.amount), 0) || 0;
    const transactionCount = filteredReport?.length || 0;
    const averageTicket = transactionCount > 0 ? totalIncome / transactionCount : 0;

    const filteredPending = pendingReport?.filter((item) => {
        const studentName = item.student_name || '';
        const courseName = item.course_name || '';
        return studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            courseName.toLowerCase().includes(searchTerm.toLowerCase());
    });

    const totalPendingDebt = filteredPending?.reduce((sum, item) => sum + Number(item.pending_amount), 0) || 0;

    const handlePrint = () => {
        window.print();
    };

    // Helper para formatear fechas de UTC a Local correctamente y evitar el corrimiento de día
    const formatDate = (dateString: string) => {
        const parts = dateString.split('T')[0].split('-');
        // Crear la fecha forzando la hora local al mediodía para evitar cambios de fecha por zona horaria
        const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 12, 0, 0);
        return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden mb-8">
                <div>
                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Reportes Financieros</h2>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">Análisis de ingresos y registros de transacciones.</p>
                </div>
                <button
                    onClick={handlePrint}
                    className="flex items-center space-x-2 px-6 py-3 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-white dark:hover:bg-slate-800 transition-all shadow-sm font-semibold"
                >
                    <Printer className="h-5 w-5" />
                    <span>Imprimir Reporte</span>
                </button>
            </div>

            {/* Print Header (Only visible when printing) */}
            <div className="hidden print:block mb-8 text-center pb-6 border-b-2 border-slate-200">
                <h1 className="text-2xl font-bold text-slate-900 uppercase tracking-wider">
                    {activeTab === 'income' ? 'Reporte Financiero de Ingresos' : 'Reporte de Alumnos Morosos'}
                </h1>
                {activeTab === 'income' && (
                    (startDate || endDate) ? (
                        <p className="text-slate-600 mt-2">
                            Período: {startDate ? formatDate(startDate) : 'Inicio'} al {endDate ? formatDate(endDate) : 'A la fecha'}
                        </p>
                    ) : (
                        <p className="text-slate-600 mt-2">Histórico Completo</p>
                    )
                )}
                {activeTab === 'pending' && <p className="text-slate-600 mt-2">A la fecha actual</p>}
            </div>

            {/* Tabs */}
            <div className="flex space-x-6 mb-8 border-b border-slate-200 dark:border-slate-700 print:hidden px-2">
                <button
                    className={`pb-3 text-sm font-bold border-b-2 flex items-center gap-2 transition-colors ${activeTab === 'income' ? 'border-brand-blue text-brand-blue' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}
                    onClick={() => setActiveTab('income')}
                >
                    <AlignJustify className="w-4 h-4" /> Ingresos Generales
                </button>
                <button
                    className={`pb-3 text-sm font-bold border-b-2 flex items-center gap-2 transition-colors ${activeTab === 'pending' ? 'border-brand-blue text-brand-blue' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}
                    onClick={() => setActiveTab('pending')}
                >
                    <AlertTriangle className="w-4 h-4" /> Pendientes de Pago (Morosos)
                </button>
            </div>

            {/* Summary Cards */}
            {activeTab === 'income' ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="glass-card p-6 border border-slate-200 dark:border-white/10 flex items-center space-x-5 hover:border-brand-success/50 transition-colors">
                        <div className="h-16 w-16 bg-brand-success/10 text-brand-success rounded-2xl flex items-center justify-center border border-brand-success/20 print:border print:border-emerald-200 shadow-inner">
                            <TrendingUp className="h-8 w-8" />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">Ingresos Totales</p>
                            <h3 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">Q{totalIncome.toFixed(2)}</h3>
                        </div>
                    </div>

                    <div className="glass-card p-6 border border-slate-200 dark:border-white/10 flex items-center space-x-5 hover:border-brand-blue/50 transition-colors">
                        <div className="h-16 w-16 bg-brand-blue/10 text-brand-blue rounded-2xl flex items-center justify-center border border-brand-blue/20 print:border print:border-blue-200 shadow-inner">
                            <Receipt className="h-8 w-8" />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">Transacciones</p>
                            <h3 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">{transactionCount}</h3>
                        </div>
                    </div>

                    <div className="glass-card p-6 border border-slate-200 dark:border-white/10 flex items-center space-x-5 hover:border-brand-purple/50 transition-colors">
                        <div className="h-16 w-16 bg-brand-purple/10 text-brand-purple rounded-2xl flex items-center justify-center border border-brand-purple/20 print:border print:border-indigo-200 shadow-inner">
                            <CreditCard className="h-8 w-8" />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">Ticket Promedio</p>
                            <h3 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">Q{averageTicket.toFixed(2)}</h3>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    <div className="glass-card p-6 border border-slate-200 dark:border-white/10 flex items-center space-x-5 hover:border-brand-danger/50 transition-colors">
                        <div className="h-16 w-16 bg-brand-danger/10 text-brand-danger rounded-2xl flex items-center justify-center border border-brand-danger/20 print:border print:border-rose-200 shadow-inner">
                            <AlertTriangle className="h-8 w-8" />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">Deuda Pendiente Total</p>
                            <h3 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">Q{totalPendingDebt.toFixed(2)}</h3>
                        </div>
                    </div>

                    <div className="glass-card p-6 border border-slate-200 dark:border-white/10 flex items-center space-x-5 hover:border-brand-warning/50 transition-colors">
                        <div className="h-16 w-16 bg-brand-warning/10 text-brand-warning rounded-2xl flex items-center justify-center border border-brand-warning/20 print:border print:border-amber-200 shadow-inner">
                            <Users className="h-8 w-8" />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">Alumnos Morosos</p>
                            <h3 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">{filteredPending?.length || 0}</h3>
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm p-2 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col md:flex-row gap-4 print:hidden items-center mb-8">
                {activeTab === 'income' && (
                    <div className="flex gap-4 w-full md:w-auto p-2">
                        <div className="flex-1">
                            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block mb-1.5 ml-1">Desde</label>
                            <input
                                type="date"
                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-4 focus:ring-brand-blue/20 focus:border-brand-blue transition-all"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                            />
                        </div>
                        <div className="flex-1">
                            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block mb-1.5 ml-1">Hasta</label>
                            <input
                                type="date"
                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-4 focus:ring-brand-blue/20 focus:border-brand-blue transition-all"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                            />
                        </div>
                    </div>
                )}

                <div className="w-px h-12 bg-slate-200 dark:bg-slate-700 hidden md:block mx-2"></div>

                <div className="flex flex-1 w-full gap-4 p-2 relative">
                    <div className="relative flex-1 group">
                        <Search className="absolute left-4 top-3.5 h-5 w-5 text-slate-400 group-focus-within:text-brand-blue transition-colors" />
                        <input
                            type="text"
                            placeholder="Buscar alumno o curso..."
                            className="w-full pl-12 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-brand-blue/20 focus:border-brand-blue transition-all placeholder:text-slate-400"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    {activeTab === 'income' && (
                        <div className="relative md:w-64">
                            <div className="absolute left-4 top-3.5 flex items-center pointer-events-none text-slate-400">
                                <Filter className="h-5 w-5" />
                            </div>
                            <select
                                className="w-full pl-12 pr-10 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-brand-blue/20 focus:border-brand-blue appearance-none font-medium cursor-pointer transition-all hover:bg-slate-50 dark:hover:bg-slate-800"
                                value={filterMethod}
                                onChange={(e) => setFilterMethod(e.target.value)}
                            >
                                <option value="">Cualquier Método</option>
                                {uniqueMethods.map((m: any) => (
                                    <option key={m} value={m}>{m}</option>
                                ))}
                            </select>
                            <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-slate-500">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {(activeTab === 'income' ? isLoading : isLoadingPending) ? (
                <div className="flex justify-center p-8"><Loader2 className="animate-spin h-8 w-8 text-blue-600" /></div>
            ) : (
                <div className="glass-card rounded-3xl overflow-hidden">
                    <div className="overflow-x-auto">
                        {activeTab === 'income' ? (
                            <table className="w-full text-left">
                                <thead className="bg-slate-50/50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700/50">
                                    <tr>
                                        <th className="px-6 py-5 text-left text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Fecha</th>
                                        <th className="px-6 py-5 text-left text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Estudiante</th>
                                        <th className="px-6 py-5 text-left text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Curso</th>
                                        <th className="px-6 py-5 text-left text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest text-center">Método</th>
                                        <th className="px-6 py-5 text-left text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest text-right">Monto</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 bg-white/50 dark:bg-transparent">
                                    {filteredReport?.map((item, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition group print:break-inside-avoid">
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
                                            <td className="px-6 py-4 font-black text-brand-success text-right bg-brand-success/5 dark:bg-brand-success/10 group-hover:bg-brand-success/10 transition-colors">Q{Number(item.amount).toFixed(2)}</td>
                                        </tr>
                                    ))}
                                    {filteredReport?.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
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
                                        <th className="px-6 py-5 text-left text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Estudiante</th>
                                        <th className="px-6 py-5 text-left text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Curso</th>
                                        <th className="px-6 py-5 text-left text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest text-center">Cuota Mensual</th>
                                        <th className="px-6 py-5 text-left text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest text-center">Meses Pendientes</th>
                                        <th className="px-6 py-5 text-left text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest text-right">Deuda Total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 bg-white/50 dark:bg-transparent">
                                    {filteredPending?.map((item, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition group print:break-inside-avoid">
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
                                    {filteredPending?.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
                                                Todos los alumnos están al día.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
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
