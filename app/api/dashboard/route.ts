import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    // 저장된 활성 키워드 조회
    const keywords = await prisma.keyword.findMany({
      where: { active: true },
      orderBy: { createdAt: "asc" },
    });

    // 각 키워드별로 DB에서 매칭 결과 조회 (입찰공고 + 발주계획)
    const keywordResults = await Promise.all(
      keywords.map(async (kw) => {
        const items = await prisma.crawlResult.findMany({
          where: {
            type: { in: ["bid", "order"] },
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
          newCount: items.filter((i) => i.isNew).length,
        };
      })
    );

    // 마지막 크롤링 시각 (가장 최근 저장된 항목 기준)
    const lastItem = await prisma.crawlResult.findFirst({
      orderBy: { createdAt: "desc" },
    });

    // 전체 신규 건수
    const totalNew = keywordResults.reduce((sum, r) => sum + r.newCount, 0);

    // 조회 후 isNew 플래그 해제
    if (totalNew > 0) {
      await prisma.crawlResult.updateMany({
        where: { isNew: true },
        data: { isNew: false },
      });
    }

    return NextResponse.json({
      keywords: keywords.map((k) => ({ id: k.id, name: k.name })),
      results: keywordResults.map((r) => ({
        keyword: r.keyword,
        keywordId: r.keywordId,
        newCount: r.newCount,
        items: r.items.map((item) => ({
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
      dbTotal: await prisma.crawlResult.count(),
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "대시보드 조회 실패";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
