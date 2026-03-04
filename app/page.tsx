"use client";

import { useState, useCallback, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import ResultTable from "@/components/ResultTable";
import ExportButton from "@/components/ExportButton";
import { Search, Star, RefreshCw, Bell, Database, Clock, X } from "lucide-react";
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
    toast.info("크롤링 시작... (수 분 소요, 30일치 수집)");
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

  // 전체 아이템 (중복 제거, 날짜순)
  const allDashItems = dashboard
    ? Array.from(
        new Map(
          dashboard.results
            .flatMap((r) => r.items)
            .map((i) => [i.id, i])
        ).values()
      ).sort((a, b) => (b.postDate > a.postDate ? 1 : -1))
    : [];

  // 선택된 키워드 기준 필터링
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

  // 유형 필터 적용
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

      {/* ── 섹션 1: 키워드 모니터링 대시보드 ── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              키워드 모니터링
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              저장된 키워드에 매칭되는 최신 입찰공고(용역) · 복수 선택 가능
            </p>
          </div>
          <div className="flex items-center gap-3">
            {dashboard && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Database className="h-3 w-3" />
                DB {dashboard.dbTotal.toLocaleString()}건
                <Clock className="h-3 w-3 ml-2" />
                {timeAgo(dashboard.lastCrawledAt)}
              </span>
            )}
            <Button variant="outline" size="sm" onClick={loadDashboard} disabled={dashLoading}>
              <RefreshCw className={`h-4 w-4 mr-1 ${dashLoading ? "animate-spin" : ""}`} />
              새로고침
            </Button>
            <Button size="sm" onClick={handleCrawl} disabled={crawling}>
              <RefreshCw className={`h-4 w-4 mr-1 ${crawling ? "animate-spin" : ""}`} />
              {crawling ? "크롤링 중..." : "지금 크롤링"}
            </Button>
          </div>
        </div>

        {!dashboard?.keywords.length && !dashLoading ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Star className="h-8 w-8 mx-auto mb-3 opacity-30" />
              <p className="text-sm">저장된 키워드가 없습니다.</p>
              <p className="text-xs mt-1">아래 검색창에서 키워드를 검색 후 ☆ 저장 버튼을 눌러주세요.</p>
            </CardContent>
          </Card>
        ) : dashLoading ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground text-sm">
              <RefreshCw className="h-5 w-5 mx-auto mb-2 animate-spin" />
              로딩 중...
            </CardContent>
          </Card>
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
              {(["bid", "order", "prespec"] as const).map((type) => {
                const labels: Record<string, string> = { bid: "입찰공고", order: "발주계획", prespec: "사전규격" };
                const count = keywordFilteredItems.filter((i) => i.type === type).length;
                const isOn = selectedTypes?.has(type) ?? false;
                return (
                  <Button
                    key={type}
                    variant={isOn ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleType(type)}
                  >
                    {labels[type]}
                    <Badge variant="secondary" className="ml-1.5">{count}</Badge>
                  </Button>
                );
              })}
            </div>

            {/* 선택 상태 표시 */}
            {selectedKeywords !== null && selectedKeywordNames.length > 0 && (
              <div className="flex items-center gap-2 mb-3 px-3 py-1.5 bg-muted rounded-md text-sm">
                <span className="text-muted-foreground">선택:</span>
                <span className="font-medium">{selectedKeywordNames.join(" + ")}</span>
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
              <Card>
                <CardContent className="py-10 text-center text-muted-foreground text-sm">
                  {selectedKeywords !== null
                    ? "선택한 키워드에 매칭되는 입찰공고가 없습니다."
                    : "저장된 키워드에 매칭되는 입찰공고가 없습니다."}
                  <br />
                  <span className="text-xs mt-1 block">&quot;지금 크롤링&quot; 버튼으로 최신 데이터를 가져오세요.</span>
                </CardContent>
              </Card>
            ) : (
              <ResultTable results={filteredDashItems} isLoading={false} />
            )}
          </div>
        )}
      </div>

      {/* ── 구분선 ── */}
      <div className="border-t" />

      {/* ── 섹션 2: 통합 검색 ── */}
      <div>
        <div className="mb-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Search className="h-5 w-5 text-primary" />
            통합 검색
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            사전규격 · 발주계획 · 입찰공고(용역)를 한 번에 검색합니다
          </p>
        </div>

        <div className="flex gap-2">
          <Input
            placeholder="검색 키워드 입력 (예: AI 시스템, 직무분석)"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="max-w-xl"
          />
          <Button onClick={handleSearch} disabled={loading}>
            {loading ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
            검색
          </Button>
          <Button variant="outline" onClick={handleSaveKeyword} disabled={saving || !keyword.trim()} title="키워드 저장">
            <Star className="h-4 w-4 mr-2" />
            저장
          </Button>
          <ExportButton keyword={searchedKeyword} disabled={loading || !searchedKeyword} />
        </div>

        {results !== null && (
          <Tabs defaultValue="all" className="w-full mt-4">
            <TabsList>
              <TabsTrigger value="all">
                전체 <Badge variant="secondary" className="ml-2">{results.total}</Badge>
              </TabsTrigger>
              <TabsTrigger value="bid">
                입찰공고 <Badge variant="secondary" className="ml-2">{results.bid.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="order">
                발주계획 <Badge variant="secondary" className="ml-2">{results.order.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="prespec">
                사전규격 <Badge variant="secondary" className="ml-2">{results.prespec.length}</Badge>
              </TabsTrigger>
            </TabsList>
            <TabsContent value="all" className="mt-4">
              <ResultTable results={[...results.bid, ...results.order, ...results.prespec]} isLoading={loading} />
            </TabsContent>
            <TabsContent value="bid" className="mt-4">
              <ResultTable results={results.bid} isLoading={loading} />
            </TabsContent>
            <TabsContent value="order" className="mt-4">
              <ResultTable results={results.order} isLoading={loading} />
            </TabsContent>
            <TabsContent value="prespec" className="mt-4">
              <ResultTable results={results.prespec} isLoading={loading} />
            </TabsContent>
          </Tabs>
        )}

        {results === null && !loading && (
          <div className="text-center py-16 text-muted-foreground">
            <Search className="h-10 w-10 mx-auto mb-3 opacity-20" />
            <p className="text-base">키워드를 입력하고 검색을 시작하세요</p>
          </div>
        )}
      </div>
    </div>
  );
}
