import { NextRequest, NextResponse } from "next/server";
import { sendEmailNotification, sendSubscriberNotifications } from "@/lib/notify";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { notifyRequestSchema } from "@/lib/validators";

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") || "unknown";
  const { allowed } = rateLimit(`notify:${ip}`, 5, 60_000);
  if (!allowed) {
    return NextResponse.json({ error: "요청이 너무 빈번합니다. 잠시 후 다시 시도해주세요." }, { status: 429 });
  }

  try {
    const body = await request.json();
    const parsed = notifyRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "잘못된 요청입니다." },
        { status: 400 }
      );
    }

    const toNotify =
      parsed.data.results ||
      (await prisma.crawlResult.findMany({
        where: { notified: false, isNew: true },
        take: 50,
        orderBy: { createdAt: "desc" },
      }));

    if (toNotify.length === 0) {
      return NextResponse.json({ message: "알림할 신규 항목이 없습니다.", sent: 0 });
    }

    const notifyResults: { email?: boolean; subscribers?: { sent: number; errors: string[] } } = {};

    // 글로벌 이메일 알림 (기존 호환)
    if (parsed.data.type === "email" || parsed.data.type === "all") {
      notifyResults.email = await sendEmailNotification(toNotify);
    }

    // 구독자별 알림
    notifyResults.subscribers = await sendSubscriberNotifications(toNotify);

    if (notifyResults.email || (notifyResults.subscribers?.sent ?? 0) > 0) {
      await prisma.crawlResult.updateMany({
        where: { id: { in: toNotify.map((r) => r.id) } },
        data: { notified: true },
      });
    }

    return NextResponse.json({
      success: true,
      sent: toNotify.length,
      results: notifyResults,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "알림 전송 실패";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
