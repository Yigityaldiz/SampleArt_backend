import { cleanupTaskService } from './service';
import { env } from '../../config';
import { logger } from '../../lib/logger';

export class CleanupScheduler {
  private timer?: NodeJS.Timeout;

  constructor(private readonly intervalMs = env.cleanupPollIntervalMs) {}

  start() {
    if (this.timer) {
      return;
    }

    const run = async () => {
      try {
        await cleanupTaskService.processPending();
      } catch (error) {
        logger.error({ err: error }, 'Cleanup scheduler execution failed');
      }
    };

    // Run immediately on start to avoid waiting full interval.
    void run();

    this.timer = setInterval(() => {
      void run();
    }, this.intervalMs);

    logger.info(
      { intervalMs: this.intervalMs },
      'Cleanup scheduler started',
    );
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
      logger.info('Cleanup scheduler stopped');
    }
  }
}
