import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';

export default function UserManagement() {
  const { user: currentUser } = useAuth();
  const [searchKeyword, setSearchKeyword] = useState('');
  const [expandedUserId, setExpandedUserId] = useState<number | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [newRole, setNewRole] = useState<'user' | 'admin' | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // 查詢用戶列表
  const { data: allUsers = [], isLoading: usersLoading, refetch: refetchUsers } = trpc.users.list.useQuery();

  // 搜尋用戶
  const { data: searchResults = [] } = trpc.users.search.useQuery(
    { keyword: searchKeyword },
    { enabled: searchKeyword.length > 0 }
  );

  // 查詢審計日誌
  const { data: auditLogs = [] } = trpc.users.auditLog.useQuery(
    { userId: expandedUserId ?? undefined },
    { enabled: expandedUserId !== null }
  );

  // 更新用戶角色
  const updateRoleMutation = trpc.users.updateRole.useMutation({
    onSuccess: () => {
      toast.success('用戶角色已更新');
      setShowConfirmDialog(false);
      setSelectedUserId(null);
      setNewRole(null);
      refetchUsers();
    },
    onError: (error) => {
      toast.error(error.message || '更新角色失敗');
    },
  });

  const displayUsers = searchKeyword.length > 0 ? searchResults : allUsers;

  const handleUpdateRole = () => {
    if (!selectedUserId || !newRole) return;

    updateRoleMutation.mutate({
      userId: selectedUserId,
      newRole,
      reason: `通過管理介面修改`,
    });
  };

  const handleRoleChange = (userId: number, role: 'user' | 'admin') => {
    setSelectedUserId(userId);
    setNewRole(role);
    setShowConfirmDialog(true);
  };

  const getRoleBadge = (role: string) => {
    if (role === 'admin') {
      return <Badge className="bg-red-100 text-red-800">管理者</Badge>;
    }
    return <Badge className="bg-gray-100 text-gray-800">一般用戶</Badge>;
  };

  if (!currentUser || currentUser.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>無權限訪問</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">
              只有管理者可以訪問此頁面。
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        {/* 標題 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold">用戶管理</h1>
          <p className="text-gray-600 mt-2">管理系統用戶和權限</p>
        </div>

        {/* 搜尋框 */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              placeholder="搜尋用戶名稱、郵箱或 openId..."
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* 用戶列表 */}
        <div className="space-y-3">
          {usersLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : displayUsers.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-gray-500">未找到用戶</p>
              </CardContent>
            </Card>
          ) : (
            displayUsers.map((u: any) => (
              <Card key={u.id} className="overflow-hidden">
                <div
                  className="p-4 cursor-pointer hover:bg-gray-50 transition"
                  onClick={() => setExpandedUserId(expandedUserId === u.id ? null : u.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <div>
                          <p className="font-medium">{u.name || '未設定名稱'}</p>
                          <p className="text-sm text-gray-500">{u.email || u.openId}</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      {getRoleBadge(u.role)}

                      {u.id !== currentUser.id && (
                        <div onClick={(e) => e.stopPropagation()}>
                          <Select
                            value={u.role}
                            onValueChange={(role) => {
                              handleRoleChange(u.id, role as 'user' | 'admin');
                            }}
                          >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="user">一般用戶</SelectItem>
                            <SelectItem value="admin">管理者</SelectItem>
                          </SelectContent>
                          </Select>
                        </div>
                      )}

                      {expandedUserId === u.id ? (
                        <ChevronUp className="h-5 w-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-gray-400" />
                      )}
                    </div>
                  </div>
                </div>

                {/* 展開的審計日誌 */}
                {expandedUserId === u.id && (
                  <div className="border-t bg-gray-50 p-4">
                    <p className="text-sm font-medium mb-3">角色變更歷史</p>
                    {auditLogs.length === 0 ? (
                      <p className="text-sm text-gray-500">無角色變更記錄</p>
                    ) : (
                      <div className="space-y-2">
                        {auditLogs.map((log: any) => (
                          <div key={log.id} className="text-sm bg-white p-2 rounded border">
                            <p className="text-gray-700">
                              {log.oldRole === 'user' ? '一般用戶' : '管理者'} → {log.newRole === 'user' ? '一般用戶' : '管理者'}
                            </p>
                            <p className="text-xs text-gray-500">
                              {new Date(log.changedAt).toLocaleString('zh-TW')}
                            </p>
                            {log.reason && (
                              <p className="text-xs text-gray-600 mt-1">原因：{log.reason}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            ))
          )}
        </div>

        {/* 統計信息 */}
        <div className="mt-8 grid grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">總用戶數</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{allUsers.length}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">管理者數</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{allUsers.filter((u: any) => u.role === 'admin').length}</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 確認對話框 */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認修改用戶角色</AlertDialogTitle>
            <AlertDialogDescription>
              您即將將此用戶的角色修改為 {newRole === 'admin' ? '管理者' : '一般用戶'}。此操作將被記錄在審計日誌中。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleUpdateRole}
              disabled={updateRoleMutation.isPending}
            >
              {updateRoleMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  修改中...
                </>
              ) : (
                '確認修改'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
