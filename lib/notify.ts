import nodemailer from "nodemailer";
import { prisma } from "./db";
import type { CrawlResult } from "@prisma/client";

function formatResultsHtml(results: CrawlResult[]): string {
  const rows = results
    .map(
      (r) => `
      <tr>
        <td style="padding:8px;border:1px solid #ddd;">${r.type === "bid" ? "입찰공고" : r.type === "prespec" ? "사전규격" : "발주계획"}</td>
        <td style="padding:8px;border:1px solid #ddd;">${r.agency}</td>
        <td style="padding:8px;border:1px solid #ddd;">${r.title}</td>
        <td style="padding:8px;border:1px solid #ddd;">${r.budget || "-"}</td>
        <td style="padding:8px;border:1px solid #ddd;">${r.postDate}</td>
        <td style="padding:8px;border:1px solid #ddd;">${r.deadline || "-"}</td>
      </tr>`
    )
    .join("");

  return `
    <html>
    <body style="font-family:sans-serif;">
      <h2>🔔 나라장터 신규 공고 알림</h2>
      <p>${results.length}건의 신규 공고가 발견되었습니다.</p>
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
            text: `*유형:* ${r.type === "bid" ? "입찰공고" : r.type === "prespec" ? "사전규격" : "발주계획"}`,
          },
          { type: "mrkdwn", text: `*기관:* ${r.agency}` },
          { type: "mrkdwn", text: `*사업명:* ${r.title}` },
          { type: "mrkdwn", text: `*예산:* ${r.budget || "-"}` },
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
