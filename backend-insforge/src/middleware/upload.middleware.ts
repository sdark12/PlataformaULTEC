import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Constants for the upload directory
const UPLOADS_DIR = path.join(__dirname, '../../uploads');

// Ensure the directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOADS_DIR);
    },
    filename: (req, file, cb) => {
        // Create a unique filename using timestamp and a random string
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const originalExt = path.extname(file.originalname);
        cb(null, `attachment-${uniqueSuffix}${originalExt}`);
    }
});

const upload = multer({
    storage,
    limits: {
        fileSize: 15 * 1024 * 1024 // 15MB limit for documents and images to protect server disk space
    },
    fileFilter: (req, file, cb) => {
        // Allow images, PDFs, and common educational document formats (Office & ZIP)
        // Video files are excluded from direct disk storage to avoid disk exhaustion; YouTube links should be used instead
        const allowedTypes = [
            'image/jpeg', 'image/png', 'image/gif', 'image/webp',
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-powerpoint',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'text/plain',
            'application/zip',
            'application/x-zip-compressed'
        ];

        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Tipo de archivo no permitido. Solo se permiten imágenes, PDF, documentos Office y archivos ZIP (hasta 15 MB). Para videos, por favor comparte el enlace de YouTube.'));
        }
    }
});

export default upload;
