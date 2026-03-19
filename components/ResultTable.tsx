"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import type { UnifiedResult } from "@/types/narajan";

interface ResultTableProps {
  results: (UnifiedResult & { isNew?: boolean })[];
  isLoading?: boolean;
  onRowClick?: (item: UnifiedResult & { isNew?: boolean }) => void;
}

// 마감일까지 남은 일수 계산 + 스타일 반환
function getDeadlineInfo(deadline: string | undefined): {
  label: string;
  className: string;
} {
  if (!deadline || deadline === "-" || deadline === "—") {
    return { label: "—", className: "text-muted-foreground" };
  }

  // "2026-03-25" 또는 "2026.03.25" 형식 파싱
  const cleaned = deadline.replace(/\./g, "-").substring(0, 10);
  const deadlineDate = new Date(cleaned + "T23:59:59");
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffMs = deadlineDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    // 마감일 지남
    return {
      label: `${deadline} (마감)`,
      className: "text-muted-foreground/50 line-through",
    };
  } else if (diffDays === 0) {
    // 오늘 마감
    return {
      label: `${deadline} (오늘)`,
      className: "text-red-600 font-bold bg-red-50 rounded px-1",
    };
  } else if (diffDays <= 2) {
    // 1~2일 남음
    return {
      label: `${deadline} (D-${diffDays})`,
      className: "text-red-600 font-semibold",
    };
  } else if (diffDays <= 5) {
    // 3~5일 남음
    return {
      label: `${deadline} (D-${diffDays})`,
      className: "text-orange-600 font-medium",
    };
  } else if (diffDays <= 7) {
    // 6~7일 남음
    return {
      label: `${deadline} (D-${diffDays})`,
      className: "text-amber-600",
    };
  }
  // 7일 이상 여유
  return { label: deadline, className: "text-muted-foreground" };
}

const TYPE_STYLES: Record<string, { bg: string; text: string; border: string; label: string }> = {
  bid: {
    bg: "bg-blue-50",
    text: "text-blue-700",
    border: "border-blue-200",
    label: "입찰공고",
  },
  order: {
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200",
    label: "발주계획",
  },
  prespec: {
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200",
    label: "사전규격",
  },
};

export default function ResultTable({ results, isLoading, onRowClick }: ResultTableProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground border rounded-lg bg-muted/10">
        <p className="text-base font-medium">검색 결과가 없습니다.</p>
        <p className="text-sm mt-1">다른 키워드로 검색해보세요.</p>
      </div>
    );
  }

  return (
    <>
      {/* 데스크톱 테이블 */}
      <div className="rounded-lg border shadow-sm hidden lg:block">
        <Table className="table-fixed w-full">
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead className="w-[72px] font-semibold text-xs uppercase tracking-wide">유형</TableHead>
              <TableHead className="w-[120px] font-semibold text-xs uppercase tracking-wide">기관명</TableHead>
              <TableHead className="font-semibold text-xs uppercase tracking-wide">사업명</TableHead>
              <TableHead className="w-[90px] text-right font-semibold text-xs uppercase tracking-wide">예산</TableHead>
              <TableHead className="w-[80px] text-center font-semibold text-xs uppercase tracking-wide">등록일</TableHead>
              <TableHead className="w-[80px] text-center font-semibold text-xs uppercase tracking-wide">마감일</TableHead>
              <TableHead className="w-[44px] text-center font-semibold text-xs uppercase tracking-wide">링크</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {results.map((item) => {
              const typeStyle = TYPE_STYLES[item.type] ?? TYPE_STYLES.bid;
              return (
                <TableRow
                  key={item.id}
                  className={cn(
                    "hover:bg-muted/20 transition-colors",
                    item.isNew && "border-l-2 border-l-red-500",
                    onRowClick && "cursor-pointer"
                  )}
                  onClick={() => onRowClick?.(item)}
                >
                  <TableCell>
                    <span
                      className={cn(
                        "inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border",
                        typeStyle.bg,
                        typeStyle.text,
                        typeStyle.border
                      )}
                    >
                      {typeStyle.label}
                      {item.isNew && (
                        <span className="ml-1 text-[10px] font-bold text-red-500">NEW</span>
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground truncate overflow-hidden" title={item.agency}>
                    {item.agency}
                  </TableCell>
                  <TableCell className="font-medium text-sm text-foreground truncate overflow-hidden" title={item.title}>
                    {item.title}
                  </TableCell>
                  <TableCell className="text-right text-sm font-mono text-foreground whitespace-nowrap">
                    {item.budget}
                  </TableCell>
                  <TableCell className="text-center text-xs text-muted-foreground whitespace-nowrap">
                    {item.postDate}
                  </TableCell>
                  <TableCell className="text-center text-xs whitespace-nowrap">
                    {(() => {
                      const info = getDeadlineInfo(item.deadline);
                      return <span className={info.className}>{info.label}</span>;
                    })()}
                  </TableCell>
                  <TableCell className="text-center">
                    {item.type !== "order" && item.url ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 hover:bg-primary/10 hover:text-primary"
                        asChild
                        onClick={(e) => e.stopPropagation()}
                      >
                        <a href={item.url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </Button>
                    ) : (
                      <span className="text-muted-foreground/40 text-xs">—</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* 모바일 카드 리스트 */}
      <div className="space-y-3 lg:hidden">
        {results.map((item) => {
          const typeStyle = TYPE_STYLES[item.type] ?? TYPE_STYLES.bid;
          return (
            <div
              key={item.id}
              className={cn(
                "rounded-lg border p-4 bg-card hover:bg-muted/20 transition-colors",
                item.isNew && "border-l-4 border-l-red-500",
                onRowClick && "cursor-pointer active:bg-muted/30"
              )}
              onClick={() => onRowClick?.(item)}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "px-2 py-0.5 rounded-md text-xs font-medium",
                      typeStyle.bg,
                      typeStyle.text
                    )}
                  >
                    {typeStyle.label}
                  </span>
                  {item.isNew && (
                    <Badge className="bg-red-500 text-white text-[10px] px-1.5 py-0">NEW</Badge>
                  )}
                </div>
                {item.type !== "order" && item.url && (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-primary"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                )}
              </div>
              <p className="text-sm font-medium text-foreground line-clamp-2 mb-2">{item.title}</p>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="truncate max-w-[40%]">{item.agency}</span>
                <span className="font-mono">{item.budget}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
                <span>{item.postDate}</span>
                {item.deadline && (() => {
                  const info = getDeadlineInfo(item.deadline);
                  return <span className={info.className}>{info.label}</span>;
                })()}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
