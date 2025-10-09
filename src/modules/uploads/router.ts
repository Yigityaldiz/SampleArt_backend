import { Router } from 'express';
import { requireAuth } from '../auth';
import { createPresignedUpload, createPresignedDownload } from './controller';

const router = Router();

router.use(requireAuth);
router.post('/presign', createPresignedUpload);
router.post('/presign-download', createPresignedDownload);

export const uploadsRouter = router;
