import * as XLSX from 'xlsx';
import * as db from './db';

/**
 * 狀態對應表 - 將 Excel 中的狀態轉換為系統狀態
 */
const STATUS_MAPPING: Record<string, string> = {
  '進入檔案室': 'entering_archive',
  '擲回經辦人員': 'returned',
  '轉台北審核': 'transfer_taipei',
  '轉法務追償': 'transfer_legal',
};

/**
 * 解析日期字符串
 */
function parseDate(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  try {
    // 處理 Excel 日期格式: "2026/3/25 上午 1:50:00"
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return null;
    return date.getTime();
  } catch {
    return null;
  }
}

/**
 * 驗證案號格式
 */
function validateCaseNumber(caseNumber: string): boolean {
  if (!caseNumber || typeof caseNumber !== 'string') return false;
  // 12碼案號格式: 公司(2碼) + 區域(2碼) + 年度(2碼) + 險種(1碼) + 流水號(5碼)
  const pattern = /^\d{2}\d{2}\d{2}[A-Z]\d{5}$/;
  return pattern.test(caseNumber.trim());
}

/**
 * 從 Excel 文件解析案件數據
 */
export function parseExcelFile(fileBuffer: Buffer): {
  cases: Array<{
    caseNumber: string;
    status?: string;
    returnReason?: string;
    transferLegalInfo?: string;
  }>;
  errors: Array<{
    row: number;
    error: string;
  }>;
} {
  const cases: Array<{
    caseNumber: string;
    status?: string;
    returnReason?: string;
    transferLegalInfo?: string;
  }> = [];
  const errors: Array<{ row: number; error: string }> = [];

  try {
    // 讀取 Excel 文件
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    
    if (!worksheet) {
      throw new Error('找不到工作表');
    }

    // 轉換為 JSON 格式
    const data = XLSX.utils.sheet_to_json(worksheet, {
      header: 1, // 返回二維數組
      defval: '',
    }) as Array<any[]>;

    if (data.length < 2) {
      throw new Error('Excel 文件至少需要標題行和一行數據');
    }

    // 提取標題行
    const headers = data[0] as string[];
    const caseNumberIdx = headers.findIndex(h => h?.toString().includes('案號') || h?.toString().includes('案号'));
    const statusIdx = headers.findIndex(h => h?.toString().includes('狀態') || h?.toString().includes('状态'));
    const reasonIdx = headers.findIndex(h => h?.toString().includes('備註') || h?.toString().includes('备注'));

    if (caseNumberIdx === -1) {
      throw new Error('找不到「案號」列');
    }

    // 處理數據行（跳過標題行）
    for (let rowIdx = 1; rowIdx < data.length; rowIdx++) {
      const row = data[rowIdx];
      
      // 跳過空行
      if (!row || row.length === 0 || !row[caseNumberIdx]) {
        continue;
      }

      const caseNumber = String(row[caseNumberIdx]).trim();
      
      // 驗證案號格式
      if (!validateCaseNumber(caseNumber)) {
        errors.push({
          row: rowIdx + 1,
          error: `無效的案號格式: ${caseNumber}`,
        });
        continue;
      }

      // 提取狀態
      let status: string | undefined;
      if (statusIdx !== -1 && row[statusIdx]) {
        const statusValue = String(row[statusIdx]).trim();
        status = STATUS_MAPPING[statusValue];
        
        if (!status) {
          errors.push({
            row: rowIdx + 1,
            error: `未知的狀態: ${statusValue}`,
          });
          continue;
        }
      }

      // 提取備註/原因
      let returnReason: string | undefined;
      let transferLegalInfo: string | undefined;
      
      if (reasonIdx !== -1 && row[reasonIdx]) {
        const reasonValue = String(row[reasonIdx]).trim();
        
        // 根據狀態決定備註的用途
        if (status === 'returned') {
          returnReason = reasonValue;
        } else if (status === 'transfer_legal') {
          transferLegalInfo = reasonValue;
        }
      }

      cases.push({
        caseNumber,
        status,
        returnReason,
        transferLegalInfo,
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知錯誤';
    errors.push({
      row: 0,
      error: `文件解析失敗: ${message}`,
    });
  }

  return { cases, errors };
}

/**
 * 批量匯入案件
 */
export async function importCasesFromExcel(
  fileBuffer: Buffer,
  userId: number
): Promise<{
  success: number;
  failed: number;
  errors: Array<{
    row: number;
    error: string;
  }>;
  details: Array<{
    caseNumber: string;
    status: 'success' | 'error';
    message: string;
  }>;
}> {
  const { cases, errors: parseErrors } = parseExcelFile(fileBuffer);
  
  const details: Array<{
    caseNumber: string;
    status: 'success' | 'error';
    message: string;
  }> = [];
  
  let successCount = 0;
  let failedCount = 0;

  // 處理每一個案件
  for (const caseData of cases) {
    try {
      // 檢查案號是否已存在
      const existing = await db.getCaseByNumber(caseData.caseNumber);
      if (existing) {
        failedCount++;
        details.push({
          caseNumber: caseData.caseNumber,
          status: 'error',
          message: '案號已存在',
        });
        continue;
      }

      // 創建案件
      await db.createCase({
        caseNumber: caseData.caseNumber,
        status: caseData.status,
        returnReason: caseData.returnReason,
        transferLegalInfo: caseData.transferLegalInfo,
        createdBy: userId,
      });

      successCount++;
      details.push({
        caseNumber: caseData.caseNumber,
        status: 'success',
        message: '匯入成功',
      });
    } catch (error) {
      failedCount++;
      const message = error instanceof Error ? error.message : '未知錯誤';
      details.push({
        caseNumber: caseData.caseNumber,
        status: 'error',
        message,
      });
    }
  }

  return {
    success: successCount,
    failed: failedCount + parseErrors.length,
    errors: parseErrors,
    details,
  };
}
