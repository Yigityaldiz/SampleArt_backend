import { Router } from 'express';
import { requireAuth } from '../auth';
import {
  getCatalogSeller,
  listCatalogSamples,
  listCatalogSellerSamples,
  listCatalogSellers,
  saveCatalogSample,
} from './controller';

const router = Router();

router.get('/sellers', listCatalogSellers);
router.get('/sellers/:sellerId', getCatalogSeller);
router.get('/sellers/:sellerId/samples', listCatalogSellerSamples);
router.get('/samples', listCatalogSamples);
router.post('/samples/:id/save', requireAuth, saveCatalogSample);

export const catalogRouter = router;
