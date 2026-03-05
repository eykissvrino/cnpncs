import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { subscriberCreateSchema, subscriberUpdateSchema } from "@/lib/validators";
import { z } from "zod";

export async function GET() {
  const subscribers = await prisma.subscriber.findMany({
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(subscribers);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = subscriberCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "입력값을 확인해주세요." },
      { status: 400 }
    );
  }

  try {
    const subscriber = await prisma.subscriber.create({ data: parsed.data });
    return NextResponse.json(subscriber, { status: 201 });
  } catch (error) {
    if (String(error).includes("Unique constraint")) {
      return NextResponse.json(
        { error: "이미 등록된 이메일입니다." },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "구독자 등록 실패" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const parsed = subscriberUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "입력값을 확인해주세요." },
      { status: 400 }
    );
  }

  const { id, ...data } = parsed.data;
  try {
    const subscriber = await prisma.subscriber.update({
      where: { id },
      data,
    });
    return NextResponse.json(subscriber);
  } catch {
    return NextResponse.json({ error: "구독자 수정 실패" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const idParsed = z.coerce.number().int().positive().safeParse(searchParams.get("id"));
  if (!idParsed.success) {
    return NextResponse.json({ error: "유효하지 않은 ID입니다." }, { status: 400 });
  }

  try {
    await prisma.subscriber.delete({ where: { id: idParsed.data } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "구독자 삭제 실패" }, { status: 500 });
  }
}
