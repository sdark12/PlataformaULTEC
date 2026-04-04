import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Export data to Excel (.xlsx)
 */
export const exportToExcel = (
    data: Record<string, any>[],
    filename: string,
    sheetName: string = 'Datos'
) => {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

    // Auto-size columns
    const maxWidths = Object.keys(data[0] || {}).map(key => {
        const maxLen = Math.max(
            key.length,
            ...data.map(row => String(row[key] || '').length)
        );
        return { wch: Math.min(maxLen + 2, 40) };
    });
    worksheet['!cols'] = maxWidths;

    XLSX.writeFile(workbook, `${filename}.xlsx`);
};

/**
 * Export data to PDF with table format
 */
export const exportToPDF = (
    columns: { header: string; dataKey: string }[],
    rows: Record<string, any>[],
    title: string,
    filename: string
) => {
    const doc = new jsPDF({ orientation: 'landscape' });

    // Header
    doc.setFontSize(16);
    doc.setTextColor(13, 89, 242); // brand-blue
    doc.text(title, 14, 18);

    // Subtitle
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text(`Ultra Tecnología — Generado el ${new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}`, 14, 25);

    // Table
    autoTable(doc, {
        startY: 32,
        head: [columns.map(c => c.header)],
        body: rows.map(row => columns.map(c => row[c.dataKey] ?? '')),
        styles: {
            fontSize: 8,
            cellPadding: 3,
        },
        headStyles: {
            fillColor: [13, 89, 242],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 9,
        },
        alternateRowStyles: {
            fillColor: [248, 250, 252],
        },
        margin: { top: 32 },
    });

    doc.save(`${filename}.pdf`);
};
