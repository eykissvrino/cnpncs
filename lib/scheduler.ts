import cron, { type ScheduledTask } from "node-cron";
import { prisma } from "./db";
import { crawlAllBids, crawlAllOrderPlans, crawlAllPreSpecs } from "./narajan-api";
import { sendEmailNotification, sendSubscriberNotifications, sendDigestNotifications } from "./notify";

let schedulerTask: ScheduledTask | null = null;
let dailyDigestTask: ScheduledTask | null = null;
let weeklyDigestTask: ScheduledTask | null = null;

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

  // 전체 미알림 신규 항목 수집 (구독자 알림용)
  const allNewResults: typeof matched = [];

  for (const kw of keywords) {
    try {
      // DB에서 키워드 매칭 (미알림 항목)
      var matched = await prisma.crawlResult.findMany({
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
          allNewResults.push(item);
        } catch { /* 무시 */ }
      }

      // 레거시 이메일 알림 (EMAIL_TO 설정 시)
      if (settings?.emailEnabled) await sendEmailNotification(matched);
    } catch (e) {
      errors.push(`[${kw.name}] ${String(e)}`);
    }
  }

  // 구독자별 즉시 알림 발송
  if (allNewResults.length > 0) {
    try {
      const subResult = await sendSubscriberNotifications(allNewResults);
      if (subResult.errors.length > 0) {
        errors.push(...subResult.errors);
      }
      console.log(`[notify] 구독자 즉시 알림: ${subResult.sent}명 발송`);
    } catch (e) {
      errors.push(`구독자 알림 오류: ${String(e)}`);
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

  // 메인 크롤링 스케줄
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

  // 매일 오전 9시 daily digest
  if (dailyDigestTask) dailyDigestTask.stop();
  dailyDigestTask = cron.schedule("0 9 * * *", async () => {
    console.log(`[scheduler] daily digest 시작: ${new Date().toISOString()}`);
    const result = await sendDigestNotifications("daily");
    console.log(`[scheduler] daily digest: ${result.sent}명 발송`);
  });

  // 매주 월요일 오전 9시 weekly digest
  if (weeklyDigestTask) weeklyDigestTask.stop();
  weeklyDigestTask = cron.schedule("0 9 * * 1", async () => {
    console.log(`[scheduler] weekly digest 시작: ${new Date().toISOString()}`);
    const result = await sendDigestNotifications("weekly");
    console.log(`[scheduler] weekly digest: ${result.sent}명 발송`);
  });

  console.log(`[scheduler] 스케줄러 등록됨: ${schedule} (+ daily 09:00, weekly Mon 09:00)`);
}

export function stopScheduler(): void {
  if (schedulerTask) {
    schedulerTask.stop();
    schedulerTask = null;
  }
  if (dailyDigestTask) {
    dailyDigestTask.stop();
    dailyDigestTask = null;
  }
  if (weeklyDigestTask) {
    weeklyDigestTask.stop();
    weeklyDigestTask = null;
  }
  console.log("[scheduler] 스케줄러 중지됨");
}
