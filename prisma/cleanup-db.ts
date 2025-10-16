import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const [collectionMembers, collectionSamples, sampleImages, collections, samples, users] =
    await prisma.$transaction([
      prisma.collectionMember.deleteMany(),
      prisma.collectionSample.deleteMany(),
      prisma.sampleImage.deleteMany(),
      prisma.collection.deleteMany(),
      prisma.sample.deleteMany(),
      prisma.user.deleteMany(),
    ]);

  console.log('Cleanup complete', {
    collectionMembers: collectionMembers.count,
    collectionSamples: collectionSamples.count,
    sampleImages: sampleImages.count,
    collections: collections.count,
    samples: samples.count,
    users: users.count,
  });
}

main()
  .catch((error) => {
    console.error('Database cleanup failed', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
