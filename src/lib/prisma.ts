import { PrismaClient } from '@prisma/client';
import { env } from '../config';

const createPrisma = () =>
  new PrismaClient({
    log: env.isDevelopment ? ['query', 'error', 'warn'] : ['error'],
  });

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma = globalForPrisma.prisma ?? createPrisma();

if (!env.isProduction) {
  globalForPrisma.prisma = prisma;
}

export type PrismaClientType = typeof prisma;
