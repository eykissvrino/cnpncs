import { NextRequest, NextResponse } from "next/server";
import { authenticateUser, createSessionCookie } from "@/lib/auth";
import { prisma } from "@/lib/db";

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

    // lastLoginAt, loginCount 업데이트
    await prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        loginCount: { increment: 1 },
      },
    });

    // AccessLog에 로그인 기록
    const clientIp = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
    await prisma.accessLog.create({
      data: {
        userId: user.id,
        action: "login",
        detail: `${user.name} (${user.username}) 로그인`,
        ip: clientIp,
      },
    });

    const token = createSessionCookie(user.id, user.username, user.role);
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
