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

  const collection = await prisma.collection.upsert({
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

  await prisma.collectionMember.upsert({
    where: { id: 'collection-seed-owner' },
    update: {
      role: 'OWNER',
      collectionId: collection.id,
      userId: defaultUser.id,
    },
    create: {
      id: 'collection-seed-owner',
      collectionId: collection.id,
      userId: defaultUser.id,
      role: 'OWNER',
    },
  });

  const invite = await prisma.invite.upsert({
    where: { token: 'seed_invite_token' },
    update: {
      collectionId: collection.id,
      inviterId: defaultUser.id,
      role: 'VIEW_ONLY',
      status: 'PENDING',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
    create: {
      collectionId: collection.id,
      inviterId: defaultUser.id,
      role: 'VIEW_ONLY',
      token: 'seed_invite_token',
      status: 'PENDING',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  await prisma.auditLog.upsert({
    where: { id: 'audit_seed_invite_created' },
    update: {
      actorId: defaultUser.id,
      action: 'INVITE_CREATED',
      collectionId: collection.id,
      targetUserId: null,
      inviteId: invite.id,
      metadata: {
        token: invite.token,
        role: invite.role,
      },
    },
    create: {
      id: 'audit_seed_invite_created',
      actorId: defaultUser.id,
      action: 'INVITE_CREATED',
      collectionId: collection.id,
      targetUserId: null,
      inviteId: invite.id,
      metadata: {
        token: invite.token,
        role: invite.role,
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
