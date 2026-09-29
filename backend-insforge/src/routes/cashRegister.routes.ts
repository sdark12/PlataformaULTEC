import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import {
    getCurrentShift,
    openShift,
    recordExpense,
    deleteExpense,
    closeShift,
    getShiftsHistory,
    getShiftDetails,
    auditShift
} from '../controllers/cashRegister.controller';

const router = Router();

router.use(requireAuth);

// Estado actual y operaciones de turno
router.get('/cash-register/current', getCurrentShift);
router.post('/cash-register/open', openShift);
router.post('/cash-register/close', closeShift);

// Gestión de gastos menores / caja chica
router.post('/cash-register/expense', recordExpense);
router.delete('/cash-register/expense/:id', deleteExpense);

// Historial y auditoría de arqueos
router.get('/cash-register/history', getShiftsHistory);
router.get('/cash-register/shifts/:id', getShiftDetails);
router.patch('/cash-register/shifts/:id/audit', auditShift);

export default router;
