import cron, { type ScheduledTask } from "node-cron";
import { prisma } from "./db";
import { crawlAllBids, crawlAllOrderPlans, crawlAllPreSpecs, crawlAllBidResults } from "./narajan-api";
import type { UnifiedResult } from "@/types/narajan";

let schedulerTask: ScheduledTask | null = null;
let fullCrawlRunning = false;

// 전체 크롤링: 최근 N일치 데이터를 모두 가져와 DB에 저장
export async function runFullCrawl(daysBack = 7): Promise<{ saved: number; errors: string[] }> {
  if (fullCrawlRunning) {
    return { saved: 0, errors: ["이미 전체 크롤링이 진행 중입니다."] };
  }

  fullCrawlRunning = true;
  const errors: string[] = [];
  let saved = 0;

  console.log(`[crawler] 전체 크롤링 시작 (최근 ${daysBack}일)`);

  try {
    const allItems: UnifiedResult[] = [];
    let bidResultsItems: UnifiedResult[] = [];

    try {
      const bids = await crawlAllBids(daysBack);
      allItems.push(...bids);
    } catch (error) {
      errors.push("입찰공고 크롤링 실패: " + String(error));
    }

    try {
      const orders = await crawlAllOrderPlans();
      allItems.push(...orders);
    } catch (error) {
      errors.push("발주계획 크롤링 실패: " + String(error));
    }

    try {
      const preSpecs = await crawlAllPreSpecs();
      allItems.push(...preSpecs);
    } catch (error) {
      errors.push("사전규격 크롤링 실패: " + String(error));
    }

    try {
      bidResultsItems = await crawlAllBidResults(daysBack);
      allItems.push(...bidResultsItems);
    } catch (error) {
      errors.push("낙찰결과 크롤링 실패: " + String(error));
    }

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
    if (bidResultsItems.length > 0) {
      await saveBidResultsAndUpdateCompanies(bidResultsItems);
    }

    console.log(`[crawler] DB 저장: ${saved}건 신규`);
  } catch (e) {
    errors.push("크롤링 오류: " + String(e));
  } finally {
    fullCrawlRunning = false;
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

      await prisma.bidResult.upsert({
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
      const matched = await prisma.crawlResult.findMany({
        where: {
          notified: false,
          OR: [
            { title: { contains: kw.name } },
            { agency: { contains: kw.name } },
          ],
        },
        take: 200,
      });

      if (matched.length === 0) continue;

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

// 통합 크롤링 실행 (전체 수집 + 키워드 매칭)
export async function runCrawl(daysBack = 30): Promise<{ newCount: number; errors: string[] }> {
  const crawlResult = await runFullCrawl(daysBack);
  const notifyResult = await runKeywordNotify();
  return {
    newCount: crawlResult.saved + notifyResult.newCount,
    errors: [...crawlResult.errors, ...notifyResult.errors],
  };
}

// node-cron 스케줄러: 6시간마다 자동 크롤링
export function startScheduler(): void {
  if (schedulerTask) {
    schedulerTask.stop();
  }

  const schedule = process.env.CRON_SCHEDULE || "0 */6 * * *";

  if (!cron.validate(schedule)) {
    console.error(`[scheduler] 잘못된 cron 스케줄: ${schedule}`);
    return;
  }

  schedulerTask = cron.schedule(schedule, async () => {
    console.log(`[scheduler] 자동 크롤링 시작: ${new Date().toISOString()}`);
    const result = await runCrawl(3);
    console.log(`[scheduler] 완료: 신규 ${result.newCount}건, 오류 ${result.errors.length}건`);
    if (result.errors.length > 0) {
      console.error("[scheduler] 오류:", result.errors);
    }
  });

  // 서버 시작 시 초기 크롤링 (30초 후 실행 — 서버 완전 준비 대기)
  setTimeout(async () => {
    const count = await prisma.crawlResult.count();
    if (count < 100) {
      console.log("[scheduler] 초기 데이터 부족 — 7일치 크롤링 시작");
      const result = await runCrawl(7);
      console.log(`[scheduler] 초기 크롤링 완료: ${result.newCount}건`);
    }
  }, 30_000);

  console.log(`[scheduler] 스케줄러 등록됨: ${schedule}`);
}

export function stopScheduler(): void {
  if (schedulerTask) {
    schedulerTask.stop();
    schedulerTask = null;
  }
  console.log("[scheduler] 스케줄러 중지됨");
}
