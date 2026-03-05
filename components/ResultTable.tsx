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
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import type { UnifiedResult } from "@/types/narajan";

interface ResultTableProps {
  results: (UnifiedResult & { isNew?: boolean })[];
  isLoading?: boolean;
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

export default function ResultTable({ results, isLoading }: ResultTableProps) {
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
    <div className="rounded-lg border shadow-sm">
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
                  item.isNew && "border-l-2 border-l-red-500"
                )}
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
                <TableCell className="text-center text-xs text-muted-foreground whitespace-nowrap">
                  {item.deadline || "—"}
                </TableCell>
                <TableCell className="text-center">
                  {item.type !== "order" && item.url ? (
                    <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-primary/10 hover:text-primary" asChild>
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
  );
}
