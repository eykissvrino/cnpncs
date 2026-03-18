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

  await client.execute(`
    CREATE TABLE IF NOT EXISTS "User" (
      "id" INTEGER PRIMARY KEY AUTOINCREMENT,
      "username" TEXT NOT NULL UNIQUE,
      "password" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "department" TEXT NOT NULL,
      "role" TEXT NOT NULL DEFAULT 'user',
      "active" INTEGER NOT NULL DEFAULT 1,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log("[migrate] User table created/verified");

  try {
    await client.execute(`ALTER TABLE "Keyword" ADD COLUMN "userId" INTEGER REFERENCES "User"("id")`);
    console.log("[migrate] Added userId column to Keyword");
  } catch {
    console.log("[migrate] userId column already exists in Keyword");
  }

  try {
    await client.execute(`DROP INDEX IF EXISTS "Keyword_name_key"`);
    await client.execute(`CREATE UNIQUE INDEX IF NOT EXISTS "Keyword_name_userId_key" ON "Keyword"("name", "userId")`);
    console.log("[migrate] Updated Keyword unique constraint");
  } catch (e) {
    console.log("[migrate] Keyword index update:", e);
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
