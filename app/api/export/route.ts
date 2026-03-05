import { NextRequest, NextResponse } from "next/server";
import { searchAll } from "@/lib/narajan-api";
import { generateExcel } from "@/lib/excel";
import { exportParamsSchema } from "@/lib/validators";
import type { UnifiedResult } from "@/types/narajan";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const parsed = exportParamsSchema.safeParse({ keyword: searchParams.get("keyword") });
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "키워드가 필요합니다." },
      { status: 400 }
    );
  }

  const keyword = parsed.data.keyword.trim();

  try {
    const results = await searchAll(keyword);
    const allResults: UnifiedResult[] = [
      ...results.bid,
      ...results.prespec,
      ...results.order,
    ];

    const excelBuffer = generateExcel(allResults);
    const filename = `narajan_${encodeURIComponent(keyword)}_${new Date().toISOString().substring(0, 10)}.xlsx`;

    return new NextResponse(new Uint8Array(excelBuffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename*=UTF-8''${filename}`,
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "엑셀 생성 실패";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
