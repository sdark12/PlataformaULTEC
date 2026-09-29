import api from '../../services/apiClient';
import { saveBlobFile } from '../../utils/fileDownloader';

export interface Invoice {
    id: number;
    invoice_number: string;
    issue_date: string;
    total_amount: number;
    status: string;
    student_name: string;
}

export const getInvoices = async () => {
    const response = await api.get<Invoice[]>('/api/invoices');
    return response.data;
};

export const createInvoice = async (data: { enrollment_id: number; items: { description: string; quantity: number; unit_price: number }[] }) => {
    const response = await api.post('/api/invoices', data);
    return response.data;
};

export const downloadInvoicePdf = async (id: number | string, invoiceNumber: string) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const response = await api.get(`/api/invoices/${id}/pdf`, { 
        params: origin ? { origin } : undefined,
        responseType: 'blob' 
    });
    const blob = new Blob([response.data], { type: 'application/pdf' });
    await saveBlobFile(blob, `invoice-${invoiceNumber}.pdf`, 'application/pdf');
};

