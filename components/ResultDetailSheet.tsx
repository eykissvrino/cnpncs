"use client";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import type { UnifiedResult } from "@/types/narajan";

const TYPE_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  bid: { bg: "bg-blue-50", text: "text-blue-700", label: "입찰공고" },
  order: { bg: "bg-amber-50", text: "text-amber-700", label: "발주계획" },
  prespec: { bg: "bg-emerald-50", text: "text-emerald-700", label: "사전규격" },
};

interface ResultDetailSheetProps {
  item: (UnifiedResult & { isNew?: boolean }) | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ResultDetailSheet({ item, open, onOpenChange }: ResultDetailSheetProps) {
  if (!item) return null;

  const typeStyle = TYPE_STYLES[item.type] ?? TYPE_STYLES.bid;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader className="pb-4">
          <div className="flex items-center gap-2 mb-2">
            <span className={cn("px-2 py-0.5 rounded-md text-xs font-medium", typeStyle.bg, typeStyle.text)}>
              {typeStyle.label}
            </span>
            {item.isNew && (
              <Badge className="bg-red-500 text-white text-[10px]">NEW</Badge>
            )}
          </div>
          <SheetTitle className="text-left text-base leading-snug">{item.title}</SheetTitle>
        </SheetHeader>

        <div className="space-y-4">
          {/* 기본 정보 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-muted-foreground mb-1">기관명</p>
              <p className="text-sm font-medium">{item.agency}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">예산</p>
              <p className="text-sm font-mono font-medium">{item.budget}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">등록일</p>
              <p className="text-sm">{item.postDate}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">마감일</p>
              <p className="text-sm">{item.deadline || "—"}</p>
            </div>
          </div>

          {/* 나라장터 링크 */}
          {item.url && (
            <Button variant="outline" className="w-full" asChild>
              <a href={item.url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" />
                나라장터에서 보기
              </a>
            </Button>
          )}

          {/* 상세 정보 */}
          {item.rawData && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">상세 정보</p>
              <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5 max-h-80 overflow-y-auto">
                {(() => {
                  try {
                    const raw = JSON.parse(item.rawData);
                    return Object.entries(raw).map(([key, value]) => {
                      if (!value || value === "" || value === "-") return null;
                      return (
                        <div key={key} className="flex gap-2 text-xs">
                          <span className="text-muted-foreground shrink-0 w-32 truncate" title={key}>
                            {key}
                          </span>
                          <span className="text-foreground break-all">
                            {String(value)}
                          </span>
                        </div>
                      );
                    });
                  } catch {
                    return <p className="text-xs text-muted-foreground">데이터를 표시할 수 없습니다.</p>;
                  }
                })()}
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
