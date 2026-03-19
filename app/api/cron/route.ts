import { NextRequest, NextResponse } from "next/server";
import { runCrawl } from "@/lib/scheduler";
import { rateLimit } from "@/lib/rate-limit";

// 크롤링 상태 추적 (메모리 내)
let crawlStatus: {
  running: boolean;
  lastResult: { newCount: number; errors: string[]; timestamp: string } | null;
} = { running: false, lastResult: null };

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");

  // 상태 조회
  if (action === "status") {
    return NextResponse.json(crawlStatus);
  }

  // CRON_SECRET 헤더 체크 (외부 스케줄러용)
  const cronSecret = process.env.CRON_SECRET;
  const headerSecret = request.headers.get("x-cron-secret");
  const isCronCall = cronSecret && headerSecret === cronSecret;

  // 이미 크롤링 중이면 거부
  if (crawlStatus.running) {
    return NextResponse.json({
      success: false,
      message: "크롤링이 진행 중입니다. 잠시 후 새로고침 해주세요.",
      running: true,
    });
  }

  // 수동 호출 시 rate limit 적용
  if (!isCronCall) {
    const ip = request.headers.get("x-forwarded-for") || "unknown";
    const { allowed } = rateLimit(`cron:${ip}`, 1, 30_000);
    if (!allowed) {
      return NextResponse.json({ error: "크롤링이 너무 빈번합니다. 30초 후 다시 시도해주세요." }, { status: 429 });
    }
  }

  // 백그라운드 크롤링 시작 (응답은 즉시 반환)
  crawlStatus.running = true;
  console.log("[cron] 백그라운드 크롤링 시작:", new Date().toISOString());

  // 비동기 실행 — await 하지 않고 즉시 응답
  runCrawl()
    .then((result) => {
      console.log("[cron] 크롤링 완료:", result);
      crawlStatus = {
        running: false,
        lastResult: {
          newCount: result.newCount,
          errors: result.errors,
          timestamp: new Date().toISOString(),
        },
      };
    })
    .catch((error) => {
      console.error("[cron] 크롤링 실패:", error);
      crawlStatus = {
        running: false,
        lastResult: {
          newCount: 0,
          errors: [error instanceof Error ? error.message : "크롤링 실패"],
          timestamp: new Date().toISOString(),
        },
      };
    });

  return NextResponse.json({
    success: true,
    message: "크롤링이 시작되었습니다. 2~3분 후 새로고침 해주세요.",
    running: true,
    newCount: 0,
  });
}
