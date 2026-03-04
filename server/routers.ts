import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { TRPCError } from "@trpc/server";
import { exportCasesToExcel } from "./export";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  cases: router({
    list: publicProcedure.query(async () => {
      const allCases = await db.getAllCases();
      return allCases;
    }),

    search: publicProcedure
      .input(z.object({ keyword: z.string() }))
      .query(async ({ input }) => {
        const results = await db.searchCases(input.keyword);
        return results;
      }),

    create: protectedProcedure
      .input(
        z.object({
          caseNumber: z.string().regex(/^[0-9]{2}[0-9]{2}[0-9]{2}[AKM][0-9]{5}$/, "案號格式不正確"),
        })
      )
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "只有管理者可以新增案件" });
        }

        try {
          await db.createCase({
            caseNumber: input.caseNumber,
            createdBy: ctx.user.id,
          });
          return { success: true };
        } catch (error) {
          if ((error as any).code === "ER_DUP_ENTRY") {
            throw new TRPCError({ code: "BAD_REQUEST", message: "案號已存在" });
          }
          throw error;
        }
      }),

    updateStatus: protectedProcedure
      .input(
        z.object({
          caseId: z.number(),
          status: z.enum(["進入檔案室", "擲回經辦人員", "轉台北審核", "轉法務追償"]),
          reason: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "只有管理者可以更新案件狀態" });
        }

        await db.updateCaseStatus({
          caseId: input.caseId,
          status: input.status,
          operatorId: ctx.user.id,
          reason: input.reason,
        });

        return { success: true };
      }),

    history: publicProcedure
      .input(z.object({ caseId: z.number() }))
      .query(async ({ input }) => {
        const history = await db.getCaseHistory(input.caseId);
        return history;
      }),

    delete: protectedProcedure
      .input(z.object({ caseId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "只有管理者可以刪除案件" });
        }

        await db.deleteCase(input.caseId);
        return { success: true };
      }),
  }),

  export: router({
    cases: publicProcedure.query(async () => {
      const allCases = await db.getAllCases();
      const historiesMap = new Map();

      for (const caseItem of allCases) {
        const history = await db.getCaseHistory(caseItem.id);
        historiesMap.set(caseItem.id, history);
      }

      const buffer = await exportCasesToExcel(allCases, historiesMap);
      return {
        buffer: buffer.toString("base64"),
        filename: `案件列表_${new Date().toISOString().split("T")[0]}.xlsx`,
      };
    }),
  }),
});

export type AppRouter = typeof appRouter;
