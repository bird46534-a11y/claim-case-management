import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

interface CreateCaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const REGIONS = [
  { code: "16", name: "嘉義" },
  { code: "17", name: "新營" },
  { code: "18", name: "台南" },
  { code: "29", name: "佳里" },
  { code: "30", name: "雲林" },
  { code: "37", name: "永康" },
];

const INSURANCE_TYPES = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z"];

export default function CreateCaseModal({ isOpen, onClose, onSuccess }: CreateCaseModalProps) {
  const [year, setYear] = useState("15");
  const [regionCode, setRegionCode] = useState("16");
  const [insuranceType, setInsuranceType] = useState("A");
  const [serialNumber, setSerialNumber] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const createMutation = trpc.cases.create.useMutation();

  // 計算案號預覽
  const generatePreview = () => {
    if (!serialNumber) return "案號預覽";
    const companyCode = "10";
    const yearStr = String(year).padStart(2, '0');
    const serialStr = String(serialNumber).padStart(5, '0');
    return `${companyCode}${regionCode}${yearStr}${insuranceType}${serialStr}`;
  };

  const handleCreate = async () => {
    if (!serialNumber) {
      toast.error("請輸入流水號");
      return;
    }

    setIsLoading(true);
    try {
      await createMutation.mutateAsync({
        year: parseInt(year),
        regionCode,
        insuranceType,
        serialNumber: parseInt(serialNumber),
      });

      toast.success("案件建立成功");
      setSerialNumber("");
      setYear("15");
      setRegionCode("16");
      setInsuranceType("A");
      onClose();
      onSuccess?.();
    } catch (error) {
      const errorMessage = (error as any)?.message || "建立案件失敗";
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>建立新案件</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* 年度選擇 */}
          <div className="space-y-2">
            <Label htmlFor="year">年度</Label>
            <Select value={year} onValueChange={setYear}>
              <SelectTrigger id="year">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 21 }, (_, i) => {
                  const y = 10 + i;
                  return (
                    <SelectItem key={y} value={String(y)}>
                      {String(y).padStart(2, '0')} (民國 {100 + y} 年)
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* 區域選擇 */}
          <div className="space-y-2">
            <Label htmlFor="region">區域</Label>
            <Select value={regionCode} onValueChange={setRegionCode}>
              <SelectTrigger id="region">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REGIONS.map((region) => (
                  <SelectItem key={region.code} value={region.code}>
                    {region.code} - {region.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 險種選擇 */}
          <div className="space-y-2">
            <Label htmlFor="insurance">險種</Label>
            <Select value={insuranceType} onValueChange={setInsuranceType}>
              <SelectTrigger id="insurance">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INSURANCE_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 流水號輸入 */}
          <div className="space-y-2">
            <Label htmlFor="serial">流水號 (1-99999)</Label>
            <Input
              id="serial"
              type="number"
              min="1"
              max="99999"
              placeholder="輸入流水號"
              value={serialNumber}
              onChange={(e) => setSerialNumber(e.target.value)}
            />
          </div>

          {/* 案號預覽 */}
          <div className="space-y-2">
            <Label>案號預覽</Label>
            <div className="p-3 bg-muted rounded-md font-mono text-sm font-bold">
              {generatePreview()}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            取消
          </Button>
          <Button onClick={handleCreate} disabled={isLoading} className="bg-red-600 hover:bg-red-700">
            {isLoading ? "建立中..." : "建立案件"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
