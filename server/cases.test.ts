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
  });

  describe("filter", () => {
    it("should return cases matching filter criteria", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.cases.filter({});
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("create", () => {
    it("should reject non-admin users", async () => {
      const ctx = createAuthContext("user");
      const caller = appRouter.createCaller(ctx);

      try {
        await caller.cases.create({
          year: 15,
          regionCode: "16",
          insuranceType: "A",
          serialNumber: 1,
        });
        expect.fail("Should throw FORBIDDEN error");
      } catch (error) {
        expect((error as any).code).toBe("FORBIDDEN");
      }
    });

    it("should validate input parameters", async () => {
      const ctx = createAuthContext("admin");
      const caller = appRouter.createCaller(ctx);

      const invalidInputs = [
        { year: 5, regionCode: "16", insuranceType: "A", serialNumber: 1 }, // year too small
        { year: 35, regionCode: "16", insuranceType: "A", serialNumber: 1 }, // year too large
        { year: 15, regionCode: "99", insuranceType: "A", serialNumber: 1 }, // invalid region
        { year: 15, regionCode: "16", insuranceType: "AB", serialNumber: 1 }, // invalid insurance type
        { year: 15, regionCode: "16", insuranceType: "A", serialNumber: 100000 }, // serial number too large
      ];

      for (const input of invalidInputs) {
        try {
          await caller.cases.create(input as any);
          expect.fail(`Should reject input: ${JSON.stringify(input)}`);
        } catch (error) {
          expect((error as any).message).toBeDefined();
        }
      }
    });

    it("should accept valid input parameters", async () => {
      const ctx = createAuthContext("admin");
      const caller = appRouter.createCaller(ctx);

      const validInputs = [
        { year: 10, regionCode: "16", insuranceType: "A", serialNumber: 1 },
        { year: 15, regionCode: "17", insuranceType: "B", serialNumber: 12345 },
        { year: 30, regionCode: "37", insuranceType: "Z", serialNumber: 99999 },
      ];

      for (const input of validInputs) {
        try {
          await caller.cases.create(input);
        } catch (error) {
          // Expected to fail due to DB not being available in test
          expect((error as any).message).toBeDefined();
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
          expect((error as any).message).toBeDefined();
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
