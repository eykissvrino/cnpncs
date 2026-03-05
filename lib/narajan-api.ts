import axios from "axios";
import type {
  ApiResponse,
  BidAnnouncementItem,
  PreSpecItem,
  OrderPlanItem,
  UnifiedResult,
} from "@/types/narajan";

// 입찰공고: /ad/ 경로
const BID_BASE_URL = "https://apis.data.go.kr/1230000/ad";
// 발주계획/사전규격: /ao/ 경로
const NARAJAN_BASE_URL = "https://apis.data.go.kr/1230000/ao";

function getApiKey(): string {
  const key = process.env.NARAJAN_API_KEY;
  if (!key || key === "your_api_key_here") {
    throw new Error(
      "NARAJAN_API_KEY가 설정되지 않았습니다. .env.local 파일에 API 키를 입력해주세요."
    );
  }
  return key;
}

function parseItems<T>(items: unknown): T[] {
  if (!items || items === "") return [];
  if (Array.isArray(items)) return items as T[];
  if (typeof items === "object" && items !== null && "item" in items) {
    const item = (items as { item: T | T[] }).item;
    return Array.isArray(item) ? item : [item];
  }
  return [];
}

function formatBudget(amount: string | undefined): string {
  if (!amount || amount === "0" || amount === "") return "-";
  const num = parseInt(amount, 10);
  if (isNaN(num)) return amount;
  if (num >= 100000000) {
    return `${(num / 100000000).toFixed(1)}억원`;
  }
  if (num >= 10000) {
    return `${Math.floor(num / 10000)}만원`;
  }
  return `${num.toLocaleString()}원`;
}

