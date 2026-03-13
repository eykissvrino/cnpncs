import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { keywordCreateSchema, keywordPatchSchema } from "@/lib/validators";
import { z } from "zod";

function getUserId(request: NextRequest): number | null {
  const id = request.headers.get("x-user-id");
  if (!id) return null;
  const parsed = parseInt(id, 10);
  return isNaN(parsed) ? null : parsed;
}

export async function GET(request: NextRequest) {
  try {
    const userId = getUserId(request);
    const keywords = await prisma.keyword.findMany({
      where: userId ? { userId } : {},
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { results: true } },
      },
    });
    return NextResponse.json(keywords);
  } catch {
    return NextResponse.json({ error: "키워드 조회 실패" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = getUserId(request);
    const body = await request.json();
    const parsed = keywordCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "잘못된 요청입니다." },
        { status: 400 }
      );
    }

    const keyword = await prisma.keyword.create({
      data: { name: parsed.data.name, userId },
    });
    return NextResponse.json(keyword, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "";
    if (msg.includes("Unique constraint")) {
      return NextResponse.json({ error: "이미 존재하는 키워드입니다." }, { status: 409 });
    }
    return NextResponse.json({ error: "키워드 추가 실패" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = keywordPatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "잘못된 요청입니다." },
        { status: 400 }
      );
    }

    const keyword = await prisma.keyword.update({
      where: { id: parsed.data.id },
      data: { active: parsed.data.active },
    });
    return NextResponse.json(keyword);
  } catch {
    return NextResponse.json({ error: "키워드 수정 실패" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const idParsed = z.coerce.number().int().positive().safeParse(searchParams.get("id"));
    if (!idParsed.success) {
      return NextResponse.json({ error: "올바른 id가 필요합니다." }, { status: 400 });
    }

    const id = idParsed.data;
    await prisma.crawlResult.deleteMany({ where: { keywordId: id } });
    await prisma.keyword.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "키워드 삭제 실패" }, { status: 500 });
  }
}
