import { logger } from '../../lib/logger';

export interface InviteMessagePayload {
  deepLink: string;
  fallbackUrl: string;
  identifier?: string;
  collectionName: string;
  inviterName?: string | null;
}

/**
 * sendInviteNotification is a stub for wiring push/email/SMS providers later.
 * For now it logs an info message so that invite flows can be tested end-to-end
 * without integrating a third-party service.
 */
export const sendInviteNotification = async (payload: InviteMessagePayload) => {
  logger.info(
    {
      deepLink: payload.deepLink,
      fallbackUrl: payload.fallbackUrl,
      identifier: payload.identifier ?? null,
      collectionName: payload.collectionName,
      inviterName: payload.inviterName ?? null,
    },
    'Invite notification stub invoked',
  );
};
