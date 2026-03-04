import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(role: "admin" | "user" = "admin"): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };

  return ctx;
}

describe("cases router", () => {
  describe("list", () => {
    it("should return empty array when no cases exist", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.cases.list();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("search", () => {
    it("should handle search with empty keyword", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.cases.search({ keyword: "" });
      expect(Array.isArray(result)).toBe(true);
    });

    it("should validate case number format", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      try {
        await caller.cases.create({ caseNumber: "invalid" });
        expect.fail("Should throw error for invalid case number");
      } catch (error) {
        expect((error as any).message).toContain("案號格式不正確");
      }
    });
  });

  describe("create", () => {
    it("should reject non-admin users", async () => {
      const ctx = createAuthContext("user");
      const caller = appRouter.createCaller(ctx);

      try {
        await caller.cases.create({ caseNumber: "101815A00001" });
        expect.fail("Should throw FORBIDDEN error");
      } catch (error) {
        expect((error as any).code).toBe("FORBIDDEN");
      }
    });

    it("should validate case number format", async () => {
      const ctx = createAuthContext("admin");
      const caller = appRouter.createCaller(ctx);

      const invalidFormats = [
        "1234567890",      // 10碼
        "12345678901234",  // 14碼
        "101815X00001",    // 險種不是 A/K/M
        "10181500000A",    // 流水號不是5碼
      ];

      for (const format of invalidFormats) {
        try {
          await caller.cases.create({ caseNumber: format });
          expect.fail(`Should reject format: ${format}`);
        } catch (error) {
          expect((error as any).message).toContain("案號格式不正確");
        }
      }
    });

    it("should accept valid case number formats", async () => {
      const ctx = createAuthContext("admin");
      const caller = appRouter.createCaller(ctx);

      const validFormats = [
        "101815A00001",
        "202024K12345",
        "999999M99999",
      ];

      for (const format of validFormats) {
        // Note: This will fail due to database constraints in test environment
        // but we're testing the format validation logic
        try {
          await caller.cases.create({ caseNumber: format });
        } catch (error) {
          // Expected to fail due to DB not being available in test
          expect((error as any).message).not.toContain("案號格式不正確");
        }
      }
    });
  });

  describe("updateStatus", () => {
    it("should reject non-admin users", async () => {
      const ctx = createAuthContext("user");
      const caller = appRouter.createCaller(ctx);

      try {
        await caller.cases.updateStatus({
          caseId: 1,
          status: "進入檔案室",
        });
        expect.fail("Should throw FORBIDDEN error");
      } catch (error) {
        expect((error as any).code).toBe("FORBIDDEN");
      }
    });

    it("should accept valid status values", async () => {
      const ctx = createAuthContext("admin");
      const caller = appRouter.createCaller(ctx);

      const validStatuses = [
        "進入檔案室",
        "擲回經辦人員",
        "轉台北審核",
        "轉法務追償",
      ];

      for (const status of validStatuses) {
        try {
          await caller.cases.updateStatus({
            caseId: 1,
            status: status as any,
          });
        } catch (error) {
          // Expected to fail due to DB not being available in test
          expect((error as any).message).not.toContain("狀態無效");
        }
      }
    });
  });

  describe("history", () => {
    it("should return history for a case", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.cases.history({ caseId: 1 });
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("delete", () => {
    it("should reject non-admin users", async () => {
      const ctx = createAuthContext("user");
      const caller = appRouter.createCaller(ctx);

      try {
        await caller.cases.delete({ caseId: 1 });
        expect.fail("Should throw FORBIDDEN error");
      } catch (error) {
        expect((error as any).code).toBe("FORBIDDEN");
      }
    });
  });
});
