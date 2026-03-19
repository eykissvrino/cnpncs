import { NextResponse } from "next/server";
import axios from "axios";

// 나라장터 API 연결 테스트 — 브라우저에서 /api/cron/test 접속하면 진단 결과 표시
export async function GET() {
  const results: Record<string, unknown> = {};
  const apiKey = process.env.NARAJAN_API_KEY;

  // 1. 환경변수 확인
  results.envCheck = {
    NARAJAN_API_KEY: apiKey ? `설정됨 (${apiKey.substring(0, 10)}...길이:${apiKey.length})` : "미설정",
    DATABASE_URL: process.env.DATABASE_URL ? "설정됨" : "미설정",
    AUTH_SECRET: process.env.AUTH_SECRET ? "설정됨" : "미설정",
  };

  if (!apiKey) {
    return NextResponse.json({ error: "NARAJAN_API_KEY 미설정", results }, { status: 500 });
  }

  // 2. 입찰공고 API 테스트 (용역)
  try {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const endDt = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}2359`;
    const start = new Date(now);
    start.setDate(start.getDate() - 7);
    const bgnDt = `${start.getFullYear()}${pad(start.getMonth() + 1)}${pad(start.getDate())}0000`;

    const bidUrl = "https://apis.data.go.kr/1230000/ad/BidPublicInfoService/getBidPblancListInfoServc";
    const bidRes = await axios.get(bidUrl, {
      params: {
        serviceKey: apiKey,
        type: "json",
        numOfRows: "5",
        pageNo: "1",
        inqryDiv: "1",
        inqryBgnDt: bgnDt,
        inqryEndDt: endDt,
      },
      timeout: 15000,
    });

    const bidHeader = bidRes.data?.response?.header;
    const bidTotal = bidRes.data?.response?.body?.totalCount;
    results.bidTest = {
      status: "성공",
      resultCode: bidHeader?.resultCode,
      resultMsg: bidHeader?.resultMsg,
      totalCount: bidTotal,
      sampleTitle: bidRes.data?.response?.body?.items?.item?.[0]?.bidNtceNm || "(없음)",
    };
  } catch (error) {
    results.bidTest = {
      status: "실패",
      error: error instanceof Error ? error.message : String(error),
      hint: "API 키가 올바른지 확인하세요. 공공데이터포털에서 입찰공고정보서비스 승인 여부도 확인.",
    };
  }

  // 3. 사전규격 API 테스트
  try {
    const preSpecUrl = "https://apis.data.go.kr/1230000/ao/HrcspSsstndrdInfoService/getPublicPrcureThngInfoServc";
    const preRes = await axios.get(preSpecUrl, {
      params: {
        serviceKey: apiKey,
        type: "json",
        numOfRows: "5",
        pageNo: "1",
      },
      timeout: 15000,
    });

    const preHeader = preRes.data?.response?.header;
    const preTotal = preRes.data?.response?.body?.totalCount;
    results.preSpecTest = {
      status: "성공",
      resultCode: preHeader?.resultCode,
      resultMsg: preHeader?.resultMsg,
      totalCount: preTotal,
    };
  } catch (error) {
    results.preSpecTest = {
      status: "실패",
      error: error instanceof Error ? error.message : String(error),
    };
  }

  // 4. DB 테스트
  try {
    const { prisma } = await import("@/lib/db");
    const kwCount = await prisma.keyword.count();
    const crawlCount = await prisma.crawlResult.count();
    results.dbTest = {
      status: "성공",
      keywordCount: kwCount,
      crawlResultCount: crawlCount,
    };
  } catch (error) {
    results.dbTest = {
      status: "실패",
      error: error instanceof Error ? error.message : String(error),
    };
  }

  return NextResponse.json(results, { status: 200 });
}
