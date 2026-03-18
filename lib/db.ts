let PrismaClient: any = undefined;
let PrismaLibSQL: any = undefined;

try {
  const prismaModule = require("@prisma/client");
  const adapterModule = require("@prisma/adapter-libsql");
  PrismaClient = prismaModule.PrismaClient;
  PrismaLibSQL = adapterModule.PrismaLibSQL;
} catch (e) {
  // Prisma not initialized yet (e.g., during build)
  console.warn("[db] Prisma client not available during build");
}

import path from "path";

function createPrismaClient() {
  if (!PrismaClient) {
    throw new Error("Prisma client not initialized. Please run 'prisma generate' first.");
  }
  // Railway 배포 시 DATABASE_URL 환경변수로 볼륨 경로 지정 (예: file:/data/narajan.db)
  // 로컬 개발 시 프로젝트 루트의 dev.db 사용
  const dbUrl = process.env.DATABASE_URL || `file:${path.resolve(process.cwd(), "dev.db")}`;
  const adapter = new PrismaLibSQL({ url: dbUrl });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

const globalForPrisma = globalThis as unknown as {
  prisma: any;
};

// Use a proxy that defers client creation until runtime
export const prisma = new Proxy({}, {
  get(target, prop) {
    if (!globalForPrisma.prisma && PrismaClient) {
      globalForPrisma.prisma = createPrismaClient();
    }
    if (globalForPrisma.prisma) {
      return (globalForPrisma.prisma as any)[prop];
    }
    // Return stub methods during build
    return function() { throw new Error("Prisma not initialized"); };
  }
});

if (process.env.NODE_ENV !== "production" && globalForPrisma.prisma) {
  // Already initialized
}
