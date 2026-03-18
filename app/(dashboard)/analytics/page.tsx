"use client";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Building2, Users, BarChart3, Loader2 } from "lucide-react";
import axios from "axios";

interface Agency {
  agencyName: string;
  postCount: number;
  typeBreakdown: Record<string, number>;
  winCount: number;
  winAmount: number;
  lastActivityDate: string;
  conversionRate: string;
}

interface Company {
  companyName?: string;
  totalWins?: number;
  recentWins?: number;
  totalWinAmount?: number;
  lastWinDate?: string;
}

interface TrendData {
  date: string;
  posts: number;
  wins: number;
  winAmount: number;
}

export default function AnalyticsPage() {
  const [period, setPeriod] = useState<30 | 90 | 365>(90);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [trends, setTrends] = useState<TrendData[]>([]);
  const [stats, setStats] = useState({
    totalPosts: 0,
    totalWins: 0,
    totalAgencies: 0,
    matchRate: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // 병렬로 데이터 로드
        const [agenciesRes, companiesRes, trendsRes] = await Promise.all([
          axios.get(`/api/analytics/agencies?days=${period}&limit=10`),
          axios.get(`/api/analytics/companies?days=${period}&limit=10`),
          axios.get(`/api/analytics/trends?days=${period}`),
        ]);

        setAgencies(agenciesRes.data.agencies || []);
        setCompanies(
          agenciesRes.data.companies || companiesRes.data.recentPeriodCompanies || []
        );
        setTrends(trendsRes.data.trends || []);

        // 통계 업데이트
        const trendsData = trendsRes.data.summary || {};
        setStats({
          totalPosts: trendsData.totalPosts || 0,
          totalWins: trendsData.totalWins || 0,
          totalAgencies: agenciesRes.data.summary?.totalAgencies || 0,
          matchRate: trendsData.matchRate || 0,
        });
      } catch (error) {
        console.error("데이터 로드 실패:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [period]);

  const StatCard = ({
    icon: Icon,
    label,
    value,
    trend,
  }: {
    icon: any;
    label: string;
    value: string | number;
    trend?: string;
  }) => (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {label}
          </CardTitle>
          <Icon className="h-4 w-4 text-blue-500" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {trend && <p className="text-xs text-muted-foreground mt-1">{trend}</p>}
      </CardContent>
    </Card>
  );

  // 간단한 바 차트 (SVG)
  const SimpleBarChart = ({
    data,
    dataKey,
  }: {
    data: Agency[];
    dataKey: string;
  }) => {
    if (!data.length) {
      return (
        <div className="h-64 flex items-center justify-center rounded-lg border-2 border-dashed border-muted">
          <p className="text-muted-foreground">데이터가 없습니다</p>
        </div>
      );
    }

    const maxValue = Math.max(...data.map((d) => d[dataKey as keyof Agency] as number));
    const chartHeight = 250;
    const barWidth = 40;
    const spacing = 10;
    const svgWidth = data.length * (barWidth + spacing) + 40;

    return (
      <div className="overflow-x-auto pb-4">
        <svg width={svgWidth} height={chartHeight + 40} className="mx-auto">
          {data.map((item, idx) => {
            const value = item[dataKey as keyof Agency] as number;
            const height = (value / maxValue) * chartHeight;
            const x = idx * (barWidth + spacing) + 20;
            const y = chartHeight - height;

            return (
              <g key={idx}>
                <rect x={x} y={y} width={barWidth} height={height} fill="#3b82f6" rx={4} />
                <text
                  x={x + barWidth / 2}
                  y={chartHeight + 15}
                  textAnchor="middle"
                  fontSize="10"
                  fill="#666"
                >
                  {item.agencyName.substring(0, 8)}
                </text>
                <text x={x + barWidth / 2} y={y - 5} textAnchor="middle" fontSize="10" fill="#333">
                  {value}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    );
  };

  // 간단한 라인 차트 (SVG)
  const SimpleLineChart = ({ data }: { data: TrendData[] }) => {
    if (!data.length) {
      return (
        <div className="h-64 flex items-center justify-center rounded-lg border-2 border-dashed border-muted">
          <p className="text-muted-foreground">데이터가 없습니다</p>
        </div>
      );
    }

    const maxPosts = Math.max(...data.map((d) => d.posts || 1));
    const maxWins = Math.max(...data.map((d) => d.wins || 1));
    const chartHeight = 250;
    const chartWidth = Math.max(800, data.length * 30);
    const padding = 40;

    const getPointsPath = (values: number[], max: number, color: string) => {
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

          {/* Posts line */}
          <polyline
            points={getPointsPath(
              data.map((d) => d.posts),
              maxPosts,
              "#3b82f6"
            )}
            fill="none"
            stroke="#3b82f6"
            strokeWidth="2"
          />

          {/* Wins line */}
          <polyline
            points={getPointsPath(
              data.map((d) => d.wins),
              maxWins,
              "#10b981"
            )}
            fill="none"
            stroke="#10b981"
            strokeWidth="2"
          />

          {/* X-axis labels */}
          {data.map((d, idx) => {
            if (idx % Math.ceil(data.length / 8) === 0) {
              const x = (idx / (data.length - 1 || 1)) * (chartWidth - padding * 2) + padding;
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
          <rect x={padding} y={padding - 30} width={200} height={25} fill="#f9fafb" rx={4} />
          <circle cx={padding + 10} cy={padding - 17} r={3} fill="#3b82f6" />
          <text x={padding + 18} y={padding - 12} fontSize="12" fill="#333">
            발주건수
          </text>
          <circle cx={padding + 100} cy={padding - 17} r={3} fill="#10b981" />
          <text x={padding + 108} y={padding - 12} fontSize="12" fill="#333">
            낙찰건수
          </text>
        </svg>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* 페이지 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">수주 분석</h1>
          <p className="text-sm text-muted-foreground mt-1">
            입찰 결과 및 수주 현황을 분석합니다
          </p>
        </div>

        {/* 기간 필터 */}
        <div className="flex gap-2">
          <Button
            variant={period === 30 ? "default" : "outline"}
            size="sm"
            onClick={() => setPeriod(30)}
          >
            30일
          </Button>
          <Button
            variant={period === 90 ? "default" : "outline"}
            size="sm"
            onClick={() => setPeriod(90)}
          >
            90일
          </Button>
          <Button
            variant={period === 365 ? "default" : "outline"}
            size="sm"
            onClick={() => setPeriod(365)}
          >
            전체
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* 통계 카드 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              icon={BarChart3}
              label="전체 수집건수"
              value={stats.totalPosts}
            />
            <StatCard
              icon={Building2}
              label="낙찰기업수"
              value={stats.totalWins}
            />
            <StatCard
              icon={Users}
              label="주요 발주기관수"
              value={stats.totalAgencies}
            />
            <StatCard
              icon={TrendingUp}
              label="키워드 매칭률"
              value={`${stats.matchRate.toFixed(1)}%`}
            />
          </div>

          {/* 월별 트렌드 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                월별 트렌드
              </CardTitle>
            </CardHeader>
            <CardContent>
              <SimpleLineChart data={trends} />
            </CardContent>
          </Card>

          {/* 기관별 발주 현황 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                기관별 발주 현황 (상위 10개)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <SimpleBarChart data={agencies.slice(0, 10)} dataKey="postCount" />
            </CardContent>
          </Card>

          {/* 기업별 수주 순위 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                기업별 수주 순위
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
                        기업명
                      </th>
                      <th className="text-right py-3 px-4 font-semibold">
                        수주건수
                      </th>
                      <th className="text-right py-3 px-4 font-semibold">
                        수주금액
                      </th>
                      <th className="text-left py-3 px-4 font-semibold">
                        최근수주일
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {companies && companies.length > 0 ? (
                      companies.slice(0, 10).map((company, index) => (
                        <tr key={index} className="border-b hover:bg-muted/50">
                          <td className="py-3 px-4">{index + 1}</td>
                          <td className="py-3 px-4 font-medium">
                            {company.companyName || "N/A"}
                          </td>
                          <td className="text-right py-3 px-4">
                            {company.recentWins || 0}
                          </td>
                          <td className="text-right py-3 px-4">
                            ₩{(company.totalWinAmount || 0).toLocaleString()}
                          </td>
                          <td className="py-3 px-4 text-muted-foreground">
                            {company.lastWinDate || "N/A"}
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
        </>
      )}
    </div>
  );
}
