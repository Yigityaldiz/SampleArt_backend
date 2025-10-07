import { Router } from 'express';
import { getHealth } from './controller';

const router = Router();

router.get('/', getHealth);

export const healthRouter = router;