function getDateRange(daysBack = 30): { inqryBgnDt: string; inqryEndDt: string } {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const inqryEndDt = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}2359`;
  const start = new Date(now);
  start.setDate(start.getDate() - daysBack);
  const inqryBgnDt = `${start.getFullYear()}${pad(start.getMonth() + 1)}${pad(start.getDate())}0000`;
  return { inqryBgnDt, inqryEndDt };
}

async function fetchWithRetry<T>(
  url: string,
  params: Record<string, string>,
  retries = 1
): Promise<T> {
  try {
    const response = await axios.get<T>(url, { params, timeout: 15000 });
    return response.data;
  } catch (error) {
    if (retries > 0) {
      await new Promise((r) => setTimeout(r, 1000));
      return fetchWithRetry<T>(url, params, retries - 1);
    }
    throw error;
  }
}

// ────────────────────────────────────────────────
// 입찰공고
// API: getBidPblancListInfoServc/Thng/Cnstwk (날짜 범위 필요, keyword는 클라이언트 필터)
// ────────────────────────────────────────────────
export async function searchBidAnnouncements(
  keyword: string,
  page = 1
): Promise<UnifiedResult[]> {
  const apiKey = getApiKey();
  const { inqryBgnDt, inqryEndDt } = getDateRange(30);

  const endpoints = [
    "BidPublicInfoService/getBidPblancListInfoServc",   // 용역만
  ];

  const results = await Promise.allSettled(
    endpoints.map((endpoint) =>
      fetchWithRetry<ApiResponse<BidAnnouncementItem>>(
        `${BID_BASE_URL}/${endpoint}`,
        {
          serviceKey: apiKey,
          type: "json",
          numOfRows: "100",
          pageNo: String(page),
          inqryDiv: "1",
          inqryBgnDt,
          inqryEndDt,
        }
      )
    )
  );

  const items: UnifiedResult[] = [];
  for (const result of results) {
    if (result.status === "rejected") continue;
    const body = result.value?.response?.body;
    if (!body || body.totalCount === 0) continue;
    const rawItems = parseItems<BidAnnouncementItem>(body.items);

    // 키워드 클라이언트 필터 (API가 서버사이드 필터를 지원하지 않음)
    const filtered = keyword
      ? rawItems.filter(
          (item) =>
            item.bidNtceNm?.includes(keyword) ||
            item.prdctClsfcNoNm?.includes(keyword) ||
            item.ntceInsttNm?.includes(keyword)
        )
      : rawItems;

    for (const item of filtered) {
      items.push({
        id: `bid-${item.bidNtceNo}-${item.bidNtceOrd}`,
        type: "bid",
        typeLabel: "입찰공고",
        title: item.bidNtceNm || "-",
        agency: item.ntceInsttNm || "-",
        budget: formatBudget(item.asignBdgtAmt),
        postDate: item.bidNtceDt?.substring(0, 10) || "-",
        deadline: item.bidClseDt?.substring(0, 10) || "-",
        url: item.bidNtceDtlUrl || item.ntceSpecDocUrl1 || item.ntceSpecDocUrl || "",
        rawData: JSON.stringify(item),
      });
    }
  }
  return items;
}

// ────────────────────────────────────────────────
// 사전규격
// API: HrcspSsstndrdInfoService
// 물품(Thng), 용역(Servc), 공사(Cnstwk), 외자(Frgcpt) 4종 엔드포인트
// ────────────────────────────────────────────────
const PRESPEC_ENDPOINTS = [
  "HrcspSsstndrdInfoService/getPublicPrcureThngInfoServcPPSSrch",   // 물품
  "HrcspSsstndrdInfoService/getPublicPrcureServcInfoServcPPSSrch",  // 용역
  "HrcspSsstndrdInfoService/getPublicPrcureCnstwkInfoServcPPSSrch", // 공사
  "HrcspSsstndrdInfoService/getPublicPrcureFrgcptInfoServcPPSSrch", // 외자
];

function mapPreSpecItem(item: PreSpecItem): UnifiedResult {
  return {
    id: `prespec-${item.bfSpecRgstNo || item.prePriceNo}`,
    type: "prespec" as const,
    typeLabel: "사전규격",
    title: item.prdctClsfcNoNm || "-",
    agency: item.ntceInsttNm || "-",
    budget: formatBudget(item.asignBdgtAmt),
    postDate: item.opninRgstDt?.substring(0, 10) || "-",
    deadline: item.opninRgstClseDt?.substring(0, 10) || "-",
    url: item.ntceSpecDocUrl || "",
    rawData: JSON.stringify(item),
  };
}

export async function searchPreSpecs(
  keyword: string,
  page = 1
): Promise<UnifiedResult[]> {
  const apiKey = getApiKey();
  const results = await Promise.allSettled(
    PRESPEC_ENDPOINTS.map((endpoint) =>
      fetchWithRetry<ApiResponse<PreSpecItem>>(
        `${NARAJAN_BASE_URL}/${endpoint}`,
        {
          serviceKey: apiKey,
          type: "json",
          numOfRows: "100",
          pageNo: String(page),
          prdctClsfcNoNm: keyword,
        }
      )
    )
  );

  const items: UnifiedResult[] = [];
  for (const result of results) {
    if (result.status === "rejected") continue;
    const body = result.value?.response?.body;
    if (!body || body.totalCount === 0) continue;
    const rawItems = parseItems<PreSpecItem>(body.items);
    for (const item of rawItems) {
      items.push(mapPreSpecItem(item));
    }
  }
  return items;
}

// ────────────────────────────────────────────────
// 발주계획
// API: OrderPlanSttusService/getOrderPlanSttusListServcPPSSrch
// bizNm으로 키워드 검색 가능 (서버사이드 필터 작동)
// ────────────────────────────────────────────────
export async function searchOrderPlans(
  keyword: string,
  page = 1
): Promise<UnifiedResult[]> {
  const apiKey = getApiKey();
  try {
    const params: Record<string, string> = {
      serviceKey: apiKey,
      type: "json",
      numOfRows: "100",
      pageNo: String(page),
    };
    if (keyword) {
      params.bizNm = keyword;
    }

    const data = await fetchWithRetry<ApiResponse<OrderPlanItem>>(
      `${NARAJAN_BASE_URL}/OrderPlanSttusService/getOrderPlanSttusListServcPPSSrch`,
      params
    );
    const body = data?.response?.body;
    if (!body || body.totalCount === 0) return [];
    const rawItems = parseItems<OrderPlanItem>(body.items);
    return rawItems.map((item) => ({
      id: `order-${item.orderPlanUntyNo || item.orderPlanSno || Math.random()}`,
      type: "order" as const,
      typeLabel: "발주계획",
      title: item.bizNm || item.prdctClsfcNoNm || "-",
      agency: item.orderInsttNm || item.totlmngInsttNm || "-",
      budget: formatBudget(item.sumOrderAmt || item.orderContrctAmt),
      postDate: item.nticeDt?.substring(0, 10) ||
        (item.orderYear && item.orderMnth ? `${item.orderYear}-${item.orderMnth.padStart(2, "0")}` : "-"),
      deadline: "-",
      url: item.bizNm
        ? `https://www.g2b.go.kr/search/search.jsp?query=${encodeURIComponent(item.bizNm)}`
        : "",
      rawData: JSON.stringify(item),
    }));
  } catch {
    return [];
  }
}

