"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Users, Plus, RotateCcw, Lock, Unlock } from "lucide-react";
import { toast } from "sonner";

interface User {
  id: number;
  username: string;
  name: string;
  department: string;
  role: string;
  active: boolean;
  lastLoginAt: string | null;
  loginCount: number;
  createdAt: string;
}

export default function AdminPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newUser, setNewUser] = useState({
    username: "",
    password: "",
    name: "",
    department: "",
  });
  const [creating, setCreating] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users");
      if (!res.ok) throw new Error("조회 실패");
      const data = (await res.json()) as User[];
      setUsers(data);
    } catch {
      toast.error("사용자 목록 조회 실패");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateUser = async () => {
    if (!newUser.username.trim() || !newUser.password.trim() || !newUser.name.trim() || !newUser.department.trim()) {
      toast.error("모든 필드를 입력해주세요");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newUser),
      });
      if (!res.ok) throw new Error("생성 실패");
      toast.success(`'${newUser.name}' 사용자가 생성되었습니다`);
      setNewUser({ username: "", password: "", name: "", department: "" });
      setCreateDialogOpen(false);
      await fetchUsers();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "사용자 생성 실패");
    } finally {
      setCreating(false);
    }
  };

  const handleResetPassword = async (id: number, name: string) => {
    if (!confirm(`${name}의 비밀번호를 초기화하시겠습니까?`)) return;
    try {
      const res = await fetch(`/api/admin/users/${id}/reset-password`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("초기화 실패");
      toast.success(`${name}의 비밀번호가 초기화되었습니다`);
      await fetchUsers();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "비밀번호 초기화 실패");
    }
  };

  const handleToggleActive = async (id: number, active: boolean, name: string) => {
    try {
      const res = await fetch(`/api/admin/users/${id}/toggle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !active }),
      });
      if (!res.ok) throw new Error("변경 실패");
      toast.success(`${name}이(가) ${!active ? "활성화" : "비활성화"}되었습니다`);
      await fetchUsers();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "상태 변경 실패");
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    return date.toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="space-y-6">
      {/* 페이지 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">사용자 관리</h1>
          <p className="text-sm text-muted-foreground mt-1">
            시스템 사용자를 관리하고 권한을 설정합니다
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)} className="w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-2" />
          사용자 추가
        </Button>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-blue-100 flex items-center justify-center">
                <Users className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{users.length}</p>
                <p className="text-xs text-muted-foreground">전체 사용자</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-emerald-100 flex items-center justify-center">
                <Unlock className="h-4 w-4 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-emerald-700">{users.filter((u) => u.active).length}</p>
                <p className="text-xs text-muted-foreground">활성 사용자</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-amber-100 flex items-center justify-center">
                <Lock className="h-4 w-4 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-700">{users.filter((u) => !u.active).length}</p>
                <p className="text-xs text-muted-foreground">비활성 사용자</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 사용자 목록 테이블 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            사용자 목록
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-8 w-8 mx-auto mb-3 opacity-20" />
              <p className="text-sm font-medium">등록된 사용자가 없습니다.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>아이디</TableHead>
                    <TableHead>이름</TableHead>
                    <TableHead>부서</TableHead>
                    <TableHead>역할</TableHead>
                    <TableHead>상태</TableHead>
                    <TableHead>최근접속</TableHead>
                    <TableHead className="text-right">접속횟수</TableHead>
                    <TableHead className="text-right">작업</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id} className="hover:bg-muted/30">
                      <TableCell className="font-medium text-sm">{user.username}</TableCell>
                      <TableCell className="text-sm">{user.name}</TableCell>
                      <TableCell className="text-sm">{user.department}</TableCell>
                      <TableCell className="text-sm">
                        {user.role === "admin" ? (
                          <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">관리자</Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">일반</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {user.active ? (
                          <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">활성</Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground text-xs">비활성</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatDate(user.lastLoginAt)}</TableCell>
                      <TableCell className="text-right text-sm font-medium">{user.loginCount}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 px-2 text-xs"
                            onClick={() => handleResetPassword(user.id, user.name)}
                            title="비밀번호 초기화"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant={user.active ? "outline" : "outline"}
                            size="sm"
                            className="h-8 px-2 text-xs"
                            onClick={() => handleToggleActive(user.id, user.active, user.name)}
                            title={user.active ? "비활성화" : "활성화"}
                          >
                            {user.active ? (
                              <Unlock className="h-3.5 w-3.5" />
                            ) : (
                              <Lock className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 사용자 추가 다이얼로그 */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>사용자 추가</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">아이디</label>
              <Input
                placeholder="사용할 아이디 입력"
                value={newUser.username}
                onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">비밀번호</label>
              <Input
                type="password"
                placeholder="초기 비밀번호 설정"
                value={newUser.password}
                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">이름</label>
              <Input
                placeholder="사용자 이름"
                value={newUser.name}
                onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">부서</label>
              <Input
                placeholder="부서명"
                value={newUser.department}
                onChange={(e) => setNewUser({ ...newUser, department: e.target.value })}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              취소
            </Button>
            <Button onClick={handleCreateUser} disabled={creating}>
              {creating ? "추가 중..." : "추가"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
