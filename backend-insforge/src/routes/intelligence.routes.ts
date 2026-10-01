import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import {
    getEarlyWarningReport,
    getDebtAgingReport,
    getStudentInterventions,
    createStudentIntervention,
    updateStudentIntervention
} from '../controllers/intelligence.controller';

const router = Router();

// Todas las rutas de Inteligencia Institucional requieren autenticación
router.use(requireAuth);

router.get('/intelligence/early-warning', getEarlyWarningReport);
router.get('/intelligence/debt-aging', getDebtAgingReport);
router.get('/intelligence/interventions/:studentId', getStudentInterventions);
router.post('/intelligence/interventions', createStudentIntervention);
router.patch('/intelligence/interventions/:id', updateStudentIntervention);

export default router;
