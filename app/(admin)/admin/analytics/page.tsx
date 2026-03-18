"use client";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Users, Search, Calendar, Loader2 } from "lucide-react";
import axios from "axios";

interface DailyStat {
  date: string;
  visits: number;
  uniqueUsers: number;
  searches: number;
}

interface UserStat {
  userId: string;
  email: string;
  department: string;
  lastVisit: string;
  totalVisits: number;
}

interface TopKeyword {
  keyword: string;
  count: number;
}

interface AdminAnalytics {
  summary?: {
    todayVisits: number;
    thisWeekVisits: number;
    totalSearches: number;
  };
  dailyStats?: DailyStat[];
  userStats?: UserStat[];
  topKeywords?: TopKeyword[];
}

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<AdminAnalytics>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await axios.get("/api/admin/analytics?days=30");
        setData(response.data);
      } catch (error) {
        console.error("관리자 분석 데이터 로드 실패:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const StatCard = ({
    icon: Icon,
    label,
    value,
    color = "blue",
  }: {
    icon: any;
    label: string;
    value: number;
    color?: string;
  }) => {
    const colorClass =
      color === "blue"
        ? "text-blue-500"
        : color === "emerald"
          ? "text-emerald-500"
          : "text-amber-500";

    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {label}
            </CardTitle>
            <Icon className={`h-4 w-4 ${colorClass}`} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{value.toLocaleString()}</div>
        </CardContent>
      </Card>
    );
  };

  // 간단한 라인 차트 (SVG)
  const SimpleDailyChart = ({ data: chartData }: { data: DailyStat[] | undefined }) => {
    if (!chartData || chartData.length === 0) {
      return (
        <div className="h-64 flex items-center justify-center rounded-lg border-2 border-dashed border-muted">
          <p className="text-muted-foreground">데이터가 없습니다</p>
        </div>
      );
    }

    const maxVisits = Math.max(...chartData.map((d) => d.visits || 1));
    const chartHeight = 250;
    const chartWidth = Math.max(800, chartData.length * 30);
    const padding = 40;

    const getPointsPath = (values: number[], max: number) => {
      const points = values
        .map((v, idx) => {
          const x = (idx / (values.length - 1 || 1)) * (chartWidth - padding * 2) + padding;
          const y = chartHeight - (v / max) * chartHeight + padding;
          return `${x},${y}`;
        })
        .join(" ");
      return points;
    };

    return (
      <div className="overflow-x-auto pb-4">
        <svg width={chartWidth} height={chartHeight + 80} className="mx-auto">
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((pos, idx) => (
            <line
              key={idx}
              x1={padding}
              y1={chartHeight - chartHeight * pos + padding}
              x2={chartWidth - padding}
              y2={chartHeight - chartHeight * pos + padding}
              stroke="#e5e7eb"
              strokeDasharray="3,3"
            />
          ))}

          {/* Visits line */}
          <polyline
            points={getPointsPath(
              chartData.map((d) => d.visits),
              maxVisits
            )}
            fill="none"
            stroke="#3b82f6"
            strokeWidth="2"
          />

          {/* Unique Users line */}
          <polyline
            points={getPointsPath(
              chartData.map((d) => d.uniqueUsers),
              maxVisits
            )}
            fill="none"
            stroke="#10b981"
            strokeWidth="2"
          />

          {/* Searches line */}
          <polyline
            points={getPointsPath(
              chartData.map((d) => d.searches),
              maxVisits
            )}
            fill="none"
            stroke="#f59e0b"
            strokeWidth="2"
          />

          {/* X-axis labels */}
          {chartData.map((d, idx) => {
            if (idx % Math.ceil(chartData.length / 8) === 0) {
              const x = (idx / (chartData.length - 1 || 1)) * (chartWidth - padding * 2) + padding;
              return (
                <text
                  key={`label-${idx}`}
                  x={x}
                  y={chartHeight + padding + 20}
                  textAnchor="middle"
                  fontSize="10"
                  fill="#666"
                >
                  {d.date.substring(5)}
                </text>
              );
            }
            return null;
          })}

          {/* Legend */}
          <rect x={padding} y={padding - 30} width={300} height={25} fill="#f9fafb" rx={4} />
          <circle cx={padding + 10} cy={padding - 17} r={3} fill="#3b82f6" />
          <text x={padding + 18} y={padding - 12} fontSize="12" fill="#333">
            총 접속
          </text>
          <circle cx={padding + 100} cy={padding - 17} r={3} fill="#10b981" />
          <text x={padding + 108} y={padding - 12} fontSize="12" fill="#333">
            사용자수
          </text>
          <circle cx={padding + 200} cy={padding - 17} r={3} fill="#f59e0b" />
          <text x={padding + 208} y={padding - 12} fontSize="12" fill="#333">
            검색수
          </text>
        </svg>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* 페이지 헤더 */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          관리자 이용 현황
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          사용자 활동 및 검색 현황을 모니터링합니다
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* 활동 요약 카드 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <StatCard
              icon={Calendar}
              label="오늘 접속수"
              value={data.summary?.todayVisits || 0}
              color="blue"
            />
            <StatCard
              icon={Users}
              label="이번주 접속수"
              value={data.summary?.thisWeekVisits || 0}
              color="emerald"
            />
            <StatCard
              icon={Search}
              label="총 검색수"
              value={data.summary?.totalSearches || 0}
              color="amber"
            />
          </div>

          {/* 일별 접속 현황 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                일별 접속 현황 (지난 30일)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <SimpleDailyChart data={data.dailyStats} />
            </CardContent>
          </Card>

          {/* 사용자별 접속 현황 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                사용자별 접속 현황 (상위 20명)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-semibold">
                        순위
                      </th>
                      <th className="text-left py-3 px-4 font-semibold">
                        이름/이메일
                      </th>
                      <th className="text-left py-3 px-4 font-semibold">
                        부서
                      </th>
                      <th className="text-left py-3 px-4 font-semibold">
                        최근 접속
                      </th>
                      <th className="text-right py-3 px-4 font-semibold">
                        총 접속횟수
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.userStats && data.userStats.length > 0 ? (
                      data.userStats.map((user, index) => (
                        <tr key={index} className="border-b hover:bg-muted/50">
                          <td className="py-3 px-4">
                            <Badge variant="outline">{index + 1}</Badge>
                          </td>
                          <td className="py-3 px-4 font-medium">
                            {user.email}
                          </td>
                          <td className="py-3 px-4 text-muted-foreground">
                            {user.department}
                          </td>
                          <td className="py-3 px-4 text-sm">
                            {user.lastVisit}
                          </td>
                          <td className="text-right py-3 px-4 font-semibold">
                            {user.totalVisits}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-muted-foreground">
                          데이터가 없습니다
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* 인기 검색 키워드 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-4 w-4" />
                인기 검색 키워드 (상위 10개)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.topKeywords && data.topKeywords.length > 0 ? (
                  data.topKeywords.map((keyword, index) => (
                    <div
                      key={index}
                      className="p-4 rounded-lg border border-muted bg-muted/50 hover:bg-muted"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-sm">
                          {keyword.keyword}
                        </span>
                        <Badge className="bg-blue-500">{keyword.count}</Badge>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div
                          className="bg-blue-500 h-2 rounded-full"
                          style={{
                            width: `${
                              (keyword.count /
                                (data.topKeywords?.[0]?.count || 1)) *
                              100
                            }%`,
                          }}
                        />
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="col-span-full py-12 text-center text-muted-foreground">
                    검색 데이터가 없습니다
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
