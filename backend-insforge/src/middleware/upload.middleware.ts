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
        fileSize: 10 * 1024 * 1024 // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        // Allow images and PDFs, plus some common document types
        const allowedTypes = [
            'image/jpeg', 'image/png', 'image/gif', 'image/webp',
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ];

        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only JPG, PNG, GIF, WEBP, PDF, and DOC are allowed.'));
        }
    }
});

export default upload;
