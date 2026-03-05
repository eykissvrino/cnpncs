"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import SubscriberDialog, { type SubscriberFormData } from "@/components/SubscriberDialog";
import SubscriberTable from "@/components/SubscriberTable";
import DeleteConfirmDialog from "@/components/DeleteConfirmDialog";
import { Save, Send, Mail, Clock, CheckCircle, XCircle, Users, Plus } from "lucide-react";
import { toast } from "sonner";

interface Settings {
  id: number;
  emailEnabled: boolean;
  cronSchedule: string;
  emailConfigured?: boolean;
}

interface Subscriber {
  id: number;
  name: string;
  department: string;
  email: string;
  schedule: string;
  keywords: string;
  active: boolean;
}

const CRON_OPTIONS = [
  { value: "0 */1 * * *", label: "매 1시간" },
  { value: "0 */2 * * *", label: "매 2시간" },
  { value: "0 */4 * * *", label: "매 4시간" },
  { value: "0 9 * * *", label: "매일 오전 9시" },
  { value: "0 9 * * 1-5", label: "평일 오전 9시" },
];

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testSending, setTestSending] = useState(false);

  // 구독자
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [subLoading, setSubLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<SubscriberFormData | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Subscriber | null>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch("/api/settings");
        const data = await res.json() as Settings;
        setSettings(data);
      } catch {
        toast.error("설정 조회 실패");
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const fetchSubscribers = useCallback(async () => {
    try {
      const res = await fetch("/api/subscribers");
      const data = await res.json() as Subscriber[];
      setSubscribers(data);
    } catch {
      toast.error("구독자 목록 조회 실패");
    } finally {
      setSubLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSubscribers();
  }, [fetchSubscribers]);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error("설정 저장 실패");
      toast.success("설정이 저장되었습니다.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  };

  const handleTestNotify = async () => {
    setTestSending(true);
    try {
      const res = await fetch("/api/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "email", results: [] }),
      });
      const data = await res.json() as { message?: string; error?: string };
      if (!res.ok) throw new Error(data.error || "알림 전송 실패");
      toast.success(data.message || "테스트 알림 전송 완료");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "알림 전송 실패");
    } finally {
      setTestSending(false);
    }
  };

  const handleAddSubscriber = () => {
    setEditTarget(null);
    setDialogOpen(true);
  };

  const handleEditSubscriber = (sub: Subscriber) => {
    setEditTarget({
      id: sub.id,
      name: sub.name,
      department: sub.department,
      email: sub.email,
      schedule: sub.schedule,
      keywords: sub.keywords,
      active: sub.active,
    });
    setDialogOpen(true);
  };

  const handleSubmitSubscriber = async (data: SubscriberFormData) => {
    if (data.id) {
      // 수정
      const res = await fetch("/api/subscribers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json() as { error?: string };
      if (!res.ok) throw new Error(result.error || "수정 실패");
      toast.success("구독자 정보가 수정되었습니다.");
    } else {
      // 추가
      const res = await fetch("/api/subscribers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json() as { error?: string };
      if (!res.ok) throw new Error(result.error || "추가 실패");
      toast.success("구독자가 추가되었습니다.");
    }
    await fetchSubscribers();
  };

  const handleDeleteSubscriber = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/subscribers?id=${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("삭제 실패");
      toast.success(`'${deleteTarget.name}' 구독자가 삭제되었습니다.`);
      await fetchSubscribers();
    } catch {
      toast.error("구독자 삭제 실패");
    } finally {
      setDeleteTarget(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-60 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!settings) return null;

  const activeCount = subscribers.filter((s) => s.active).length;

  return (
    <div className="space-y-6">
      {/* 페이지 헤더 */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">알림 설정</h1>
        <p className="text-sm text-muted-foreground mt-1">
          구독자 관리 및 이메일 알림, 크롤링 주기를 설정합니다
        </p>
      </div>

      {/* ── 구독자 관리 ── */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-blue-100 flex items-center justify-center">
                <Users className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-base">구독자 관리</CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  등록된 구독자에게 관심 키워드에 매칭되는 공고 알림을 발송합니다
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{subscribers.length}명</Badge>
              <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">{activeCount}명 활성</Badge>
              <Button size="sm" onClick={handleAddSubscriber}>
                <Plus className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">구독자 </span>추가
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {subLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : (
            <SubscriberTable
              subscribers={subscribers}
              onEdit={handleEditSubscriber}
              onDelete={(sub) => setDeleteTarget(sub)}
            />
          )}
        </CardContent>
      </Card>

      {/* ── 이메일 설정 ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${settings.emailEnabled ? "bg-blue-100" : "bg-muted"}`}>
                <Mail className={`h-4 w-4 ${settings.emailEnabled ? "text-blue-600" : "text-muted-foreground"}`} />
              </div>
              <div>
                <CardTitle className="text-base">이메일 알림</CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  신규 공고 발견 시 구독자에게 이메일 알림 발송
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {settings.emailEnabled ? (
                <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
                  <CheckCircle className="h-3.5 w-3.5" />활성
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <XCircle className="h-3.5 w-3.5" />비활성
                </span>
              )}
              <Switch
                checked={settings.emailEnabled}
                onCheckedChange={(v) =>
                  setSettings((prev) => prev ? { ...prev, emailEnabled: v } : prev)
                }
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border bg-muted/30 p-3">
            <p className="text-xs font-medium text-muted-foreground mb-1">SMTP 상태</p>
            {settings.emailConfigured ? (
              <p className="text-sm text-emerald-600 font-medium flex items-center gap-1">
                <CheckCircle className="h-3.5 w-3.5" /> SMTP 설정 완료
              </p>
            ) : (
              <p className="text-sm text-amber-600 font-medium flex items-center gap-1">
                <XCircle className="h-3.5 w-3.5" /> 환경변수(EMAIL_USER, EMAIL_PASS) 미설정
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── 크롤링 주기 ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-amber-100 flex items-center justify-center">
              <Clock className="h-4 w-4 text-amber-600" />
            </div>
            <div>
              <CardTitle className="text-base">크롤링 주기</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                활성화된 키워드로 자동 크롤링할 주기를 설정합니다
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <Label className="text-sm font-medium sm:w-20 shrink-0">주기 설정</Label>
            <Select
              value={settings.cronSchedule}
              onValueChange={(v) =>
                setSettings((prev) => prev ? { ...prev, cronSchedule: v } : prev)
              }
            >
              <SelectTrigger className="sm:w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CRON_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* ── 액션 버튼 ── */}
      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        <Button onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? "저장 중..." : "설정 저장"}
        </Button>
        <Button variant="outline" onClick={handleTestNotify} disabled={testSending}>
          <Send className="h-4 w-4 mr-2" />
          {testSending ? "전송 중..." : "테스트 알림 보내기"}
        </Button>
      </div>

      {/* ── 다이얼로그 ── */}
      <SubscriberDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initial={editTarget}
        onSubmit={handleSubmitSubscriber}
      />

      <DeleteConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={`'${deleteTarget?.name}' 구독자 삭제`}
        description="이 구독자를 삭제하시겠습니까? 삭제된 구독자는 더 이상 알림을 받지 않습니다."
        onConfirm={handleDeleteSubscriber}
      />
    </div>
  );
}
