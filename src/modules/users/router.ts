import type { RequestHandler } from 'express';
import { Router } from 'express';
import { requireAuth, requireRole } from '../auth';
import { listUsers, getUser, createUser, updateUser } from './controller';

const allowSelfOrAdmin: RequestHandler = (req, res, next) => {
  const user = req.authUser;

  if (!user) {
    return res.status(401).json({ error: { message: 'Unauthorized' } });
  }

  if (user.roles.includes('admin') || user.id === req.params.id) {
    return next();
  }

  return res.status(403).json({ error: { message: 'Forbidden' } });
};

const router = Router();

router.use(requireAuth);

router.get('/', requireRole('admin'), listUsers);
router.get('/:id', allowSelfOrAdmin, getUser);
router.post('/', requireRole('admin'), createUser);
router.patch('/:id', requireRole('admin'), updateUser);

export const usersRouter = router;
