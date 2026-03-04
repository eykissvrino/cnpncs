"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Save, Send, Mail, MessageSquare, Clock, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";

interface Settings {
  id: number;
  emailEnabled: boolean;
  slackEnabled: boolean;
  cronSchedule: string;
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
        body: JSON.stringify({ type: "all", results: [] }),
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

  if (loading) {
    return (
      <div className="space-y-6 max-w-2xl">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!settings) return null;

  return (
    <div className="space-y-6 max-w-2xl">
      {/* 페이지 헤더 */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">알림 설정</h1>
        <p className="text-sm text-muted-foreground mt-1">
          이메일 및 슬랙 알림과 자동 크롤링 주기를 설정합니다
        </p>
      </div>

      {/* 이메일 설정 */}
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
                  신규 입찰공고 발견 시 이메일로 알림 전송
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
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">환경변수 설정 (.env.local)</p>
            <pre className="block bg-muted/60 border rounded-lg p-3 text-xs font-mono text-foreground leading-relaxed overflow-x-auto">
{`EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your@gmail.com
EMAIL_PASS=your_app_password
EMAIL_TO=recipient@email.com`}
            </pre>
          </div>
        </CardContent>
      </Card>

      {/* 슬랙 설정 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${settings.slackEnabled ? "bg-purple-100" : "bg-muted"}`}>
                <MessageSquare className={`h-4 w-4 ${settings.slackEnabled ? "text-purple-600" : "text-muted-foreground"}`} />
              </div>
              <div>
                <CardTitle className="text-base">슬랙 알림</CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  신규 입찰공고 발견 시 Slack 채널로 알림 전송
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {settings.slackEnabled ? (
                <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
                  <CheckCircle className="h-3.5 w-3.5" />활성
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <XCircle className="h-3.5 w-3.5" />비활성
                </span>
              )}
              <Switch
                checked={settings.slackEnabled}
                onCheckedChange={(v) =>
                  setSettings((prev) => prev ? { ...prev, slackEnabled: v } : prev)
                }
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">환경변수 설정 (.env.local)</p>
            <pre className="block bg-muted/60 border rounded-lg p-3 text-xs font-mono text-foreground leading-relaxed overflow-x-auto">
{`SLACK_BOT_TOKEN=xoxb-your-token
SLACK_CHANNEL_ID=C1234567890`}
            </pre>
          </div>
        </CardContent>
      </Card>

      {/* 크롤링 주기 */}
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
          <div className="flex items-center gap-3">
            <Label className="text-sm font-medium w-20 shrink-0">주기 설정</Label>
            <Select
              value={settings.cronSchedule}
              onValueChange={(v) =>
                setSettings((prev) => prev ? { ...prev, cronSchedule: v } : prev)
              }
            >
              <SelectTrigger className="w-52">
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

      {/* 액션 버튼 */}
      <div className="flex gap-3 pt-2">
        <Button onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? "저장 중..." : "설정 저장"}
        </Button>
        <Button variant="outline" onClick={handleTestNotify} disabled={testSending}>
          <Send className="h-4 w-4 mr-2" />
          {testSending ? "전송 중..." : "테스트 알림 보내기"}
        </Button>
      </div>
    </div>
  );
}
