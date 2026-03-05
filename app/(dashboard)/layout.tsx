"use client";

import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Menu, Building2 } from "lucide-react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-background">
      {/* 데스크톱 사이드바 */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {/* 모바일 사이드바 (Sheet) */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="p-0 w-64">
          <Sidebar onNavigate={() => setSidebarOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* 메인 콘텐츠 */}
      <div className="flex-1 flex flex-col overflow-hidden lg:ml-64">
        {/* 모바일 상단바 */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 border-b bg-background">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary">
              <Building2 className="h-4 w-4 text-white" />
            </div>
            <span className="font-semibold text-sm">나라장터 모니터</span>
          </div>
        </header>

        {/* 페이지 콘텐츠 */}
        <main className="flex-1 overflow-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
