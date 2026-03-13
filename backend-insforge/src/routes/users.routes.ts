import { Router } from 'express';
import { getUsers, getUserById, createUser, updateUser, deleteUser } from '../controllers/users.controller';
import { validateSchema } from '../middleware/validateSchema';
import { createUserSchema, updateUserSchema } from '../schemas/users.schema';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.use(requireAuth);

router.get('/', getUsers);
router.post('/', validateSchema(createUserSchema), createUser);
router.get('/:id', getUserById);
router.put('/:id', validateSchema(updateUserSchema), updateUser);
router.delete('/:id', deleteUser);

export default router;
