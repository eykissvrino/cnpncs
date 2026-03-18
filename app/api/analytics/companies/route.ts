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

    // 1. Company 모델에서 상위 기업 조회 (전체 랭킹)
    const companies = await prisma.company.findMany({
      orderBy: { totalWins: "desc" },
      take: limit,
    });

    // 2. 최근 기간 내 수주 현황
    const recentResults = await prisma.bidResult.findMany({
      where: {
        createdAt: { gte: since },
        companyName: { not: null },
        ranking: 1, // 낙찰자만 필터
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    // 기업별로 그룹화
    const groupedByCompany: Record<
      string,
      { count: number; winAmount: number; lastDate: Date }
    > = {};

    recentResults.forEach((result: typeof recentResults[0]) => {
      const company = result.companyName || "Unknown";
      if (!groupedByCompany[company]) {
        groupedByCompany[company] = { count: 0, winAmount: 0, lastDate: new Date(0) };
      }
      groupedByCompany[company].count++;

      const amount = result.sucsfbidAmt
        ? parseInt(result.sucsfbidAmt.replace(/[^\d]/g, "")) || 0
        : 0;
      groupedByCompany[company].winAmount += amount;

      const resultDate = new Date(result.createdAt);
      if (resultDate > groupedByCompany[company].lastDate) {
        groupedByCompany[company].lastDate = resultDate;
      }
    });

    const recentCompanies = Object.entries(groupedByCompany)
      .map(([name, data]) => ({
        companyName: name,
        recentWins: data.count,
        totalWinAmount: data.winAmount,
        lastWinDate: data.lastDate.toISOString().split("T")[0],
      }))
      .sort((a, b) => b.recentWins - a.recentWins)
      .slice(0, limit);

    return NextResponse.json({
      period: {
        from: since.toISOString().split("T")[0],
        to: new Date().toISOString().split("T")[0],
        days,
      },
      allTimeTopCompanies: companies,
      recentPeriodCompanies: recentCompanies,
    });
  } catch (error) {
    console.error("기업별 수주 분석 API 오류:", error);
    return NextResponse.json(
      { error: "기업별 수주 분석 조회에 실패했습니다" },
      { status: 500 }
    );
  }
}
