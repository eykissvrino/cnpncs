import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    // 관리자 권한 확인
    const userRole = request.headers.get("x-user-role");
    if (userRole !== "admin") {
      return NextResponse.json(
        { error: "관리자 권한이 필요합니다" },
        { status: 403 }
      );
    }

    const days = parseInt(request.nextUrl.searchParams.get("days") || "30");

    if (days <= 0) {
      return NextResponse.json(
        { error: "days는 양수여야 합니다" },
        { status: 400 }
      );
    }

    const since = new Date();
    since.setDate(since.getDate() - days);

    // 1. 사용자별 접속 통계
    const accessLogs = await prisma.accessLog.findMany({
      where: {
        createdAt: { gte: since },
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            name: true,
            department: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const userAccessStats: Record<
      number,
      {
        userId: number;
        username: string;
        name: string;
        department: string;
        role: string;
        accessCount: number;
        actions: Record<string, number>;
        lastAccessDate: string;
      }
    > = {};

    accessLogs.forEach((log: typeof accessLogs[0]) => {
      const userId = log.userId;
      if (!userAccessStats[userId]) {
        userAccessStats[userId] = {
          userId: log.user.id,
          username: log.user.username,
          name: log.user.name,
          department: log.user.department,
          role: log.user.role,
          accessCount: 0,
          actions: {},
          lastAccessDate: "",
        };
      }

      userAccessStats[userId].accessCount++;
      const action = log.action || "other";
      userAccessStats[userId].actions[action] =
        (userAccessStats[userId].actions[action] || 0) + 1;

      const logDate = log.createdAt.toISOString().split("T")[0];
      if (
        !userAccessStats[userId].lastAccessDate ||
        logDate > userAccessStats[userId].lastAccessDate
      ) {
        userAccessStats[userId].lastAccessDate = logDate;
      }
    });

    // 2. 일별 접속 현황 (로그인 기준)
    const dailyLoginStats: Record<string, number> = {};

    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split("T")[0];
      dailyLoginStats[dateStr] = 0;
    }

    accessLogs
      .filter((log: typeof accessLogs[0]) => log.action === "login")
      .forEach((log: typeof accessLogs[0]) => {
        const dateStr = log.createdAt.toISOString().split("T")[0];
        dailyLoginStats[dateStr]++;
      });

    const dailyLogins = Object.entries(dailyLoginStats)
      .sort(([dateA], [dateB]) => dateB.localeCompare(dateA)) // 최근순
      .slice(0, days)
      .map(([date, count]) => ({ date, loginCount: count }));

    // 3. 검색 키워드 빈도
    const searchLogs = accessLogs.filter(
      (log: typeof accessLogs[0]) => log.action === "search"
    );
    const keywordFrequency: Record<string, number> = {};

    searchLogs.forEach((log: typeof accessLogs[0]) => {
      const keyword = log.detail || "no_detail";
      keywordFrequency[keyword] = (keywordFrequency[keyword] || 0) + 1;
    });

    const topKeywords = Object.entries(keywordFrequency)
      .map(([keyword, frequency]) => ({ keyword, frequency }))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 20);

    // 4. 전체 사용자 활동 요약
    const allUsers = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        active: true,
        loginCount: true,
        lastLoginAt: true,
        createdAt: true,
      },
      orderBy: { loginCount: "desc" },
    });

    const activeUsers = Object.values(userAccessStats).length;
    const totalActions = accessLogs.length;
    const actionBreakdown: Record<string, number> = {};

    accessLogs.forEach((log: typeof accessLogs[0]) => {
      const action = log.action || "other";
      actionBreakdown[action] = (actionBreakdown[action] || 0) + 1;
    });

    return NextResponse.json({
      period: {
        from: since.toISOString().split("T")[0],
        to: new Date().toISOString().split("T")[0],
        days,
      },
      summary: {
        totalUsers: allUsers.length,
        activeUsersInPeriod: activeUsers,
        totalActions,
        actionBreakdown,
        topAction: Object.entries(actionBreakdown).sort(([, a], [, b]) =>
          b - a
        )[0],
      },
      userAccessStats: Object.values(userAccessStats).sort(
        (a, b) => b.accessCount - a.accessCount
      ),
      dailyLogins: dailyLogins.reverse(), // 오래된 순으로 정렬
      topSearchKeywords: topKeywords,
      allUsers,
    });
  } catch (error) {
    console.error("관리자 이용 현황 API 오류:", error);
    return NextResponse.json(
      { error: "관리자 이용 현황 조회에 실패했습니다" },
      { status: 500 }
    );
  }
}
