import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import {
    getStudentBalance,
    getLeaderboard,
    awardPoints,
    awardPointsBulk,
    getRewards,
    createReward,
    updateReward,
    deleteReward,
    claimReward,
    getClaims,
    deliverClaim,
    cancelClaim
} from '../controllers/merits.controller';

const router = Router();

router.use(requireAuth);

// Student merits queries
router.get('/student/:student_id/balance', getStudentBalance);
router.get('/leaderboard', getLeaderboard);
router.post('/award', awardPoints);
router.post('/award-bulk', awardPointsBulk);

// Claims management
router.get('/claims', getClaims);
router.put('/claims/:id/deliver', deliverClaim);
router.put('/claims/:id/cancel', cancelClaim);

// Rewards CRUD and claims
router.get('/rewards', getRewards);
router.post('/rewards', createReward);
router.put('/rewards/:id', updateReward);
router.delete('/rewards/:id', deleteReward);
router.post('/rewards/:id/claim', claimReward);

export default router;
