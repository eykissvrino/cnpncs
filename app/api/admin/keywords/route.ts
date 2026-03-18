import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { keywordCreateSchema } from "@/lib/validators";
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

async function checkAdminAccess(userId: number): Promise<boolean> {
  const role = await getUserRole(userId);
  return role === "admin";
}

export async function GET(request: NextRequest) {
  try {
    const userId = getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const isAdmin = await checkAdminAccess(userId);
    if (!isAdmin) {
      return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
    }

    // 전체 키워드를 사용자별로 그룹핑하여 반환
    const keywords = await prisma.keyword.findMany({
      orderBy: [{ userId: "asc" }, { createdAt: "desc" }],
      include: {
        user: { select: { id: true, username: true, name: true, department: true } },
        _count: { select: { results: true } },
      },
    });

    // 사용자별로 그룹핑
    type KeywordType = typeof keywords[0];
    type GroupedType = Record<
      number,
      {
        user: KeywordType["user"];
        keywords: Array<{
          id: number;
          name: string;
          active: boolean;
          createdAt: Date;
          resultCount: number;
        }>;
      }
    >;

    const groupedByUser = keywords.reduce((acc: GroupedType, kw: KeywordType) => {
      const userId = kw.userId || 0;
      if (!acc[userId]) {
        acc[userId] = {
          user: kw.user,
          keywords: [],
        };
      }
      acc[userId].keywords.push({
        id: kw.id,
        name: kw.name,
        active: kw.active,
        createdAt: kw.createdAt,
        resultCount: kw._count.results,
      });
      return acc;
    }, {});

    const byUserArray = Object.entries(groupedByUser).map(([userId, data]) => ({
      userId: parseInt(userId, 10),
      user: (data as any).user,
      keywordCount: (data as any).keywords.length,
      keywords: (data as any).keywords,
    }));

    return NextResponse.json({
      total: keywords.length,
      byUser: byUserArray,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "전체 키워드 조회 실패";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const isAdmin = await checkAdminAccess(userId);
    if (!isAdmin) {
      return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
    }

    const body = await request.json();

    // userId와 name이 필요
    if (!("userId" in body) || !("name" in body)) {
      return NextResponse.json(
        { error: "userId와 name이 필요합니다." },
        { status: 400 }
      );
    }

    const userIdParsed = z.coerce.number().int().positive().safeParse(body.userId);
    if (!userIdParsed.success) {
      return NextResponse.json(
        { error: "올바른 userId가 필요합니다." },
        { status: 400 }
      );
    }

    const nameParsed = z.string().min(1).safeParse(body.name);
    if (!nameParsed.success) {
      return NextResponse.json(
        { error: "올바른 name이 필요합니다." },
        { status: 400 }
      );
    }

    const targetUserId = userIdParsed.data;
    const keywordName = nameParsed.data;

    // 해당 사용자가 존재하는지 확인
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
    });
    if (!targetUser) {
      return NextResponse.json({ error: "사용자를 찾을 수 없습니다." }, { status: 404 });
    }

    // 키워드 생성
    const keyword = await prisma.keyword.create({
      data: {
        name: keywordName,
        userId: targetUserId,
      },
      include: {
        user: { select: { id: true, username: true, name: true, department: true } },
      },
    });

    return NextResponse.json(keyword, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "";
    if (msg.includes("Unique constraint")) {
      return NextResponse.json(
        { error: "이미 존재하는 키워드입니다." },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "키워드 추가 실패" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const userId = getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const isAdmin = await checkAdminAccess(userId);
    if (!isAdmin) {
      return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const idParsed = z.coerce.number().int().positive().safeParse(searchParams.get("id"));
    if (!idParsed.success) {
      return NextResponse.json({ error: "올바른 id가 필요합니다." }, { status: 400 });
    }

    const id = idParsed.data;

    // 키워드 존재 확인
    const keyword = await prisma.keyword.findUnique({ where: { id } });
    if (!keyword) {
      return NextResponse.json({ error: "키워드를 찾을 수 없습니다." }, { status: 404 });
    }

    // 관련 결과 먼저 삭제
    await prisma.crawlResult.deleteMany({ where: { keywordId: id } });

    // 키워드 삭제
    await prisma.keyword.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "키워드 삭제 실패";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
