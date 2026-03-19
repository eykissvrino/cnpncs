import { prisma } from "./db";
import { crawlAllBids, crawlAllOrderPlans, crawlAllPreSpecs, crawlAllBidResults } from "./narajan-api";
import type { UnifiedResult } from "@/types/narajan";

// 전체 크롤링: 최근 N일치 데이터를 모두 가져와 DB에 저장
export async function runFullCrawl(daysBack = 7): Promise<{ saved: number; errors: string[] }> {
  const errors: string[] = [];
  let saved = 0;

  console.log(`[crawler] 전체 크롤링 시작 (최근 ${daysBack}일)`);

  try {
    const [bids, orders, preSpecs, bidResults] = await Promise.allSettled([
      crawlAllBids(daysBack),
      crawlAllOrderPlans(),
      crawlAllPreSpecs(),
      crawlAllBidResults(daysBack),
    ]);

    const allItems = [
      ...(bids.status === "fulfilled" ? bids.value : []),
      ...(orders.status === "fulfilled" ? orders.value : []),
      ...(preSpecs.status === "fulfilled" ? preSpecs.value : []),
      ...(bidResults.status === "fulfilled" ? bidResults.value : []),
    ];

    if (bids.status === "rejected") errors.push("입찰공고 크롤링 실패: " + String(bids.reason));
    if (orders.status === "rejected") errors.push("발주계획 크롤링 실패: " + String(orders.reason));
    if (preSpecs.status === "rejected") errors.push("사전규격 크롤링 실패: " + String(preSpecs.reason));
    if (bidResults.status === "rejected") errors.push("낙찰결과 크롤링 실패: " + String(bidResults.reason));

    console.log(`[crawler] 수집 완료: ${allItems.length}건`);

    // DB에 upsert (bidNumber 기준 중복 방지)
    for (const item of allItems) {
      try {
        const existing = await prisma.crawlResult.findUnique({ where: { bidNumber: item.id } });
        if (!existing) {
          await prisma.crawlResult.create({
            data: {
              type: item.type,
              title: item.title,
              agency: item.agency,
              budget: item.budget,
              deadline: item.deadline !== "-" ? item.deadline : null,
              postDate: item.postDate,
              bidNumber: item.id,
              url: item.url || null,
              rawData: item.rawData,
              isNew: true,
              notified: false,
            },
          });
          saved++;
        }
      } catch {
        // 중복 등 무시
      }
    }

    // BidResult 모델에 별도 저장 및 Company 업데이트
    if (bidResults.status === "fulfilled") {
      await saveBidResultsAndUpdateCompanies(bidResults.value);
    }

    console.log(`[crawler] DB 저장: ${saved}건 신규`);
  } catch (e) {
    errors.push("크롤링 오류: " + String(e));
  }

  return { saved, errors };
}

// BidResult 저장 및 Company 통계 업데이트
async function saveBidResultsAndUpdateCompanies(items: UnifiedResult[]): Promise<void> {
  for (const item of items) {
    try {
      const rawData = JSON.parse(item.rawData);
      const bidNtceNo = rawData.bidNtceNo || "";
      const bidNtceOrd = rawData.bidNtceOrd || "";
      const companyBizno = rawData.prcbdrBizno || "";

      if (!bidNtceNo || !companyBizno) continue;

      // BidResult 저장
      const bidResult = await prisma.bidResult.upsert({
        where: {
          bidNtceNo_bidNtceOrd_companyBizno: {
            bidNtceNo,
            bidNtceOrd,
            companyBizno,
          },
        },
        update: {},
        create: {
          bidNtceNo,
          bidNtceOrd,
          bidNtceNm: rawData.bidNtceNm || "",
          opengDt: rawData.opengDt || null,
          sucsfbidMthdNm: rawData.sucsfbidMthdNm || null,
          companyName: rawData.prcbdrNm || null,
          companyBizno,
          bidAmount: rawData.bidprcAmt || null,
          sucsfbidAmt: rawData.sucsfbidAmt || null,
          ranking: rawData.rnkng ? parseInt(rawData.rnkng, 10) : null,
          resultType: "completed",
          agency: rawData.ntceInsttNm || null,
          rawData: item.rawData,
        },
      });

      // Company 통계 업데이트
      if (companyBizno) {
        const ranking = rawData.rnkng ? parseInt(rawData.rnkng, 10) : 999;
        const isWin = ranking === 1;

        await prisma.company.upsert({
          where: { bizno: companyBizno },
          update: {
            totalBids: { increment: 1 },
            totalWins: isWin ? { increment: 1 } : undefined,
            totalAmount: rawData.sucsfbidAmt || undefined,
            lastBidDate: rawData.rgstDt?.substring(0, 10) || undefined,
            updatedAt: new Date(),
          },
          create: {
            bizno: companyBizno,
            name: rawData.prcbdrNm || "Unknown",
            totalBids: 1,
            totalWins: isWin ? 1 : 0,
            totalAmount: rawData.sucsfbidAmt || null,
            lastBidDate: rawData.rgstDt?.substring(0, 10) || null,
          },
        });
      }
    } catch (error) {
      console.error("[BidResult 저장 실패]", (error as Error)?.message);
    }
  }
}

// 키워드 매칭: DB에 저장된 새 항목 중 등록된 키워드와 매칭하여 keywordId 설정
export async function runKeywordNotify(): Promise<{ newCount: number; errors: string[] }> {
  const errors: string[] = [];
  let newCount = 0;

  const keywords = await prisma.keyword.findMany({ where: { active: true } });

  for (const kw of keywords) {
    try {
      // DB에서 키워드 매칭 (미알림 항목)
      const matched = await prisma.crawlResult.findMany({
        where: {
          notified: false,
          OR: [
            { title: { contains: kw.name } },
            { agency: { contains: kw.name } },
          ],
        },
        take: 50,
      });

      if (matched.length === 0) continue;

      // 키워드와 연결 & 알림 플래그 설정
      for (const item of matched) {
        try {
          await prisma.crawlResult.update({
            where: { id: item.id },
            data: { keywordId: kw.id, notified: true },
          });
          newCount++;
        } catch { /* 무시 */ }
      }
    } catch (e) {
      errors.push(`[${kw.name}] ${String(e)}`);
    }
  }

  return { newCount, errors };
}

// 통합 크롤링 실행 (전체 수집 + 키워드 알림)
// 첫 크롤링(DB 비어있을 때)은 60일, 이후 정기 크롤링은 14일
export async function runCrawl(daysBack?: number): Promise<{ newCount: number; errors: string[] }> {
  // daysBack이 지정되지 않으면 DB 상태에 따라 자동 결정
  if (!daysBack) {
    const count = await prisma.crawlResult.count();
    daysBack = count < 100 ? 60 : 14;
    console.log(`[crawler] DB ${count < 100 ? `${count}건 부족 → 초기 60일` : `${count}건 존재 → 최근 14일`} 크롤링`);
  }
  const crawlResult = await runFullCrawl(daysBack);
  const notifyResult = await runKeywordNotify();
  return {
    newCount: crawlResult.saved + notifyResult.newCount,
    errors: [...crawlResult.errors, ...notifyResult.errors],
  };
}

export function startScheduler(): void {
  console.log("[scheduler] 스케줄러 준비 완료 (수동 호출용)");
}

export function stopScheduler(): void {
  console.log("[scheduler] 스케줄러 중지됨");
}
