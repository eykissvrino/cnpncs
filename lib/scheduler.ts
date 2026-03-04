import cron, { type ScheduledTask } from "node-cron";
import { prisma } from "./db";
import { crawlAllBids, crawlAllOrderPlans, crawlAllPreSpecs } from "./narajan-api";
import { sendEmailNotification, sendSlackNotification } from "./notify";

let schedulerTask: ScheduledTask | null = null;

// 전체 크롤링: 최근 N일치 데이터를 모두 가져와 DB에 저장
export async function runFullCrawl(daysBack = 7): Promise<{ saved: number; errors: string[] }> {
  const errors: string[] = [];
  let saved = 0;

  console.log(`[crawler] 전체 크롤링 시작 (최근 ${daysBack}일)`);

  try {
    const [bids, orders, preSpecs] = await Promise.allSettled([
      crawlAllBids(daysBack),
      crawlAllOrderPlans(),
      crawlAllPreSpecs(),
    ]);

    const allItems = [
      ...(bids.status === "fulfilled" ? bids.value : []),
      ...(orders.status === "fulfilled" ? orders.value : []),
      ...(preSpecs.status === "fulfilled" ? preSpecs.value : []),
    ];

    if (bids.status === "rejected") errors.push("입찰공고 크롤링 실패: " + String(bids.reason));
    if (orders.status === "rejected") errors.push("발주계획 크롤링 실패: " + String(orders.reason));
    if (preSpecs.status === "rejected") errors.push("사전규격 크롤링 실패: " + String(preSpecs.reason));

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
    console.log(`[crawler] DB 저장: ${saved}건 신규`);
  } catch (e) {
    errors.push("크롤링 오류: " + String(e));
  }

  return { saved, errors };
}

// 키워드 알림: DB에 저장된 새 항목 중 등록된 키워드와 매칭 → 알림 발송
export async function runKeywordNotify(): Promise<{ newCount: number; errors: string[] }> {
  const errors: string[] = [];
  let newCount = 0;

  const keywords = await prisma.keyword.findMany({ where: { active: true } });
  const settings = await prisma.settings.findUnique({ where: { id: 1 } });

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

      // 키워드와 연결 & 알림 발송
      for (const item of matched) {
        try {
          await prisma.crawlResult.update({
            where: { id: item.id },
            data: { keywordId: kw.id, notified: settings?.emailEnabled || settings?.slackEnabled || false },
          });
          newCount++;
        } catch { /* 무시 */ }
      }

      if (settings?.emailEnabled) await sendEmailNotification(matched);
      if (settings?.slackEnabled) await sendSlackNotification(matched);
    } catch (e) {
      errors.push(`[${kw.name}] ${String(e)}`);
    }
  }

  return { newCount, errors };
}

// 통합 크롤링 실행 (전체 수집 + 키워드 알림)
// 수동 실행 시 30일, 스케줄 실행 시 7일 권장
export async function runCrawl(daysBack = 30): Promise<{ newCount: number; errors: string[] }> {
  const crawlResult = await runFullCrawl(daysBack);
  const notifyResult = await runKeywordNotify();
  return {
    newCount: crawlResult.saved + notifyResult.newCount,
    errors: [...crawlResult.errors, ...notifyResult.errors],
  };
}

export function startScheduler(): void {
  if (schedulerTask) {
    schedulerTask.stop();
  }

  const schedule = process.env.CRON_SCHEDULE || "0 */2 * * *";

  if (!cron.validate(schedule)) {
    console.error(`[scheduler] 잘못된 cron 스케줄: ${schedule}`);
    return;
  }

  schedulerTask = cron.schedule(schedule, async () => {
    console.log(`[scheduler] 크롤링 시작: ${new Date().toISOString()}`);
    const result = await runCrawl(7); // 스케줄 실행은 7일 (최신 업데이트만)
    console.log(
      `[scheduler] 완료: 신규 ${result.newCount}건, 오류 ${result.errors.length}건`
    );
    if (result.errors.length > 0) {
      console.error("[scheduler] 오류:", result.errors);
    }
  });

  console.log(`[scheduler] 스케줄러 등록됨: ${schedule}`);
}

export function stopScheduler(): void {
  if (schedulerTask) {
    schedulerTask.stop();
    schedulerTask = null;
    console.log("[scheduler] 스케줄러 중지됨");
  }
}
