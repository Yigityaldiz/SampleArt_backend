import { Router } from 'express';
import { requireAuth } from '../auth';
import { createPresignedUpload } from './controller';

const router = Router();

router.use(requireAuth);
router.post('/presign', createPresignedUpload);

export const uploadsRouter = router;
