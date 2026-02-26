import * as XLSX from "xlsx";
import type { UnifiedResult } from "@/types/narajan";

function createSheet(results: UnifiedResult[], type: string) {
  const data = results
    .filter((r) => r.type === type)
    .map((r) => ({
      기관명: r.agency,
      사업명: r.title,
      예산: r.budget,
      등록일: r.postDate,
      마감일: r.deadline,
      링크: r.url || "",
    }));

  if (data.length === 0) {
    return XLSX.utils.aoa_to_sheet([["데이터 없음"]]);
  }

  const ws = XLSX.utils.json_to_sheet(data);

  // 컬럼 너비 설정
  ws["!cols"] = [
    { wch: 30 }, // 기관명
    { wch: 50 }, // 사업명
    { wch: 15 }, // 예산
    { wch: 12 }, // 등록일
    { wch: 12 }, // 마감일
    { wch: 60 }, // 링크
  ];

  return ws;
}

export function generateExcel(results: UnifiedResult[]): Buffer {
  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(wb, createSheet(results, "order"), "발주계획");
  XLSX.utils.book_append_sheet(wb, createSheet(results, "prespec"), "사전규격");
  XLSX.utils.book_append_sheet(wb, createSheet(results, "bid"), "입찰공고");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return buf as Buffer;
}
