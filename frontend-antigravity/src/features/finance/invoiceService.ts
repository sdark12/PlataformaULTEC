import api from '../../services/apiClient';

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

export const downloadInvoicePdf = async (id: number, invoiceNumber: string) => {
    const response = await api.get(`/api/invoices/${id}/pdf`, { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `invoice-${invoiceNumber}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.remove();
};
