import { z } from "zod";

// ── Keywords API ──
export const keywordCreateSchema = z.object({
  name: z.string().min(1, "키워드를 입력해주세요").max(100).trim(),
});

export const keywordPatchSchema = z.object({
  id: z.number().int().positive(),
  active: z.boolean(),
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
