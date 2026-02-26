import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

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
    return NextResponse.json(settings);
  } catch {
    return NextResponse.json({ error: "설정 조회 실패" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const data = await request.json() as {
      emailEnabled?: boolean;
      slackEnabled?: boolean;
      cronSchedule?: string;
    };
    const settings = await prisma.settings.upsert({
      where: { id: 1 },
      update: data,
      create: {
        id: 1,
        emailEnabled: data.emailEnabled ?? false,
        slackEnabled: data.slackEnabled ?? false,
        cronSchedule: data.cronSchedule ?? "0 */2 * * *",
      },
    });
    return NextResponse.json(settings);
  } catch {
    return NextResponse.json({ error: "설정 저장 실패" }, { status: 500 });
  }
}
