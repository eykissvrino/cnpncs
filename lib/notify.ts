import nodemailer from "nodemailer";
import { prisma } from "./db";
import type { CrawlResult } from "@prisma/client";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function typeLabel(type: string): string {
  return type === "bid" ? "입찰공고" : type === "prespec" ? "사전규격" : "발주계획";
}

function formatResultsHtml(results: CrawlResult[], recipientName?: string): string {
  const rows = results
    .map(
      (r) => `
      <tr>
        <td style="padding:8px;border:1px solid #ddd;">${typeLabel(r.type)}</td>
        <td style="padding:8px;border:1px solid #ddd;">${escapeHtml(r.agency)}</td>
        <td style="padding:8px;border:1px solid #ddd;">${escapeHtml(r.title)}</td>
        <td style="padding:8px;border:1px solid #ddd;">${escapeHtml(r.budget || "-")}</td>
        <td style="padding:8px;border:1px solid #ddd;">${escapeHtml(r.postDate)}</td>
        <td style="padding:8px;border:1px solid #ddd;">${escapeHtml(r.deadline || "-")}</td>
      </tr>`
    )
    .join("");

  const greeting = recipientName ? `<p>${escapeHtml(recipientName)}님, ` : `<p>`;

  return `
    <html>
    <body style="font-family:sans-serif;">
      <h2>🔔 나라장터 신규 공고 알림</h2>
      ${greeting}${results.length}건의 신규 공고가 발견되었습니다.</p>
      <table style="border-collapse:collapse;width:100%;">
        <thead>
          <tr style="background:#f5f5f5;">
            <th style="padding:8px;border:1px solid #ddd;">유형</th>
            <th style="padding:8px;border:1px solid #ddd;">기관명</th>
            <th style="padding:8px;border:1px solid #ddd;">사업명</th>
            <th style="padding:8px;border:1px solid #ddd;">예산</th>
            <th style="padding:8px;border:1px solid #ddd;">등록일</th>
            <th style="padding:8px;border:1px solid #ddd;">마감일</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </body>
    </html>
  `;
}

export async function sendEmailNotification(results: CrawlResult[]): Promise<boolean> {
  const emailEnabled =
    process.env.EMAIL_USER &&
    process.env.EMAIL_PASS &&
    process.env.EMAIL_TO;

  if (!emailEnabled) {
    console.warn("[notify] 이메일 환경변수가 설정되지 않았습니다.");
    return false;
  }

  try {
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || "smtp.gmail.com",
      port: parseInt(process.env.EMAIL_PORT || "587"),
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: process.env.EMAIL_TO,
      subject: `[나라장터 모니터] 신규 공고 ${results.length}건 발견`,
      html: formatResultsHtml(results),
    });

    await prisma.notifyLog.create({
      data: {
        type: "email",
        message: `신규 공고 ${results.length}건 알림 발송`,
        success: true,
      },
    });
    return true;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    await prisma.notifyLog.create({
      data: {
        type: "email",
        message: `이메일 발송 실패: ${msg}`,
        success: false,
      },
    });
    return false;
  }
}

