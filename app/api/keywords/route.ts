import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const keywords = await prisma.keyword.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { results: true } },
      },
    });
    return NextResponse.json(keywords);
  } catch (error) {
    return NextResponse.json({ error: "키워드 조회 실패" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name } = await request.json() as { name: string };
    if (!name?.trim()) {
      return NextResponse.json({ error: "키워드 이름이 필요합니다." }, { status: 400 });
    }
    const keyword = await prisma.keyword.create({
      data: { name: name.trim() },
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
    const { id, active } = await request.json() as { id: number; active: boolean };
    const keyword = await prisma.keyword.update({
      where: { id },
      data: { active },
    });
    return NextResponse.json(keyword);
  } catch {
    return NextResponse.json({ error: "키워드 수정 실패" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = parseInt(searchParams.get("id") || "");
    if (isNaN(id)) {
      return NextResponse.json({ error: "id 파라미터가 필요합니다." }, { status: 400 });
    }
    await prisma.crawlResult.deleteMany({ where: { keywordId: id } });
    await prisma.keyword.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "키워드 삭제 실패" }, { status: 500 });
  }
}
