import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';

// Información oficial de la versión más reciente de Plataforma ULTEC
const LATEST_APP_VERSION = {
    version: "1.3.0",
    versionCode: 35,
    minVersion: "1.0.0",
    releaseDate: "2026-09-30",
    downloadUrl: "https://plataformaultec.duckdns.org/downloads/PlataformaULTEC.apk",
    fileName: "PlataformaULTEC.apk",
    fileSize: 54651711,
    title: "Actualización v1.3.0 - Inteligencia Institucional, Cartera Vencida y Alerta Temprana",
    releaseNotes: [
        "Semáforo de Alerta Temprana de Deserción Escolar (EWS): Algoritmo de Índice de Retención Escolar (IRE 0-100) que cruza asistencia (40%), promedio académico (35%), mora (20%) y disciplina (5%).",
        "Bitácora de Intervención y Retención Estudiantil: Registro de llamadas, convenios de pago pactados, citas presenciales y tutorías con enlaces rápidos de WhatsApp institucional.",
        "Análisis de Cartera Vencida y Antigüedad de Saldos (Aging Buckets): Desglose de morosidad en tramos de 0-30, 31-60, 61-90 y más de 90 días con proyección de facturación.",
        "Centro de Reportes y BI Unificado: Tablero integrado en ReportsHub con métricas ejecutivas, tasa de cobranza mensual y exportación profesional en PDF y Excel."
    ],
    isCritical: false
};


/**
 * Consulta pública de la versión más reciente de la aplicación
 * Permite a la app móvil y al portal web verificar si hay una actualización disponible.
 */
export const getLatestAppVersion = async (req: Request, res: Response): Promise<void> => {
    try {
        // Si existe un archivo físico del APK en el servidor, obtener su tamaño real en bytes
        const apkPath = path.join(__dirname, '../../../downloads/PlataformaULTEC.apk');
        let fileSize = LATEST_APP_VERSION.fileSize;

        if (fs.existsSync(apkPath)) {
            try {
                const stats = fs.statSync(apkPath);
                fileSize = stats.size;
            } catch (err) {
                console.warn('No se pudo leer el tamaño exacto del APK:', err);
            }
        }

        res.status(200).json({
            ...LATEST_APP_VERSION,
            fileSize
        });
    } catch (error) {
        console.error('Error al consultar la versión de la app:', error);
        res.status(500).json({ message: 'Error interno al consultar la versión' });
    }
};

/**
 * Descarga directa del archivo APK más reciente
 */
export const downloadLatestApk = async (req: Request, res: Response): Promise<void> => {
    try {
        // Buscar en varias rutas posibles del servidor
        const candidatePaths = [
            path.join(__dirname, '../../../downloads/PlataformaULTEC.apk'),
            path.join(__dirname, '../../../../downloads/PlataformaULTEC.apk'),
            path.join(__dirname, '../../uploads/PlataformaULTEC.apk'),
            '/usr/share/nginx/html/downloads/PlataformaULTEC.apk',
            'C:\\Users\\saul_\\.gemini\\antigravity\\scratch\\PlataformaULTEC\\PlataformaULTEC.apk'
        ];

        let foundPath = '';
        for (const p of candidatePaths) {
            if (fs.existsSync(p)) {
                foundPath = p;
                break;
            }
        }

        if (foundPath) {
            res.setHeader('Content-Type', 'application/vnd.android.package-archive');
            res.setHeader('Content-Disposition', 'attachment; filename="PlataformaULTEC.apk"');
            res.download(foundPath, 'PlataformaULTEC.apk');
        } else {
            // Redirigir a la URL pública de descargas servida por Nginx
            res.redirect('https://plataformaultec.duckdns.org/downloads/PlataformaULTEC.apk');
        }
    } catch (error) {
        console.error('Error al descargar el APK:', error);
        res.status(500).json({ message: 'Error al procesar la descarga del APK' });
    }
};
