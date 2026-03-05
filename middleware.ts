import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 인증 불필요 경로
  if (
    pathname === "/login" ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  // CRON_SECRET 헤더가 있는 /api/cron 요청은 통과
  if (pathname === "/api/cron") {
    const cronSecret = process.env.CRON_SECRET;
    const headerSecret = request.headers.get("x-cron-secret");
    if (cronSecret && headerSecret === cronSecret) {
      return NextResponse.next();
    }
  }

  // ADMIN_PASSWORD 미설정 시 인증 건너뜀 (개발 편의)
  if (!process.env.ADMIN_PASSWORD) {
    return NextResponse.next();
  }

  // 세션 쿠키 확인
  const sessionToken = request.cookies.get("narajan-session")?.value;
  if (!sessionToken) {
    // API 요청은 401 반환
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }
    // 페이지 요청은 로그인으로 리다이렉트
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // 토큰 검증 (middleware에서는 crypto 사용 불가하므로 간단 비교)
  // lib/auth.ts의 generateSessionToken과 동일한 로직
  const { createHash } = require("crypto") as typeof import("crypto");
  const authSecret = process.env.AUTH_SECRET || "narajan-monitor-default-secret";
  const expectedToken = createHash("sha256")
    .update(process.env.ADMIN_PASSWORD + authSecret)
    .digest("hex");

  if (sessionToken !== expectedToken) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "세션이 만료되었습니다." }, { status: 401 });
    }
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.delete("narajan-session");
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
