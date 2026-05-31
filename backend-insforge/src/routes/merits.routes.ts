import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import {
    getStudentBalance,
    getLeaderboard,
    awardPoints,
    getRewards,
    createReward,
    updateReward,
    deleteReward,
    claimReward
} from '../controllers/merits.controller';

const router = Router();

router.use(requireAuth);

// Student merits queries
router.get('/student/:student_id/balance', getStudentBalance);
router.get('/leaderboard', getLeaderboard);
router.post('/award', awardPoints);

// Rewards CRUD and claims
router.get('/rewards', getRewards);
router.post('/rewards', createReward);
router.put('/rewards/:id', updateReward);
router.delete('/rewards/:id', deleteReward);
router.post('/rewards/:id/claim', claimReward);

export default router;
