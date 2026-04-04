import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

import authRoutes from './routes/auth.routes';
import { auditLogger } from './middleware/audit.middleware';
import { apiRateLimiter } from './middleware/rateLimiter';
import academicRoutes from './routes/academic.routes';
import paymentRoutes from './routes/payments.routes';
import invoiceRoutes from './routes/invoices.routes';
import attendanceRoutes from './routes/attendance.routes';
import reportRoutes from './routes/reports.routes';
import gradesRoutes from './routes/grades.routes';
import subgradesRoutes from './routes/subgrades.routes';
import notificationsRoutes from './routes/notifications.routes';
import usersRoutes from './routes/users.routes';
import assignmentsRoutes from './routes/assignments.routes';
import branchesRoutes from './routes/branches.routes';
import auditRoutes from './routes/audit.routes';
import resourcesRoutes from './routes/resources.routes';
import announcementsRoutes from './routes/announcements.routes';
import parentsRoutes from './routes/parents.routes';
import disciplineRoutes from './routes/discipline.routes';
import settingsRoutes from './routes/settings.routes';

const app = express();

// Security & Parsing
app.use(helmet());
app.use(cors({
    origin: [
        'http://localhost:5173',
        'http://localhost:3000',
        process.env.FRONTEND_URL || ''
    ].filter(Boolean),
    credentials: true
}));
app.use(express.json());
app.use(morgan('dev'));

// Static files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Global API protection
app.use('/api', apiRateLimiter);
app.use('/api', auditLogger);

// Auth routes (have their own rate limiter)
app.use('/auth', authRoutes);

// API routes
app.use('/api', academicRoutes);
app.use('/api', paymentRoutes);
app.use('/api', invoiceRoutes);
app.use('/api', attendanceRoutes);
app.use('/api', reportRoutes);
app.use('/api', gradesRoutes);
app.use('/api', subgradesRoutes);
app.use('/api', notificationsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/assignments', assignmentsRoutes);
app.use('/api/branches', branchesRoutes);
app.use('/api/audit-logs', auditRoutes);
app.use('/api/resources', resourcesRoutes);
app.use('/api/announcements', announcementsRoutes);
app.use('/api/parents', parentsRoutes);
app.use('/api/discipline', disciplineRoutes);
app.use('/api/settings', settingsRoutes);

// Health Check
app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default app;

