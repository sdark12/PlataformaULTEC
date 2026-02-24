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
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden">
                <div>
                    <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Reportes Financieros</h2>
                    <p className="text-slate-500 mt-1">Análisis de ingresos y registros de transacciones.</p>
                </div>
                <button
                    onClick={handlePrint}
                    className="flex items-center space-x-2 px-6 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition-all shadow-sm font-medium"
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
            <div className="flex space-x-6 mb-8 border-b border-slate-200 print:hidden">
                <button
                    className={`pb-3 text-sm font-semibold border-b-2 flex items-center gap-2 transition-colors ${activeTab === 'income' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                    onClick={() => setActiveTab('income')}
                >
                    <AlignJustify className="w-4 h-4" /> Ingresos Generales
                </button>
                <button
                    className={`pb-3 text-sm font-semibold border-b-2 flex items-center gap-2 transition-colors ${activeTab === 'pending' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                    onClick={() => setActiveTab('pending')}
                >
                    <AlertTriangle className="w-4 h-4" /> Pendientes de Pago (Morosos)
                </button>
            </div>

            {/* Summary Cards */}
            {activeTab === 'income' ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex items-center space-x-4">
                        <div className="h-14 w-14 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center print:border print:border-emerald-200">
                            <TrendingUp className="h-7 w-7" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Ingresos Totales</p>
                            <h3 className="text-3xl font-black text-slate-800">Q{totalIncome.toFixed(2)}</h3>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex items-center space-x-4">
                        <div className="h-14 w-14 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center print:border print:border-blue-200">
                            <Receipt className="h-7 w-7" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Transacciones</p>
                            <h3 className="text-3xl font-black text-slate-800">{transactionCount}</h3>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex items-center space-x-4">
                        <div className="h-14 w-14 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center print:border print:border-indigo-200">
                            <CreditCard className="h-7 w-7" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Ticket Promedio</p>
                            <h3 className="text-3xl font-black text-slate-800">Q{averageTicket.toFixed(2)}</h3>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex items-center space-x-4">
                        <div className="h-14 w-14 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center print:border print:border-rose-200">
                            <AlertTriangle className="h-7 w-7" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Deuda Pendiente Total</p>
                            <h3 className="text-3xl font-black text-slate-800">Q{totalPendingDebt.toFixed(2)}</h3>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex items-center space-x-4">
                        <div className="h-14 w-14 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center print:border print:border-amber-200">
                            <Users className="h-7 w-7" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Alumnos Morosos</p>
                            <h3 className="text-3xl font-black text-slate-800">{filteredPending?.length || 0}</h3>
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-2 print:hidden items-center">
                {activeTab === 'income' && (
                    <div className="flex gap-2 w-full md:w-auto p-2">
                        <div className="flex-1">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Desde</label>
                            <input
                                type="date"
                                className="w-full bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                            />
                        </div>
                        <div className="flex-1">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Hasta</label>
                            <input
                                type="date"
                                className="w-full bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                            />
                        </div>
                    </div>
                )}

                <div className="w-px h-12 bg-slate-200 hidden md:block mx-2"></div>

                <div className="flex flex-1 w-full gap-2 p-2 relative">
                    <div className="relative flex-1 group">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 group-focus-within:text-blue-500" />
                        <input
                            type="text"
                            placeholder="Buscar alumno o curso..."
                            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    {activeTab === 'income' && (
                        <div className="relative w-48">
                            <div className="absolute left-3 top-2.5 flex items-center pointer-events-none text-slate-400">
                                <Filter className="h-4 w-4" />
                            </div>
                            <select
                                className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 appearance-none font-medium cursor-pointer"
                                value={filterMethod}
                                onChange={(e) => setFilterMethod(e.target.value)}
                            >
                                <option value="">Cualquier Método</option>
                                {uniqueMethods.map((m: any) => (
                                    <option key={m} value={m}>{m}</option>
                                ))}
                            </select>
                            <div className="absolute inset-y-0 right-2 flex items-center pointer-events-none text-slate-500">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {(activeTab === 'income' ? isLoading : isLoadingPending) ? (
                <div className="flex justify-center p-8"><Loader2 className="animate-spin h-8 w-8 text-blue-600" /></div>
            ) : (
                <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                    {activeTab === 'income' ? (
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 border-b border-slate-200">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-widest">Fecha</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-widest">Estudiante</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-widest">Curso</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-widest text-center">Método</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-widest text-right">Monto</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredReport?.map((item, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50 transition print:break-inside-avoid">
                                        <td className="px-6 py-4 text-slate-500 font-medium border-b border-slate-50">
                                            {formatDate(item.payment_date)}
                                        </td>
                                        <td className="px-6 py-4 font-bold text-slate-900 border-b border-slate-50">{item.student_name}</td>
                                        <td className="px-6 py-4 text-slate-600 border-b border-slate-50">{item.course_name}</td>
                                        <td className="px-6 py-4 text-center border-b border-slate-50">
                                            <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200 print:border-none print:p-0 print:bg-transparent print:text-slate-800">
                                                {item.method}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 font-black text-emerald-600 text-right border-b border-slate-50">Q{Number(item.amount).toFixed(2)}</td>
                                    </tr>
                                ))}
                                {filteredReport?.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                                            No hay transacciones en este período.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    ) : (
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 border-b border-slate-200">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-widest">Estudiante</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-widest">Curso</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-widest text-center">Cuota Mensual</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-widest text-center">Meses Pendientes</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-widest text-right">Deuda Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredPending?.map((item, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50 transition print:break-inside-avoid">
                                        <td className="px-6 py-4 font-bold text-slate-900 border-b border-slate-50">{item.student_name}</td>
                                        <td className="px-6 py-4 text-slate-600 border-b border-slate-50">{item.course_name}</td>
                                        <td className="px-6 py-4 text-center text-slate-500 border-b border-slate-50">Q{Number(item.monthly_fee).toFixed(2)}</td>
                                        <td className="px-6 py-4 text-center border-b border-slate-50">
                                            <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-700 border border-rose-200 print:border-none print:p-0 print:bg-transparent print:text-rose-800">
                                                {item.months_overdue}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 font-black text-rose-600 text-right border-b border-slate-50">Q{Number(item.pending_amount).toFixed(2)}</td>
                                    </tr>
                                ))}
                                {filteredPending?.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                                            Todos los alumnos están al día.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}
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
