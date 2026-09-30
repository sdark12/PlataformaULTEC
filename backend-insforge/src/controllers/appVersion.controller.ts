import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';

// Información oficial de la versión más reciente de Plataforma ULTEC
const LATEST_APP_VERSION = {
    version: "1.2.0",
    versionCode: 34,
    minVersion: "1.0.0",
    releaseDate: "2026-09-29",
    downloadUrl: "https://plataformaultec.duckdns.org/downloads/PlataformaULTEC.apk",
    fileName: "PlataformaULTEC.apk",
    fileSize: 54651711,
    title: "Actualización v1.2.0 - Carnets Digitales Estudiantiles y Emisión Controlada",
    releaseNotes: [
        "Carnet Digital Oficial en Pantalla: Identificación estudiantil interactiva con efecto 3D flip card, marcas de agua antifalsificación y código QR institucional dinámico.",
        "Seguridad Estricta Antifalsificación: Los estudiantes y tutores no pueden imprimir ni descargar carnets de forma descontrolada desde la app; todo carnet físico requiere solicitud formal.",
        "Solicitud de Carnet Físico a Administración: Estudiantes y padres solicitan su carnet en línea indicando trámite inicial o reposición por extravío.",
        "Módulo de Emisión y Entrega Presencial: Administración valida solicitudes, imprime en formato estándar PVC CR80 con alta resolución y registra la entrega presencial certificada con firma y fecha.",
        "Verificación Pública QR Avanzada: El portal público de validación ahora corrobora si el alumno posee credencial física oficial entregada por administración."
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
