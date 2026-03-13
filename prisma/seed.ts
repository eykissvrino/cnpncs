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

const COMMON_PASSWORD = "cnp1234";

const users = [
  { username: "cnp_ceo",      password: COMMON_PASSWORD, name: "대표님",             department: "대표",               role: "admin" },
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
