import type { RequestHandler } from 'express';
import { Router } from 'express';
import { requireAuth } from '../auth';
import {
  listUsers,
  getUser,
  createUser,
  updateUser,
  getCurrentUser,
  updateCurrentUserLanguage,
} from './controller';

const ensureSelf: RequestHandler = (req, res, next) => {
  const user = req.authUser;

  if (!user) {
    return res.status(401).json({ error: { message: 'Unauthorized' } });
  }

  if (user.id === req.params.id) {
    return next();
  }

  return res.status(403).json({ error: { message: 'Forbidden' } });
};

const ensureBodyMatchesSelf: RequestHandler = (req, res, next) => {
  const user = req.authUser;

  if (!user) {
    return res.status(401).json({ error: { message: 'Unauthorized' } });
  }

  const { id } = (req.body ?? {}) as { id?: string };

  if (id && id !== user.id) {
    return res.status(403).json({ error: { message: 'Forbidden' } });
  }

  return next();
};

const router = Router();

router.use(requireAuth);

router.get('/', listUsers);
router.get('/me', getCurrentUser);
router.patch('/me/language', updateCurrentUserLanguage);
router.get('/:id', ensureSelf, getUser);
router.post('/', ensureBodyMatchesSelf, createUser);
router.patch('/:id', ensureSelf, updateUser);

export const usersRouter = router;
