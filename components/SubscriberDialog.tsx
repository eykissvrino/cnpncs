"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

export interface SubscriberFormData {
  id?: number;
  name: string;
  department: string;
  email: string;
  schedule: string;
  keywords: string;
  active: boolean;
}

interface SubscriberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: SubscriberFormData | null;
  onSubmit: (data: SubscriberFormData) => Promise<void>;
}

const EMPTY: SubscriberFormData = {
  name: "",
  department: "",
  email: "",
  schedule: "weekday",
  keywords: "",
  active: true,
};

export default function SubscriberDialog({
  open,
  onOpenChange,
  initial,
  onSubmit,
}: SubscriberDialogProps) {
  const [form, setForm] = useState<SubscriberFormData>(EMPTY);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(initial ?? EMPTY);
    }
  }, [open, initial]);

  const isEdit = !!initial?.id;

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await onSubmit(form);
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "구독자 수정" : "구독자 추가"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="sub-name">이름</Label>
            <Input
              id="sub-name"
              placeholder="홍길동"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sub-dept">소속</Label>
            <Input
              id="sub-dept"
              placeholder="기획팀"
              value={form.department}
              onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sub-email">이메일</Label>
            <Input
              id="sub-email"
              type="email"
              placeholder="user@company.com"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>알림 일정</Label>
            <Select
              value={form.schedule}
              onValueChange={(v) => setForm((f) => ({ ...f, schedule: v }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="weekday">평일 오전 9시</SelectItem>
                <SelectItem value="daily">매일 오전 9시</SelectItem>
                <SelectItem value="weekly">매주 월요일 오전 9시</SelectItem>
                <SelectItem value="immediate">즉시 (발견 시 바로)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sub-keywords">관심 키워드</Label>
            <Input
              id="sub-keywords"
              placeholder="AI,클라우드,보안 (쉼표 구분)"
              value={form.keywords}
              onChange={(e) => setForm((f) => ({ ...f, keywords: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground">쉼표(,)로 구분하여 입력하세요</p>
          </div>
          <div className="flex items-center justify-between">
            <Label>활성 상태</Label>
            <Switch
              checked={form.active}
              onCheckedChange={(v) => setForm((f) => ({ ...f, active: v }))}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            취소
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || !form.name.trim() || !form.email.trim()}
          >
            {submitting ? "처리 중..." : isEdit ? "수정" : "추가"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
