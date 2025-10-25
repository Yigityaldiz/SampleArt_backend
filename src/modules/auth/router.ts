import { Router } from 'express';
import { requireAuth } from './guards';
import { sellerAuthLogin } from './controller';

const router = Router();

router.post('/sellers/login', requireAuth, sellerAuthLogin);

export const authRouter = router;
