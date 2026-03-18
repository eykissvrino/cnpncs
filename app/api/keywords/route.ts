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

async function getUserRole(userId: number): Promise<string | null> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  return user?.role ?? null;
}

export async function GET(request: NextRequest) {
  try {
    const userId = getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const role = await getUserRole(userId);
    let whereClause: any = {};

    // admin은 모든 키워드 반환, user는 자신의 키워드만
    if (role !== "admin") {
      whereClause = { userId };
    }

    const keywords = await prisma.keyword.findMany({
      where: whereClause,
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
    if (!userId) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const body = await request.json();
    const parsed = keywordCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "잘못된 요청입니다." },
        { status: 400 }
      );
    }

    const role = await getUserRole(userId);
    let targetUserId = userId;

    // admin이 targetUserId를 지정하면 해당 사용자에게 할당
    if (role === "admin" && "targetUserId" in body && body.targetUserId) {
      targetUserId = body.targetUserId;
    }

    const keyword = await prisma.keyword.create({
      data: { name: parsed.data.name, userId: targetUserId },
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
    const userId = getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const body = await request.json();
    const parsed = keywordPatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "잘못된 요청입니다." },
        { status: 400 }
      );
    }

    // 권한 확인
    const role = await getUserRole(userId);
    const keyword = await prisma.keyword.findUnique({ where: { id: parsed.data.id } });

    if (!keyword) {
      return NextResponse.json({ error: "키워드를 찾을 수 없습니다." }, { status: 404 });
    }

    // admin이 아니면 자신의 키워드만 수정 가능
    if (role !== "admin" && keyword.userId !== userId) {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
    }

    const updated = await prisma.keyword.update({
      where: { id: parsed.data.id },
      data: { active: parsed.data.active },
    });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "키워드 수정 실패" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const userId = getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const idParsed = z.coerce.number().int().positive().safeParse(searchParams.get("id"));
    if (!idParsed.success) {
      return NextResponse.json({ error: "올바른 id가 필요합니다." }, { status: 400 });
    }

    const id = idParsed.data;
    const role = await getUserRole(userId);
    const keyword = await prisma.keyword.findUnique({ where: { id } });

    if (!keyword) {
      return NextResponse.json({ error: "키워드를 찾을 수 없습니다." }, { status: 404 });
    }

    // admin이 아니면 자신의 키워드만 삭제 가능
    if (role !== "admin" && keyword.userId !== userId) {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
    }

    await prisma.crawlResult.deleteMany({ where: { keywordId: id } });
    await prisma.keyword.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "키워드 삭제 실패" }, { status: 500 });
  }
}
