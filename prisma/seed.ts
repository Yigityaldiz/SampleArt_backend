import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const userId = 'user_seed_admin';

  const defaultUser = await prisma.user.upsert({
    where: { id: userId },
    update: {
      email: 'admin@sampleart.local',
      name: 'Seed Admin',
      locale: 'tr-TR',
    },
    create: {
      id: userId,
      email: 'admin@sampleart.local',
      name: 'Seed Admin',
      locale: 'tr-TR',
    },
  });

  const sample = await prisma.sample.create({
    data: {
      userId: defaultUser.id,
      title: 'Seramik Örneği',
      materialType: 'ceramic',
      applicationArea: 'wall',
      colorHex: '#FFFFFF',
      companyName: 'Local Studio',
    },
  });

  await prisma.sampleImage.create({
    data: {
      sampleId: sample.id,
      storageProvider: 'local',
      objectKey: `samples/${sample.id}/primary.jpg`,
      url: `http://localhost:3000/uploads/${sample.id}/primary.jpg`,
      width: 1024,
      height: 768,
    },
  });

  await prisma.collection.upsert({
    where: { id: 'collection-seed' },
    update: {},
    create: {
      id: 'collection-seed',
      userId: defaultUser.id,
      name: 'İlk Koleksiyon',
      samples: {
        create: {
          sampleId: sample.id,
          position: 1,
        },
      },
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error('Seed failed', error);
    await prisma.$disconnect();
    process.exit(1);
  });
