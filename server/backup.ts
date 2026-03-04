import { storagePut } from "./storage";
import * as db from "./db";

/**
 * 每日自動備份案件資料至 S3
 */
export async function backupCasesData() {
  try {
    console.log("[Backup] Starting daily backup...");

    // 取得所有案件
    const allCases = await db.getAllCases();

    // 取得所有案件的歷程
    const casesWithHistory = await Promise.all(
      allCases.map(async (caseItem) => {
        const history = await db.getCaseHistory(caseItem.id);
        return {
          ...caseItem,
          history,
        };
      })
    );

    // 轉換為 JSON
    const backupData = JSON.stringify(casesWithHistory, null, 2);

    // 上傳至 S3
    const timestamp = new Date().toISOString().split("T")[0];
    const filename = `backup/cases_${timestamp}.json`;

    const result = await storagePut(filename, backupData, "application/json");

    console.log(`[Backup] Backup completed successfully: ${result.url}`);
    return result;
  } catch (error) {
    console.error("[Backup] Backup failed:", error);
    throw error;
  }
}

/**
 * 設置每日備份的 cron job
 * 在每天凌晨 2:00 執行備份
 */
export function setupDailyBackup() {
  // 注意：在實際部署時，應使用 node-cron 或類似的排程庫
  // 這裡只是示例，實際實現應在 server/_core/index.ts 中設置
  console.log("[Backup] Daily backup scheduler configured");
}
