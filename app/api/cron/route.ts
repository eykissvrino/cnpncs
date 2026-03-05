import { NextRequest, NextResponse } from "next/server";
import { runCrawl } from "@/lib/scheduler";
import { rateLimit } from "@/lib/rate-limit";

export const maxDuration = 300;

export async function GET(request: NextRequest) {
  // CRON_SECRET 헤더 체크 (외부 스케줄러용)
  const cronSecret = process.env.CRON_SECRET;
  const headerSecret = request.headers.get("x-cron-secret");
  const isCronCall = cronSecret && headerSecret === cronSecret;

  // 수동 호출 시 rate limit 적용
  if (!isCronCall) {
    const ip = request.headers.get("x-forwarded-for") || "unknown";
    const { allowed } = rateLimit(`cron:${ip}`, 1, 60_000);
    if (!allowed) {
      return NextResponse.json({ error: "크롤링이 이미 진행 중이거나 너무 빈번합니다. 1분 후 다시 시도해주세요." }, { status: 429 });
    }
  }

  try {
    console.log("[cron] 크롤링 시작:", new Date().toISOString());
    const result = await runCrawl();
    console.log("[cron] 완료:", result);
    return NextResponse.json({
      success: true,
      newCount: result.newCount,
      errors: result.errors,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "크롤링 실패";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
