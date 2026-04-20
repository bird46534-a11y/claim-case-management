import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * 案件表：儲存理賠案件基本資訊
 * case_number: 12碼案號（例如 101815A00001）
 * status: 當前狀態（進入檔案室、擲回經辦人員、轉台北審核、轉法務追償）
 * created_by: 建檔者 user id
 * created_at: 建檔時間
 * updated_at: 最後更新時間
 */
export const cases = mysqlTable("cases", {
  id: int("id").autoincrement().primaryKey(),
  caseNumber: varchar("caseNumber", { length: 12 }).notNull().unique(),
  status: mysqlEnum("status", [
    "進入檔案室",
    "擲回經辦人員",
    "轉台北審核",
    "轉法務追償",
  ]).notNull(),
  returnReason: text("returnReason"), // 擲回原因
  transferLegalInfo: text("transferLegalInfo"), // 轉法務追償信息
  createdBy: int("createdBy").notNull().references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Case = typeof cases.$inferSelect;
export type InsertCase = typeof cases.$inferInsert;

/**
 * 狀態歷程表：記錄每次狀態變更的詳細資訊
 * case_id: 案件 ID
 * status: 變更後的狀態
 * operator_id: 操作人 user id
 * changed_at: 變更時間
 * reason: 擲回原因備註（僅當狀態為「擲回經辦人員」時使用）
 */
export const statusHistory = mysqlTable("statusHistory", {
  id: int("id").autoincrement().primaryKey(),
  caseId: int("caseId").notNull().references(() => cases.id, { onDelete: "cascade" }),
  status: mysqlEnum("status", [
    "進入檔案室",
    "擲回經辦人員",
    "轉台北審核",
    "轉法務追償",
  ]).notNull(),
  operatorId: int("operatorId").notNull().references(() => users.id),
  changedAt: timestamp("changedAt").defaultNow().notNull(),
  reason: text("reason"), // 擲回原因
  transferLegalInfo: text("transferLegalInfo"), // 轉法務追償信息
});

export type StatusHistory = typeof statusHistory.$inferSelect;
export type InsertStatusHistory = typeof statusHistory.$inferInsert;

// 狀態變更信息類型
export type StatusChangeInfo = {
  status: string;
  reason?: string; // 擲回原因
  transferLegalInfo?: string; // 轉法務追償信息
};
/**
 * 審計日誌表：記錄用戶權限變更
 * admin_id: 執行操作的管理員 user id
 * target_user_id: 被修改的用戶 user id
 * old_role: 修改前的角色
 * new_role: 修改後的角色
 * changed_at: 變更時間
 */
export const auditLog = mysqlTable("auditLog", {
  id: int("id").autoincrement().primaryKey(),
  adminId: int("adminId").notNull().references(() => users.id),
  targetUserId: int("targetUserId").notNull().references(() => users.id),
  oldRole: mysqlEnum("oldRole", ["user", "admin"]).notNull(),
  newRole: mysqlEnum("newRole", ["user", "admin"]).notNull(),
  reason: text("reason"),
  changedAt: timestamp("changedAt").defaultNow().notNull(),
});

export type AuditLog = typeof auditLog.$inferSelect;
export type InsertAuditLog = typeof auditLog.$inferInsert;