// ────────────────────────────────────────────────
// 전체 크롤링 (DB 저장용)
// 날짜 범위 내 모든 입찰공고/발주계획을 페이지네이션으로 수집
// ────────────────────────────────────────────────
export async function crawlAllBids(daysBack = 7): Promise<UnifiedResult[]> {
  const apiKey = getApiKey();
  const endpoint = "BidPublicInfoService/getBidPblancListInfoServc"; // 용역만
  const allItems: UnifiedResult[] = [];
  const pad = (n: number) => String(n).padStart(2, "0");

  // daysBack일을 3일씩 청크로 나눠서 수집
  // 이유: 30일치 한 번에 요청 시 ~270페이지 → 50페이지 캡에서 잘림
  // 3일씩 나누면 ~27페이지/청크 → 캡 내에서 완전 수집 가능
  const CHUNK_DAYS = 3;

  for (let offset = 0; offset < daysBack; offset += CHUNK_DAYS) {
    const chunkSize = Math.min(CHUNK_DAYS, daysBack - offset);

    const endDate = new Date();
    endDate.setDate(endDate.getDate() - offset);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - (offset + chunkSize));

    const inqryEndDt = `${endDate.getFullYear()}${pad(endDate.getMonth() + 1)}${pad(endDate.getDate())}2359`;
    const inqryBgnDt = `${startDate.getFullYear()}${pad(startDate.getMonth() + 1)}${pad(startDate.getDate())}0000`;

    try {
      const first = await fetchWithRetry<ApiResponse<BidAnnouncementItem>>(
        `${BID_BASE_URL}/${endpoint}`,
        { serviceKey: apiKey, type: "json", numOfRows: "100", pageNo: "1", inqryDiv: "1", inqryBgnDt, inqryEndDt }
      );
      const totalCount = first?.response?.body?.totalCount ?? 0;
      const totalPages = Math.min(Math.ceil(totalCount / 100), 50);

      const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

      for (let i = 0; i < pages.length; i += 10) {
        const batch = pages.slice(i, i + 10);
        const results = await Promise.allSettled(
          batch.map((p) =>
            fetchWithRetry<ApiResponse<BidAnnouncementItem>>(
              `${BID_BASE_URL}/${endpoint}`,
              { serviceKey: apiKey, type: "json", numOfRows: "100", pageNo: String(p), inqryDiv: "1", inqryBgnDt, inqryEndDt }
            )
          )
        );
        for (const r of results) {
          if (r.status === "rejected") continue;
          const items = parseItems<BidAnnouncementItem>(r.value?.response?.body?.items);
          for (const item of items) {
            allItems.push({
              id: `bid-${item.bidNtceNo}-${item.bidNtceOrd}`,
              type: "bid",
              typeLabel: "입찰공고",
              title: item.bidNtceNm || "-",
              agency: item.ntceInsttNm || "-",
              budget: formatBudget(item.asignBdgtAmt),
              postDate: item.bidNtceDt?.substring(0, 10) || "-",
              deadline: item.bidClseDt?.substring(0, 10) || "-",
              url: item.bidNtceDtlUrl || item.ntceSpecDocUrl1 || item.ntceSpecDocUrl || "",
              rawData: JSON.stringify(item),
            });
          }
        }
        if (i + 10 < pages.length) await new Promise((r) => setTimeout(r, 200));
      }
    } catch {
      // 청크 실패는 무시하고 다음 청크 진행
    }

    // 청크 간 300ms 대기 (rate limit 방지)
    if (offset + CHUNK_DAYS < daysBack) await new Promise((r) => setTimeout(r, 300));
  }

  return allItems;
}

