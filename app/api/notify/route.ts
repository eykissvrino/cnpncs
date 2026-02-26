import { NextRequest, NextResponse } from "next/server";
import { sendEmailNotification, sendSlackNotification } from "@/lib/notify";
import { prisma } from "@/lib/db";
import type { CrawlResult } from "@prisma/client";

export async function POST(request: NextRequest) {
  try {
    const { type, results } = await request.json() as {
      type: "email" | "slack" | "all";
      results?: CrawlResult[];
    };

    // results가 없으면 미알림 항목 조회
    const toNotify =
      results ||
      (await prisma.crawlResult.findMany({
        where: { notified: false, isNew: true },
        take: 50,
        orderBy: { createdAt: "desc" },
      }));

    if (toNotify.length === 0) {
      return NextResponse.json({ message: "알림할 신규 항목이 없습니다.", sent: 0 });
    }

    const results_: { email?: boolean; slack?: boolean } = {};

    if (type === "email" || type === "all") {
      results_.email = await sendEmailNotification(toNotify);
    }
    if (type === "slack" || type === "all") {
      results_.slack = await sendSlackNotification(toNotify);
    }

    if (results_.email || results_.slack) {
      await prisma.crawlResult.updateMany({
        where: { id: { in: toNotify.map((r) => r.id) } },
        data: { notified: true },
      });
    }

    return NextResponse.json({ success: true, sent: toNotify.length, results: results_ });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "알림 전송 실패";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
