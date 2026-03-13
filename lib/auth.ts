import { createHash } from "crypto";
import { prisma } from "@/lib/db";

const AUTH_SECRET = process.env.AUTH_SECRET || "narajan-monitor-default-secret";

export function hashPassword(password: string): string {
  return createHash("sha256").update(password).digest("hex");
}

export function generateSessionToken(userId: number, username: string): string {
  return createHash("sha256")
    .update(`${userId}:${username}:${AUTH_SECRET}`)
    .digest("hex");
}

export async function authenticateUser(username: string, password: string) {
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || !user.active) return null;
  if (user.password !== hashPassword(password)) return null;
  return user;
}

export function parseSessionToken(token: string): { userId: number; username: string } | null {
  // Token format: "userId:username:hash"
  // We store it as a cookie in format "userId:username:hash"
  const parts = token.split(":");
  if (parts.length < 3) return null;
  const userId = parseInt(parts[0], 10);
  const username = parts[1];
  const hash = parts.slice(2).join(":");
  if (isNaN(userId) || !username) return null;
  const expectedHash = generateSessionToken(userId, username);
  if (hash !== expectedHash) return null;
  return { userId, username };
}

export function createSessionCookie(userId: number, username: string): string {
  const hash = generateSessionToken(userId, username);
  return `${userId}:${username}:${hash}`;
}

export async function getCurrentUser(sessionToken: string) {
  const parsed = parseSessionToken(sessionToken);
  if (!parsed) return null;
  const user = await prisma.user.findUnique({ where: { id: parsed.userId } });
  if (!user || !user.active) return null;
  return user;
}
