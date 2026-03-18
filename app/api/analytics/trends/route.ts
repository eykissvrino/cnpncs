import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get("days") || "90");

    if (days <= 0) {
      return NextResponse.json(
        { error: "days는 양수여야 합니다" },
        { status: 400 }
      );
    }

    const since = new Date();
    since.setDate(since.getDate() - days);

    // 월별 발주 및 수주 현황
    const crawlResults = await prisma.crawlResult.findMany({
      where: {
        createdAt: { gte: since },
      },
      select: {
        createdAt: true,
      },
    });

    const bidResults = await prisma.bidResult.findMany({
      where: {
        createdAt: { gte: since },
        ranking: 1, // 낙찰자만
      },
      select: {
        createdAt: true,
        sucsfbidAmt: true,
      },
    });

    // 월/일별로 집계
    const trendData: Record<
      string,
      {
        posts: number;
        wins: number;
        winAmount: number;
      }
    > = {};

    crawlResults.forEach((result: typeof crawlResults[0]) => {
      const date = new Date(result.createdAt);
      const key = date.toISOString().split("T")[0]; // YYYY-MM-DD

      if (!trendData[key]) {
        trendData[key] = { posts: 0, wins: 0, winAmount: 0 };
      }
      trendData[key].posts++;
    });

    bidResults.forEach((result: typeof bidResults[0]) => {
      const date = new Date(result.createdAt);
      const key = date.toISOString().split("T")[0];

      if (!trendData[key]) {
        trendData[key] = { posts: 0, wins: 0, winAmount: 0 };
      }
      trendData[key].wins++;

      const amount = result.sucsfbidAmt
        ? parseInt(result.sucsfbidAmt.replace(/[^\d]/g, "")) || 0
        : 0;
      trendData[key].winAmount += amount;
    });

    const trends = Object.entries(trendData)
      .map(([date, data]) => ({
        date,
        posts: data.posts,
        wins: data.wins,
        winAmount: data.winAmount,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // 통계 계산
    const totalPosts = crawlResults.length;
    const totalWins = bidResults.length;
    const totalWinAmount = bidResults.reduce((sum: number, result: typeof bidResults[0]) => {
      const amount = result.sucsfbidAmt
        ? parseInt(result.sucsfbidAmt.replace(/[^\d]/g, "")) || 0
        : 0;
      return sum + amount;
    }, 0);

    const avgPostsPerDay =
      days > 0 ? Math.round(totalPosts / days) : totalPosts;
    const matchRate =
      totalPosts > 0 ? ((totalWins / totalPosts) * 100).toFixed(2) : "0.00";

    return NextResponse.json({
      period: {
        from: since.toISOString().split("T")[0],
        to: new Date().toISOString().split("T")[0],
        days,
      },
      trends,
      summary: {
        totalPosts,
        totalWins,
        totalWinAmount,
        avgPostsPerDay,
        matchRate: parseFloat(matchRate),
      },
    });
  } catch (error) {
    console.error("트렌드 분석 API 오류:", error);
    return NextResponse.json(
      { error: "트렌드 분석 조회에 실패했습니다" },
      { status: 500 }
    );
  }
}
