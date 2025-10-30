import { SellerProfileStatus } from '@prisma/client';
import { prisma } from '../src/lib/prisma';

const [userId, reviewerId] = process.argv.slice(2);

const usage = () => {
  console.error('Usage: pnpm tsx scripts/approve-seller.ts <userId> [reviewerUserId]');
};

if (!userId) {
  usage();
  process.exit(1);
}

const main = async () => {
  const profile = await prisma.sellerProfile.findUnique({
    where: { userId },
  });

  if (!profile) {
    throw new Error(`Seller profile not found for userId=${userId}`);
  }

  if (profile.status === SellerProfileStatus.APPROVED) {
    console.log(`Seller profile for userId=${userId} is already approved.`);
    return;
  }

  const updated = await prisma.sellerProfile.update({
    where: { id: profile.id },
    data: {
      status: SellerProfileStatus.APPROVED,
      reviewedById: reviewerId ?? null,
      reviewedAt: new Date(),
      rejectionReason: null,
    },
  });

  console.log(
    `Seller profile ${updated.id} approved for user ${updated.userId} (status=${updated.status}).`,
  );
};

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
