import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth";

// 관리자 권한 확인
function requireAdmin(request: NextRequest): boolean {
  const userRole = request.headers.get("x-user-role");
  return userRole === "admin";
}

// GET: 전체 사용자 목록
export async function GET(request: NextRequest) {
  try {
    if (!requireAdmin(request)) {
      return NextResponse.json({ error: "접근 권한이 없습니다." }, { status: 403 });
    }

    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        name: true,
        department: true,
        role: true,
        active: true,
        lastLoginAt: true,
        loginCount: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ users });
  } catch (error) {
    console.error("사용자 목록 조회 실패:", error);
    return NextResponse.json({ error: "사용자 목록 조회 실패" }, { status: 500 });
  }
}

// POST: 새 사용자 생성
export async function POST(request: NextRequest) {
  try {
    if (!requireAdmin(request)) {
      return NextResponse.json({ error: "접근 권한이 없습니다." }, { status: 403 });
    }

    const { username, password, name, department, role } = (await request.json()) as {
      username: string;
      password: string;
      name: string;
      department: string;
      role?: string;
    };

    if (!username || !password || !name || !department) {
      return NextResponse.json(
        { error: "필수 정보가 누락되었습니다." },
        { status: 400 }
      );
    }

    // 중복 확인
    const existingUser = await prisma.user.findUnique({ where: { username } });
    if (existingUser) {
      return NextResponse.json(
        { error: "이미 존재하는 아이디입니다." },
        { status: 409 }
      );
    }

    const newUser = await prisma.user.create({
      data: {
        username,
        password: hashPassword(password),
        name,
        department,
        role: role || "user",
        active: true,
      },
      select: {
        id: true,
        username: true,
        name: true,
        department: true,
        role: true,
        createdAt: true,
      },
    });

    // 사용자 생성 로그
    const adminId = request.headers.get("x-user-id");
    if (adminId) {
      await prisma.accessLog.create({
        data: {
          userId: parseInt(adminId),
          action: "user_created",
          detail: `사용자 생성: ${username} (${name})`,
          ip: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
        },
      });
    }

    return NextResponse.json(
      { success: true, user: newUser },
      { status: 201 }
    );
  } catch (error) {
    console.error("사용자 생성 실패:", error);
    return NextResponse.json({ error: "사용자 생성 실패" }, { status: 500 });
  }
}

// PUT: 사용자 수정/비밀번호 초기화
export async function PUT(request: NextRequest) {
  try {
    if (!requireAdmin(request)) {
      return NextResponse.json({ error: "접근 권한이 없습니다." }, { status: 403 });
    }

    const { userId, name, department, role, active, resetPassword, newPassword } = (await request.json()) as {
      userId: number;
      name?: string;
      department?: string;
      role?: string;
      active?: boolean;
      resetPassword?: boolean;
      newPassword?: string;
    };

    if (!userId) {
      return NextResponse.json(
        { error: "사용자 ID가 필요합니다." },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ error: "사용자를 찾을 수 없습니다." }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (name) updateData.name = name;
    if (department) updateData.department = department;
    if (role) updateData.role = role;
    if (typeof active === "boolean") updateData.active = active;
    if (resetPassword && newPassword) {
      updateData.password = hashPassword(newPassword);
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        username: true,
        name: true,
        department: true,
        role: true,
        active: true,
        lastLoginAt: true,
        loginCount: true,
        createdAt: true,
      },
    });

    // 사용자 수정 로그
    const adminId = request.headers.get("x-user-id");
    if (adminId) {
      const details = [];
      if (name) details.push(`이름: ${name}`);
      if (department) details.push(`부서: ${department}`);
      if (role) details.push(`역할: ${role}`);
      if (resetPassword) details.push("비밀번호 초기화됨");

      await prisma.accessLog.create({
        data: {
          userId: parseInt(adminId),
          action: "user_updated",
          detail: `사용자 수정: ${user.username} - ${details.join(", ")}`,
          ip: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
        },
      });
    }

    return NextResponse.json({ success: true, user: updatedUser });
  } catch (error) {
    console.error("사용자 수정 실패:", error);
    return NextResponse.json({ error: "사용자 수정 실패" }, { status: 500 });
  }
}

// DELETE: 사용자 비활성화
export async function DELETE(request: NextRequest) {
  try {
    if (!requireAdmin(request)) {
      return NextResponse.json({ error: "접근 권한이 없습니다." }, { status: 403 });
    }

    const { userId } = (await request.json()) as { userId: number };

    if (!userId) {
      return NextResponse.json(
        { error: "사용자 ID가 필요합니다." },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ error: "사용자를 찾을 수 없습니다." }, { status: 404 });
    }

    // 자기 자신을 비활성화할 수 없음
    const adminId = request.headers.get("x-user-id");
    if (adminId && parseInt(adminId) === userId) {
      return NextResponse.json(
        { error: "자신의 계정을 비활성화할 수 없습니다." },
        { status: 400 }
      );
    }

    const deactivatedUser = await prisma.user.update({
      where: { id: userId },
      data: { active: false },
      select: {
        id: true,
        username: true,
        name: true,
        department: true,
        role: true,
        active: true,
        lastLoginAt: true,
        loginCount: true,
        createdAt: true,
      },
    });

    // 사용자 비활성화 로그
    if (adminId) {
      await prisma.accessLog.create({
        data: {
          userId: parseInt(adminId),
          action: "user_deactivated",
          detail: `사용자 비활성화: ${user.username} (${user.name})`,
          ip: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
        },
      });
    }

    return NextResponse.json({ success: true, user: deactivatedUser });
  } catch (error) {
    console.error("사용자 비활성화 실패:", error);
    return NextResponse.json({ error: "사용자 비활성화 실패" }, { status: 500 });
  }
}
