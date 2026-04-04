import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import {
    getIncidents,
    createIncident,
    updateIncident,
    resolveIncident,
    deleteIncident
} from '../controllers/discipline.controller';

const router = Router();

router.use(requireAuth);

router.get('/', getIncidents);
router.post('/', createIncident);
router.put('/:id', updateIncident);
router.put('/:id/resolve', resolveIncident);
router.delete('/:id', deleteIncident);

export default router;
