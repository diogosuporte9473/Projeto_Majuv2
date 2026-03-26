// server/routers.ts
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

// ====================== AUDIT LOG ======================
async function createAuditLog({
  userId,
  action,
  entityType,
  entityId,
  entityName,
  details,
}: {
  userId: number;
  action: 'create' | 'update' | 'archive' | 'delete' | 'restore';
  entityType: 'board' | 'card' | 'user';
  entityId: number;
  entityName: string;
  details?: string;
}) {
  try {
    await supabase.from("audit_logs").insert({
      user_id: userId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      entity_name: entityName,
      details: details || "",
    });
  } catch (err) {
    console.error("[AuditLog] Failed to create log:", err);
  }
}

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "your-secret-key");

// ====================== AUXILIARY ROUTERS ======================
const auditRouter = router({
  list: protectedProcedure
    .input(z.object({
      userId: z.number().optional(),
      action: z.string().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      search: z.string().optional(),
      page: z.number().default(1),
      limit: z.number().default(20),
    }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Apenas administradores podem ver logs" });
      }

      let query = supabase.from("audit_logs").select("*, users(name, username)", { count: "exact" });

      if (input.userId) query = query.eq("user_id", input.userId);
      if (input.action) query = query.eq("action", input.action);
      if (input.startDate) query = query.gte("created_at", input.startDate);
      if (input.endDate) query = query.lte("created_at", input.endDate);
      if (input.search) query = query.ilike("entity_name", `%${input.search}%`);

      const from = (input.page - 1) * input.limit;
      const to = from + input.limit - 1;

      const { data, error, count } = await query
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });

      return {
        logs: data || [],
        total: count || 0,
        pages: Math.ceil((count || 0) / input.limit),
      };
    }),
});

const boardMirrorSettingsRouter = router({
  get: protectedProcedure
    .input(z.object({ boardId: z.number() }))
    .query(async ({ input }) => {
      const { data } = await supabase
        .from("board_mirror_settings")
        .select("*")
        .eq("board_id", input.boardId)
        .maybeSingle();
      return data;
    }),

  update: protectedProcedure
    .input(z.object({ boardId: z.number(), settings: z.any() }))
    .mutation(async ({ input }) => {
      const { error } = await supabase
        .from("board_mirror_settings")
        .upsert({ board_id: input.boardId, ...input.settings }, { onConflict: "board_id" });
      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      return { success: true };
    }),
});

// ====================== ROOT ROUTER ======================
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
        // Seu código completo de login aqui (Supabase + fallback)
        const email = input.username.includes('@') ? input.username : `${input.username}@projeto-maju.com`;
        
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email,
          password: input.password,
        });

        if (authError) {
          // fallback Drizzle
          const user = await getUserByUsername(input.username);
          if (!user) throw new TRPCError({ code: "UNAUTHORIZED", message: "User not found" });

          const valid = await bcrypt.compare(input.password, user.password);
          if (!valid) throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid password" });

          const token = await new SignJWT({})
            .setProtectedHeader({ alg: "HS256" })
            .setSubject(user.id.toString())
            .setIssuedAt()
            .setExpirationTime("30d")
            .sign(JWT_SECRET);

          const cookieOptions = getSessionCookieOptions(ctx.req);
          ctx.res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: 30 * 24 * 60 * 60 * 1000 });
          return user;
        }

        // Supabase login succeeded
        const user = await getUserByUsername(input.username);
        if (!user) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "User not in database" });

        const token = await new SignJWT({})
          .setProtectedHeader({ alg: "HS256" })
          .setSubject(user.id.toString())
          .setIssuedAt()
          .setExpirationTime("30d")
          .sign(JWT_SECRET);

        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: 30 * 24 * 60 * 60 * 1000 });
        return user;
      }),

    register: publicProcedure
      .input(z.object({ username: z.string(), password: z.string(), name: z.string().optional() }))
      .mutation(async ({ input, ctx }) => {
        // Seu código completo de register aqui
        // ... (mantenha o código que você já tinha)
      }),

    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true };
    }),
  }),

  admin: router({
    users: router({
      list: protectedProcedure.query(async ({ ctx }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        const { data, error } = await supabase.from("users").select("id, username, name, role, createdAt");
        if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
        return data || [];
      }),
      // create, update, delete... (adicione aqui se quiser)
    }),
    // boards: router({ ... }) se tiver sub-rotas de admin para boards
  }),

  boards: router({
    list: protectedProcedure.query(async ({ ctx }) => await getUserBoards(ctx.user.id)),
    get: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ ctx, input }) => {
      const board = await getBoardById(input.id, ctx.user.id);
      if (!board) throw new TRPCError({ code: "NOT_FOUND", message: "Board not found" });
      return board;
    }),
    // ... adicione os demais procedimentos de boards (create, update, delete, getMembers, etc.)
  }),

  lists: router({
    getByBoard: protectedProcedure.input(z.object({ boardId: z.number() })).query(async ({ ctx, input }) => {
      const board = await getBoardById(input.boardId, ctx.user.id);
      if (!board) throw new TRPCError({ code: "NOT_FOUND", message: "Board not found" });
      return await getBoardLists(input.boardId);
    }),
    // create, update, delete...
  }),

  cards: router({
    getByList: protectedProcedure.input(z.object({ listId: z.number() })).query(async ({ input }) => {
      return await getListCards(input.listId);
    }),
    // getArchivedByBoard, create, getDetails, update, delete, reorder...
  }),

  settings: router({
    getPreferences: protectedProcedure.query(async ({ ctx }) => {
      // seu código
    }),
    updatePreferences: protectedProcedure.input(/* ... */).mutation(async ({ ctx, input }) => {
      // seu código
    }),
    updateProfile: protectedProcedure.input(/* ... */).mutation(async ({ ctx, input }) => {
      // seu código
    }),
  }),

  cardDetails: router({
    // Todos os procedimentos relacionados a card (labels, checklists, comments, attachments, mirror, etc.)
    getDetails: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
      const card = await getCardById(input.id);
      if (!card) throw new TRPCError({ code: "NOT_FOUND", message: "Card not found" });
      // ... resto
    }),
    // addLabel, deleteLabel, getChecklists, addChecklistGroup, etc.
    createMirror: protectedProcedure.input(/* ... */).mutation(/* ... */),
    getMirroredCards: protectedProcedure.input(z.object({ boardId: z.number() })).query(async ({ input }) => {
      return await getMirroredCards(input.boardId);
    }),
  }),

  stats: router({
    getGeneral: protectedProcedure.query(async () => {
      // seu código de stats
    }),
  }),

  checklistTemplates: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      // seu código
    }),
    applyTemplate: protectedProcedure.input(/* ... */).mutation(/* ... */),
  }),

  ai: router({
    chat: protectedProcedure
      .input(z.object({
        messages: z.array(z.object({ role: z.enum(["user", "assistant", "system"]), content: z.string() })),
        useWebSearch: z.boolean().optional(),
        shortResponse: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        // seu código de IA
      }),
  }),
});

export type AppRouter = typeof rootRouter;
