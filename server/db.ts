import { eq, sql } from "drizzle-orm";
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
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(cases).values({
    caseNumber: input.caseNumber,
    createdBy: input.createdBy,
    status: "進入檔案室", // 預設狀態
  });

  return result;
}

/**
 * 取得所有案件（包含最新狀態）
 */
export async function getAllCases() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.select().from(cases);
  return result;
}

/**
 * 根據案號搜尋案件（支援模糊搜尋）
 */
export async function searchCases(keyword: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db
    .select()
    .from(cases)
    .where(
      sql`${cases.caseNumber} LIKE ${`%${keyword}%`}`
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
  });
}

/**
 * 取得案件的完整狀態歷程
 */
export async function getCaseHistory(caseId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db
    .select()
    .from(statusHistory)
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
