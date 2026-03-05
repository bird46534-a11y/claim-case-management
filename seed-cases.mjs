/**
 * 預生成案件清單的 seed 腳本
 * 用法: node seed-cases.mjs
 * 
 * 生成規則：
 * - 公司代碼：10（固定）
 * - 區域代碼：16(嘉義)、17(新營)、18(台南)、29(佳里)、30(雲林)、37(永康)
 * - 年度：18（2018年，固定）
 * - 險種：A（固定）
 * - 流水號：每個區域都是 00001~05000
 * 
 * 總案件數：6 個區域 × 5000 個流水號 = 30000 個案件
 */

import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("ERROR: DATABASE_URL environment variable is not set");
  process.exit(1);
}

// 解析 DATABASE_URL
const url = new URL(DATABASE_URL);
const config = {
  host: url.hostname,
  user: url.username,
  password: url.password,
  database: url.pathname.slice(1),
  port: url.port || 3306,
  ssl: {
    rejectUnauthorized: false, // 允许自簽名證書
  },
  enableKeepAlive: true,
};

const REGIONS = [
  { code: "16", name: "嘉義" },
  { code: "17", name: "新營" },
  { code: "18", name: "台南" },
  { code: "29", name: "佳里" },
  { code: "30", name: "雲林" },
  { code: "37", name: "永康" },
];

const COMPANY = "10";
const YEAR = "18";
const INSURANCE_TYPE = "A";
const CASES_PER_REGION = 5000;

async function generateCases() {
  let connection;
  try {
    connection = await mysql.createConnection(config);
  } catch (error) {
    console.error("連接失敗：", error.message);
    throw error;
  }

  try {
    console.log("開始生成案件清單...");
    console.log(`區域數：${REGIONS.length}`);
    console.log(`每個區域的案件數：${CASES_PER_REGION}`);
    console.log(`總案件數：${REGIONS.length * CASES_PER_REGION}`);

    // 檢查是否已存在案件
    const [existingCases] = await connection.execute(
      "SELECT COUNT(*) as count FROM cases"
    );
    
    if (existingCases[0].count > 0) {
      console.log(`警告：資料庫中已存在 ${existingCases[0].count} 個案件`);
      console.log("清空現有案件並重新生成...");
      await connection.execute("DELETE FROM statusHistory");
      await connection.execute("DELETE FROM cases");
      console.log("✓ 已清空現有案件");
    }

    // 準備批量插入
    const cases = [];
    let caseIndex = 0;

    // 為每個區域生成 00001~05000 的流水號
    for (const region of REGIONS) {
      for (let i = 1; i <= CASES_PER_REGION; i++) {
        const sequenceNumber = String(i).padStart(5, "0");
        const caseNumber = `${COMPANY}${region.code}${YEAR}${INSURANCE_TYPE}${sequenceNumber}`;
        
        cases.push({
          caseNumber,
          status: "進入檔案室", // 預設狀態
          createdBy: 1, // 假設 user id 1 為系統管理員
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        caseIndex++;

        // 每 1000 個案件批量插入一次
        if (caseIndex % 1000 === 0) {
          await insertBatch(connection, cases);
          console.log(`已生成 ${caseIndex} 個案件...`);
          cases.length = 0;
        }
      }
    }

    // 插入剩餘案件
    if (cases.length > 0) {
      await insertBatch(connection, cases);
      console.log(`已生成 ${caseIndex} 個案件...`);
    }

    console.log(`✓ 成功生成 ${caseIndex} 個案件`);

    // 驗證
    const [result] = await connection.execute(
      "SELECT COUNT(*) as count FROM cases"
    );
    console.log(`資料庫中現有案件數：${result[0].count}`);

    // 顯示每個區域的案件數
    for (const region of REGIONS) {
      const [regionResult] = await connection.execute(
        `SELECT COUNT(*) as count FROM cases WHERE caseNumber LIKE '${COMPANY}${region.code}${YEAR}${INSURANCE_TYPE}%'`
      );
      console.log(`  區域 ${region.name}(${region.code})：${regionResult[0].count} 個案件`);
    }

  } catch (error) {
    console.error("錯誤：", error.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

async function insertBatch(connection, cases) {
  if (cases.length === 0) return;

  const values = cases
    .map(
      (c) =>
        `('${c.caseNumber}', '${c.status}', ${c.createdBy}, NOW(), NOW())`
    )
    .join(",");

  const sql = `
    INSERT INTO cases (caseNumber, status, createdBy, createdAt, updatedAt)
    VALUES ${values}
    ON DUPLICATE KEY UPDATE updatedAt = NOW()
  `;

  try {
    await connection.execute(sql);
  } catch (error) {
    // 忽略重複鍵錯誤
    if (error.code !== "ER_DUP_ENTRY") {
      throw error;
    }
  }
}

generateCases();
