"use client";

import { useEffect, useState } from "react";
import { Progress } from "@/components/ui/progress";
import { Loader2 } from "lucide-react";

const STAGES = [
  { label: "입찰공고 수집 중...", target: 30 },
  { label: "사전규격 수집 중...", target: 60 },
  { label: "발주계획 수집 중...", target: 85 },
  { label: "키워드 매칭 및 알림 처리 중...", target: 95 },
];

interface CrawlProgressProps {
  isActive: boolean;
}

export default function CrawlProgress({ isActive }: CrawlProgressProps) {
  const [progress, setProgress] = useState(0);
  const [stageIndex, setStageIndex] = useState(0);

  useEffect(() => {
    if (!isActive) {
      setProgress(0);
      setStageIndex(0);
      return;
    }

    const timer = setInterval(() => {
      setStageIndex((prev) => {
        if (prev < STAGES.length - 1) return prev + 1;
        return prev;
      });
    }, 15000);

    return () => clearInterval(timer);
  }, [isActive]);

  useEffect(() => {
    if (!isActive) return;
    const target = STAGES[stageIndex]?.target ?? 95;
    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= target) return prev;
        return prev + 1;
      });
    }, 500);
    return () => clearInterval(timer);
  }, [isActive, stageIndex]);

  if (!isActive) return null;

  return (
    <div className="rounded-lg border bg-primary/5 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        <p className="text-sm font-medium text-primary">
          {STAGES[stageIndex]?.label ?? "처리 중..."}
        </p>
      </div>
      <Progress value={progress} className="h-2" />
      <p className="text-xs text-muted-foreground">
        크롤링은 수 분이 소요될 수 있습니다. 이 페이지를 벗어나지 마세요.
      </p>
    </div>
  );
}
