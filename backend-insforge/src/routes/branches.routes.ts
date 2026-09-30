import { Router } from 'express';
import { getBranches, createBranch, updateBranch, deleteBranch } from '../controllers/branches.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

// Endpoint de consulta de sedes con autenticación opcional:
// Si no hay token de sesión (ej. páginas públicas o cliente cargando login), retorna [] con 200 OK
// en lugar de 401 para evitar romper la UI o disparar bucles de redirección en clientes antiguos.
router.get('/', (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.json([]);
    }
    requireAuth(req, res, next);
}, getBranches);

router.use(requireAuth);

router.post('/', createBranch);
router.put('/:id', updateBranch);
router.delete('/:id', deleteBranch);

export default router;
