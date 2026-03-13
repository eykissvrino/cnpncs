import { createClient } from "@libsql/client";
import { createHash } from "crypto";
import path from "path";

const dbUrl = process.env.DATABASE_URL || `file:${path.resolve(process.cwd(), "dev.db")}`;
const client = createClient({ url: dbUrl });

function hashPassword(password: string): string {
  return createHash("sha256").update(password).digest("hex");
}

const users = [
  { username: "cnp_admin",   password: "cnp2025!",    name: "관리자",       department: "경영지원",       role: "admin" },
  { username: "cnp_infra",   password: "infra2025!",  name: "인프라본부",   department: "인프라본부",     role: "user" },
  { username: "cnp_arch",    password: "arch2025!",   name: "건축본부",     department: "건축본부",       role: "user" },
  { username: "cnp_civil",   password: "civil2025!",  name: "토목본부",     department: "토목본부",       role: "user" },
  { username: "cnp_env",     password: "env2025!",    name: "환경본부",     department: "환경본부",       role: "user" },
  { username: "cnp_safety",  password: "safety2025!", name: "안전본부",     department: "안전본부",       role: "user" },
  { username: "cnp_digital", password: "digital2025!",name: "디지털본부",   department: "디지털본부",     role: "user" },
  { username: "cnp_energy",  password: "energy2025!", name: "에너지본부",   department: "에너지본부",     role: "user" },
  { username: "cnp_mgmt",    password: "mgmt2025!",   name: "경영지원본부", department: "경영지원본부",   role: "user" },
];

async function main() {
  console.log("[migrate] Starting migration...");

  // 1. User 테이블 생성
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

  // 2. Keyword 테이블에 userId 컬럼 추가 (없으면)
  try {
    await client.execute(`ALTER TABLE "Keyword" ADD COLUMN "userId" INTEGER REFERENCES "User"("id")`);
    console.log("[migrate] Added userId column to Keyword");
  } catch {
    console.log("[migrate] userId column already exists in Keyword");
  }

  // 3. Keyword unique constraint 변경: name -> (name, userId)
  // SQLite는 ALTER로 unique 변경 불가, 기존 unique(name) 제약 제거 필요
  // 기존 데이터는 userId=null로 유지됨
  try {
    await client.execute(`DROP INDEX IF EXISTS "Keyword_name_key"`);
    await client.execute(`CREATE UNIQUE INDEX IF NOT EXISTS "Keyword_name_userId_key" ON "Keyword"("name", "userId")`);
    console.log("[migrate] Updated Keyword unique constraint");
  } catch (e) {
    console.log("[migrate] Keyword index update:", e);
  }

  // 4. 시드 데이터 삽입
  for (const u of users) {
    const hashed = hashPassword(u.password);
    await client.execute({
      sql: `INSERT OR IGNORE INTO "User" ("username", "password", "name", "department", "role") VALUES (?, ?, ?, ?, ?)`,
      args: [u.username, hashed, u.name, u.department, u.role],
    });
    console.log(`  + ${u.username} (${u.department})`);
  }

  console.log("[migrate] Migration completed!");
}

main()
  .catch((e) => {
    console.error("[migrate] Error:", e);
    process.exit(1);
  });
