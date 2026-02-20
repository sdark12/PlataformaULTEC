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

import authRoutes from './routes/auth.routes';
import academicRoutes from './routes/academic.routes';
import paymentRoutes from './routes/payments.routes';
import invoiceRoutes from './routes/invoices.routes';
import attendanceRoutes from './routes/attendance.routes';
import reportRoutes from './routes/reports.routes';

app.use('/auth', authRoutes);
app.use('/api', academicRoutes);
app.use('/api', paymentRoutes);
app.use('/api', invoiceRoutes);
app.use('/api', attendanceRoutes);
app.use('/api', reportRoutes);

// Health Check
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default app;
