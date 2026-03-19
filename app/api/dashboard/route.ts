import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

async function getUserRole(userId: number): Promise<string | null> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  return user?.role ?? null;
}

export async function GET(request: NextRequest) {
  try {
    const userIdHeader = request.headers.get("x-user-id");
    const userId = userIdHeader ? parseInt(userIdHeader, 10) : null;

    if (!userId) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const role = await getUserRole(userId);
    let whereClause: any = { active: true };

    // admin이 아니면 자신의 키워드만 조회
    if (role !== "admin") {
      whereClause = { active: true, userId };
    }

    // 저장된 활성 키워드 조회 (사용자별)
    const keywords = await prisma.keyword.findMany({
      where: whereClause,
      orderBy: { createdAt: "asc" },
    });

    // 각 키워드별로 DB에서 매칭 결과 조회 (입찰공고 + 발주계획)
    const keywordResults = await Promise.all(
      keywords.map(async (kw: typeof keywords[0]) => {
        const items = await prisma.crawlResult.findMany({
          where: {
            keywordId: kw.id,
            type: { in: ["bid", "order", "prespec"] },
            OR: [
              { title: { contains: kw.name } },
              { agency: { contains: kw.name } },
            ],
          },
          orderBy: { postDate: "desc" },
          take: 100,
        });
        return {
          keyword: kw.name,
          keywordId: kw.id,
          items,
          newCount: items.filter((i: typeof items[0]) => i.isNew).length,
        };
      })
    );

    // 마지막 크롤링 시각 (가장 최근 저장된 항목 기준, 사용자의 키워드에만 한정)
    const lastItem = await prisma.crawlResult.findFirst({
      where: {
        keyword: {
          id: { in: keywords.map((k: typeof keywords[0]) => k.id) },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // 전체 신규 건수
    const totalNew = keywordResults.reduce((sum, r) => sum + r.newCount, 0);

    // 조회 후 isNew 플래그 해제 (해당 사용자의 키워드에만)
    if (totalNew > 0) {
      await prisma.crawlResult.updateMany({
        where: {
          isNew: true,
          keyword: {
            id: { in: keywords.map((k: typeof keywords[0]) => k.id) },
          },
        },
        data: { isNew: false },
      });
    }

    // 전체 수집 건수 (키워드 매칭 여부 무관)
    const dbTotal = await prisma.crawlResult.count();

    return NextResponse.json({
      keywords: keywords.map((k: typeof keywords[0]) => ({ id: k.id, name: k.name })),
      results: keywordResults.map((r) => ({
        keyword: r.keyword,
        keywordId: r.keywordId,
        newCount: r.newCount,
        items: r.items.map((item: typeof r.items[0]) => ({
          id: item.bidNumber || String(item.id),
          type: item.type,
          typeLabel: item.type === "bid" ? "입찰공고" : item.type === "prespec" ? "사전규격" : "발주계획",
          title: item.title,
          agency: item.agency,
          budget: item.budget || "-",
          postDate: item.postDate,
          deadline: item.deadline || "-",
          url: item.url || "",
          isNew: item.isNew,
          rawData: item.rawData,
        })),
      })),
      lastCrawledAt: lastItem?.createdAt?.toISOString() ?? null,
      totalNew,
      dbTotal,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "대시보드 조회 실패";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
