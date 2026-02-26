import { NextRequest, NextResponse } from "next/server";
import { searchBidAnnouncements, searchPreSpecs, searchOrderPlans } from "@/lib/narajan-api";
import { prisma } from "@/lib/db";
import type { UnifiedResult } from "@/types/narajan";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const keyword = searchParams.get("keyword")?.trim();
  const page = parseInt(searchParams.get("page") || "1");

  if (!keyword) {
    return NextResponse.json({ error: "keyword 파라미터가 필요합니다." }, { status: 400 });
  }

  try {
    // ① DB에서 먼저 검색 (title LIKE '%keyword%')
    const dbResults = await prisma.crawlResult.findMany({
      where: {
        OR: [
          { title: { contains: keyword } },
          { agency: { contains: keyword } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    const dbMapped: UnifiedResult[] = dbResults.map((r) => ({
      id: r.bidNumber || String(r.id),
      type: r.type as "bid" | "prespec" | "order",
      typeLabel: r.type === "bid" ? "입찰공고" : r.type === "prespec" ? "사전규격" : "발주계획",
      title: r.title,
      agency: r.agency,
      budget: r.budget || "-",
      postDate: r.postDate,
      deadline: r.deadline || "-",
      url: r.url || "",
      rawData: r.rawData,
    }));

    const dbBid = dbMapped.filter((r) => r.type === "bid");
    const dbPrespec = dbMapped.filter((r) => r.type === "prespec");
    const dbOrder = dbMapped.filter((r) => r.type === "order");

    // ② DB에 데이터가 충분하면 DB 결과만 반환, 아니면 실시간 API도 호출
    const dbTotal = dbMapped.length;

    if (dbTotal >= 10) {
      // DB에 충분한 데이터 → 바로 반환
      return NextResponse.json({
        bid: dbBid,
        prespec: dbPrespec,
        order: dbOrder,
        total: dbTotal,
        source: "db",
      });
    }

    // ③ DB에 데이터 부족 → 실시간 API 호출 (100건 제한 있음)
    const [bidResult, prespecResult, orderResult] = await Promise.allSettled([
      searchBidAnnouncements(keyword, page),
      searchPreSpecs(keyword, page),
      searchOrderPlans(keyword, page),
    ]);

    const apiBid = bidResult.status === "fulfilled" ? bidResult.value : [];
    const apiPrespec = prespecResult.status === "fulfilled" ? prespecResult.value : [];
    const apiOrder = orderResult.status === "fulfilled" ? orderResult.value : [];

    // ④ DB 결과 + API 결과 합치기 (id 기준 중복 제거)
    const existingIds = new Set(dbMapped.map((r) => r.id));
    const newFromApi = [...apiBid, ...apiPrespec, ...apiOrder].filter(
      (r) => !existingIds.has(r.id)
    );

    const bid = [...dbBid, ...apiBid.filter((r) => !existingIds.has(r.id))];
    const prespec = [...dbPrespec, ...apiPrespec.filter((r) => !existingIds.has(r.id))];
    const order = [...dbOrder, ...apiOrder.filter((r) => !existingIds.has(r.id))];

    // ⑤ 새 API 결과를 DB에 저장 (다음 검색 때 활용)
    for (const item of newFromApi) {
      try {
        await prisma.crawlResult.upsert({
          where: { bidNumber: item.id },
          update: {},
          create: {
            type: item.type,
            title: item.title,
            agency: item.agency,
            budget: item.budget,
            deadline: item.deadline !== "-" ? item.deadline : null,
            postDate: item.postDate,
            bidNumber: item.id,
            url: item.url || null,
            rawData: item.rawData,
            isNew: true,
            notified: false,
            // keywordId 없음 (전체 저장)
          },
        });
      } catch {
        // 중복 무시
      }
    }

    return NextResponse.json({
      bid,
      prespec,
      order,
      total: bid.length + prespec.length + order.length,
      source: "api",
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "검색 중 오류가 발생했습니다.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
