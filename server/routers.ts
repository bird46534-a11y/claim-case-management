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

    // 多條件查詢 API
    filter: publicProcedure
      .input(
        z.object({
          year: z.number().optional(),
          regionCode: z.string().optional(),
          insuranceType: z.string().optional(),
          serialNumber: z.string().optional(),
        })
      )
      .query(async ({ input }) => {
        const results = await db.queryCasesByFilters({
          year: input.year,
          regionCode: input.regionCode,
          insuranceType: input.insuranceType,
          serialNumber: input.serialNumber ? parseInt(input.serialNumber) : undefined,
        });
        return results;
      }),

    // 新增案件 API - 接收分解的參數
    create: protectedProcedure
      .input(
        z.object({
          year: z.number().min(10).max(30),
          regionCode: z.string().regex(/^(16|17|18|29|30|37)$/, "無效的區域代碼"),
          insuranceType: z.string().regex(/^[A-Z]$/, "險種必須為單一大寫字母"),
          serialNumber: z.number().min(1).max(99999),
          status: z.enum(["entering_archive", "returned", "transfer_taipei", "transfer_legal"]).optional(),
          returnReason: z.string().optional(),
          transferLegalInfo: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "只有管理者可以新增案件" });
        }

        try {
          // 組合案號：公司(10) + 區域(2) + 年度(2) + 險種(1) + 流水號(5)
          const companyCode = "10";
          const yearStr = String(input.year).padStart(2, '0');
          const serialStr = String(input.serialNumber).padStart(5, '0');
          const caseNumber = `${companyCode}${input.regionCode}${yearStr}${input.insuranceType}${serialStr}`;

          const result = await db.createCase({
            caseNumber,
            createdBy: ctx.user.id,
            status: input.status,
            returnReason: input.returnReason,
            transferLegalInfo: input.transferLegalInfo,
          });

          // 發送 WebSocket 事件通知所有客戶端
          const io = (ctx.req as any).app?.io;
          if (io) {
            io.emit("case:created", {
              caseNumber,
              year: input.year,
              regionCode: input.regionCode,
              insuranceType: input.insuranceType,
              serialNumber: input.serialNumber,
              createdBy: ctx.user.id,
              createdAt: new Date(),
            });
          }

          return { success: true, caseNumber };
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
          transferLegalInfo: z.string().optional(),
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
          transferLegalInfo: input.transferLegalInfo,
        });

        // 發送 WebSocket 事件通知所有客戶端
        const io = (ctx.req as any).app?.io;
        if (io) {
          io.emit("case:updated", {
            caseId: input.caseId,
            status: input.status,
            operatorId: ctx.user.id,
            reason: input.reason,
            transferLegalInfo: input.transferLegalInfo,
            updatedAt: new Date(),
          });
        }

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

        // 發送 WebSocket 事件通知所有客戶端
        const io = (ctx.req as any).app?.io;
        if (io) {
          io.emit("case:deleted", {
            caseId: input.caseId,
          });
        }

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
