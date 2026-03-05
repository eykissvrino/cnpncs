import { z } from "zod";

// ── Keywords API ──
export const keywordCreateSchema = z.object({
  name: z.string().min(1, "키워드를 입력해주세요").max(100).trim(),
});

export const keywordPatchSchema = z.object({
  id: z.number().int().positive(),
  active: z.boolean(),
});

// ── Settings API ──
export const settingsUpdateSchema = z.object({
  emailEnabled: z.boolean().optional(),
  slackEnabled: z.boolean().optional(),
  cronSchedule: z
    .string()
    .regex(/^[\d\s*/,-]+$/, "잘못된 cron 형식입니다")
    .optional(),
});

// ── Search API ──
export const searchParamsSchema = z.object({
  keyword: z.string().min(1, "검색 키워드를 입력해주세요").max(200),
  page: z.coerce.number().int().min(1).max(100).default(1),
  type: z.enum(["all", "bid", "prespec", "order"]).default("all"),
});

// ── Export API ──
export const exportParamsSchema = z.object({
  keyword: z.string().min(1, "키워드가 필요합니다").max(200),
});

// ── Notify API ──
export const notifyRequestSchema = z.object({
  type: z.enum(["email", "slack", "all"]),
  results: z.array(z.any()).optional(),
});

// ── Subscribers API ──
export const subscriberCreateSchema = z.object({
  name: z.string().min(1, "이름을 입력해주세요").max(50),
  department: z.string().min(1, "소속을 입력해주세요").max(100),
  email: z.string().email("올바른 이메일을 입력해주세요"),
  schedule: z.enum(["immediate", "daily", "weekly"]).default("immediate"),
  keywords: z.string().max(500).default(""),
  active: z.boolean().default(true),
});

export const subscriberUpdateSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1).max(50).optional(),
  department: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  schedule: z.enum(["immediate", "daily", "weekly"]).optional(),
  keywords: z.string().max(500).optional(),
  active: z.boolean().optional(),
});
