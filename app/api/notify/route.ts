import { NextRequest, NextResponse } from "next/server";
import { sendEmailNotification, sendSubscriberNotifications } from "@/lib/notify";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { notifyRequestSchema } from "@/lib/validators";
import nodemailer from "nodemailer";

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

    // 테스트 모드: results가 빈 배열이면 SMTP 연결 테스트만 수행
    if (parsed.data.results && parsed.data.results.length === 0) {
      if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        return NextResponse.json({ error: "SMTP 환경변수(EMAIL_USER, EMAIL_PASS)가 설정되지 않았습니다." }, { status: 400 });
      }

      const transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST || "smtp.gmail.com",
        port: parseInt(process.env.EMAIL_PORT || "587"),
        secure: false,
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      });

      // 구독자 목록 가져오기
      const subscribers = await prisma.subscriber.findMany({ where: { active: true } });
      if (subscribers.length === 0) {
        return NextResponse.json({ error: "활성 구독자가 없습니다. 구독자를 먼저 추가해주세요." }, { status: 400 });
      }

      // 각 구독자에게 테스트 메일 발송
      let sentCount = 0;
      for (const sub of subscribers) {
        try {
          await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: sub.email,
            subject: `[나라장터 모니터] 테스트 알림 - ${sub.name}님`,
            html: `
              <html>
              <body style="font-family:sans-serif;">
                <h2>🔔 나라장터 모니터 - 테스트 알림</h2>
                <p>${sub.name}님, 이메일 알림이 정상적으로 설정되었습니다.</p>
                <p>키워드: <strong>${sub.keywords || "(없음)"}</strong></p>
                <p>알림 일정: <strong>${sub.schedule === "weekday" ? "평일 오전 9시" : sub.schedule === "daily" ? "매일 오전 9시" : sub.schedule === "weekly" ? "매주 월요일 오전 9시" : "즉시"}</strong></p>
                <hr style="border:none;border-top:1px solid #eee;margin:20px 0;">
                <p style="color:#888;font-size:12px;">이 메일은 나라장터 모니터 시스템에서 발송된 테스트 메일입니다.</p>
              </body>
              </html>
            `,
          });
          sentCount++;
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          return NextResponse.json({ error: `${sub.name}(${sub.email}) 발송 실패: ${msg}` }, { status: 500 });
        }
      }

      return NextResponse.json({ message: `테스트 알림 ${sentCount}명에게 발송 완료!`, sent: sentCount });
    }

    // 실제 알림 모드
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

    if (parsed.data.type === "email" || parsed.data.type === "all") {
      notifyResults.email = await sendEmailNotification(toNotify);
    }

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
