"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Tag, Bell, Building2, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/", icon: LayoutDashboard, label: "대시보드" },
  { href: "/keywords", icon: Tag, label: "키워드 관리" },
  { href: "/settings", icon: Bell, label: "알림 설정" },
];

interface SidebarProps {
  onNavigate?: () => void;
}

export default function Sidebar({ onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

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
      <nav className="flex-1 px-3 py-4 space-y-1">
        <p className="px-3 text-xs font-medium text-sidebar-foreground/40 uppercase tracking-wider mb-2">메뉴</p>
        {navItems.map(({ href, icon: Icon, label }) => {
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
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* 하단: 로그아웃 + 버전 */}
      <div className="px-3 pb-2">
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
        <p className="text-xs text-sidebar-foreground/40">나라장터 모니터 v1.0</p>
        <p className="text-xs text-sidebar-foreground/30 mt-0.5">조달청 공공데이터 연동</p>
      </div>
    </aside>
  );
}
