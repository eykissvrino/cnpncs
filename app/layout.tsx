import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import Sidebar from "@/components/Sidebar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "나라장터 모니터",
  description: "나라장터 발주계획 · 사전규격 · 입찰공고 통합 모니터링",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <div className="flex h-screen bg-background">
          <Sidebar />
          <div className="ml-64 flex-1 overflow-auto">
            <main className="max-w-7xl mx-auto px-6 py-8">{children}</main>
          </div>
        </div>
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
