import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useWebSocket } from "@/hooks/useWebSocket";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Loader2, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import CaseHistory from "@/components/CaseHistory";
import ExportButton from "@/components/ExportButton";

export default function CaseList() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const { subscribe } = useWebSocket();
  const [searchKeyword, setSearchKeyword] = useState("");
  const [expandedCaseId, setExpandedCaseId] = useState<number | null>(null);
  const [newCaseNumber, setNewCaseNumber] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [selectedCaseId, setSelectedCaseId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  // 查詢案件列表
  const { data: allCases = [], isLoading: casesLoading, refetch: refetchCases } = trpc.cases.list.useQuery();

  // 搜尋案件
  const { data: searchResults = [] } = trpc.cases.search.useQuery(
    { keyword: searchKeyword },
    { enabled: searchKeyword.length > 0 }
  );

  // 新增案件
  const createCaseMutation = trpc.cases.create.useMutation({
    onSuccess: () => {
      toast.success("案件新增成功");
      setNewCaseNumber("");
      refetchCases();
    },
    onError: (error) => {
      toast.error(error.message || "新增案件失敗");
    },
  });

  // 更新案件狀態
  const updateStatusMutation = trpc.cases.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("案件狀態已更新");
      setSelectedStatus(null);
      setSelectedCaseId(null);
      setRejectReason("");
      refetchCases();
    },
    onError: (error) => {
      toast.error(error.message || "更新狀態失敗");
    },
  });

  // 設置 WebSocket 事件監聽
  useEffect(() => {
    // 監聽新增案件事件
    const unsubscribeCreated = subscribe("case:created", (data: any) => {
      console.log("[WebSocket] Received case:created event", data);
      toast.info(`新增案件：${data.caseNumber}`);
      refetchCases();
    });

    // 監聽更新狀態事件
    const unsubscribeUpdated = subscribe("case:updated", (data: any) => {
      console.log("[WebSocket] Received case:updated event", data);
      toast.info(`案件 ${data.caseId} 狀態已更新為：${data.status}`);
      refetchCases();
    });

    // 監聽刪除案件事件
    const unsubscribeDeleted = subscribe("case:deleted", (data: any) => {
      console.log("[WebSocket] Received case:deleted event", data);
      toast.info(`案件 ${data.caseId} 已刪除`);
      refetchCases();
    });

    return () => {
      unsubscribeCreated?.();
      unsubscribeUpdated?.();
      unsubscribeDeleted?.();
    };
  }, [subscribe, refetchCases]);

  // 驗證案號格式
  const validateCaseNumber = (caseNumber: string): boolean => {
    const regex = /^[0-9]{2}[0-9]{2}[0-9]{2}[AKM][0-9]{5}$/;
    return regex.test(caseNumber);
  };

  // 處理新增案件
  const handleCreateCase = () => {
    if (!newCaseNumber) {
      toast.error("請輸入案號");
      return;
    }
    if (!validateCaseNumber(newCaseNumber)) {
      toast.error("案號格式不正確（應為12碼：公司2+區域2+年度2+險種1+流水號5）");
      return;
    }
    createCaseMutation.mutate({ caseNumber: newCaseNumber });
  };

  // 處理狀態更新
  const handleUpdateStatus = () => {
    if (!selectedCaseId || !selectedStatus) {
      toast.error("請選擇案件與狀態");
      return;
    }
    updateStatusMutation.mutate({
      caseId: selectedCaseId,
      status: selectedStatus as "進入檔案室" | "擲回經辦人員" | "轉台北審核" | "轉法務追償",
      reason: selectedStatus === "擲回經辦人員" ? rejectReason : undefined,
    });
  };

  // 顯示的案件列表
  const displayCases = searchKeyword.length > 0 ? searchResults : allCases;

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
          <Button onClick={() => (window.location.href = "/api/oauth/login")}>登入</Button>
        </div>
      </div>
    );
  }

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
        <div className="flex gap-4 mb-8 flex-wrap">
          {/* 搜尋框 */}
          <div className="flex-1 min-w-64">
            <Input
              placeholder="搜尋案號..."
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              className="border-border"
            />
          </div>

          {/* 匯出 Excel 按鈕 */}
          <ExportButton />

          {/* 新增案件按鈕（僅管理者） */}
          {user?.role === "admin" && (
            <Dialog>
              <DialogTrigger asChild>
                <Button className="bg-accent text-accent-foreground hover:bg-accent/90">
                  新增案件
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>新增案件</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">案號（12碼）</label>
                    <Input
                      placeholder="例如：101815A00001"
                      value={newCaseNumber}
                      onChange={(e) => setNewCaseNumber(e.target.value.toUpperCase())}
                      maxLength={12}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      格式：公司(2碼)+區域(2碼)+年度(2碼)+險種(1碼:A/K/M)+流水號(5碼)
                    </p>
                  </div>
                  <Button
                    onClick={handleCreateCase}
                    disabled={createCaseMutation.isPending}
                    className="w-full bg-accent text-accent-foreground"
                  >
                    {createCaseMutation.isPending ? "新增中..." : "新增"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* 案件列表 */}
        <div className="space-y-2">
          {casesLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="animate-spin w-6 h-6" />
            </div>
          ) : displayCases.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchKeyword ? "未找到符合的案件" : "暫無案件"}
            </div>
          ) : (
            displayCases.map((caseItem) => (
              <div
                key={caseItem.id}
                className={`border border-border p-4 ${
                  caseItem.status === "轉台北審核" ? "bg-orange-50" : "bg-white"
                }`}
              >
                {/* 案件摘要行 */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex-1">
                    <button
                      onClick={() =>
                        setExpandedCaseId(expandedCaseId === caseItem.id ? null : caseItem.id)
                      }
                      className="flex items-center gap-2 hover:text-accent transition-colors"
                    >
                      <ChevronDown
                        className={`w-4 h-4 transition-transform ${
                          expandedCaseId === caseItem.id ? "rotate-180" : ""
                        }`}
                      />
                      <span className="font-bold text-lg">{caseItem.caseNumber}</span>
                    </button>
                  </div>

                  {/* 狀態標籤 */}
                  <div className="flex items-center gap-4">
                    <span
                      className={`px-3 py-1 text-sm font-medium ${
                        caseItem.status === "轉台北審核"
                          ? "bg-orange-200 text-orange-900"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {caseItem.status}
                    </span>

                    {/* 狀態切換下拉菜單（僅管理者） */}
                    {user?.role === "admin" && (
                      <Dialog open={selectedCaseId === caseItem.id} onOpenChange={(open) => {
                        if (!open) {
                          setSelectedCaseId(null);
                          setSelectedStatus(null);
                          setRejectReason("");
                        }
                      }}>
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedCaseId(caseItem.id)}
                          >
                            變更狀態
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>變更案件狀態</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div>
                              <label className="block text-sm font-medium mb-2">新狀態</label>
                              <Select value={selectedStatus || ""} onValueChange={setSelectedStatus}>
                                <SelectTrigger>
                                  <SelectValue placeholder="選擇狀態" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="進入檔案室">進入檔案室</SelectItem>
                                  <SelectItem value="擲回經辦人員">擲回經辦人員</SelectItem>
                                  <SelectItem value="轉台北審核">轉台北審核</SelectItem>
                                  <SelectItem value="轉法務追償">轉法務追償</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            {/* 擲回原因備註 */}
                            {selectedStatus === "擲回經辦人員" && (
                              <div>
                                <label className="block text-sm font-medium mb-2">擲回原因</label>
                                <Input
                                  placeholder="輸入擲回原因..."
                                  value={rejectReason}
                                  onChange={(e) => setRejectReason(e.target.value)}
                                />
                              </div>
                            )}

                            <Button
                              onClick={handleUpdateStatus}
                              disabled={updateStatusMutation.isPending || !selectedStatus}
                              className="w-full bg-accent text-accent-foreground"
                            >
                              {updateStatusMutation.isPending ? "更新中..." : "確認變更"}
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
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
            ))
          )}
        </div>
      </div>
    </div>
  );
}