export async function sendSlackNotification(results: CrawlResult[]): Promise<boolean> {
  const token = process.env.SLACK_BOT_TOKEN;
  const channelId = process.env.SLACK_CHANNEL_ID;

  if (!token || !channelId || token === "xoxb-your-token") {
    console.warn("[notify] 슬랙 환경변수가 설정되지 않았습니다.");
    return false;
  }

  try {
    const { WebClient } = await import("@slack/web-api");
    const client = new WebClient(token);

    const blocks = [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: `🔔 나라장터 신규 공고 ${results.length}건`,
        },
      },
      ...results.slice(0, 10).map((r) => ({
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*유형:* ${typeLabel(r.type)}`,
          },
          { type: "mrkdwn", text: `*기관:* ${escapeHtml(r.agency)}` },
          { type: "mrkdwn", text: `*사업명:* ${escapeHtml(r.title)}` },
          { type: "mrkdwn", text: `*예산:* ${escapeHtml(r.budget || "-")}` },
        ],
      })),
    ];

    if (results.length > 10) {
      blocks.push({
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `_외 ${results.length - 10}건 더 있습니다._`,
          },
        ],
      } as (typeof blocks)[number]);
    }

    await client.chat.postMessage({ channel: channelId, blocks });

    await prisma.notifyLog.create({
      data: {
        type: "slack",
        message: `신규 공고 ${results.length}건 슬랙 알림 발송`,
        success: true,
      },
    });
    return true;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    await prisma.notifyLog.create({
      data: {
        type: "slack",
        message: `슬랙 알림 실패: ${msg}`,
        success: false,
      },
    });
    return false;
  }
}

// ── 구독자별 알림 ──

function getTransporter() {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST || "smtp.gmail.com",
    port: parseInt(process.env.EMAIL_PORT || "587"),
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
}

export async function sendSubscriberNotifications(
  results: CrawlResult[]
): Promise<{ sent: number; errors: string[] }> {
  const errors: string[] = [];
  let sent = 0;

  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    return { sent: 0, errors: ["이메일 SMTP 환경변수가 설정되지 않았습니다."] };
  }

  const subscribers = await prisma.subscriber.findMany({
    where: { active: true, schedule: "immediate" },
  });

  if (subscribers.length === 0) return { sent: 0, errors: [] };

  const transporter = getTransporter();

  for (const sub of subscribers) {
    try {
      const subKeywords = sub.keywords
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean);

      if (subKeywords.length === 0) continue;

      const matched = results.filter((r) =>
        subKeywords.some(
          (kw) => r.title.includes(kw) || r.agency.includes(kw)
        )
      );

      if (matched.length === 0) continue;

      const matchedKeywords = subKeywords.filter((kw) =>
        matched.some((r) => r.title.includes(kw) || r.agency.includes(kw))
      );

      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: sub.email,
        subject: `[나라장터] ${sub.name}님, 관심 키워드 매칭 공고 ${matched.length}건`,
        html: formatResultsHtml(matched, sub.name),
      });

      await prisma.notifyLog.create({
        data: {
          type: "subscriber-email",
          message: `${sub.name}(${sub.email}): ${matchedKeywords.join(",")} → ${matched.length}건`,
          success: true,
        },
      });
      sent++;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      errors.push(`${sub.name}: ${msg}`);
      await prisma.notifyLog.create({
        data: {
          type: "subscriber-email",
          message: `${sub.name}(${sub.email}) 발송 실패: ${msg}`,
          success: false,
        },
      });
    }
  }

  return { sent, errors };
}

export async function sendDigestNotifications(
  scheduleType: "daily" | "weekly"
): Promise<{ sent: number; errors: string[] }> {
  const errors: string[] = [];
  let sent = 0;

  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    return { sent: 0, errors: ["이메일 SMTP 환경변수가 설정되지 않았습니다."] };
  }

  const subscribers = await prisma.subscriber.findMany({
    where: { active: true, schedule: scheduleType },
  });

  if (subscribers.length === 0) return { sent: 0, errors: [] };

  const daysBack = scheduleType === "daily" ? 1 : 7;
  const since = new Date();
  since.setDate(since.getDate() - daysBack);

  const recentResults = await prisma.crawlResult.findMany({
    where: { createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  if (recentResults.length === 0) return { sent: 0, errors: [] };

  const transporter = getTransporter();
  const periodLabel = scheduleType === "daily" ? "일일" : "주간";

  for (const sub of subscribers) {
    try {
      const subKeywords = sub.keywords
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean);

      if (subKeywords.length === 0) continue;

      const matched = recentResults.filter((r) =>
        subKeywords.some(
          (kw) => r.title.includes(kw) || r.agency.includes(kw)
        )
      );

      if (matched.length === 0) continue;

      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: sub.email,
        subject: `[나라장터] ${sub.name}님, ${periodLabel} 요약 - 매칭 공고 ${matched.length}건`,
        html: formatResultsHtml(matched, sub.name),
      });

      await prisma.notifyLog.create({
        data: {
          type: `subscriber-${scheduleType}`,
          message: `${sub.name}(${sub.email}): ${periodLabel} 요약 ${matched.length}건`,
          success: true,
        },
      });
      sent++;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      errors.push(`${sub.name}: ${msg}`);
    }
  }

  return { sent, errors };
}
