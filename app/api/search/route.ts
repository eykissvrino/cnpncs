import { NextRequest, NextResponse } from "next/server";
import { searchBidAnnouncements, searchPreSpecs, searchOrderPlans, searchBidResults } from "@/lib/narajan-api";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import type { UnifiedResult } from "@/types/narajan";

export async function GET(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") || "unknown";
  const { allowed } = rateLimit(`search:${ip}`, 10, 60_000);
  if (!allowed) {
    return NextResponse.json({ error: "요청이 너무 빈번합니다. 잠시 후 다시 시도해주세요." }, { status: 429 });
  }

  const { searchParams } = new URL(request.url);
  const keyword = searchParams.get("keyword")?.trim();
  const page = parseInt(searchParams.get("page") || "1");

  if (!keyword) {
    return NextResponse.json({ error: "keyword 파라미터가 필요합니다." }, { status: 400 });
  }

  try {
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

    const dbMapped: UnifiedResult[] = dbResults.map((r: typeof dbResults[0]) => ({
      id: r.bidNumber || String(r.id),
      type: r.type as "bid" | "prespec" | "order" | "bidresult",
      typeLabel: r.type === "bid" ? "입찰공고" : r.type === "prespec" ? "사전규격" : r.type === "order" ? "발주계획" : "개찰결과",
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
    const dbBidResult = dbMapped.filter((r) => r.type === "bidresult");

    const dbTotal = dbMapped.length;

    if (dbTotal >= 10) {
      return NextResponse.json({
        bid: dbBid,
        prespec: dbPrespec,
        order: dbOrder,
        bidresult: dbBidResult,
        total: dbTotal,
        source: "db",
      });
    }

    const [bidResult, prespecResult, orderResult, bidResultResult] = await Promise.allSettled([
      searchBidAnnouncements(keyword, page),
      searchPreSpecs(keyword, page),
      searchOrderPlans(keyword, page),
      searchBidResults(keyword, page),
    ]);

    const apiBid = bidResult.status === "fulfilled" ? bidResult.value : [];
    const apiPrespec = prespecResult.status === "fulfilled" ? prespecResult.value : [];
    const apiOrder = orderResult.status === "fulfilled" ? orderResult.value : [];
    const apiBidResult = bidResultResult.status === "fulfilled" ? bidResultResult.value : [];

    const existingIds = new Set(dbMapped.map((r) => r.id));
    const newFromApi = [...apiBid, ...apiPrespec, ...apiOrder, ...apiBidResult].filter(
      (r) => !existingIds.has(r.id)
    );

    const bid = [...dbBid, ...apiBid.filter((r) => !existingIds.has(r.id))];
    const prespec = [...dbPrespec, ...apiPrespec.filter((r) => !existingIds.has(r.id))];
    const order = [...dbOrder, ...apiOrder.filter((r) => !existingIds.has(r.id))];
    const bidresult = [...dbBidResult, ...apiBidResult.filter((r) => !existingIds.has(r.id))];

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
      bidresult,
      total: bid.length + prespec.length + order.length + bidresult.length,
      source: "api",
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "검색 중 오류가 발생했습니다.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
