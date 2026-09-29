import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import * as XLSX from 'xlsx';
import type { jsPDF } from 'jspdf';

/**
 * Converts a Blob to a pure base64 string (without the data URL prefix)
 */
export const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const dataUrl = reader.result as string;
            const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

/**
 * Saves and opens/shares a file on native Capacitor platforms (Android/iOS)
 */
export const saveAndShareNative = async (base64Data: string, filename: string, _mimeType?: string) => {
    const cleanBase64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
    
    // Save file into native cache directory
    const result = await Filesystem.writeFile({
        path: filename,
        data: cleanBase64,
        directory: Directory.Cache,
    });

    // Open native Android / iOS system share sheet to open with Excel/Sheets/PDF Reader or save to storage
    try {
        await Share.share({
            title: filename,
            text: `Archivo exportado: ${filename}`,
            url: result.uri,
            dialogTitle: `Abrir o Compartir ${filename}`,
        });
    } catch (shareErr: any) {
        // Ignore user cancellation
        if (shareErr?.message?.toLowerCase().includes('cancel')) {
            return;
        }
        console.warn('Share warning:', shareErr);
    }
};

/**
 * Universal Excel exporter
 * Works in Android / iOS native apps (via Filesystem + Share) and Web browsers (via XLSX.writeFile)
 */
export const saveWorkbook = async (workbook: XLSX.WorkBook, filename: string): Promise<void> => {
    const cleanFilename = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
    
    try {
        if (Capacitor.isNativePlatform()) {
            const base64 = XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' });
            await saveAndShareNative(
                base64,
                cleanFilename,
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            );
        } else {
            XLSX.writeFile(workbook, cleanFilename);
        }
    } catch (err: any) {
        console.error('Error exporting Excel:', err);
        alert(`Error al exportar archivo Excel: ${err?.message || 'Error desconocido'}`);
    }
};

/**
 * Universal PDF exporter
 * Works in Android / iOS native apps (via Filesystem + Share) and Web browsers (via doc.save)
 */
export const savePdfDoc = async (doc: jsPDF, filename: string): Promise<void> => {
    const cleanFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
    
    try {
        if (Capacitor.isNativePlatform()) {
            const dataUri = doc.output('datauristring');
            const base64 = dataUri.split(',')[1];
            await saveAndShareNative(base64, cleanFilename, 'application/pdf');
        } else {
            doc.save(cleanFilename);
        }
    } catch (err: any) {
        console.error('Error exporting PDF:', err);
        alert(`Error al generar archivo PDF: ${err?.message || 'Error desconocido'}`);
    }
};

/**
 * Universal Blob exporter (e.g. for backend-generated PDF invoices)
 * Works in Android / iOS native apps and Web browsers
 */
export const saveBlobFile = async (blob: Blob, filename: string, mimeType: string = 'application/octet-stream'): Promise<void> => {
    try {
        if (Capacitor.isNativePlatform()) {
            const base64 = await blobToBase64(blob);
            await saveAndShareNative(base64, filename, mimeType);
        } else {
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            link.remove();
            setTimeout(() => window.URL.revokeObjectURL(url), 1000);
        }
    } catch (err: any) {
        console.error('Error saving blob file:', err);
        alert(`Error al descargar archivo: ${err?.message || 'Error desconocido'}`);
    }
};
