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
  updateCollectionMemberRole,
  removeCollectionMember,
} from './controller';
import { createCollectionInvite } from '../invites/controller';

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
router.post('/:id/invites', createCollectionInvite);
router.patch('/:id/members/:memberId', updateCollectionMemberRole);
router.delete('/:id/members/:memberId', removeCollectionMember);

export const collectionsRouter = router;
