import { Router } from 'express';
import { listCatalogSamples } from '../catalog/controller';

const router = Router();

router.get('/samples', listCatalogSamples);

export const publicRouter = router;
