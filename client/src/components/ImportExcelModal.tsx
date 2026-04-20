import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, CheckCircle2, Upload } from 'lucide-react';
import { trpc } from '@/lib/trpc';

interface ImportExcelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function ImportExcelModal({ isOpen, onClose, onSuccess }: ImportExcelModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const importMutation = trpc.import.cases.useMutation();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      // 驗證文件類型
      if (!selectedFile.name.endsWith('.xlsx') && !selectedFile.name.endsWith('.xls')) {
        alert('請選擇 Excel 文件 (.xlsx 或 .xls)');
        return;
      }
      setFile(selectedFile);
      setResult(null);
    }
  };

  const handleImport = async () => {
    if (!file) return;

    setIsLoading(true);
    setProgress(0);

    try {
      // 讀取文件為 base64
      const reader = new FileReader();
      reader.onload = async (e) => {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        const bytes = new Uint8Array(arrayBuffer);
        const binary = String.fromCharCode.apply(null, Array.from(bytes));
        const base64 = btoa(binary);

        setProgress(50);

        try {
          const importResult = await importMutation.mutateAsync({
            fileBase64: base64,
          });

          setProgress(100);
          setResult(importResult);
          setFile(null);

          // 3 秒後自動關閉
          setTimeout(() => {
            if (importResult.success > 0) {
              onSuccess?.();
              onClose();
            }
          }, 3000);
        } catch (error) {
          setProgress(0);
          const message = error instanceof Error ? error.message : '匯入失敗';
          setResult({
            success: 0,
            failed: 1,
            errors: [{ row: 0, error: message }],
            details: [],
          });
        }
      };
      reader.readAsArrayBuffer(file);
    } catch (error) {
      setIsLoading(false);
      setProgress(0);
      alert('文件讀取失敗');
    }
  };

  const handleReset = () => {
    setFile(null);
    setResult(null);
    setProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>匯入 Excel 案件</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {!result ? (
            <>
              {/* 文件選擇區域 */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-gray-400 transition"
              >
                <Upload className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                <p className="text-sm font-medium text-gray-700">
                  {file ? file.name : '點擊選擇或拖拽 Excel 文件'}
                </p>
                <p className="text-xs text-gray-500 mt-1">支援 .xlsx 和 .xls 格式</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>

              {/* 進度條 */}
              {isLoading && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>正在匯入...</span>
                    <span>{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>
              )}

              {/* 提示信息 */}
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Excel 文件應包含以下列：案號、狀態、建檔日期、最後更新、狀態歷程、備註
                </AlertDescription>
              </Alert>
            </>
          ) : (
            <>
              {/* 匯入結果 */}
              <div className="space-y-3">
                {result.success > 0 && (
                  <Alert className="border-green-200 bg-green-50">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-800">
                      成功匯入 {result.success} 個案件
                    </AlertDescription>
                  </Alert>
                )}

                {result.failed > 0 && (
                  <Alert className="border-red-200 bg-red-50">
                    <AlertCircle className="h-4 w-4 text-red-600" />
                    <AlertDescription className="text-red-800">
                      失敗 {result.failed} 個案件
                    </AlertDescription>
                  </Alert>
                )}

                {/* 錯誤詳情 */}
                {result.errors && result.errors.length > 0 && (
                  <div className="max-h-48 overflow-y-auto border rounded-lg p-3 bg-gray-50">
                    <p className="text-sm font-medium text-gray-700 mb-2">錯誤詳情：</p>
                    <ul className="space-y-1">
                      {result.errors.map((error: any, idx: number) => (
                        <li key={idx} className="text-xs text-red-600">
                          {error.row > 0 ? `第 ${error.row} 行：` : '文件：'}
                          {error.error}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* 匯入詳情 */}
                {result.details && result.details.length > 0 && (
                  <div className="max-h-48 overflow-y-auto border rounded-lg p-3 bg-gray-50">
                    <p className="text-sm font-medium text-gray-700 mb-2">匯入詳情：</p>
                    <ul className="space-y-1">
                      {result.details.slice(0, 10).map((detail: any, idx: number) => (
                        <li key={idx} className="text-xs">
                          <span className={detail.status === 'success' ? 'text-green-600' : 'text-red-600'}>
                            {detail.caseNumber}
                          </span>
                          {' - '}
                          <span className="text-gray-600">{detail.message}</span>
                        </li>
                      ))}
                      {result.details.length > 10 && (
                        <li className="text-xs text-gray-500">
                          ... 還有 {result.details.length - 10} 個案件
                        </li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            {result ? '關閉' : '取消'}
          </Button>
          {!result && (
            <Button onClick={handleImport} disabled={!file || isLoading}>
              {isLoading ? '匯入中...' : '開始匯入'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
