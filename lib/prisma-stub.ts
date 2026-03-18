// This is a stub for Prisma client when the actual client cannot be generated
// during build. It allows the application to compile while Prisma setup is deferred.

export const prisma = {
  user: { findMany: async () => [], findUnique: async () => null, create: async () => ({}) },
  keyword: { findMany: async () => [], findUnique: async () => null, create: async () => ({}) },
  crawlResult: { findMany: async () => [], findUnique: async () => null, create: async () => ({}) },
  bidResult: { upsert: async () => ({}) },
  company: { upsert: async () => ({}) },
  accessLog: { create: async () => ({}) },
} as any;

export default prisma;
