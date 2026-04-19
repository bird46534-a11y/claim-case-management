import { eq, and, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, cases, statusHistory } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

/**
 * 新增案件
 */
export async function createCase(input: {
  caseNumber: string;
  createdBy: number;
  status?: string;
  returnReason?: string;
  transferLegalInfo?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // 將前端的狀態值轉換為中文狀態
  const statusMap: Record<string, string> = {
    "entering_archive": "進入檔案室",
    "returned": "擲回經辦人員",
    "transfer_taipei": "轉台北審核",
    "transfer_legal": "轉法務追償",
  };

  const finalStatus = input.status ? (statusMap[input.status] || "進入檔案室") : "進入檔案室";

  const result = await db.insert(cases).values({
    caseNumber: input.caseNumber,
    status: finalStatus as "進入檔案室" | "擲回經辦人員" | "轉台北審核" | "轉法務追償",
    returnReason: input.returnReason || undefined,
    transferLegalInfo: input.transferLegalInfo || undefined,
    createdBy: input.createdBy,
  });

  // 如果設置了初始狀態，則在 statusHistory 中記錄
  if (input.status) {
    const caseId = (result as any).insertId;
    await db.insert(statusHistory).values({
      caseId,
      status: finalStatus as "進入檔案室" | "擲回經辦人員" | "轉台北審核" | "轉法務追償",
      operatorId: input.createdBy,
      reason: input.returnReason || undefined,
      transferLegalInfo: input.transferLegalInfo || undefined,
    });
  }

  return result;
}

/**
 * 取得所有案件（按區域代碼和流水號正序排列）
 */
export async function getAllCases() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // 按照案號正序排列（區域代碼 + 流水號）
  const result = await db
    .select()
    .from(cases)
    .orderBy(sql`SUBSTRING(${cases.caseNumber}, 3, 2), SUBSTRING(${cases.caseNumber}, 9, 5)`);
  
  return result;
}

/**
 * 根據案號搜尋案件（支援模糊搜尋，按區域代碼和流水號正序排列）
 */
export async function searchCases(keyword: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db
    .select()
    .from(cases)
    .where(
      sql`${cases.caseNumber} LIKE ${`%${keyword}%`}`
    )
    .orderBy(sql`SUBSTRING(${cases.caseNumber}, 3, 2), SUBSTRING(${cases.caseNumber}, 9, 5)`);

  return result;
}

/**
 * 多條件動態查詢案件
 * 支援篩選：year, region_code, insurance_type, serial_number
 */
export async function queryCasesByFilters(filters: {
  year?: number;
  regionCode?: string;
  insuranceType?: string;
  serialNumber?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // 案號格式：公司(2) + 區域(2) + 年度(2) + 險種(1) + 流水號(5)
  const conditions: any[] = [];

  if (filters.year) {
    const yearStr = String(filters.year).padStart(2, '0');
    conditions.push(sql`SUBSTRING(${cases.caseNumber}, 5, 2) = ${yearStr}`);
  }

  if (filters.regionCode) {
    conditions.push(sql`SUBSTRING(${cases.caseNumber}, 3, 2) = ${filters.regionCode}`);
  }

  if (filters.insuranceType) {
    conditions.push(sql`SUBSTRING(${cases.caseNumber}, 7, 1) = ${filters.insuranceType}`);
  }

  if (filters.serialNumber) {
    const serialStr = String(filters.serialNumber).padStart(5, '0');
    conditions.push(sql`SUBSTRING(${cases.caseNumber}, 8, 5) = ${serialStr}`);
  }

  // 組合所有條件
  if (conditions.length === 0) {
    return getAllCases();
  }

  // 按區域代碼正序 > 流水號正序排列
  const result = await db
    .select()
    .from(cases)
    .where(and(...(conditions as any)))
    .orderBy(
      sql`SUBSTRING(${cases.caseNumber}, 3, 2), SUBSTRING(${cases.caseNumber}, 8, 5)`
    );

  return result;
}

/**
 * 更新案件狀態
 */
export async function updateCaseStatus(input: {
  caseId: number;
  status: "進入檔案室" | "擲回經辦人員" | "轉台北審核" | "轉法務追償";
  operatorId: number;
  reason?: string;
  transferLegalInfo?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // 更新案件狀態
  await db
    .update(cases)
    .set({ status: input.status })
    .where(eq(cases.id, input.caseId));

  // 記錄狀態歷程
  await db.insert(statusHistory).values({
    caseId: input.caseId,
    status: input.status,
    operatorId: input.operatorId,
    reason: input.reason,
    transferLegalInfo: input.transferLegalInfo,
  });
}

/**
 * 取得案件的完整狀態歷程
 */
export async function getCaseHistory(caseId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db
    .select({
      id: statusHistory.id,
      caseId: statusHistory.caseId,
      status: statusHistory.status,
      operatorId: statusHistory.operatorId,
      operatorName: users.name,
      changedAt: statusHistory.changedAt,
      reason: statusHistory.reason,
      transferLegalInfo: statusHistory.transferLegalInfo,
    })
    .from(statusHistory)
    .leftJoin(users, eq(statusHistory.operatorId, users.id))
    .where(eq(statusHistory.caseId, caseId))
    .orderBy(statusHistory.changedAt);

  return result;
}

/**
 * 刪除案件
 */
export async function deleteCase(caseId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(cases).where(eq(cases.id, caseId));
}

/**
 * 根據案件 ID 取得案件詳情
 */
export async function getCaseById(caseId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.select().from(cases).where(eq(cases.id, caseId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}
