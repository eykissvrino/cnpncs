"use client";

import { useState, useCallback, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ResultTable from "@/components/ResultTable";
import ResultDetailSheet from "@/components/ResultDetailSheet";
import CrawlProgress from "@/components/CrawlProgress";
import ExportButton from "@/components/ExportButton";
import { Search, Star, RefreshCw, Bell, Database, Clock, X, Zap, FileText } from "lucide-react";
import { toast } from "sonner";
import type { UnifiedResult } from "@/types/narajan";

interface KeywordResult {
  keyword: string;
  keywordId: number;
  newCount: number;
  items: (UnifiedResult & { isNew?: boolean })[];
}

interface DashboardData {
  keywords: { id: number; name: string }[];
  results: KeywordResult[];
  lastCrawledAt: string | null;
  totalNew: number;
  dbTotal: number;
}

interface SearchResults {
  bid: UnifiedResult[];
  prespec: UnifiedResult[];
  order: UnifiedResult[];
  bidresult: UnifiedResult[];
  total: number;
}

function timeAgo(isoStr: string | null): string {
  if (!isoStr) return "크롤링 데이터 없음";
  const diff = Math.floor((Date.now() - new Date(isoStr).getTime()) / 1000);
  if (diff < 60) return `${diff}초 전`;
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  return `${Math.floor(diff / 86400)}일 전`;
}

export default function HomePage() {
  // 대시보드
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [dashLoading, setDashLoading] = useState(true);
  const [crawling, setCrawling] = useState(false);
  const [selectedKeywords, setSelectedKeywords] = useState<Set<number> | null>(null);
  const [selectedTypes, setSelectedTypes] = useState<Set<string> | null>(null);

  // 검색
  const [keyword, setKeyword] = useState("");
  const [searchedKeyword, setSearchedKeyword] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResults | null>(null);
  const [saving, setSaving] = useState(false);

  // 상세보기
  const [selectedItem, setSelectedItem] = useState<(UnifiedResult & { isNew?: boolean }) | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const handleRowClick = useCallback((item: UnifiedResult & { isNew?: boolean }) => {
    setSelectedItem(item);
    setSheetOpen(true);
  }, []);

  const loadDashboard = useCallback(async () => {
    setDashLoading(true);
    try {
      const res = await fetch("/api/dashboard");
      const data = await res.json() as DashboardData & { error?: string };
      if (!res.ok) throw new Error(data.error);
      setDashboard(data);
    } catch {
      toast.error("대시보드 로딩 실패");
    } finally {
      setDashLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
    const timer = setInterval(loadDashboard, 5 * 60 * 1000);
    return () => clearInterval(timer);
  }, [loadDashboard]);

  const handleCrawl = async () => {
    setCrawling(true);
    try {
      const res = await fetch("/api/cron");
      const data = await res.json() as { newCount?: number; errors?: string[] };
      toast.success(`크롤링 완료: 신규 ${data.newCount ?? 0}건`);
      await loadDashboard();
    } catch {
      toast.error("크롤링 실패");
    } finally {
      setCrawling(false);
    }
  };

  const handleSearch = useCallback(async () => {
    const q = keyword.trim();
    if (!q) { toast.error("검색 키워드를 입력해주세요."); return; }
    setLoading(true);
    setResults(null);
    try {
      const res = await fetch(`/api/search?keyword=${encodeURIComponent(q)}&type=all`);
      const data = await res.json() as SearchResults & { error?: string };
      if (!res.ok) throw new Error(data.error || "검색 실패");
      setResults(data);
      setSearchedKeyword(q);
      if (data.total === 0) toast.info("검색 결과가 없습니다.");
      else toast.success(`총 ${data.total}건 검색 완료`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "검색 중 오류 발생");
    } finally {
      setLoading(false);
    }
  }, [keyword]);

  const handleSaveKeyword = async () => {
    const q = searchedKeyword || keyword.trim();
    if (!q) return;
    setSaving(true);
    try {
      const res = await fetch("/api/keywords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: q }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) throw new Error(data.error || "저장 실패");
      toast.success(`'${q}' 키워드가 추가되었습니다.`);
      await loadDashboard();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "키워드 저장 실패");
    } finally {
      setSaving(false);
    }
  };

  const toggleKeyword = useCallback((id: number) => {
    setSelectedKeywords((prev) => {
      if (prev === null) {
        return new Set([id]);
      }
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        return next.size === 0 ? null : next;
      } else {
        next.add(id);
        return next;
      }
    });
  }, []);

  const allDashItems = dashboard
    ? Array.from(
        new Map(
          dashboard.results
            .flatMap((r) => r.items)
            .map((i) => [i.id, i])
        ).values()
      ).sort((a, b) => (b.postDate > a.postDate ? 1 : -1))
    : [];

  const keywordFilteredItems =
    selectedKeywords === null
      ? allDashItems
      : Array.from(
          new Map(
            (dashboard?.results ?? [])
              .filter((r) => selectedKeywords.has(r.keywordId))
              .flatMap((r) => r.items)
              .map((i) => [i.id, i])
          ).values()
        ).sort((a, b) => (b.postDate > a.postDate ? 1 : -1));

  const filteredDashItems =
    selectedTypes === null
      ? keywordFilteredItems
      : keywordFilteredItems.filter((i) => selectedTypes.has(i.type));

  const toggleType = (type: string) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev ?? []);
      if (next.has(type)) {
        next.delete(type);
        return next.size === 0 ? null : next;
      } else {
        next.add(type);
        return next;
      }
    });
  };

  const selectedKeywordNames =
    selectedKeywords !== null
      ? Array.from(selectedKeywords)
          .map((id) => dashboard?.results.find((r) => r.keywordId === id)?.keyword)
          .filter((n): n is string => !!n)
      : [];

  return (
    <div className="space-y-8">

      {/* ── 페이지 헤더 ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">대시보드</h1>
          <p className="text-sm text-muted-foreground mt-1">
            나라장터 입찰공고 · 발주계획 · 사전규격 통합 모니터링
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadDashboard} disabled={dashLoading}>
            <RefreshCw className={`h-4 w-4 mr-1.5 ${dashLoading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">새로고침</span>
          </Button>
          <Button size="sm" onClick={handleCrawl} disabled={crawling}>
            <Zap className={`h-4 w-4 mr-1.5 ${crawling ? "animate-pulse" : ""}`} />
            {crawling ? "크롤링 중..." : "지금 크롤링"}
          </Button>
        </div>
      </div>

      {/* ── 크롤링 진행률 ── */}
      <CrawlProgress isActive={crawling} />

      {/* ── 통계 카드 ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">전체 수집</p>
                <p className="text-2xl font-bold mt-1">
                  {dashLoading ? "—" : (dashboard?.dbTotal ?? 0).toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">건</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                <Database className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">신규 항목</p>
                <p className="text-2xl font-bold mt-1 text-red-600">
                  {dashLoading ? "—" : (dashboard?.totalNew ?? 0)}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">NEW</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
                <Bell className="h-5 w-5 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">모니터링 키워드</p>
                <p className="text-2xl font-bold mt-1">
                  {dashLoading ? "—" : (dashboard?.keywords.length ?? 0)}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">개</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center">
                <Star className="h-5 w-5 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">최근 수집</p>
                <p className="text-sm font-semibold mt-1 leading-tight">
                  {dashLoading ? "—" : timeAgo(dashboard?.lastCrawledAt ?? null)}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">자동 5분 갱신</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center">
                <Clock className="h-5 w-5 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── 섹션 1: 키워드 모니터링 대시보드 ── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Bell className="h-4 w-4 text-primary" />
              키워드 모니터링
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              저장된 키워드에 매칭되는 최신 항목 · 복수 선택 가능
            </p>
          </div>
        </CardHeader>
        <CardContent>
          {!dashboard?.keywords.length && !dashLoading ? (
            <div className="py-12 text-center text-muted-foreground">
              <Star className="h-8 w-8 mx-auto mb-3 opacity-20" />
              <p className="text-sm font-medium">저장된 키워드가 없습니다.</p>
              <p className="text-xs mt-1">아래 검색창에서 키워드를 검색 후 저장 버튼을 눌러주세요.</p>
            </div>
          ) : dashLoading ? (
            <div className="py-10 text-center text-muted-foreground text-sm">
              <RefreshCw className="h-5 w-5 mx-auto mb-2 animate-spin text-primary" />
              로딩 중...
            </div>
          ) : dashboard && (
            <div>
              {/* 키워드 토글 버튼 (다중 선택) */}
              <div className="flex flex-wrap gap-2 mb-3">
                <Button
                  variant={selectedKeywords === null ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedKeywords(null)}
                >
                  전체
                  <Badge variant="secondary" className="ml-1.5">{allDashItems.length}</Badge>
                  {dashboard.totalNew > 0 && selectedKeywords === null && (
                    <Badge className="ml-1 bg-red-500 text-white text-[10px] px-1.5 py-0">
                      NEW {dashboard.totalNew}
                    </Badge>
                  )}
                </Button>
                {dashboard.results.map((r) => {
                  const isSelected = selectedKeywords?.has(r.keywordId) ?? false;
                  return (
                    <Button
                      key={r.keywordId}
                      variant={isSelected ? "default" : "outline"}
                      size="sm"
                      onClick={() => toggleKeyword(r.keywordId)}
                    >
                      {r.keyword}
                      <Badge variant="secondary" className="ml-1.5">{r.items.length}</Badge>
                      {r.newCount > 0 && (
                        <Badge className="ml-1 bg-red-500 text-white text-[10px] px-1.5 py-0">
                          {r.newCount}
                        </Badge>
                      )}
                    </Button>
                  );
                })}
              </div>

              {/* 유형 필터 */}
              <div className="flex flex-wrap gap-2 mb-3">
                {(["bid", "order", "prespec", "bidresult"] as const).map((type) => {
                  const labels: Record<string, string> = { bid: "입찰공고", order: "발주계획", prespec: "사전규격", bidresult: "개찰결과" };
                  const count = keywordFilteredItems.filter((i) => i.type === type).length;
                  const isOn = selectedTypes?.has(type) ?? false;
                  return (
                    <Button
                      key={type}
                      variant={isOn ? "secondary" : "ghost"}
                      size="sm"
                      onClick={() => toggleType(type)}
                      className={isOn ? "bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20" : ""}
                    >
                      {labels[type]}
                      <Badge variant="secondary" className="ml-1.5">{count}</Badge>
                    </Button>
                  );
                })}
              </div>

              {/* 선택 상태 표시 */}
              {selectedKeywords !== null && selectedKeywordNames.length > 0 && (
                <div className="flex items-center gap-2 mb-3 px-3 py-1.5 bg-primary/5 border border-primary/10 rounded-lg text-sm">
                  <span className="text-muted-foreground">선택:</span>
                  <span className="font-medium text-primary">{selectedKeywordNames.join(" + ")}</span>
                  <span className="text-muted-foreground">· {filteredDashItems.length}건</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 w-5 p-0 ml-auto"
                    onClick={() => setSelectedKeywords(null)}
                    title="선택 초기화"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}

              {/* 결과 테이블 */}
              {filteredDashItems.length === 0 ? (
                <div className="py-10 text-center text-muted-foreground text-sm border rounded-lg bg-muted/20">
                  {selectedKeywords !== null
                    ? "선택한 키워드에 매칭되는 항목이 없습니다."
                    : "저장된 키워드에 매칭되는 항목이 없습니다."}
                  <br />
                  <span className="text-xs mt-1 block">&quot;지금 크롤링&quot; 버튼으로 최신 데이터를 가져오세요.</span>
                </div>
              ) : (
                <ResultTable results={filteredDashItems} isLoading={false} onRowClick={handleRowClick} />
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── 섹션 2: 통합 검색 ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Search className="h-4 w-4 text-primary" />
            통합 검색
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            사전규격 · 발주계획 · 입찰공고(용역)를 한 번에 검색합니다
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              placeholder="검색 키워드 입력 (예: AI 시스템, 직무분석)"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="sm:max-w-xl"
            />
            <div className="flex gap-2">
              <Button onClick={handleSearch} disabled={loading} className="flex-1 sm:flex-none">
                {loading ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                검색
              </Button>
              <Button variant="outline" onClick={handleSaveKeyword} disabled={saving || !keyword.trim()} title="키워드 저장">
                <Star className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">저장</span>
              </Button>
              <ExportButton keyword={searchedKeyword} disabled={loading || !searchedKeyword} />
            </div>
          </div>

          {results !== null && (
            <Tabs defaultValue="all" className="w-full mt-5">
              <TabsList className="bg-muted/50 w-full sm:w-auto">
                <TabsTrigger value="all" className="data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm">
                  전체 <Badge variant="secondary" className="ml-2">{results.total}</Badge>
                </TabsTrigger>
                <TabsTrigger value="bid" className="data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm">
                  입찰 <Badge variant="secondary" className="ml-2">{results.bid.length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="order" className="data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm">
                  발주 <Badge variant="secondary" className="ml-2">{results.order.length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="prespec" className="data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm">
                  사전 <Badge variant="secondary" className="ml-2">{results.prespec.length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="bidresult" className="data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm">
                  개찰 <Badge variant="secondary" className="ml-2">{results.bidresult.length}</Badge>
                </TabsTrigger>
              </TabsList>
              <TabsContent value="all" className="mt-4">
                <ResultTable results={[...results.bid, ...results.order, ...results.prespec, ...results.bidresult]} isLoading={loading} onRowClick={handleRowClick} />
              </TabsContent>
              <TabsContent value="bid" className="mt-4">
                <ResultTable results={results.bid} isLoading={loading} onRowClick={handleRowClick} />
              </TabsContent>
              <TabsContent value="order" className="mt-4">
                <ResultTable results={results.order} isLoading={loading} onRowClick={handleRowClick} />
              </TabsContent>
              <TabsContent value="prespec" className="mt-4">
                <ResultTable results={results.prespec} isLoading={loading} onRowClick={handleRowClick} />
              </TabsContent>
              <TabsContent value="bidresult" className="mt-4">
                <ResultTable results={results.bidresult} isLoading={loading} onRowClick={handleRowClick} />
              </TabsContent>
            </Tabs>
          )}

          {results === null && !loading && (
            <div className="text-center py-16 text-muted-foreground">
              <FileText className="h-10 w-10 mx-auto mb-3 opacity-20" />
              <p className="text-base">키워드를 입력하고 검색을 시작하세요</p>
              <p className="text-xs mt-1">사전규격, 발주계획, 입찰공고를 통합 검색합니다</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── 결과 상세보기 시트 ── */}
      <ResultDetailSheet item={selectedItem} open={sheetOpen} onOpenChange={setSheetOpen} />
    </div>
  );
}
