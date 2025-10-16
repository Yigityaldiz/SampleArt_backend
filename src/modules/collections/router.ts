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
  listCollectionMembers,
  inviteCollectionMember,
  updateCollectionMemberRole,
  removeCollectionMember,
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
router.get('/:id/members', listCollectionMembers);
router.post('/:id/members', inviteCollectionMember);
router.patch('/:id/members/:memberId', updateCollectionMemberRole);
router.delete('/:id/members/:memberId', removeCollectionMember);

export const collectionsRouter = router;
