import { Router } from 'express';
import { requireAuth } from '../auth';
import { listSamples, getSample, createSample, updateSample, deleteSample } from './controller';

const router = Router();

router.use(requireAuth);

router.get('/', listSamples);
router.get('/:id', getSample);
router.post('/', createSample);
router.patch('/:id', updateSample);
router.delete('/:id', deleteSample);

export const samplesRouter = router;
