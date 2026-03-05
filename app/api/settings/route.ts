import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { settingsUpdateSchema } from "@/lib/validators";

export async function GET() {
  try {
    const settings = await prisma.settings.upsert({
      where: { id: 1 },
      update: {},
      create: {
        id: 1,
        emailEnabled: false,
        slackEnabled: false,
        cronSchedule: "0 */2 * * *",
      },
    });
    return NextResponse.json({
      ...settings,
      emailConfigured: !!(process.env.EMAIL_USER && process.env.EMAIL_PASS),
    });
  } catch {
    return NextResponse.json({ error: "설정 조회 실패" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = settingsUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "잘못된 요청입니다." },
        { status: 400 }
      );
    }

    const settings = await prisma.settings.upsert({
      where: { id: 1 },
      update: parsed.data,
      create: {
        id: 1,
        emailEnabled: parsed.data.emailEnabled ?? false,
        slackEnabled: false,
        cronSchedule: parsed.data.cronSchedule ?? "0 */2 * * *",
      },
    });
    return NextResponse.json(settings);
  } catch {
    return NextResponse.json({ error: "설정 저장 실패" }, { status: 500 });
  }
}
