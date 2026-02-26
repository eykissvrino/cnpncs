# 나라장터 모니터

나라장터 발주계획 · 사전규격 · 입찰공고를 키워드로 통합 검색하는 웹 모니터링 도구입니다.

## 주요 기능

- **통합 검색**: 발주계획 / 사전규격 / 입찰공고를 키워드 하나로 동시 검색
- **키워드 즐겨찾기**: 자주 사용하는 키워드를 저장하고 자동 크롤링
- **자동 알림**: 신규 공고 발견 시 이메일 / 슬랙으로 알림 발송
- **엑셀 내보내기**: 검색 결과를 .xlsx 파일로 다운로드
- **자동 크롤링**: 설정한 주기마다 활성 키워드를 자동 검색

## 실행 방법

### 1. 환경변수 설정

`.env.local` 파일을 열어 값을 입력합니다:

```env
# 나라장터 API 키 (공공데이터포털에서 발급)
NARAJAN_API_KEY=your_api_key_here

# 이메일 알림 (Gmail 앱 비밀번호 필요)
EMAIL_USER=your@gmail.com
EMAIL_PASS=your_app_password
EMAIL_TO=recipient@email.com

# 슬랙 알림 (선택)
SLACK_BOT_TOKEN=xoxb-your-token
SLACK_CHANNEL_ID=C1234567890
```

### 2. 개발 서버 실행

```bash
npm run dev
```

http://localhost:3000 접속

### 3. 프로덕션 빌드

```bash
npm run build
npm start
```

## API 키 발급

1. [공공데이터포털](https://www.data.go.kr) 회원가입
2. 다음 서비스를 신청합니다:
   - **조달청_나라장터 입찰공고정보서비스**
   - **조달청_나라장터 사전규격정보서비스**
   - **조달청_나라장터 발주계획현황서비스**
3. 발급된 인증키를 `.env.local`의 `NARAJAN_API_KEY`에 입력

## 기술 스택

- **Frontend**: Next.js 15, React 19, Tailwind CSS, ShadCN/ui
- **Backend**: Next.js API Routes, node-cron
- **Database**: Prisma 7 + SQLite (libsql)
- **알림**: Nodemailer (Gmail), Slack Web API
