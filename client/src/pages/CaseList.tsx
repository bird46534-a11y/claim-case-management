import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useWebSocket } from "@/hooks/useWebSocket";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import CaseHistory from "@/components/CaseHistory";
import ExportButton from "@/components/ExportButton";
import { getLoginUrl } from "@/const";

const STATUS_OPTIONS = [
  { value: "進入檔案室", label: "進入檔案室" },
  { value: "擲回經辦人員", label: "擲回經辦人員" },
  { value: "轉台北審核", label: "轉台北審核", color: "orange" },
  { value: "轉法務追償", label: "轉法務追償" },
];

const getStatusColor = (status: string) => {
  if (status === "轉台北審核") return "bg-orange-100 text-orange-900 border-orange-300";
  return "bg-gray-100 text-gray-900 border-gray-300";
};

function LogoutButton() {
  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      window.location.href = "/";
    },
  });

  return (
    <Button
      variant="outline"
      onClick={() => logoutMutation.mutate()}
      disabled={logoutMutation.isPending}
    >
      {logoutMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "登出"}
    </Button>
  );
}

export default function CaseList() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const { subscribe } = useWebSocket();
  const [searchKeyword, setSearchKeyword] = useState("");
  const [expandedCaseId, setExpandedCaseId] = useState<number | null>(null);
  const [editingCaseId, setEditingCaseId] = useState<number | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;
  const [showAccountMenu, setShowAccountMenu] = useState(false);

  // 查詢案件列表
  const { data: allCases = [], isLoading: casesLoading, refetch: refetchCases } = trpc.cases.list.useQuery();

  // 搜尋案件
  const { data: searchResults = [] } = trpc.cases.search.useQuery(
    { keyword: searchKeyword },
    { enabled: searchKeyword.length > 0 }
  );

  // 更新案件狀態
  const updateStatusMutation = trpc.cases.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("案件狀態已更新");
      setEditingCaseId(null);
      setSelectedStatus(null);
      setRejectReason("");
      refetchCases();
    },
    onError: (error) => {
      toast.error(error.message || "更新狀態失敗");
    },
  });

  // 設置 WebSocket 事件監聽
  useEffect(() => {
    const unsubscribeUpdated = subscribe("case:updated", (data: any) => {
      console.log("[WebSocket] Received case:updated event", data);
      toast.info(`案件 ${data.caseId} 狀態已更新為：${data.status}`);
      refetchCases();
    });

    const unsubscribeDeleted = subscribe("case:deleted", (data: any) => {
      console.log("[WebSocket] Received case:deleted event", data);
      toast.info(`案件 ${data.caseId} 已刪除`);
      refetchCases();
    });

    return () => {
      if (unsubscribeUpdated) unsubscribeUpdated();
      if (unsubscribeDeleted) unsubscribeDeleted();
    };
  }, [subscribe, refetchCases]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin w-8 h-8" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-lg mb-4">請登入以繼續</p>
          <Button onClick={() => (window.location.href = getLoginUrl())}>登入</Button>
        </div>
      </div>
    );
  }

  // 決定顯示的案件列表
  const displayCases = searchKeyword.length > 0 ? searchResults : allCases;

  // 分頁
  const totalPages = Math.ceil(displayCases.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedCases = displayCases.slice(startIndex, startIndex + itemsPerPage);

  const handleStatusChange = (caseId: number, newStatus: string) => {
    if (!user) return;

    updateStatusMutation.mutate({
      caseId,
      status: newStatus as any,
      reason: newStatus === "擲回經辦人員" ? rejectReason : undefined,
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* 標題區域 */}
      <div className="border-b border-border p-6">
        <h1 className="text-3xl font-bold text-foreground mb-2">理賠案件管理系統</h1>
        <p className="text-muted-foreground">歡迎，{user?.name || "使用者"}</p>
      </div>

      {/* 主要內容區域 */}
      <div className="container py-8">
        {/* 操作欄 */}
        <div className="flex gap-4 mb-8 flex-wrap items-center">
          {/* 搜尋框 */}
          <div className="flex-1 min-w-64">
            <Input
              placeholder="搜尋案號..."
              value={searchKeyword}
              onChange={(e) => {
                setSearchKeyword(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full"
            />
          </div>

          {/* Excel 匯出按鈕 */}
          <ExportButton />

          {/* 帳戶管理按鈕 */}
          {user?.role === "admin" && (
            <Button variant="outline" onClick={() => setShowAccountMenu(!showAccountMenu)}>
              帳戶管理
            </Button>
          )}

          {/* 登出按鈕 */}
          <LogoutButton />
        </div>

        {/* 案件統計 */}
        <div className="mb-6 text-sm text-muted-foreground">
          共 {displayCases.length} 個案件
          {searchKeyword && ` (搜尋結果)`}
        </div>

        {/* 案件列表 */}
        {casesLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="animate-spin w-8 h-8" />
          </div>
        ) : paginatedCases.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {searchKeyword ? "未找到匹配的案件" : "暫無案件"}
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {paginatedCases.map((caseItem) => (
                <div
                  key={caseItem.id}
                  className={`border rounded-lg p-4 transition-colors ${
                    caseItem.status === "轉台北審核"
                      ? "bg-orange-50 border-orange-200"
                      : "bg-white border-border hover:bg-gray-50"
                  }`}
                >
                  {/* 案件行 */}
                  <div className="flex items-center justify-between gap-4">
                    {/* 案號 */}
                    <div className="flex-1 min-w-0">
                      <button
                        onClick={() =>
                          setExpandedCaseId(
                            expandedCaseId === caseItem.id ? null : caseItem.id
                          )
                        }
                        className="flex items-center gap-2 text-left hover:text-blue-600 font-mono font-semibold"
                      >
                        {expandedCaseId === caseItem.id ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                        {caseItem.caseNumber}
                      </button>
                    </div>

                    {/* 狀態選擇 */}
                    <div className="flex items-center gap-2">
                      {editingCaseId === caseItem.id ? (
                        <div className="flex gap-2">
                          <Select
                            value={selectedStatus || ""}
                            onValueChange={(value) => {
                              setSelectedStatus(value);
                              if (value !== "擲回經辦人員") {
                                setRejectReason("");
                              }
                            }}
                          >
                            <SelectTrigger className="w-40">
                              <SelectValue placeholder="選擇狀態" />
                            </SelectTrigger>
                            <SelectContent>
                              {STATUS_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          {/* 擲回原因輸入框 */}
                          {selectedStatus === "擲回經辦人員" && (
                            <Input
                              placeholder="擲回原因"
                              value={rejectReason}
                              onChange={(e) => setRejectReason(e.target.value)}
                              className="w-40"
                            />
                          )}

                          {/* 確認按鈕 */}
                          <Button
                            size="sm"
                            onClick={() => {
                              if (selectedStatus) {
                                handleStatusChange(caseItem.id, selectedStatus);
                              }
                            }}
                            disabled={updateStatusMutation.isPending}
                          >
                            {updateStatusMutation.isPending ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              "確認"
                            )}
                          </Button>

                          {/* 取消按鈕 */}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingCaseId(null);
                              setSelectedStatus(null);
                              setRejectReason("");
                            }}
                          >
                            取消
                          </Button>
                        </div>
                      ) : (
                        <>
                          {/* 顯示當前狀態 */}
                          <div
                            className={`px-3 py-1 rounded border text-sm font-medium ${getStatusColor(
                              caseItem.status
                            )}`}
                          >
                            {caseItem.status}
                          </div>

                          {/* 編輯按鈕 */}
                          {user?.role === "admin" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditingCaseId(caseItem.id);
                                setSelectedStatus(caseItem.status);
                              }}
                            >
                              編輯
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* 展開的歷史時間軸 */}
                  {expandedCaseId === caseItem.id && (
                    <div className="mt-4 pt-4 border-t border-border">
                      <CaseHistory caseId={caseItem.id} />
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* 分頁控制 */}
            {totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-8">
                <Button
                  variant="outline"
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                >
                  上一頁
                </Button>
                <div className="flex items-center gap-2">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <Button
                      key={page}
                      variant={currentPage === page ? "default" : "outline"}
                      onClick={() => setCurrentPage(page)}
                      className="w-10"
                    >
                      {page}
                    </Button>
                  ))}
                </div>
                <Button
                  variant="outline"
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                >
                  下一頁
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
