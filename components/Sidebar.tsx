"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Tag, Building2, LogOut, Users, Settings, BarChart3, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";

interface NavItem {
  href: string;
  icon: React.ReactNode;
  label: string;
}

interface User {
  id: number;
  username: string;
  name: string;
  department: string;
  role: string;
}

interface SidebarProps {
  onNavigate?: () => void;
}

export default function Sidebar({ onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const data = (await res.json()) as User;
          setUser(data);
        }
      } catch {
        // 사용자 정보 조회 실패
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, []);

  const isAdmin = user?.role === "admin";

  const userMenuItems: NavItem[] = [
    { href: "/", icon: <LayoutDashboard className="h-4 w-4 shrink-0" />, label: "대시보드" },
    { href: "/keywords", icon: <Tag className="h-4 w-4 shrink-0" />, label: "키워드 관리" },
  ];

  const adminMenuItems: NavItem[] = [
    { href: "/admin", icon: <Users className="h-4 w-4 shrink-0" />, label: "사용자 관리" },
    { href: "/admin/keywords", icon: <Settings className="h-4 w-4 shrink-0" />, label: "키워드 할당" },
    { href: "/admin/analytics", icon: <BarChart3 className="h-4 w-4 shrink-0" />, label: "이용 현황" },
    { href: "/analytics", icon: <TrendingUp className="h-4 w-4 shrink-0" />, label: "수주 분석" },
  ];

  const navItems = [...userMenuItems, ...(isAdmin ? adminMenuItems : [])];

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  return (
    <aside className="fixed left-0 top-0 h-full w-64 flex flex-col bg-sidebar border-r border-sidebar-border z-50">
      {/* 브랜드 헤더 */}
      <div className="px-6 py-5 border-b border-sidebar-border">
        <Link href="/" className="flex items-center gap-3" onClick={onNavigate}>
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <Building2 className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="font-semibold text-sm text-sidebar-foreground leading-tight">나라장터</p>
            <p className="text-xs text-sidebar-foreground/60 leading-tight">모니터링 시스템</p>
          </div>
        </Link>
      </div>

      {/* 네비게이션 */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <p className="px-3 text-xs font-medium text-sidebar-foreground/40 uppercase tracking-wider mb-2">메뉴</p>
        {navItems.map(({ href, icon, label }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-white shadow-sm"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              )}
            >
              {icon}
              {label}
            </Link>
          );
        })}
      </nav>

      {/* 사용자 정보 */}
      {!loading && user && (
        <div className="px-4 py-3 border-t border-sidebar-border bg-sidebar-accent/50">
          <p className="text-xs text-sidebar-foreground/60">로그인 사용자</p>
          <p className="text-sm font-semibold text-sidebar-foreground truncate">{user.name}</p>
          <p className="text-xs text-sidebar-foreground/50 truncate">{user.department}</p>
          {isAdmin && (
            <p className="text-xs text-amber-600 font-medium mt-1">관리자</p>
          )}
        </div>
      )}

      {/* 하단: 로그아웃 + 버전 */}
      <div className="px-3 pb-2 border-t border-sidebar-border">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-sidebar-foreground/60 hover:text-sidebar-foreground"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4 mr-2" />
          로그아웃
        </Button>
      </div>
      <div className="px-6 py-3 border-t border-sidebar-border">
        <p className="text-xs text-sidebar-foreground/40">나라장터 모니터 v2.0</p>
        <p className="text-xs text-sidebar-foreground/30 mt-0.5">조달청 공공데이터 연동</p>
      </div>
    </aside>
  );
}
