"use client";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TrendingUp, Building2, Users, BarChart3, Loader2 } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
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
    icon: React.ComponentType<{ className?: string }>;
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
              {trends.length === 0 ? (
                <div className="h-64 flex items-center justify-center rounded-lg border-2 border-dashed border-muted">
                  <p className="text-muted-foreground">데이터가 없습니다</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={trends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} tickFormatter={(v: string) => v.substring(5)} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="posts" name="발주건수" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="wins" name="낙찰건수" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
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
              {agencies.length === 0 ? (
                <div className="h-64 flex items-center justify-center rounded-lg border-2 border-dashed border-muted">
                  <p className="text-muted-foreground">데이터가 없습니다</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={agencies.slice(0, 10)} layout="vertical" margin={{ left: 80 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" tick={{ fontSize: 12 }} />
                    <YAxis type="category" dataKey="agencyName" tick={{ fontSize: 11 }} width={120} tickFormatter={(v: string) => v.length > 12 ? v.substring(0, 12) + "…" : v} />
                    <Tooltip />
                    <Bar dataKey="postCount" name="발주건수" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
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
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">순위</TableHead>
                      <TableHead>기업명</TableHead>
                      <TableHead className="text-right">수주건수</TableHead>
                      <TableHead className="text-right">수주금액</TableHead>
                      <TableHead>최근수주일</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {companies && companies.length > 0 ? (
                      companies.slice(0, 10).map((company, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{index + 1}</TableCell>
                          <TableCell className="font-medium">{company.companyName || "N/A"}</TableCell>
                          <TableCell className="text-right">{company.recentWins || 0}</TableCell>
                          <TableCell className="text-right">₩{(company.totalWinAmount || 0).toLocaleString()}</TableCell>
                          <TableCell className="text-muted-foreground">{company.lastWinDate || "N/A"}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                          데이터가 없습니다
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
