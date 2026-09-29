import { useQuery } from '@tanstack/react-query';
import { getInvoices, downloadInvoicePdf } from '../../features/finance/invoiceService';
import { getCurrentUser } from '../../features/auth/authService';
import { Loader2, FileText, Download, Table, Clock, ShieldCheck } from 'lucide-react';
import * as XLSX from 'xlsx';
import { saveWorkbook } from '../../utils/fileDownloader';

const InvoicesList = () => {
    const user = getCurrentUser();
    const isSecretary = user?.role === 'secretary';

    const { data: invoices, isLoading } = useQuery({
        queryKey: ['invoices'],
        queryFn: getInvoices,
    });

    const handleDownload = (invoice: any) => {
        downloadInvoicePdf(invoice.id, invoice.invoice_number);
    };

    const exportToExcel = async () => {
        if (!invoices || invoices.length === 0) return;

        const dataToExport = invoices.map((inv: any) => ({
            'ID Interno': inv.id,
            'No. Factura/Recibo': inv.invoice_number,
            'Estudiante / Cliente': inv.student_name,
            'Fecha Emisión': new Date(inv.issue_date).toLocaleDateString(),
            'Total (Q)': Number(inv.total_amount)
        }));

        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, isSecretary ? "Facturas_Turno" : "Facturas");
        const filename = isSecretary 
            ? `Facturas_Turno_${new Date().toISOString().split('T')[0]}.xlsx`
            : "Reporte_Facturas.xlsx";
        await saveWorkbook(workbook, filename);
    };

    if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin h-8 w-8 text-blue-600" /></div>;

    const totalTurnAmount = (invoices || []).reduce((sum: number, inv: any) => sum + Number(inv.total_amount || 0), 0);

    return (
        <div>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div>
                    <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
                        {isSecretary ? 'Facturas Emitidas en tu Turno' : 'Facturas Emitidas'}
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm sm:text-base">
                        {isSecretary 
                            ? 'Comprobantes y recibos generados por ti durante la jornada de hoy.'
                            : 'Historial de comprobantes de pago.'}
                    </p>
                </div>
                <button
                    onClick={exportToExcel}
                    title={isSecretary ? "Exportar Facturas del Día" : "Exportar a Excel"}
                    className="w-full sm:w-auto flex items-center justify-center space-x-2 px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] active:scale-95 font-semibold border border-white/10"
                >
                    <Table className="h-5 w-5" />
                    <span>{isSecretary ? 'Exportar Facturas del Día' : 'Exportar Todo a Excel'}</span>
                </button>
            </div>

            {/* Banner de Turno para Secretaría */}
            {isSecretary && (
                <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-blue-500/10 border border-emerald-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
                    <div className="flex items-center space-x-3">
                        <div className="h-3 w-3 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                        <div>
                            <span className="text-xs font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                                <ShieldCheck className="h-4 w-4 inline" /> Turno Diario Activo
                            </span>
                            <p className="text-xs text-slate-600 dark:text-slate-300">
                                Mostrando únicamente las facturas generadas por tu usuario hoy. Esta vista se reinicia automáticamente a las 00:00 hrs.
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="text-xs font-bold text-slate-600 dark:text-slate-300 bg-white/60 dark:bg-slate-800/60 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5 text-emerald-500" />
                            <span>Hoy: <strong className="text-emerald-600 dark:text-emerald-400">Q{totalTurnAmount.toFixed(2)}</strong> ({invoices?.length || 0} docs)</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Mobile Cards View */}
            <div className="block md:hidden space-y-3">
                {invoices?.map((invoice: any) => (
                    <div
                        key={invoice.id}
                        className="glass-card p-4 rounded-2xl border border-slate-200 dark:border-white/10 space-y-3 shadow-sm bg-white/70 dark:bg-slate-900/70"
                    >
                        <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center space-x-3 min-w-0">
                                <div className="h-10 w-10 rounded-xl bg-brand-blue/10 flex items-center justify-center text-brand-blue border border-brand-blue/20 shrink-0">
                                    <FileText className="h-5 w-5" />
                                </div>
                                <div className="min-w-0">
                                    <h3 className="font-bold text-sm text-slate-900 dark:text-white truncate">#{invoice.invoice_number}</h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{invoice.student_name}</p>
                                </div>
                            </div>
                            <div className="text-right shrink-0">
                                <span className="text-base font-black text-brand-success">Q{invoice.total_amount}</span>
                            </div>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-white/5 text-xs text-slate-500 dark:text-slate-400">
                            <span>Fecha de emisión:</span>
                            <span className="font-medium text-slate-700 dark:text-slate-300">
                                {new Date(invoice.issue_date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </span>
                        </div>

                        <button
                            onClick={() => handleDownload(invoice)}
                            className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 bg-brand-blue text-white hover:bg-blue-600 rounded-xl font-bold text-xs transition-all shadow-sm active:scale-95"
                        >
                            <Download className="h-4 w-4" />
                            <span>Descargar PDF</span>
                        </button>
                    </div>
                ))}
                {invoices?.length === 0 && (
                    <div className="glass-card p-8 rounded-2xl text-center text-slate-500 dark:text-slate-400">
                        {isSecretary ? 'No has emitido facturas ni recibos durante la jornada de hoy.' : 'No hay facturas emitidas.'}
                    </div>
                )}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block glass-card rounded-3xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50/50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700/50">
                            <tr>
                                <th className="px-6 py-5 font-bold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-widest">No. Factura</th>
                                <th className="px-6 py-5 font-bold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-widest">Cliente</th>
                                <th className="px-6 py-5 font-bold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-widest">Fecha</th>
                                <th className="px-6 py-5 font-bold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-widest">Total</th>
                                <th className="px-6 py-5 font-bold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-widest text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 bg-white/50 dark:bg-transparent">
                            {invoices?.map((invoice: any) => (
                                <tr key={invoice.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition group">
                                    <td className="px-6 py-4 font-bold text-slate-900 dark:text-white flex items-center space-x-3">
                                        <div className="h-10 w-10 rounded-xl bg-brand-blue/10 flex items-center justify-center text-brand-blue border border-brand-blue/20">
                                            <FileText className="h-5 w-5" />
                                        </div>
                                        <span>#{invoice.invoice_number}</span>
                                    </td>
                                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300 font-medium">{invoice.student_name}</td>
                                    <td className="px-6 py-4 text-slate-500 dark:text-slate-400">
                                        {new Date(invoice.issue_date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                                    </td>
                                    <td className="px-6 py-4 font-bold text-brand-success bg-brand-success/10 px-2 py-1 rounded-lg inline-block border border-brand-success/20 mt-3 whitespace-nowrap">Q{invoice.total_amount}</td>
                                    <td className="px-6 py-4 text-right">
                                        <button
                                            onClick={() => handleDownload(invoice)}
                                            className="inline-flex items-center space-x-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-brand-blue hover:text-white dark:hover:bg-brand-blue dark:hover:text-white transition-all font-bold border border-slate-200 dark:border-slate-700 hover:border-brand-blue"
                                        >
                                            <Download className="h-4 w-4" />
                                            <span>Descargar PDF</span>
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {invoices?.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
                                        {isSecretary ? 'No has emitido facturas ni recibos durante la jornada de hoy.' : 'No hay facturas emitidas.'}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default InvoicesList;
