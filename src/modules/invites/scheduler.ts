import { logger } from '../../lib/logger';
import { InviteService, inviteService } from './service';

const DEFAULT_INTERVAL_MS = 60 * 60 * 1000;

export class InviteExpirationScheduler {
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly service: InviteService = inviteService,
    private readonly intervalMs: number = DEFAULT_INTERVAL_MS,
  ) {}

  start() {
    if (this.timer) {
      return;
    }

    const run = async () => {
      try {
        const count = await this.service.expireInvites();
        if (count > 0) {
          logger.info({ count }, 'Expired invites');
        }
      } catch (error) {
        logger.error({ err: error }, 'Failed to expire invites');
      }
    };

    void run();

    this.timer = setInterval(() => {
      void run();
    }, this.intervalMs);

    logger.info({ intervalMs: this.intervalMs }, 'Invite expiration scheduler started');
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
      logger.info('Invite expiration scheduler stopped');
    }
  }
}

export const inviteExpirationScheduler = new InviteExpirationScheduler();
