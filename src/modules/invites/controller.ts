import type { NextFunction, Request, Response } from 'express';
import { CollectionRole } from '@prisma/client';
import { CollectionService } from '../collections/service';
import { InviteService } from './service';
import { createInviteBodySchema, resolveInviteQuerySchema, inviteIdParamSchema } from './schemas';
import { collectionIdParamSchema } from '../collections/schemas';

const collectionService = new CollectionService();
const service = new InviteService();

const APP_STORE_URL = 'https://apps.apple.com/app/id6749925767';

const buildDeepLink = (token: string) => `sampleart://invite/${token}`;

export const createCollectionInvite = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const params = collectionIdParamSchema.parse(req.params);
    const body = createInviteBodySchema.parse(req.body);
    const authUser = req.authUser;

    if (!authUser) {
      return res.status(401).json({ error: { message: 'Unauthorized' } });
    }

    await collectionService.assertCollectionRole(params.id, authUser.id, [CollectionRole.OWNER]);

    const { invite } = await service.createInvite(
      params.id,
      authUser.id,
      body.role ?? CollectionRole.VIEW_ONLY,
    );

    res.status(201).json({
      data: {
        id: invite.id,
        token: invite.token,
        role: invite.role,
        status: invite.status,
        expiresAt: invite.expiresAt.toISOString(),
        deepLink: buildDeepLink(invite.token),
        appStoreFallbackUrl: APP_STORE_URL,
        collection: invite.collection,
        inviter: invite.inviter,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const resolveInvite = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = resolveInviteQuerySchema.parse(req.query);
    const invite = await service.resolveInvite(query.token);

    res.json({
      data: {
        id: invite.id,
        collection: invite.collection,
        inviter: invite.inviter,
        invitee: invite.invitee ?? null,
        role: invite.role,
        status: invite.status,
        expiresAt: invite.expiresAt.toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const acceptInvite = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const params = inviteIdParamSchema.parse(req.params);
    const authUser = req.authUser;

    if (!authUser) {
      return res.status(401).json({ error: { message: 'Unauthorized' } });
    }

    const invite = await service.acceptInvite(params.id, authUser.id);
    const role = await collectionService.ensureMembershipFromInvite(
      invite.collectionId,
      authUser.id,
      invite.role,
    );

    res.json({
      data: {
        collectionId: invite.collectionId,
        role,
        status: invite.status,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const rejectInvite = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const params = inviteIdParamSchema.parse(req.params);
    const authUser = req.authUser;

    if (!authUser) {
      return res.status(401).json({ error: { message: 'Unauthorized' } });
    }

    const invite = await service.rejectInvite(params.id, authUser.id);

    res.json({
      data: {
        collectionId: invite.collectionId,
        status: invite.status,
      },
    });
  } catch (error) {
    next(error);
  }
};
