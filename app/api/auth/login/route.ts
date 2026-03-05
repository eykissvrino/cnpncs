import { NextRequest, NextResponse } from "next/server";
import { generateSessionToken } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const { password } = (await request.json()) as { password: string };

    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword) {
      return NextResponse.json({ error: "서버에 ADMIN_PASSWORD가 설정되지 않았습니다." }, { status: 500 });
    }

    if (password !== adminPassword) {
      return NextResponse.json({ error: "비밀번호가 올바르지 않습니다." }, { status: 401 });
    }

    const token = generateSessionToken(password);
    const response = NextResponse.json({ success: true });

    response.cookies.set("narajan-session", token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7일
      secure: process.env.NODE_ENV === "production",
    });

    return response;
  } catch {
    return NextResponse.json({ error: "로그인 처리 실패" }, { status: 500 });
  }
}
