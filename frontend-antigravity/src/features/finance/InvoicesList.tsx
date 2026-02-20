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
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-slate-800">Facturas</h2>
                {/* Invoice creation usually happens automatically or via specific action, not manual button here for now */}
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th className="px-6 py-4 font-medium text-slate-500">No. Factura</th>
                            <th className="px-6 py-4 font-medium text-slate-500">Cliente</th>
                            <th className="px-6 py-4 font-medium text-slate-500">Fecha</th>
                            <th className="px-6 py-4 font-medium text-slate-500">Total</th>
                            <th className="px-6 py-4 font-medium text-slate-500">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {invoices?.map((invoice: any) => (
                            <tr key={invoice.id} className="hover:bg-slate-50 transition">
                                <td className="px-6 py-4 font-medium text-slate-900 flex items-center space-x-2">
                                    <FileText className="h-4 w-4 text-slate-400" />
                                    <span>{invoice.invoice_number}</span>
                                </td>
                                <td className="px-6 py-4 text-slate-600">{invoice.student_name}</td>
                                <td className="px-6 py-4 text-slate-600">
                                    {new Date(invoice.issue_date).toLocaleDateString()}
                                </td>
                                <td className="px-6 py-4 font-bold text-slate-900">Q{invoice.total_amount}</td>
                                <td className="px-6 py-4">
                                    <button
                                        onClick={() => handleDownload(invoice)}
                                        className="flex items-center space-x-1 text-blue-600 hover:text-blue-800 font-medium"
                                    >
                                        <Download className="h-4 w-4" />
                                        <span>PDF</span>
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {invoices?.length === 0 && (
                            <tr>
                                <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                                    No hay facturas emitidas.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default InvoicesList;
