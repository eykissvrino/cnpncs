import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/db";

// 모닝브리프용 읽기 전용 API (x-brief-secret 헤더 인증)
// - 최근 N시간 동안 새로 수집된 입찰공고·사전규격·발주계획을 반환
// - isNew/notified 플래그는 건드리지 않음 (대시보드 신규 표시 유지)

const TYPE_LABEL: Record<string, string> = {
  bid: "입찰공고",
  prespec: "사전규격",
  order: "발주계획",
};

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.BRIEF_SECRET;
  const header = request.headers.get("x-brief-secret");
  if (!secret || !header) return false;
  const a = Buffer.from(secret);
  const b = Buffer.from(header);
  return a.length === b.length && timingSafeEqual(a, b);
}

// 기본 조회 구간: 월요일은 주말 포함 72시간, 그 외 24시간 (KST 기준)
function defaultHours(): number {
  const kstDay = new Date(Date.now() + 9 * 60 * 60 * 1000).getUTCDay();
  return kstDay === 1 ? 72 : 24;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const hoursParam = parseInt(searchParams.get("hours") || "", 10);
    const hours = !isNaN(hoursParam) && hoursParam > 0 && hoursParam <= 24 * 14 ? hoursParam : defaultHours();
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    // username 지정 시 해당 계정 키워드만, 없으면 전체 활성 키워드
    const username = searchParams.get("username")?.trim();
    const keywords = await prisma.keyword.findMany({
      where: username ? { active: true, user: { username } } : { active: true },
    });
    const keywordNames = [...new Set(keywords.map((k: typeof keywords[0]) => k.name))];

    const items = await prisma.crawlResult.findMany({
      where: { createdAt: { gte: since }, type: { in: Object.keys(TYPE_LABEL) } },
      orderBy: { createdAt: "desc" },
      take: 2000,
    });

    const mapped = items.map((item: typeof items[0]) => ({
      type: item.type,
      typeLabel: TYPE_LABEL[item.type] ?? item.type,
      title: item.title,
      agency: item.agency,
      budget: item.budget || "-",
      postDate: item.postDate,
      deadline: item.deadline || "-",
      url: item.url || "",
      matchedKeywords: keywordNames.filter((kw) => item.title.includes(kw) || item.agency.includes(kw)),
    }));

    const matched = mapped.filter((m: typeof mapped[0]) => m.matchedKeywords.length > 0);
    const others = mapped.filter((m: typeof mapped[0]) => m.matchedKeywords.length === 0);

    const countByType = (list: typeof mapped) =>
      Object.fromEntries(Object.values(TYPE_LABEL).map((label) => [label, list.filter((m) => m.typeLabel === label).length]));

    const lastItem = await prisma.crawlResult.findFirst({ orderBy: { createdAt: "desc" } });

    return NextResponse.json({
      since: since.toISOString(),
      hours,
      username: username || null,
      lastCrawledAt: lastItem?.createdAt?.toISOString() ?? null,
      keywords: keywordNames,
      totals: { all: mapped.length, matched: matched.length, byType: countByType(mapped) },
      matched,
      // 키워드 미매칭 공고는 분량 제한 (요약용)
      others: others.slice(0, 300),
      othersTruncated: others.length > 300,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "브리프 조회 실패";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
