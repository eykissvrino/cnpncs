# 나라장터 모니터 v2.0

시앤피컨설팅 나라장터 용역 입찰공고 모니터링 + 수주 분석 웹앱입니다.

## 주요 기능

- **통합 검색**: 발주계획 / 사전규격 / 입찰공고 / 개찰결과를 키워드로 동시 검색
- **본부별 키워드 모니터링**: 10개 본부별 키워드 격리 + 관리자 할당
- **자동 크롤링**: 외부 스케줄러(Railway Cron)로 최신 데이터 수집 (최대 90일)
- **수주 분석**: 기관별 발주 현황, 기업별 수주 순위, 월별 트렌드 차트
- **관리자 대시보드**: 사용자 관리, 키워드 할당, 이용 현황 모니터링
- **엑셀 내보내기**: 검색 결과를 .xlsx 파일로 다운로드

## 환경변수

```env
DATABASE_URL=file:/data/narajan.db   # libsql DB 경로
NARAJAN_API_KEY=your_api_key         # 공공데이터포털 API 키
AUTH_SECRET=your_secret              # 세션 서명키
CRON_SECRET=your_cron_secret         # 크롤링 API 보호키
```

## 실행 방법

```bash
# 개발 서버
npm run dev

# 프로덕션 빌드
npm run build
npm start
```

## API 키 발급

1. [공공데이터포털](https://www.data.go.kr) 회원가입
2. 다음 6종 서비스를 신청합니다:
   - 조달청_나라장터 입찰공고정보서비스
   - 조달청_나라장터 사전규격정보서비스
   - 조달청_나라장터 발주계획현황서비스
   - 조달청_나라장터 낙찰정보서비스
   - 조달청_나라장터 계약정보서비스
   - 조달청_나라장터 표준서비스
3. 발급된 인증키를 환경변수 `NARAJAN_API_KEY`에 입력

## 기술 스택

- **Frontend**: Next.js 16, React 19, Tailwind CSS 4, shadcn/ui, Recharts
- **Backend**: Next.js API Routes
- **Database**: Prisma 6 + SQLite (libsql)
- **배포**: Railway (auto-deploy on main push)
