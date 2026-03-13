import { NextRequest, NextResponse } from "next/server";
import { authenticateUser, createSessionCookie } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const { username, password } = (await request.json()) as {
      username: string;
      password: string;
    };

    if (!username || !password) {
      return NextResponse.json({ error: "아이디와 비밀번호를 입력하세요." }, { status: 400 });
    }

    const user = await authenticateUser(username, password);
    if (!user) {
      return NextResponse.json({ error: "아이디 또는 비밀번호가 올바르지 않습니다." }, { status: 401 });
    }

    const token = createSessionCookie(user.id, user.username);
    const response = NextResponse.json({
      success: true,
      user: { id: user.id, name: user.name, department: user.department, role: user.role },
    });

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
