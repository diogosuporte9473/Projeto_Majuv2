// ====================== IMPORTS (coloque no topo do arquivo) ======================
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

// ====================== SEUS ROUTERS AUXILIARES (mantenha como estavam) ======================
// auditRouter, boardMirrorSettingsRouter, createAuditLog, JWT_SECRET, etc.

// ====================== ROOT ROUTER (NOME ALTERADO PARA EVITAR CONFLITO) ======================

export const rootRouter = router({
  system: systemRouter,
  audit: auditRouter,
  boardMirrorSettings: boardMirrorSettingsRouter,

  auth: router({
    me: publicProcedure.query(async ({ ctx }) => {
      if (!ctx.user) return null;
      const { password, ...user } = ctx.user;
      return user;
    }),

    login: publicProcedure
      .input(z.object({ username: z.string(), password: z.string() }))
      .mutation(async ({ input, ctx }) => {
        // ← Cole aqui todo o seu código de login (Supabase + fallback)
      }),

    register: publicProcedure
      .input(z.object({ username: z.string(), password: z.string(), name: z.string().optional() }))
      .mutation(async ({ input, ctx }) => {
        // ← Cole aqui todo o seu código de register
      }),

    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true };
    }),
  }),

  admin: router({
    // ← Cole aqui todo o conteúdo do admin (users + boards)
  }),

  boards: router({
    // ← Cole aqui todo o conteúdo do boards
  }),

  lists: router({
    // ← lists
  }),

  cards: router({
    // ← cards
  }),

  settings: router({
    // ← settings (getPreferences, updatePreferences, updateProfile)
  }),

  cardDetails: router({
    // ← todo o cardDetails (getLabels, addLabel, checklists, comments, attachments, etc.)
  }),

  stats: router({
    // ← stats
  }),

  checklistTemplates: router({
    // ← checklistTemplates
  }),

  ai: router({
    // ← ai chat
  }),
});

// Tipo exportado (usado no frontend)
export type AppRouter = typeof rootRouter;
