"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface ExportButtonProps {
  keyword: string;
  disabled?: boolean;
}

export default function ExportButton({ keyword, disabled }: ExportButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    if (!keyword) {
      toast.error("검색 키워드를 먼저 입력해주세요.");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(
        `/api/export?keyword=${encodeURIComponent(keyword)}`
      );
      if (!response.ok) {
        const data = await response.json() as { error?: string };
        throw new Error(data.error || "엑셀 다운로드 실패");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `narajan_${keyword}_${new Date().toISOString().substring(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("엑셀 파일이 다운로드되었습니다.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "다운로드 실패");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="outline"
      onClick={handleExport}
      disabled={disabled || loading || !keyword}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : (
        <Download className="h-4 w-4 mr-2" />
      )}
      엑셀 내보내기
    </Button>
  );
}
