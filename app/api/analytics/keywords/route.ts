import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = parseInt(searchParams.get("userId") || "-1");
    const days = parseInt(searchParams.get("days") || "90");
    const limit = parseInt(searchParams.get("limit") || "10");

    if (days <= 0 || limit <= 0) {
      return NextResponse.json(
        { error: "days와 limit은 양수여야 합니다" },
        { status: 400 }
      );
    }

    const since = new Date();
    since.setDate(since.getDate() - days);

    // userId가 지정되지 않으면 모든 사용자의 키워드 매칭 분석
    let where: any = {
      keyword: {
        active: true,
      },
      createdAt: { gte: since },
    };

    if (userId > 0) {
      where.keyword.userId = userId;
    }

    // 키워드별 매칭된 CrawlResult 건수
    const keywordMatches = await prisma.crawlResult.findMany({
      where,
      include: {
        keyword: {
          select: {
            id: true,
            name: true,
            userId: true,
            user: {
              select: {
                username: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // 키워드별로 집계
    const keywordStats: Record<
      number,
      {
        keywordId: number;
        keywordName: string;
        userId?: number;
        username?: string;
        userName?: string;
        matchCount: number;
        types: Record<string, number>;
        agencies: Record<string, number>;
        lastMatchDate: Date;
      }
    > = {};

    keywordMatches.forEach((result: typeof keywordMatches[0]) => {
      if (!result.keyword) return;

      const keywordId = result.keyword.id;
      if (!keywordStats[keywordId]) {
        keywordStats[keywordId] = {
          keywordId,
          keywordName: result.keyword.name,
          ...(result.keyword.userId && {
            userId: result.keyword.userId,
            username: result.keyword.user?.username,
            userName: result.keyword.user?.name,
          }),
          matchCount: 0,
          types: {},
          agencies: {},
          lastMatchDate: new Date(0),
        };
      }

      keywordStats[keywordId].matchCount++;

      const type = result.type || "other";
      keywordStats[keywordId].types[type] =
        (keywordStats[keywordId].types[type] || 0) + 1;

      const agency = result.agency || "Unknown";
      keywordStats[keywordId].agencies[agency] =
        (keywordStats[keywordId].agencies[agency] || 0) + 1;

      if (result.createdAt > keywordStats[keywordId].lastMatchDate) {
        keywordStats[keywordId].lastMatchDate = result.createdAt;
      }
    });

    const keywords = Object.values(keywordStats)
      .sort((a, b) => b.matchCount - a.matchCount)
      .slice(0, limit)
      .map((stat) => ({
        ...stat,
        lastMatchDate: stat.lastMatchDate.toISOString().split("T")[0],
      }));

    // 통계
    const totalMatches = keywordMatches.length;
    const uniqueKeywords = Object.keys(keywordStats).length;

    return NextResponse.json({
      period: {
        from: since.toISOString().split("T")[0],
        to: new Date().toISOString().split("T")[0],
        days,
      },
      filter: {
        userId: userId > 0 ? userId : "all",
      },
      summary: {
        totalMatches,
        uniqueKeywords,
        averageMatchPerKeyword:
          uniqueKeywords > 0
            ? (totalMatches / uniqueKeywords).toFixed(2)
            : "0.00",
      },
      keywords,
    });
  } catch (error) {
    console.error("키워드별 매칭 분석 API 오류:", error);
    return NextResponse.json(
      { error: "키워드별 매칭 분석 조회에 실패했습니다" },
      { status: 500 }
    );
  }
}
