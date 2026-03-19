import { createClient } from "@libsql/client";
import { createHash } from "crypto";
import path from "path";

const dbUrl = process.env.DATABASE_URL || `file:${path.resolve(process.cwd(), "dev.db")}`;
const client = createClient({ url: dbUrl });

function hashPassword(password) {
  return createHash("sha256").update(password).digest("hex");
}

const COMMON_PASSWORD = "cnp1234";

const users = [
  { username: "admin",         password: COMMON_PASSWORD, name: "관리자",             department: "관리",               role: "admin" },
  { username: "cnp_global",   password: COMMON_PASSWORD, name: "글로벌컨설팅본부",   department: "글로벌컨설팅본부",   role: "user" },
  { username: "cnp_next",     password: COMMON_PASSWORD, name: "넥스트보상연구본부", department: "넥스트보상연구본부", role: "user" },
  { username: "cnp_biz",      password: COMMON_PASSWORD, name: "경영컨설팅본부",     department: "경영컨설팅본부",     role: "user" },
  { username: "cnp_work",     password: COMMON_PASSWORD, name: "일터혁신컨설팅본부", department: "일터혁신컨설팅본부", role: "user" },
  { username: "cnp_ability",  password: COMMON_PASSWORD, name: "직업능력개발본부",   department: "직업능력개발본부",   role: "user" },
  { username: "cnp_vocacons", password: COMMON_PASSWORD, name: "직업능력컨설팅본부", department: "직업능력컨설팅본부", role: "user" },
  { username: "cnp_public",   password: COMMON_PASSWORD, name: "공공경영컨설팅본부", department: "공공경영컨설팅본부", role: "user" },
  { username: "cnp_sustain",  password: COMMON_PASSWORD, name: "지속가능경영본부",   department: "지속가능경영본부",   role: "user" },
  { username: "cnp_ai",       password: COMMON_PASSWORD, name: "AI컨설팅연구소",     department: "AI컨설팅연구소",     role: "user" },
];

