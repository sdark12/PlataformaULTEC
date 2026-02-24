import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import {
    getSubgradeCategories,
    saveSubgradeCategories,
    deleteSubgradeCategory,
    getSubgrades,
    saveSubgrades
} from '../controllers/subgrades.controller';

const router = Router();

// Category Routes
router.get('/subgrades/categories', requireAuth, getSubgradeCategories);
router.post('/subgrades/categories', requireAuth, saveSubgradeCategories);
router.delete('/subgrades/categories/:category_id', requireAuth, deleteSubgradeCategory);

// Note Routes
router.get('/subgrades', requireAuth, getSubgrades);
router.post('/subgrades', requireAuth, saveSubgrades);

export default router;
