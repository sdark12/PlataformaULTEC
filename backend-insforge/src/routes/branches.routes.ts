import { Router } from 'express';
import { getBranches, createBranch, updateBranch, deleteBranch } from '../controllers/branches.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.use(requireAuth);

router.get('/', getBranches);
router.post('/', createBranch);
router.put('/:id', updateBranch);
router.delete('/:id', deleteBranch);

export default router;
