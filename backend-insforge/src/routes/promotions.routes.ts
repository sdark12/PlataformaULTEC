import { Router } from 'express';
import { 
    getCandidatesForPromotion, 
    executePromotion, 
    getPromotionHistory 
} from '../controllers/promotions.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.use(requireAuth);

router.get('/promotions/candidates', getCandidatesForPromotion);
router.post('/promotions/execute', executePromotion);
router.get('/promotions/history', getPromotionHistory);

export default router;
