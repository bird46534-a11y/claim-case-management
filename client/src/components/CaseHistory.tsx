import { trpc } from "@/lib/trpc";
import { Loader2 } from "lucide-react";

interface CaseHistoryProps {
  caseId: number;
}

export default function CaseHistory({ caseId }: CaseHistoryProps) {
  const { data: history = [], isLoading } = trpc.cases.history.useQuery({ caseId });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="animate-spin w-4 h-4" />
      </div>
    );
  }

  if (history.length === 0) {
    return <p className="text-sm text-muted-foreground">暫無狀態變動記錄</p>;
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold">狀態變動歷程</h3>
      <div className="space-y-2">
        {history.map((record, index) => (
          <div key={record.id} className="flex gap-3 text-sm">
            {/* 時間軸點 */}
            <div className="flex flex-col items-center">
              <div className="w-2 h-2 bg-accent rounded-full mt-1.5" />
              {index < history.length - 1 && (
                <div className="w-0.5 h-8 bg-border mt-1" />
              )}
            </div>

            {/* 內容 */}
            <div className="flex-1 pb-2">
              <div className="flex items-baseline gap-2">
                <span className="font-medium">{record.status}</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(record.changedAt).toLocaleString("zh-TW")}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">操作人: {record.operatorName || "未知"}</p>
              {record.reason && (
                <p className="text-xs text-muted-foreground mt-1">原因：{record.reason}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