async function main() {
  console.log("[migrate] Starting migration...");

  // Keyword 테이블 (기본)
  await client.execute(`
    CREATE TABLE IF NOT EXISTS "Keyword" (
      "id" INTEGER PRIMARY KEY AUTOINCREMENT,
      "name" TEXT NOT NULL,
      "active" INTEGER NOT NULL DEFAULT 1,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "userId" INTEGER REFERENCES "User"("id")
    )
  `);
  console.log("[migrate] Keyword table created/verified");

  // CrawlResult 테이블
  await client.execute(`
    CREATE TABLE IF NOT EXISTS "CrawlResult" (
      "id" INTEGER PRIMARY KEY AUTOINCREMENT,
      "type" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "agency" TEXT NOT NULL,
      "budget" TEXT,
      "deadline" TEXT,
      "postDate" TEXT NOT NULL,
      "bidNumber" TEXT UNIQUE,
      "url" TEXT,
      "rawData" TEXT NOT NULL,
      "isNew" INTEGER NOT NULL DEFAULT 1,
      "notified" INTEGER NOT NULL DEFAULT 0,
      "keywordId" INTEGER REFERENCES "Keyword"("id"),
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log("[migrate] CrawlResult table created/verified");

  // User 테이블
  await client.execute(`
    CREATE TABLE IF NOT EXISTS "User" (
      "id" INTEGER PRIMARY KEY AUTOINCREMENT,
      "username" TEXT NOT NULL UNIQUE,
      "password" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "department" TEXT NOT NULL,
      "role" TEXT NOT NULL DEFAULT 'user',
      "active" INTEGER NOT NULL DEFAULT 1,
      "lastLoginAt" DATETIME,
      "loginCount" INTEGER NOT NULL DEFAULT 0,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log("[migrate] User table created/verified");

  // User 테이블에 누락된 컬럼 추가 (기존 DB 호환)
  for (const col of [
    { name: "lastLoginAt", def: `ALTER TABLE "User" ADD COLUMN "lastLoginAt" DATETIME` },
    { name: "loginCount", def: `ALTER TABLE "User" ADD COLUMN "loginCount" INTEGER NOT NULL DEFAULT 0` },
  ]) {
    try { await client.execute(col.def); console.log(`[migrate] User.${col.name} 컬럼 추가됨`); }
    catch { console.log(`[migrate] User.${col.name} 컬럼 이미 존재`); }
  }

  // AccessLog 테이블
  await client.execute(`
    CREATE TABLE IF NOT EXISTS "AccessLog" (
      "id" INTEGER PRIMARY KEY AUTOINCREMENT,
      "userId" INTEGER NOT NULL REFERENCES "User"("id"),
      "action" TEXT NOT NULL,
      "detail" TEXT,
      "ip" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log("[migrate] AccessLog table created/verified");

  // BidResult 테이블
  await client.execute(`
    CREATE TABLE IF NOT EXISTS "BidResult" (
      "id" INTEGER PRIMARY KEY AUTOINCREMENT,
      "bidNtceNo" TEXT NOT NULL,
      "bidNtceOrd" TEXT,
      "bidNtceNm" TEXT NOT NULL,
      "opengDt" TEXT,
      "sucsfbidMthdNm" TEXT,
      "companyName" TEXT,
      "companyBizno" TEXT,
      "bidAmount" TEXT,
      "sucsfbidAmt" TEXT,
      "ranking" INTEGER,
      "resultType" TEXT NOT NULL DEFAULT 'completed',
      "agency" TEXT,
      "rawData" TEXT NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log("[migrate] BidResult table created/verified");

  // Company 테이블
  await client.execute(`
    CREATE TABLE IF NOT EXISTS "Company" (
      "id" INTEGER PRIMARY KEY AUTOINCREMENT,
      "bizno" TEXT NOT NULL UNIQUE,
      "name" TEXT NOT NULL,
      "totalBids" INTEGER NOT NULL DEFAULT 0,
      "totalWins" INTEGER NOT NULL DEFAULT 0,
      "totalAmount" TEXT,
      "lastBidDate" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log("[migrate] Company table created/verified");

  // Keyword.userId 컬럼 추가 (기존 DB 호환)
  try {
    await client.execute(`ALTER TABLE "Keyword" ADD COLUMN "userId" INTEGER REFERENCES "User"("id")`);
    console.log("[migrate] Added userId column to Keyword");
  } catch {
    console.log("[migrate] userId column already exists in Keyword");
  }

  // 인덱스 정리
  try {
    await client.execute(`DROP INDEX IF EXISTS "Keyword_name_key"`);
    await client.execute(`CREATE UNIQUE INDEX IF NOT EXISTS "Keyword_name_userId_key" ON "Keyword"("name", "userId")`);
    await client.execute(`CREATE UNIQUE INDEX IF NOT EXISTS "BidResult_bidNtceNo_bidNtceOrd_companyBizno_key" ON "BidResult"("bidNtceNo", "bidNtceOrd", "companyBizno")`);
    console.log("[migrate] Indexes created/verified");
  } catch (e) {
    console.log("[migrate] Index update:", e);
  }

  for (const u of users) {
    const hashed = hashPassword(u.password);
    const existing = await client.execute({
      sql: `SELECT id FROM "User" WHERE "username" = ?`,
      args: [u.username],
    });
    if (existing.rows.length > 0) {
      await client.execute({
        sql: `UPDATE "User" SET "password" = ?, "name" = ?, "department" = ?, "role" = ? WHERE "username" = ?`,
        args: [hashed, u.name, u.department, u.role, u.username],
      });
    } else {
      await client.execute({
        sql: `INSERT INTO "User" ("username", "password", "name", "department", "role") VALUES (?, ?, ?, ?, ?)`,
        args: [u.username, hashed, u.name, u.department, u.role],
      });
    }
    console.log(`  + ${u.username} (${u.department})`);
  }

  console.log("[migrate] Migration completed!");
}

main()
  .catch((e) => {
    console.error("[migrate] Error:", e);
    process.exit(1);
  });
