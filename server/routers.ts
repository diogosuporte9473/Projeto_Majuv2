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

import {
  boards,
  users,
  userPreferences,
  notes,
} from "../drizzle/schema.js";

import { supabase } from "./_core/supabase.js";
import { systemRouter } from "./_core/systemRouter.js";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc.js";
import { getSessionCookieOptions } from "./_core/cookies.js";
import { invokeLLM, Message } from "./_core/llm.js";
import { ENV } from "./_core/env.js";

// ==================== AUDIT LOG ====================
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

// ==================== ROUTERS ====================

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

      let query = supabase
        .from("audit_logs")
        .select("*, users(name, username)", { count: "exact" });

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
        pages: Math.ceil((count || 0) / input.limit)
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
        .upsert({ board_id: input.boardId, ...input.settings }, { onConflict: 'board_id' });
      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      return { success: true };
    }),
});

// ==================== MAIN APP ROUTER ====================

export const appRouter = router({
  system: systemRouter,
  audit: auditRouter,
  boardMirrorSettings: boardMirrorSettingsRouter,

  auth: router({
    me: publicProcedure.query(async ({ ctx }) => {
      if (!ctx.user) return null;
      const { password, ...userWithoutPassword } = ctx.user;
      return userWithoutPassword;
    }),

    login: publicProcedure
      .input(z.object({ username: z.string(), password: z.string() }))
      .mutation(async ({ input, ctx }) => {
        // ... (seu código de login com Supabase + fallback permanece igual)
        // Copie aqui o bloco completo de login que você tinha
        const email = input.username.includes('@') ? input.username : `${input.username}@projeto-maju.com`;
        
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email,
          password: input.password,
        });

        if (authError) {
          // fallback para Drizzle (seu código antigo)
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

    // register, logout... (mantenha o resto igual)
    // ... cole aqui o register e logout que você tinha
  }),

  // ==================== ADMIN (APENAS UMA VEZ) ====================
  admin: router({
    users: router({
      list: protectedProcedure.query(async ({ ctx }) => {
        if (ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Apenas administradores podem listar usuários' });
        }
        const { data, error } = await supabase.from("users").select("id, username, name, role, createdAt");
        if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
        return data || [];
      }),

      create: protectedProcedure
        .input(z.object({
          username: z.string().min(3),
          password: z.string().min(6),
          name: z.string().optional(),
          role: z.enum(['user', 'admin']).default('user'),
        }))
        .mutation(async ({ ctx, input }) => {
          if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });

          const hashedPassword = await bcrypt.hash(input.password, 10);
          const email = input.username.includes('@') ? input.username : `${input.username}@projeto-maju.com`;

          const { data, error } = await supabase.from("users").insert({
            username: input.username,
            password: hashedPassword,
            name: input.name,
            role: input.role,
          }).select("id").single();

          if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
          return { id: data.id };
        }),

      // update e delete (mantenha se quiser)
    }),

    boards: router({
      addMember: protectedProcedure
        .input(z.object({ boardId: z.number(), userId: z.number(), role: z.enum(['viewer', 'editor', 'admin']).default('viewer') }))
        .mutation(async ({ ctx, input }) => {
          // ... seu código
        }),
      removeMember: protectedProcedure
        // ... seu código
    }),
  }),

  // ==================== BOARDS, LISTS, CARDS, etc. ====================
  boards: router({ /* todo o seu router de boards */ }),
  lists: router({ /* todo o seu router de lists */ }),
  cards: router({ /* todo o seu router de cards */ }),
  settings: router({ /* seu settings */ }),
  notes: router({ /* notes */ }),
  cardDetails: router({ /* cardDetails com labels, checklists, etc. */ }),
  stats: router({ /* stats */ }),
  checklistTemplates: router({ /* checklistTemplates */ }),
  ai: router({ /* ai chat */ }),

});

export type AppRouter = typeof appRouter;
