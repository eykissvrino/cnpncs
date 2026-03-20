import { NextRequest, NextResponse } from "next/server";

const EFFECTIVE_SECRET = process.env.AUTH_SECRET;
if (!EFFECTIVE_SECRET) {
  console.error("[SECURITY] AUTH_SECRET 환경변수가 설정되지 않았습니다! 반드시 설정해주세요.");
}

async function sha256Hex(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function validateToken(token: string): Promise<boolean> {
  const parts = token.split(":");
  if (parts.length < 4) return false;
  const userId = parseInt(parts[0], 10);
  const username = parts[1];
  const role = parts[2];
  const hash = parts.slice(3).join(":");
  if (isNaN(userId) || !username || !role) return false;
  const expectedHash = await sha256Hex(`${userId}:${username}:${role}:${EFFECTIVE_SECRET}`);
  return hash === expectedHash;
}

export async function middleware(request: NextRequest) {
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

  // /admin 경로 접근 시 admin 권한 확인
  if (pathname.startsWith("/admin")) {
    const sessionToken = request.cookies.get("narajan-session")?.value;
    if (!sessionToken || !(await validateToken(sessionToken))) {
      const response = pathname.startsWith("/api/")
        ? NextResponse.json({ error: "세션이 만료되었습니다." }, { status: 401 })
        : NextResponse.redirect(new URL("/login", request.url));
      response.cookies.delete("narajan-session");
      return response;
    }
    const parts = sessionToken.split(":");
    const role = parts[2];
    if (role !== "admin") {
      return pathname.startsWith("/api/")
        ? NextResponse.json({ error: "접근 권한이 없습니다." }, { status: 403 })
        : NextResponse.redirect(new URL("/", request.url));
    }
  }

  // 세션 쿠키 확인
  const sessionToken = request.cookies.get("narajan-session")?.value;
  if (!sessionToken || !(await validateToken(sessionToken))) {
    if (sessionToken) {
      const response = pathname.startsWith("/api/")
        ? NextResponse.json({ error: "세션이 만료되었습니다." }, { status: 401 })
        : NextResponse.redirect(new URL("/login", request.url));
      response.cookies.delete("narajan-session");
      return response;
    }
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // userId, username, role을 헤더에 추가하여 API에서 사용
  const parts = sessionToken.split(":");
  const response = NextResponse.next();
  response.headers.set("x-user-id", parts[0]);
  response.headers.set("x-username", parts[1]);
  response.headers.set("x-user-role", parts[2]);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
