import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get("days") || "90");
    const limit = parseInt(searchParams.get("limit") || "20");

    if (days <= 0 || limit <= 0) {
      return NextResponse.json(
        { error: "days와 limit은 양수여야 합니다" },
        { status: 400 }
      );
    }

    const since = new Date();
    since.setDate(since.getDate() - days);

    // 1. CrawlResult에서 기관별 발주 건수
    const crawlResults = await prisma.crawlResult.findMany({
      where: {
        createdAt: { gte: since },
        agency: { not: "" },
      },
    });

    // 기관별 발주 건수 집계
    const agencyPostCounts: Record<
      string,
      { postCount: number; types: Record<string, number>; lastDate: Date }
    > = {};

    crawlResults.forEach((result: typeof crawlResults[0]) => {
      const agency = result.agency || "Unknown";
      if (!agencyPostCounts[agency]) {
        agencyPostCounts[agency] = {
          postCount: 0,
          types: {},
          lastDate: new Date(0),
        };
      }
      agencyPostCounts[agency].postCount++;

      const type = result.type || "other";
      agencyPostCounts[agency].types[type] =
        (agencyPostCounts[agency].types[type] || 0) + 1;

      const resultDate = new Date(result.createdAt);
      if (resultDate > agencyPostCounts[agency].lastDate) {
        agencyPostCounts[agency].lastDate = resultDate;
      }
    });

    // 2. BidResult에서 기관별 낙찰 건수
    const bidResults = await prisma.bidResult.findMany({
      where: {
        createdAt: { gte: since },
        agency: { not: null },
        ranking: 1, // 낙찰자만
      },
    });

    const agencyWinCounts: Record<
      string,
      { winCount: number; winAmount: number }
    > = {};

    bidResults.forEach((result: typeof bidResults[0]) => {
      const agency = result.agency || "Unknown";
      if (!agencyWinCounts[agency]) {
        agencyWinCounts[agency] = { winCount: 0, winAmount: 0 };
      }
      agencyWinCounts[agency].winCount++;

      const amount = result.sucsfbidAmt
        ? parseInt(result.sucsfbidAmt.replace(/[^\d]/g, "")) || 0
        : 0;
      agencyWinCounts[agency].winAmount += amount;
    });

    // 3. 병합 및 정렬
    const agencies = Object.entries(agencyPostCounts)
      .map(([name, postData]) => ({
        agencyName: name,
        postCount: postData.postCount,
        typeBreakdown: postData.types,
        winCount: agencyWinCounts[name]?.winCount || 0,
        winAmount: agencyWinCounts[name]?.winAmount || 0,
        lastActivityDate: postData.lastDate.toISOString().split("T")[0],
        conversionRate:
          postData.postCount > 0
            ? (
                ((agencyWinCounts[name]?.winCount || 0) / postData.postCount) *
                100
              ).toFixed(2)
            : "0.00",
      }))
      .sort((a, b) => b.postCount - a.postCount)
      .slice(0, limit);

    return NextResponse.json({
      period: {
        from: since.toISOString().split("T")[0],
        to: new Date().toISOString().split("T")[0],
        days,
      },
      agencies,
      summary: {
        totalAgencies: agencies.length,
        totalPosts: crawlResults.length,
        totalWins: bidResults.length,
      },
    });
  } catch (error) {
    console.error("기관별 발주 분석 API 오류:", error);
    return NextResponse.json(
      { error: "기관별 발주 분석 조회에 실패했습니다" },
      { status: 500 }
    );
  }
}
