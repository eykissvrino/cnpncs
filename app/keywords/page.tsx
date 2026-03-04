"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Trash2, RefreshCw, Tag, Database } from "lucide-react";
import { toast } from "sonner";

interface Keyword {
  id: number;
  name: string;
  active: boolean;
  createdAt: string;
  _count: { results: number };
}

export default function KeywordsPage() {
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [loading, setLoading] = useState(true);
  const [newKeyword, setNewKeyword] = useState("");
  const [adding, setAdding] = useState(false);
  const [crawling, setCrawling] = useState(false);

  const fetchKeywords = async () => {
    try {
      const res = await fetch("/api/keywords");
      const data = await res.json() as Keyword[];
      setKeywords(data);
    } catch {
      toast.error("키워드 목록 조회 실패");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKeywords();
  }, []);

  const handleAdd = async () => {
    const name = newKeyword.trim();
    if (!name) return;
    setAdding(true);
    try {
      const res = await fetch("/api/keywords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) throw new Error(data.error || "추가 실패");
      setNewKeyword("");
      toast.success(`'${name}' 키워드가 추가되었습니다.`);
      await fetchKeywords();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "키워드 추가 실패");
    } finally {
      setAdding(false);
    }
  };

  const handleToggle = async (id: number, active: boolean) => {
    try {
      await fetch("/api/keywords", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, active }),
      });
      setKeywords((prev) =>
        prev.map((kw) => (kw.id === id ? { ...kw, active } : kw))
      );
    } catch {
      toast.error("키워드 상태 변경 실패");
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`'${name}' 키워드를 삭제하시겠습니까? 관련 크롤링 데이터도 함께 삭제됩니다.`)) return;
    try {
      const res = await fetch(`/api/keywords?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("삭제 실패");
      toast.success(`'${name}' 키워드가 삭제되었습니다.`);
      await fetchKeywords();
    } catch {
      toast.error("키워드 삭제 실패");
    }
  };

  const handleCrawlNow = async () => {
    setCrawling(true);
    try {
      const res = await fetch("/api/cron");
      const data = await res.json() as { newCount?: number; errors?: string[]; error?: string };
      if (!res.ok) throw new Error(data.error || "크롤링 실패");
      toast.success(`크롤링 완료: 신규 ${data.newCount}건 발견`);
      if (data.errors && data.errors.length > 0) {
        toast.warning(`일부 오류 발생: ${data.errors.slice(0, 2).join(", ")}`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "크롤링 실패");
    } finally {
      setCrawling(false);
    }
  };

  const activeCount = keywords.filter((k) => k.active).length;

  return (
    <div className="space-y-6">
      {/* 페이지 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">키워드 관리</h1>
          <p className="text-sm text-muted-foreground mt-1">
            즐겨찾기 키워드를 관리하고 자동 크롤링을 설정합니다
          </p>
        </div>
        <Button onClick={handleCrawlNow} disabled={crawling}>
          <RefreshCw className={`h-4 w-4 mr-2 ${crawling ? "animate-spin" : ""}`} />
          {crawling ? "크롤링 중..." : "지금 크롤링 시작"}
        </Button>
      </div>

      {/* 요약 통계 */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-blue-100 flex items-center justify-center">
                <Tag className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{keywords.length}</p>
                <p className="text-xs text-muted-foreground">전체 키워드</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-emerald-100 flex items-center justify-center">
                <RefreshCw className="h-4 w-4 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-emerald-700">{activeCount}</p>
                <p className="text-xs text-muted-foreground">활성 키워드</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-amber-100 flex items-center justify-center">
                <Database className="h-4 w-4 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {keywords.reduce((sum, k) => sum + k._count.results, 0).toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">총 수집 건수</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 키워드 추가 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="h-4 w-4 text-primary" />
            키워드 추가
          </CardTitle>
          <CardDescription>새로운 모니터링 키워드를 등록합니다</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="검색할 키워드 입력 (예: AI 시스템, 클라우드)"
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              className="max-w-sm"
            />
            <Button onClick={handleAdd} disabled={adding || !newKeyword.trim()}>
              <Plus className="h-4 w-4 mr-2" />
              추가
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 키워드 목록 */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Tag className="h-4 w-4 text-primary" />
              등록된 키워드
            </CardTitle>
            <Badge variant="secondary">{keywords.length}개</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : keywords.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Tag className="h-8 w-8 mx-auto mb-3 opacity-20" />
              <p className="text-sm font-medium">등록된 키워드가 없습니다.</p>
              <p className="text-xs mt-1">위에서 키워드를 추가해주세요.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {keywords.map((kw) => (
                <div
                  key={kw.id}
                  className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/20 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <Switch
                      checked={kw.active}
                      onCheckedChange={(checked) => handleToggle(kw.id, checked)}
                    />
                    <div className="flex items-center gap-3">
                      <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${kw.active ? "bg-primary/10" : "bg-muted"}`}>
                        <Tag className={`h-4 w-4 ${kw.active ? "text-primary" : "text-muted-foreground"}`} />
                      </div>
                      <div>
                        <p className={`font-medium text-sm ${!kw.active && "text-muted-foreground"}`}>{kw.name}</p>
                        <p className="text-xs text-muted-foreground">
                          누적 {kw._count.results.toLocaleString()}건 수집
                        </p>
                      </div>
                    </div>
                    {!kw.active && (
                      <Badge variant="outline" className="text-xs text-muted-foreground">비활성</Badge>
                    )}
                    {kw.active && (
                      <Badge className="text-xs bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100">활성</Badge>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(kw.id, kw.name)}
                    className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
