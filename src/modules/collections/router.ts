import { Router } from 'express';
import { requireAuth } from '../auth';
import {
  listCollections,
  getCollection,
  createCollection,
  updateCollection,
  deleteCollection,
  addCollectionSample,
  removeCollectionSample,
  reorderCollectionSamples,
} from './controller';

const router = Router();

router.use(requireAuth);

router.get('/', listCollections);
router.get('/:id', getCollection);
router.post('/', createCollection);
router.patch('/:id', updateCollection);
router.delete('/:id', deleteCollection);
router.post('/:id/samples', addCollectionSample);
router.patch('/:id/samples/reorder', reorderCollectionSamples);
router.delete('/:id/samples/:sampleId', removeCollectionSample);

export const collectionsRouter = router;
