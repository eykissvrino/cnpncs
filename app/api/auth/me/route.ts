import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("narajan-session")?.value;
    if (!token) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const user = await getCurrentUser(token);
    if (!user) {
      return NextResponse.json({ error: "세션이 만료되었습니다." }, { status: 401 });
    }

    return NextResponse.json({
      id: user.id,
      username: user.username,
      name: user.name,
      department: user.department,
      role: user.role,
    });
  } catch {
    return NextResponse.json({ error: "사용자 정보 조회 실패" }, { status: 500 });
  }
}