export async function crawlAllPreSpecs(): Promise<UnifiedResult[]> {
  const apiKey = getApiKey();
  const allItems: UnifiedResult[] = [];

  for (const endpoint of PRESPEC_ENDPOINTS) {
    try {
      const first = await fetchWithRetry<ApiResponse<PreSpecItem>>(
        `${NARAJAN_BASE_URL}/${endpoint}`,
        { serviceKey: apiKey, type: "json", numOfRows: "100", pageNo: "1" }
      );
      const totalCount = first?.response?.body?.totalCount ?? 0;
      if (totalCount === 0) continue;
      const totalPages = Math.min(Math.ceil(totalCount / 100), 20);

      // 첫 페이지 데이터 먼저 처리
      const firstItems = parseItems<PreSpecItem>(first?.response?.body?.items);
      for (const item of firstItems) {
        allItems.push(mapPreSpecItem(item));
      }

      // 나머지 페이지
      const pages = Array.from({ length: totalPages - 1 }, (_, i) => i + 2);
      for (let i = 0; i < pages.length; i += 10) {
        const batch = pages.slice(i, i + 10);
        const results = await Promise.allSettled(
          batch.map((p) =>
            fetchWithRetry<ApiResponse<PreSpecItem>>(
              `${NARAJAN_BASE_URL}/${endpoint}`,
              { serviceKey: apiKey, type: "json", numOfRows: "100", pageNo: String(p) }
            )
          )
        );
        for (const r of results) {
          if (r.status === "rejected") continue;
          const items = parseItems<PreSpecItem>(r.value?.response?.body?.items);
          for (const item of items) {
            allItems.push(mapPreSpecItem(item));
          }
        }
        if (i + 10 < pages.length) await new Promise((r) => setTimeout(r, 200));
      }
    } catch {
      // 엔드포인트 실패 시 다음 엔드포인트 진행
    }
    // 엔드포인트 간 300ms 대기
    await new Promise((r) => setTimeout(r, 300));
  }
  return allItems;
}

export async function crawlAllOrderPlans(): Promise<UnifiedResult[]> {
  const apiKey = getApiKey();
  try {
    const first = await fetchWithRetry<ApiResponse<OrderPlanItem>>(
      `${NARAJAN_BASE_URL}/OrderPlanSttusService/getOrderPlanSttusListServcPPSSrch`,
      { serviceKey: apiKey, type: "json", numOfRows: "100", pageNo: "1" }
    );
    const totalCount = first?.response?.body?.totalCount ?? 0;
    const totalPages = Math.min(Math.ceil(totalCount / 100), 20);

    const allItems: UnifiedResult[] = [];
    const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

    for (let i = 0; i < pages.length; i += 10) {
      const batch = pages.slice(i, i + 10);
      const results = await Promise.allSettled(
        batch.map((p) =>
          fetchWithRetry<ApiResponse<OrderPlanItem>>(
            `${NARAJAN_BASE_URL}/OrderPlanSttusService/getOrderPlanSttusListServcPPSSrch`,
            { serviceKey: apiKey, type: "json", numOfRows: "100", pageNo: String(p) }
          )
        )
      );
      for (const r of results) {
        if (r.status === "rejected") continue;
        const items = parseItems<OrderPlanItem>(r.value?.response?.body?.items);
        for (const item of items) {
          allItems.push({
            id: `order-${item.orderPlanUntyNo || item.orderPlanSno || Math.random()}`,
            type: "order",
            typeLabel: "발주계획",
            title: item.bizNm || item.prdctClsfcNoNm || "-",
            agency: item.orderInsttNm || item.totlmngInsttNm || "-",
            budget: formatBudget(item.sumOrderAmt || item.orderContrctAmt),
            postDate: item.nticeDt?.substring(0, 10) ||
              (item.orderYear && item.orderMnth ? `${item.orderYear}-${item.orderMnth.padStart(2, "0")}` : "-"),
            deadline: "-",
            url: item.bizNm
              ? `https://www.g2b.go.kr/search/search.jsp?query=${encodeURIComponent(item.bizNm)}`
              : "",
            rawData: JSON.stringify(item),
          });
        }
      }
      if (i + 10 < pages.length) await new Promise((r) => setTimeout(r, 200));
    }
    return allItems;
  } catch {
    return [];
  }
}

export async function searchAll(keyword: string): Promise<{
  bid: UnifiedResult[];
  prespec: UnifiedResult[];
  order: UnifiedResult[];
  total: number;
}> {
  const [bidResult, prespecResult, orderResult] = await Promise.allSettled([
    searchBidAnnouncements(keyword),
    searchPreSpecs(keyword),
    searchOrderPlans(keyword),
  ]);

  const bid = bidResult.status === "fulfilled" ? bidResult.value : [];
  const prespec = prespecResult.status === "fulfilled" ? prespecResult.value : [];
  const order = orderResult.status === "fulfilled" ? orderResult.value : [];

  return {
    bid,
    prespec,
    order,
    total: bid.length + prespec.length + order.length,
  };
}
