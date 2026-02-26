export interface BidAnnouncementItem {
  bidNtceNo: string;
  bidNtceOrd: string;
  bidNtceNm: string;
  ntceInsttNm: string;
  asignBdgtAmt: string;
  bidClseDt: string;
  bidNtceDt: string;
  bidNtceDtlUrl?: string;
  bidNtceUrl?: string;
  ntceSpecDocUrl1?: string;
  ntceSpecDocUrl2?: string;
  ntceSpecDocUrl?: string;
  bidMethdNm?: string;
  prdctClsfcNoNm?: string;
  opengDt?: string;
  presmptPrce?: string;
  srvceDivNm?: string;
  cntrctCnclsMthdNm?: string;
}

export interface PreSpecItem {
  prePriceNo: string;
  bfSpecRgstNo?: string;
  prdctClsfcNoNm: string;
  ntceInsttNm: string;
  asignBdgtAmt: string;
  opninRgstDt: string;
  opninRgstClseDt?: string;
  refNo?: string;
  srvceDivNm?: string;
  ntceSpecDocUrl?: string;
}

export interface OrderPlanItem {
  orderPlanSno?: string;
  orderPlanUntyNo?: string;
  bizNm: string;
  prdctClsfcNoNm?: string;
  dtilPrdctClsfcNoNm?: string;
  orderInsttNm: string;
  totlmngInsttNm?: string;
  sumOrderAmt?: string;
  orderContrctAmt?: string;
  nticeDt?: string;
  orderYear?: string;
  orderMnth?: string;
  cntrctMthdNm?: string;
  prcrmntMethd?: string;
  bsnsTyNm?: string;
  bsnsDivNm?: string;
}

export interface ApiResponseBody<T> {
  // items can be a direct array, wrapped in {item:...}, empty string, or null
  items: unknown;
  numOfRows: number;
  pageNo: number;
  totalCount: number;
}

export interface ApiResponse<T> {
  response: {
    header: {
      resultCode: string;
      resultMsg: string;
    };
    body: ApiResponseBody<T>;
  };
}

export type SearchType = "all" | "bid" | "prespec" | "order";

export interface UnifiedResult {
  id: string;
  type: "bid" | "prespec" | "order";
  typeLabel: string;
  title: string;
  agency: string;
  budget: string;
  postDate: string;
  deadline: string;
  url: string;
  rawData: string;
}
