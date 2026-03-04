import ExcelJS from "exceljs";
import { Case, StatusHistory } from "../drizzle/schema";

export async function exportCasesToExcel(
  cases: Case[],
  histories: Map<number, StatusHistory[]>
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("案件列表");

  // 設定欄位
  worksheet.columns = [
    { header: "案號", key: "caseNumber", width: 15 },
    { header: "狀態", key: "status", width: 15 },
    { header: "建檔日期", key: "createdAt", width: 20 },
    { header: "最後更新", key: "updatedAt", width: 20 },
    { header: "狀態歷程", key: "history", width: 50 },
  ];

  // 設定標題行樣式
  worksheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  worksheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF000000" }, // 黑色背景
  };

  // 新增資料行
  cases.forEach((caseItem) => {
    const caseHistory = histories.get(caseItem.id) || [];
    const historyText = caseHistory
      .map(
        (h) =>
          `${new Date(h.changedAt).toLocaleString("zh-TW")} - ${h.status}${
            h.reason ? ` (${h.reason})` : ""
          }`
      )
      .join("\n");

    worksheet.addRow({
      caseNumber: caseItem.caseNumber,
      status: caseItem.status,
      createdAt: new Date(caseItem.createdAt).toLocaleString("zh-TW"),
      updatedAt: new Date(caseItem.updatedAt).toLocaleString("zh-TW"),
      history: historyText,
    });
  });

  // 設定行高與文字換行
  worksheet.eachRow((row) => {
    row.height = 30;
  });

  worksheet.columns.forEach((col) => {
    if (col.key === "history") {
      col.alignment = { wrapText: true, vertical: "top" };
    }
  });

  // 匯出為 Buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer as unknown as Buffer;
}
