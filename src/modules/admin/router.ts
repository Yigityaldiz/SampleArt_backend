import { Router } from 'express';
import { adminSellerApplicationsRouter } from './seller-applications/router';
import { requireAuth, requireRole } from '../auth';
import { listAdminUsers } from './users/controller';

const router = Router();

router.use(requireAuth, requireRole('admin'));

router.use('/seller-applications', adminSellerApplicationsRouter);
router.get('/users', listAdminUsers);

export const adminRouter = router;
