"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ExternalLink } from "lucide-react";
import type { UnifiedResult } from "@/types/narajan";

interface ResultTableProps {
  results: UnifiedResult[];
  isLoading?: boolean;
}

const TYPE_COLORS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  bid: "default",
  prespec: "secondary",
  order: "outline",
};

const TYPE_LABELS: Record<string, string> = {
  bid: "입찰공고",
  prespec: "사전규격",
  order: "발주계획",
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
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-lg">검색 결과가 없습니다.</p>
        <p className="text-sm mt-1">다른 키워드로 검색해보세요.</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-24">유형</TableHead>
            <TableHead className="w-48">기관명</TableHead>
            <TableHead>사업명</TableHead>
            <TableHead className="w-28 text-right">예산</TableHead>
            <TableHead className="w-24 text-center">등록일</TableHead>
            <TableHead className="w-24 text-center">마감일</TableHead>
            <TableHead className="w-12 text-center">링크</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {results.map((item) => (
            <TableRow key={item.id} className="hover:bg-muted/50">
              <TableCell>
                <Badge variant={TYPE_COLORS[item.type] || "default"}>
                  {TYPE_LABELS[item.type] || item.type}
                </Badge>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {item.agency}
              </TableCell>
              <TableCell className="font-medium text-sm">{item.title}</TableCell>
              <TableCell className="text-right text-sm font-mono">
                {item.budget}
              </TableCell>
              <TableCell className="text-center text-xs text-muted-foreground">
                {item.postDate}
              </TableCell>
              <TableCell className="text-center text-xs text-muted-foreground">
                {item.deadline || "-"}
              </TableCell>
              <TableCell className="text-center">
                {(() => {
                  let url = item.url;
                  if (!url && item.type === "order") {
                    try {
                      const raw = JSON.parse(item.rawData || "{}");
                      if (raw.bizNm) {
                        url = `https://www.g2b.go.kr/search/search.jsp?query=${encodeURIComponent(raw.bizNm)}`;
                      }
                    } catch { /* ignore */ }
                  }
                  return url ? (
                    <Button variant="ghost" size="icon" asChild>
                      <a href={url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  ) : (
                    <span className="text-muted-foreground text-xs">-</span>
                  );
                })()}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
