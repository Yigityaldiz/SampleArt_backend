import { Router } from 'express';
import {
  listAdminSellerApplications,
  getAdminSellerApplication,
  approveSellerApplication,
  rejectSellerApplication,
} from './controller';

const router = Router();

router.get('/', listAdminSellerApplications);
router.get('/:applicationId', getAdminSellerApplication);
router.post('/:applicationId/approve', approveSellerApplication);
router.post('/:applicationId/reject', rejectSellerApplication);

export const adminSellerApplicationsRouter = router;
