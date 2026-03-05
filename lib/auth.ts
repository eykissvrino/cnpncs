import { createHash } from "crypto";

const AUTH_SECRET = process.env.AUTH_SECRET || "narajan-monitor-default-secret";

export function generateSessionToken(password: string): string {
  return createHash("sha256")
    .update(password + AUTH_SECRET)
    .digest("hex");
}

export function validateSessionToken(token: string): boolean {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return false;
  return token === generateSessionToken(password);
}
