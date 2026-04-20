import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useWebSocket } from "@/hooks/useWebSocket";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Loader2, ChevronDown, ChevronUp, Plus } from "lucide-react";
import { toast } from "sonner";
import CaseHistory from "@/components/CaseHistory";
import ExportButton from "@/components/ExportButton";
import CreateCaseModal from "@/components/CreateCaseModal";
import { ImportExcelModal } from "@/components/ImportExcelModal";
import FilterBar from "@/components/FilterBar";
import { getLoginUrl } from "@/const";
import { useLocation } from "wouter";

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
  const [, navigate] = useLocation();
  
  // 搜尋和篩選狀態
  const [searchKeyword, setSearchKeyword] = useState("");
  const [filterYear, setFilterYear] = useState<number | undefined>();
  const [filterRegion, setFilterRegion] = useState<string | undefined>();
  const [filterInsuranceType, setFilterInsuranceType] = useState<string | undefined>();
  const [filterSerialNumber, setFilterSerialNumber] = useState<string | undefined>();
  
  // UI 狀態
  const [expandedCaseId, setExpandedCaseId] = useState<number | null>(null);
  const [editingCaseId, setEditingCaseId] = useState<number | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [transferLegalInfo, setTransferLegalInfo] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const itemsPerPage = 50;

  // 查詢案件列表
  const { data: allCases = [], isLoading: casesLoading, refetch: refetchCases } = trpc.cases.list.useQuery();

  // 搜尋案件
  const { data: searchResults = [] } = trpc.cases.search.useQuery(
    { keyword: searchKeyword },
    { enabled: searchKeyword.length > 0 }
  );

  // 多條件篩選查詢
  const { data: filteredResults = [] } = trpc.cases.filter.useQuery(
    {
      year: filterYear,
      regionCode: filterRegion,
      insuranceType: filterInsuranceType,
      serialNumber: filterSerialNumber,
    },
    { enabled: !!(filterYear || filterRegion || filterInsuranceType || filterSerialNumber) }
  );

  // 更新案件狀態
  const updateStatusMutation = trpc.cases.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("案件狀態已更新");
      setEditingCaseId(null);
      setSelectedStatus(null);
      setRejectReason("");
      setTransferLegalInfo("");
      refetchCases();
    },
    onError: (error) => {
      toast.error(error.message || "更新狀態失敗");
    },
  });

  // 刪除案件
  const deleteCaseMutation = trpc.cases.delete.useMutation({
    onSuccess: () => {
      toast.success("案件已刪除");
      refetchCases();
    },
    onError: (error) => {
      toast.error(error.message || "刪除案件失敗");
    },
  });

  // 決定顯示的案件清單
  const displayCases = searchKeyword 
    ? searchResults 
    : (filterYear || filterRegion || filterInsuranceType || filterSerialNumber)
      ? filteredResults
      : allCases;

  // 分頁
  const totalPages = Math.ceil(displayCases.length / itemsPerPage);
  const paginatedCases = displayCases.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // 檢查新增的案件是否符合當前篩選條件
  const matchesFilters = (caseData: any) => {
    if (filterYear && caseData.year !== filterYear) return false;
    if (filterRegion && caseData.regionCode !== filterRegion) return false;
    if (filterInsuranceType && caseData.insuranceType !== filterInsuranceType) return false;
    if (filterSerialNumber && caseData.serialNumber !== parseInt(filterSerialNumber)) return false;
    return true;
  };

  // 設置 WebSocket 事件監聽
  useEffect(() => {
    const unsubscribeCreated = subscribe("case:created", (data: any) => {
      console.log("[WebSocket] Received case:created event", data);
      toast.success(`新案件已建立：${data.caseNumber}`);
      // 只有當新案件符合當前篩選條件時，才重新取得清單
      if (!searchKeyword && !filterYear && !filterRegion && !filterInsuranceType && !filterSerialNumber) {
        refetchCases();
      } else if (matchesFilters(data)) {
        refetchCases();
      }
    });

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
      if (unsubscribeCreated) unsubscribeCreated();
      if (unsubscribeUpdated) unsubscribeUpdated();
      if (unsubscribeDeleted) unsubscribeDeleted();
    };
  }, [subscribe, refetchCases]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <h1 className="text-2xl font-bold">理賠案件管理系統</h1>
        <p className="text-muted-foreground">請登入以繼續</p>
        <Button onClick={() => (window.location.href = getLoginUrl())}>
          登入
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 px-4">
        {/* 標題與操作欄 */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold">理賠案件管理系統</h1>
            <div className="flex gap-2">
              {user?.role === "admin" && (
                <>
                  <Button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="bg-red-600 hover:bg-red-700 text-white gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    建立新案件
                  </Button>
                  <Button
                    onClick={() => setIsImportModalOpen(true)}
                    variant="outline"
                    className="gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    匯入 Excel
                  </Button>
                  <Button
                    onClick={() => navigate('/users')}
                    variant="outline"
                    className="gap-2"
                  >
                    用戶管理
                  </Button>
                </>
              )}
              <ExportButton />
              <LogoutButton />
            </div>
          </div>

          {/* 搜尋框 */}
          <div className="mb-4">
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

          {/* 篩選工具列 */}
          <FilterBar
            year={filterYear}
            onYearChange={setFilterYear}
            regionCode={filterRegion}
            onRegionChange={setFilterRegion}
            insuranceType={filterInsuranceType}
            onInsuranceTypeChange={setFilterInsuranceType}
            serialNumber={filterSerialNumber}
            onSerialNumberChange={setFilterSerialNumber}
            onClearAll={() => {
              setFilterYear(undefined);
              setFilterRegion(undefined);
              setFilterInsuranceType(undefined);
              setFilterSerialNumber(undefined);
              setCurrentPage(1);
            }}
          />
        </div>

        {/* 案件統計 */}
        <div className="mb-6 text-sm text-muted-foreground">
          共 {displayCases.length} 個案件
          {searchKeyword && ` (搜尋結果)`}
          {(filterYear || filterRegion || filterInsuranceType || filterSerialNumber) && ` (篩選結果)`}
        </div>

        {/* 案件列表 */}
        {casesLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        ) : paginatedCases.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            {displayCases.length === 0 ? "暫無案件" : "此頁無案件"}
          </div>
        ) : (
          <div className="space-y-2">
            {paginatedCases.map((caseItem) => (
              <div
                key={caseItem.id}
                className={`border rounded-lg p-4 ${
                  caseItem.status === "轉台北審核" ? "bg-orange-50 border-orange-300" : ""
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <button
                      onClick={() =>
                        setExpandedCaseId(expandedCaseId === caseItem.id ? null : caseItem.id)
                      }
                      className="flex items-center gap-2 font-mono font-bold text-lg hover:text-red-600"
                    >
                      {expandedCaseId === caseItem.id ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                      {caseItem.caseNumber}
                    </button>
                  </div>

                  <div className="flex items-center gap-3">
                    {editingCaseId === caseItem.id ? (
                      <div className="flex gap-2">
                        <Select value={selectedStatus || "placeholder"} onValueChange={setSelectedStatus}>
                          <SelectTrigger className="w-40">
                            <SelectValue placeholder="選擇狀態" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="placeholder" disabled>
                              選擇狀態
                            </SelectItem>
                            {STATUS_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        {selectedStatus === "擲回經辦人員" && (
                          <Input
                            placeholder="擲回原因"
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            className="w-40"
                          />
                        )}

                        {selectedStatus === "轉法務追償" && (
                          <Input
                            placeholder="轉法務追償信息"
                            value={transferLegalInfo}
                            onChange={(e) => setTransferLegalInfo(e.target.value)}
                            className="w-40"
                          />
                        )}

                        <Button
                          size="sm"
                          onClick={() => {
                            if (!selectedStatus) {
                              toast.error("請選擇狀態");
                              return;
                            }
                            updateStatusMutation.mutate({
                              caseId: caseItem.id,
                              status: selectedStatus as any,
                              reason: rejectReason || undefined,
                              transferLegalInfo: transferLegalInfo || undefined,
                            });
                          }}
                          disabled={updateStatusMutation.isPending}
                        >
                          確認
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingCaseId(null);
                            setSelectedStatus(null);
                            setRejectReason("");
                            setTransferLegalInfo("");
                          }}
                        >
                          取消
                        </Button>
                      </div>
                    ) : (
                      <>
                        <div className={`px-3 py-1 rounded border text-sm font-medium ${getStatusColor(caseItem.status)}`}>
                          {caseItem.status}
                        </div>
                        {user?.role === "admin" && (
                          <>
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
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                >
                                  刪除
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>確認刪除案件</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    確定要刪除案件 {caseItem.caseNumber} 嗎？此操作無法復原。
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>取消</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => {
                                      deleteCaseMutation.mutate({ caseId: caseItem.id });
                                    }}
                                    className="bg-red-600 hover:bg-red-700"
                                  >
                                    確認刪除
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* 展開的歷史時間軸 */}
                {expandedCaseId === caseItem.id && (
                  <div className="mt-4 pt-4 border-t">
                    <CaseHistory caseId={caseItem.id} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* 分頁控制 */}
        {totalPages > 1 && (
          <div className="mt-8 flex items-center justify-center gap-2">
            <Button
              variant="outline"
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
            >
              上一頁
            </Button>
            <span className="text-sm text-muted-foreground">
              第 {currentPage} / {totalPages} 頁
            </span>
            <Button
              variant="outline"
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
            >
              下一頁
            </Button>
          </div>
        )}
      </div>

      {/* 建立新案件彈窗 */}
      <CreateCaseModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => refetchCases()}
      />

      {/* 匯入 Excel 彈窗 */}
      <ImportExcelModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={() => refetchCases()}
      />
    </div>
  );
}
