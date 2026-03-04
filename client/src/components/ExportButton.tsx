import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Loader2, Download } from "lucide-react";
import { toast } from "sonner";

export default function ExportButton() {
  const exportMutation = trpc.export.cases.useQuery();

  const handleExport = async () => {
    try {
      const result = await exportMutation.refetch();
      if (result.data) {
        const { buffer, filename } = result.data;
        const binaryString = atob(buffer);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success("匯出成功");
      }
    } catch (error) {
      toast.error("匯出失敗");
    }
  };

  return (
    <Button
      onClick={handleExport}
      disabled={exportMutation.isLoading}
      variant="outline"
      className="gap-2"
    >
      {exportMutation.isLoading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          匯出中...
        </>
      ) : (
        <>
          <Download className="w-4 h-4" />
          匯出 Excel
        </>
      )}
    </Button>
  );
}
