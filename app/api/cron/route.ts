import { NextResponse } from "next/server";
import { runCrawl } from "@/lib/scheduler";

export async function GET() {
  try {
    console.log("[cron] 수동 크롤링 시작:", new Date().toISOString());
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
