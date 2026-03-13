import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';

dotenv.config();

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));
import path from 'path';

import authRoutes from './routes/auth.routes';
import { auditLogger } from './middleware/audit.middleware';

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Aplicar Audit Logger a todas las rutas API
app.use('/api', auditLogger);

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

app.use('/auth', authRoutes);
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

// Health Check
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default app;
