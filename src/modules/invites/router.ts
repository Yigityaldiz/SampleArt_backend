import { Router } from 'express';
import { requireAuth } from '../auth';
import { resolveInvite, acceptInvite, rejectInvite } from './controller';

const router = Router();

router.get('/resolve', resolveInvite);

router.post('/:id/accept', requireAuth, acceptInvite);
router.post('/:id/reject', requireAuth, rejectInvite);

export const invitesRouter = router;
