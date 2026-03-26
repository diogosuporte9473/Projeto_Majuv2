// ====================== IMPORTS ======================
import { COOKIE_NAME } from "../shared/const.js";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { SignJWT } from "jose";

import {
  getUserBoards,
  getBoardById,
  getBoardLists,
  getListCards,
  getCardById,
  getCardLabels,
  getCardChecklists,
  getCardCustomFields,
  getMirroredCards,
  getUserByUsername,
  getDb,
} from "./db.js";

import { supabase } from "./_core/supabase.js";
import { systemRouter } from "./_core/systemRouter.js";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc.js";
import { getSessionCookieOptions } from "./_core/cookies.js";
import { invokeLLM } from "./_core/llm.js";

// ====================== AUDIT + OUTROS ROUTERS ======================
// (mantenha todo o código de auditRouter, boardMirrorSettingsRouter, createAuditLog, etc.)

// ====================== ROOT ROUTER (IMPORTANTE: NÃO CHAME DE appRouter) ======================

export const rootRouter = router({
  system: systemRouter,
  audit: auditRouter,
  boardMirrorSettings: boardMirrorSettingsRouter,

  auth: router({
    me: publicProcedure.query(async ({ ctx }) => {
      if (!ctx.user) return null;
      const { password, ...rest } = ctx.user;
      return rest;
    }),

    login: publicProcedure
      .input(z.object({ username: z.string(), password: z.string() }))
      .mutation(async ({ input, ctx }) => {
        // seu código completo de login aqui
        // ... (mantenha o que você já tinha)
      }),

    register: publicProcedure
      .input(z.object({ username: z.string(), password: z.string(), name: z.string().optional() }))
      .mutation(async ({ input, ctx }) => {
        // seu código de register
      }),

    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true };
    }),
  }),

  admin: router({ /* todo seu admin router */ }),

  boards: router({ /* todo seu boards router */ }),

  lists: router({ /* lists */ }),

  cards: router({ /* cards */ }),

  settings: router({ /* settings */ }),

  cardDetails: router({ /* cardDetails com todos os sub-procedimentos */ }),

  stats: router({ /* stats */ }),

  checklistTemplates: router({ /* checklistTemplates */ }),

  ai: router({ /* ai */ }),
});

export type AppRouter = typeof rootRouter;   // ← mantenha o tipo como AppRouter
