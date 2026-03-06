import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface FilterBarProps {
  year?: number;
  onYearChange: (year?: number) => void;
  regionCode?: string;
  onRegionChange: (region?: string) => void;
  insuranceType?: string;
  onInsuranceTypeChange: (type?: string) => void;
  serialNumber?: string;
  onSerialNumberChange: (serial?: string) => void;
  onClearAll: () => void;
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

export default function FilterBar({
  year,
  onYearChange,
  regionCode,
  onRegionChange,
  insuranceType,
  onInsuranceTypeChange,
  serialNumber,
  onSerialNumberChange,
  onClearAll,
}: FilterBarProps) {
  const hasActiveFilters = year || regionCode || insuranceType || serialNumber;

  return (
    <div className="space-y-3 p-4 bg-muted rounded-lg border border-border">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* 年度篩選 */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">年度</label>
          <Select value={year ? String(year) : "__all__"} onValueChange={(v) => onYearChange(v === "__all__" ? undefined : parseInt(v))}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder="全部" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">全部</SelectItem>
              {Array.from({ length: 21 }, (_, i) => {
                const y = 10 + i;
                return (
                  <SelectItem key={y} value={String(y)}>
                    {String(y).padStart(2, '0')}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        {/* 區域篩選 */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">區域</label>
          <Select value={regionCode || "__all__"} onValueChange={(v) => onRegionChange(v === "__all__" ? undefined : v)}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder="全部" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">全部</SelectItem>
              {REGIONS.map((region) => (
                <SelectItem key={region.code} value={region.code}>
                  {region.code} - {region.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 險種篩選 */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">險種</label>
          <Select value={insuranceType || "__all__"} onValueChange={(v) => onInsuranceTypeChange(v === "__all__" ? undefined : v)}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder="全部" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">全部</SelectItem>
              {INSURANCE_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 流水號篩選 */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">流水號</label>
          <Input
            type="number"
            min="1"
            max="99999"
            placeholder="輸入流水號"
            value={serialNumber || ""}
            onChange={(e) => onSerialNumberChange(e.target.value || undefined)}
            className="h-8 text-sm"
          />
        </div>
      </div>

      {/* 清除篩選按鈕 */}
      {hasActiveFilters && (
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={onClearAll}
            className="gap-1 h-7 text-xs"
          >
            <X className="w-3 h-3" />
            清除篩選
          </Button>
        </div>
      )}
    </div>
  );
}
