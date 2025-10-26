import { SellerApplicationAdminService } from '../src/modules/seller-applications/admin-service';
import { prisma } from '../src/lib/prisma';

const usage = `Usage:
  pnpm tsx scripts/seller-review.ts <applicationId> [--reviewer <reviewerId>] [--reject "<reason>"]

Examples:
  pnpm tsx scripts/seller-review.ts spr_123
  pnpm tsx scripts/seller-review.ts spr_123 --reviewer admin_cli
  pnpm tsx scripts/seller-review.ts spr_123 --reject "Missing tax certificate"
`;

const ensureReviewerExists = async (reviewerId: string) => {
  const existing = await prisma.user.findUnique({ where: { id: reviewerId } });
  if (existing) {
    return existing;
  }

  return prisma.user.create({
    data: {
      id: reviewerId,
      email: null,
      name: reviewerId,
      locale: null,
    },
  });
};

const run = async () => {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error(usage);
    process.exit(1);
  }

  const applicationId = args[0]!;
  let reviewerId = process.env.SELLER_REVIEWER_ID ?? 'admin-script';
  let action: 'approve' | 'reject' = 'approve';
  let rejectionReason: string | null = null;

  for (let index = 1; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === '--reviewer') {
      const value = args[index + 1];
      if (!value) {
        console.error('Missing value for --reviewer option.\n');
        console.error(usage);
        process.exit(1);
      }
      reviewerId = value;
      index += 1;
    } else if (arg === '--reject') {
      const value = args[index + 1];
      if (!value) {
        console.error('Missing rejection reason after --reject option.\n');
        console.error(usage);
        process.exit(1);
      }
      action = 'reject';
      rejectionReason = value;
      index += 1;
    } else {
      console.error(`Unknown option: ${arg}\n`);
      console.error(usage);
      process.exit(1);
    }
  }

  const service = new SellerApplicationAdminService();

  try {
    await ensureReviewerExists(reviewerId);

    if (action === 'approve') {
      const profile = await service.approve(applicationId, reviewerId);
      console.log('Seller application approved:');
      console.log(
        JSON.stringify(
          {
            id: profile.id,
            userId: profile.userId,
            status: profile.status,
            reviewedById: profile.reviewedById,
            reviewedAt: profile.reviewedAt,
          },
          null,
          2,
        ),
      );
    } else {
      const profile = await service.reject(applicationId, reviewerId, rejectionReason);
      console.log('Seller application rejected:');
      console.log(
        JSON.stringify(
          {
            id: profile.id,
            userId: profile.userId,
            status: profile.status,
            reviewedById: profile.reviewedById,
            reviewedAt: profile.reviewedAt,
            rejectionReason: profile.rejectionReason,
          },
          null,
          2,
        ),
      );
    }
  } catch (error) {
    console.error('Operation failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
};

run();
