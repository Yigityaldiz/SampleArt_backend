import { Router } from 'express';
import { requireAuth } from '../auth';
import {
  submitSellerApplication,
  getCurrentSellerApplication,
  updateCurrentSellerApplication,
} from './controller';

const router = Router();

router.use(requireAuth);

router.post('/', submitSellerApplication);
router.get('/me', getCurrentSellerApplication);
router.patch('/me', updateCurrentSellerApplication);

export const sellerApplicationsRouter = router;
