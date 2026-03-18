"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Settings, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface User {
  id: number;
  username: string;
  name: string;
  department: string;
}

interface UserKeyword {
  id: number;
  name: string;
}

export default function AdminKeywordsPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [userKeywords, setUserKeywords] = useState<UserKeyword[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [keywordsLoading, setKeywordsLoading] = useState(false);
  const [newKeyword, setNewKeyword] = useState("");
  const [adding, setAdding] = useState(false);

  const fetchUsers = async () => {
    setUsersLoading(true);
    try {
      const res = await fetch("/api/admin/users");
      if (!res.ok) throw new Error("조회 실패");
      const data = (await res.json()) as User[];
      setUsers(data);
    } catch {
      toast.error("사용자 목록 조회 실패");
    } finally {
      setUsersLoading(false);
    }
  };

  const fetchUserKeywords = async (userId: string) => {
    if (!userId) {
      setUserKeywords([]);
      return;
    }
    setKeywordsLoading(true);
    try {
      const res = await fetch(`/api/admin/keywords?userId=${userId}`);
      if (!res.ok) throw new Error("조회 실패");
      const data = (await res.json()) as UserKeyword[];
      setUserKeywords(data);
    } catch {
      toast.error("키워드 목록 조회 실패");
      setUserKeywords([]);
    } finally {
      setKeywordsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleUserSelect = (userId: string) => {
    setSelectedUserId(userId);
    fetchUserKeywords(userId);
  };

  const handleAddKeyword = async () => {
    if (!selectedUserId) {
      toast.error("사용자를 선택해주세요");
      return;
    }
    if (!newKeyword.trim()) {
      toast.error("키워드를 입력해주세요");
      return;
    }
    setAdding(true);
    try {
      const res = await fetch("/api/admin/keywords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: parseInt(selectedUserId),
          keywordName: newKeyword,
        }),
      });
      if (!res.ok) throw new Error("추가 실패");
      toast.success(`'${newKeyword}' 키워드가 추가되었습니다`);
      setNewKeyword("");
      await fetchUserKeywords(selectedUserId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "키워드 추가 실패");
    } finally {
      setAdding(false);
    }
  };

  const handleRemoveKeyword = async (keywordId: number, keywordName: string) => {
    if (!selectedUserId) return;
    try {
      const res = await fetch(`/api/admin/keywords/${keywordId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: parseInt(selectedUserId) }),
      });
      if (!res.ok) throw new Error("삭제 실패");
      toast.success(`'${keywordName}' 키워드가 삭제되었습니다`);
      await fetchUserKeywords(selectedUserId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "키워드 삭제 실패");
    }
  };

  return (
    <div className="space-y-6">
      {/* 페이지 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">키워드 할당</h1>
          <p className="text-sm text-muted-foreground mt-1">
            사용자에게 모니터링 키워드를 할당하고 관리합니다
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Settings className="h-4 w-4 text-primary" />
            사용자 선택
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">사용자</label>
            {usersLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <Select value={selectedUserId} onValueChange={handleUserSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="사용자를 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id.toString()}>
                      {user.name} ({user.department})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </CardContent>
      </Card>

      {selectedUserId && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">할당된 키워드</CardTitle>
              <Badge variant="secondary">{userKeywords.length}개</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 키워드 추가 */}
            <div className="flex gap-2">
              <Input
                placeholder="새 키워드 입력"
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddKeyword()}
              />
              <Button onClick={handleAddKeyword} disabled={adding || !newKeyword.trim()}>
                <Plus className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">추가</span>
              </Button>
            </div>

            {/* 키워드 목록 */}
            {keywordsLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 2 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : userKeywords.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm">할당된 키워드가 없습니다.</p>
                <p className="text-xs mt-1">위의 입력란에서 키워드를 추가해주세요.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {userKeywords.map((keyword) => (
                  <div
                    key={keyword.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/20 transition-colors"
                  >
                    <span className="text-sm font-medium">{keyword.name}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleRemoveKeyword(keyword.id, keyword.name)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!selectedUserId && (
        <Card>
          <CardContent className="pt-12 pb-12">
            <div className="text-center text-muted-foreground">
              <Settings className="h-8 w-8 mx-auto mb-3 opacity-20" />
              <p className="text-sm font-medium">사용자를 선택하여 키워드를 할당하세요</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
