"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Pencil, Trash2 } from "lucide-react";

interface Subscriber {
  id: number;
  name: string;
  department: string;
  email: string;
  schedule: string;
  keywords: string;
  active: boolean;
}

interface SubscriberTableProps {
  subscribers: Subscriber[];
  onEdit: (sub: Subscriber) => void;
  onDelete: (sub: Subscriber) => void;
}

const SCHEDULE_LABELS: Record<string, string> = {
  immediate: "즉시",
  daily: "매일",
  weekly: "매주",
};

export default function SubscriberTable({ subscribers, onEdit, onDelete }: SubscriberTableProps) {
  if (subscribers.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground border rounded-lg bg-muted/10">
        <p className="text-sm font-medium">등록된 구독자가 없습니다.</p>
        <p className="text-xs mt-1">구독자를 추가하여 알림을 받을 수 있도록 설정하세요.</p>
      </div>
    );
  }

  return (
    <>
      {/* 데스크톱 테이블 */}
      <div className="rounded-lg border shadow-sm hidden lg:block">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead className="font-semibold text-xs">이름</TableHead>
              <TableHead className="font-semibold text-xs">소속</TableHead>
              <TableHead className="font-semibold text-xs">이메일</TableHead>
              <TableHead className="font-semibold text-xs w-[70px] text-center">알림</TableHead>
              <TableHead className="font-semibold text-xs">키워드</TableHead>
              <TableHead className="font-semibold text-xs w-[60px] text-center">상태</TableHead>
              <TableHead className="font-semibold text-xs w-[80px] text-center">관리</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {subscribers.map((sub) => (
              <TableRow key={sub.id} className="hover:bg-muted/20">
                <TableCell className="text-sm font-medium">{sub.name}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{sub.department}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{sub.email}</TableCell>
                <TableCell className="text-center">
                  <Badge variant="outline" className="text-xs">
                    {SCHEDULE_LABELS[sub.schedule] ?? sub.schedule}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {sub.keywords
                      .split(",")
                      .filter(Boolean)
                      .map((kw) => (
                        <Badge key={kw} variant="secondary" className="text-xs">
                          {kw.trim()}
                        </Badge>
                      ))}
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  {sub.active ? (
                    <Badge className="text-xs bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100">
                      활성
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs text-muted-foreground">
                      비활성
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => onEdit(sub)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      onClick={() => onDelete(sub)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* 모바일 카드 리스트 */}
      <div className="space-y-3 lg:hidden">
        {subscribers.map((sub) => (
          <div key={sub.id} className="rounded-lg border p-4 bg-card">
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="text-sm font-medium">{sub.name}</p>
                <p className="text-xs text-muted-foreground">{sub.department}</p>
              </div>
              <div className="flex items-center gap-1">
                {sub.active ? (
                  <Badge className="text-xs bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100">
                    활성
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs text-muted-foreground">
                    비활성
                  </Badge>
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground mb-2">{sub.email}</p>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className="text-xs">
                {SCHEDULE_LABELS[sub.schedule] ?? sub.schedule}
              </Badge>
              <div className="flex flex-wrap gap-1">
                {sub.keywords
                  .split(",")
                  .filter(Boolean)
                  .map((kw) => (
                    <Badge key={kw} variant="secondary" className="text-xs">
                      {kw.trim()}
                    </Badge>
                  ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button variant="outline" size="sm" onClick={() => onEdit(sub)}>
                <Pencil className="h-3.5 w-3.5 mr-1" />
                수정
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:bg-destructive/10"
                onClick={() => onDelete(sub)}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                삭제
              </Button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
