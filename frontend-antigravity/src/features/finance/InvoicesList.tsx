import { useQuery } from '@tanstack/react-query';
import { getInvoices, downloadInvoicePdf } from '../../features/finance/invoiceService';
import { Loader2, FileText, Download } from 'lucide-react';

const InvoicesList = () => {
    const { data: invoices, isLoading } = useQuery({
        queryKey: ['invoices'],
        queryFn: getInvoices,
    });

    const handleDownload = (invoice: any) => {
        downloadInvoicePdf(invoice.id, invoice.invoice_number);
    };

    if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin h-8 w-8 text-blue-600" /></div>;

    return (
        <div>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div>
                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Facturas Emitidas</h2>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">Historial de comprobantes de pago.</p>
                </div>
            </div>

            <div className="glass-card rounded-3xl overflow-hidden">
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
                                            className="inline-flex items-center space-x-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-brand-blue hover:text-white dark:hover:bg-brand-blue dark:hover:text-white transition-all font-bold border border-slate-200 dark:border-slate-700 hover:border-brand-blue group-hover:opacity-100 opacity-0 md:opacity-100"
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
                                        No hay facturas emitidas.
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
