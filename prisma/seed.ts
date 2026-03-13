import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { createHash } from "crypto";
import path from "path";

const dbUrl = process.env.DATABASE_URL || `file:${path.resolve(process.cwd(), "dev.db")}`;
const adapter = new PrismaLibSQL({ url: dbUrl });
const prisma = new PrismaClient({ adapter });

function hashPassword(password: string): string {
  return createHash("sha256").update(password).digest("hex");
}

const users = [
  { username: "cnp_admin",   password: "cnp2025!",    name: "관리자",     department: "경영지원",     role: "admin" },
  { username: "cnp_infra",   password: "infra2025!",  name: "인프라본부", department: "인프라본부",   role: "user" },
  { username: "cnp_arch",    password: "arch2025!",   name: "건축본부",   department: "건축본부",     role: "user" },
  { username: "cnp_civil",   password: "civil2025!",  name: "토목본부",   department: "토목본부",     role: "user" },
  { username: "cnp_env",     password: "env2025!",    name: "환경본부",   department: "환경본부",     role: "user" },
  { username: "cnp_safety",  password: "safety2025!", name: "안전본부",   department: "안전본부",     role: "user" },
  { username: "cnp_digital", password: "digital2025!",name: "디지털본부", department: "디지털본부",   role: "user" },
  { username: "cnp_energy",  password: "energy2025!", name: "에너지본부", department: "에너지본부",   role: "user" },
  { username: "cnp_mgmt",    password: "mgmt2025!",   name: "경영지원본부", department: "경영지원본부", role: "user" },
];

async function main() {
  console.log("Seeding users...");

  for (const u of users) {
    await prisma.user.upsert({
      where: { username: u.username },
      update: { name: u.name, department: u.department, role: u.role },
      create: {
        username: u.username,
        password: hashPassword(u.password),
        name: u.name,
        department: u.department,
        role: u.role,
      },
    });
    console.log(`  ✓ ${u.username} (${u.department})`);
  }

  console.log("Seed completed!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
