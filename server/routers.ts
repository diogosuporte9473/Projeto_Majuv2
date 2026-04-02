import { COOKIE_NAME } from "../shared/const.js";
import { and } from "drizzle-orm";
import { getSessionCookieOptions } from "./_core/cookies.js";
import { systemRouter } from "./_core/systemRouter.js";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc.js";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { SignJWT } from "jose";
import {
  getUserBoards,
  getBoardById,
  getBoardMembers,
  getBoardLists,
  getListCards,
  getCardById,
  getCardLabels,
  getCardChecklists,
  getCardComments,
  getCardAttachments,
  getCardCustomFields,
  getMirroredCards,
  getUserByUsername,
  getDb,
} from "./db.js";
import {
  boards,
  boardMembers,
  lists,
  cards,
  mirroredCards,
  cardAttachments,
  notifications,
  userPreferences,
  users,
  cardLabels,
  cardChecklists,
  cardCustomFields,
  projectDates,
  notes,
  checklistTemplates,
} from "../drizzle/schema.js";
import { invokeLLM, Message } from "./_core/llm.js";
import { ENV } from "./_core/env.js";

import { supabase } from "./_core/supabase.js";

/**
 * Função utilitária para registrar logs de auditoria
 */
async function createAuditLog({
  userId,
  action,
  entityType,
  entityId,
  entityName,
  details
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
      details: details || ""
    });
  } catch (err) {
    console.error("[AuditLog] Failed to create log:", err);
  }
}

const rawJwtSecret = (ENV.cookieSecret || "").trim();
const JWT_SECRET = new TextEncoder().encode(rawJwtSecret || "temporary_development_secret_32_chars_long_minimum");

if (ENV.isProduction && rawJwtSecret.length < 32) {
  console.warn("⚠️ CRITICAL: JWT_SECRET environment variable is too short (min 32 chars). Manual signing of tokens may be insecure or fail. Please set a strong JWT_SECRET in your Vercel Project Settings.");
}

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
      // O modal de "Atividades do Quadro" aparece para usuários autenticados.
      // Não restringimos a admin aqui (filtro por board pode ser adicionado depois se desejar).

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
      const { data, error } = await supabase
        .from("board_mirror_settings")
        .select("*")
        .eq("board_id", input.boardId)
        .maybeSingle();
      return data;
    }),
  update: protectedProcedure
    .input(z.object({
      boardId: z.number(),
      settings: z.any()
    }))
    .mutation(async ({ input }) => {
      const { error } = await supabase
        .from("board_mirror_settings")
        .upsert({
          board_id: input.boardId,
          ...input.settings
        }, { onConflict: 'board_id' });
      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      return { success: true };
    }),
});

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  audit: auditRouter,
  boardMirrorSettings: boardMirrorSettingsRouter,
  auth: router({
    me: publicProcedure.query(async (opts) => {
      try {
        if (!opts.ctx.user) return null;
        const { password, ...userWithoutPassword } = opts.ctx.user;
        return userWithoutPassword;
      } catch (error) {
        console.error("[tRPC auth.me Error]", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erro ao buscar dados do usuário",
          cause: error,
        });
      }
    }),
    login: publicProcedure
      .input(z.object({ username: z.string(), password: z.string() }))
      .mutation(async ({ input, ctx }) => {
        // 1. Tentar login via Supabase Auth
        // Como o Supabase exige email, vamos transformar o username em email
        const email = input.username.includes('@') ? input.username : `${input.username}@projeto-maju.com`;
        
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email,
          password: input.password,
        });

        if (authError) {
          console.warn("[Auth] Supabase login failed, trying Drizzle fallback:", authError.message);
          
          // 2. Fallback para o banco Drizzle (usuários antigos)
          const user = await getUserByUsername(input.username);
          if (!user) {
            throw new TRPCError({ code: "UNAUTHORIZED", message: "User not found" });
          }

          const valid = await bcrypt.compare(input.password, user.password);
          if (!valid) {
            throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid password" });
          }

          // Gerar token manual (comportamento antigo)
          const token = await new SignJWT({})
            .setProtectedHeader({ alg: "HS256" })
            .setSubject(user.id.toString())
            .setIssuedAt()
            .setExpirationTime("30d")
            .sign(JWT_SECRET);

          const cookieOptions = getSessionCookieOptions(ctx.req);
          ctx.res.cookie(COOKIE_NAME, token, {
            ...cookieOptions,
            maxAge: 30 * 24 * 60 * 60 * 1000,
          });

          return user;
        }

        // 3. Se o login no Supabase funcionou, buscar o usuário no Drizzle
        // (Assume-se que o Supabase e o Drizzle estão em sincronia via Triggers ou manual)
        const user = await getUserByUsername(input.username);
        if (!user) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "User found in Auth but not in Database" });
        }

        // EM VEZ DE GERAR TOKEN MANUAL, USAR O TOKEN DO SUPABASE
        const sessionToken = authData.session?.access_token;
        if (!sessionToken) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "No access token returned from Supabase" });
        }

        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, {
          ...cookieOptions,
          maxAge: (authData.session?.expires_in || 3600) * 1000,
        });

        return user;
      }),
    register: publicProcedure
      .input(z.object({ 
        username: z.string(), 
        password: z.string(), 
        name: z.string().optional()
      }))
      .mutation(async ({ input, ctx }) => {
        const email = input.username.includes('@') ? input.username : `${input.username}@projeto-maju.com`;

        // 1. Criar no Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email,
          password: input.password,
          options: {
            data: {
              name: input.name || input.username,
              username: input.username
            }
          }
        });

        if (authError) {
          throw new TRPCError({ 
            code: "BAD_REQUEST", 
            message: `Erro no Supabase Auth: ${authError.message}` 
          });
        }

        // 2. Criar no banco Drizzle
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        const hashedPassword = await bcrypt.hash(input.password, 10);
        const [user] = await db.insert(users).values({
          username: input.username,
          password: hashedPassword,
          name: input.name || input.username.split('@')[0],
          role: "user",
        }).returning();

        const sessionToken = authData.session?.access_token;
        if (!sessionToken) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Registration successful but no token returned" });
        }

        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, {
          ...cookieOptions,
          maxAge: (authData.session?.expires_in || 3600) * 1000,
        });

        return user;
      }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // Board routers
  boards: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return await getUserBoards(ctx.user.id);
    }),
    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const board = await getBoardById(input.id, ctx.user.id);
        if (!board) throw new TRPCError({ code: "NOT_FOUND", message: "Board not found or access denied" });
        return board;
      }),
    getMembers: protectedProcedure
      .input(z.object({ boardId: z.number() }))
      .query(async ({ ctx, input }) => {
        const board = await getBoardById(input.boardId, ctx.user.id);
        if (!board) throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });

        const { data, error } = await supabase
          .from("board_members")
          .select("user_id, role, users(name, username)")
          .eq("board_id", input.boardId);

        if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
        
        return data.map((m: any) => ({
          userId: m.user_id,
          role: m.role,
          userName: m.users?.name || m.users?.username || `User ${m.user_id}`
        }));
      }),
    create: protectedProcedure
      .input(
        z.object({
          name: z.string().min(1).max(255),
          description: z.string().optional(),
          color: z.string().default("#4b4897"),
        })
      )
      .mutation(async ({ ctx, input }) => {
        // MÉTODO DIRETO REST: Evita o erro de conexão do Drizzle/Postgres
        const { data: board, error: boardError } = await supabase
          .from("boards")
          .insert({
            name: input.name,
            description: input.description || "",
            color: input.color,
            owner_id: ctx.user.id,
          })
          .select("id")
          .single();

        if (boardError) {
          console.error("[Database] Board creation failed via REST:", boardError);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Erro ao criar quadro: ${boardError.message}`,
          });
        }

        // Registrar log
        await createAuditLog({
          userId: ctx.user.id,
          action: 'create',
          entityType: 'board',
          entityId: board.id,
          entityName: input.name,
          details: `Quadro criado: ${input.name}`
        });

        // Criar lista "Caixa de Entrada" automaticamente
        const { error: listError } = await supabase
          .from("lists")
          .insert({
            board_id: board.id,
            name: "Caixa de Entrada",
            position: 0,
          });

        if (listError) {
          console.error("[Database] Inbox list creation failed:", listError);
          // Não lançamos erro aqui para não invalidar a criação do board, 
          // mas logamos para depuração.
        }

        return { id: board.id };
      }),
    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().min(1).max(255).optional(),
          description: z.string().optional(),
          color: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const board = await getBoardById(input.id, ctx.user.id);
        if (!board) throw new TRPCError({ code: "NOT_FOUND", message: "Board not found" });

        // Permitir que qualquer usuário altere o nome (removido check de owner)
        // No entanto, ainda verificamos se o usuário tem acesso ao board através do getBoardById

        const updateData: any = {};
        if (input.name) updateData.name = input.name;
        if (input.description !== undefined) updateData.description = input.description;
        if (input.color) updateData.color = input.color;

        const { error } = await supabase.from("boards").update(updateData).eq("id", input.id);
        if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });

        // Registrar log de atualização
        await createAuditLog({
          userId: ctx.user.id,
          action: 'update',
          entityType: 'board',
          entityId: input.id,
          entityName: board.name,
          details: `Quadro atualizado: ${Object.keys(updateData).join(", ")}`
        });

        return { success: true };
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const board = await getBoardById(input.id, ctx.user.id);
        if (!board) throw new TRPCError({ code: "NOT_FOUND", message: "Board not found" });

        // Apenas ADM pode excluir boards
        if (ctx.user.role !== 'admin') {
          throw new TRPCError({ code: "FORBIDDEN", message: "Apenas administradores podem excluir quadros" });
        }

        const { error } = await supabase.from("boards").delete().eq("id", input.id);
        if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });

        // Registrar log de exclusão
        await createAuditLog({
          userId: ctx.user.id,
          action: 'delete',
          entityType: 'board',
          entityId: input.id,
          entityName: board.name,
          details: `Quadro excluído permanentemente: ${board.name}`
        });

        return { success: true };
      }),

    addMember: protectedProcedure
      .input(
        z.object({
          boardId: z.number(),
          userId: z.number(),
          role: z.enum(["viewer", "editor", "admin"]).default("viewer"),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const board = await getBoardById(input.boardId, ctx.user.id);
        if (!board) throw new TRPCError({ code: "NOT_FOUND", message: "Board not found" });

        if (board.owner_id !== ctx.user.id && ctx.user.role !== 'admin') {
          throw new TRPCError({ code: "FORBIDDEN", message: "Only board owner or admin can add members" });
        }

        const { error } = await supabase.from("board_members").upsert({
          board_id: input.boardId,
          user_id: input.userId,
          role: input.role,
        }, { onConflict: 'board_id,user_id' });

        if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });

        return { success: true };
      }),

    getMirrorSettings: protectedProcedure
      .input(z.object({ boardId: z.number() }))
      .query(async ({ input }) => {
        const { data, error } = await supabase
          .from("board_mirror_settings")
          .select("*")
          .eq("board_id", input.boardId)
          .maybeSingle();

        if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
        
        if (!data) {
          return {
            mirror_labels: true,
            mirror_checklists: true,
            mirror_comments: false,
            mirror_attachments: false,
            mirror_custom_fields: true,
            mirror_dates: true,
            mirror_description: true,
          };
        }
        return data;
      }),

    updateMirrorSettings: protectedProcedure
      .input(z.object({
        boardId: z.number(),
        settings: z.object({
          mirror_labels: z.boolean(),
          mirror_checklists: z.boolean(),
          mirror_comments: z.boolean(),
          mirror_attachments: z.boolean(),
          mirror_custom_fields: z.boolean(),
          mirror_dates: z.boolean(),
          mirror_description: z.boolean(),
        })
      }))
      .mutation(async ({ ctx, input }) => {
        const board = await getBoardById(input.boardId, ctx.user.id);
        if (!board || ctx.user.role !== 'admin') {
          throw new TRPCError({ code: "FORBIDDEN", message: "Apenas administradores podem configurar espelhamento" });
        }

        const { error } = await supabase
          .from("board_mirror_settings")
          .upsert({
            board_id: input.boardId,
            ...input.settings,
            updated_at: new Date().toISOString()
          }, { onConflict: 'board_id' });

        if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
        return { success: true };
      }),
  }),

  branding: router({
    get: publicProcedure.query(async ({ ctx }) => {
      // Busca as configurações baseadas no domínio atual (ctx.domain)
      const { data, error } = await supabase
        .from("app_settings")
        .select("*")
        .eq("domain", ctx.domain)
        .maybeSingle();
      
      if (error) {
        console.error("[Branding] Error fetching settings:", error);
        return { appName: "Maju Tasks", appLogoUrl: null, primaryColor: "#4b4897" };
      }
      
      // Se não houver configurações para este domínio, retorna um padrão
      if (!data) {
        return { 
          appName: "Maju Tasks", 
          appLogoUrl: null, 
          primaryColor: "#4b4897",
          isNewTenant: true 
        };
      }
      
      return {
        appName: data.app_name || "Maju Tasks",
        appLogoUrl: data.app_logo_url || null,
        primaryColor: data.primary_color || "#4b4897"
      };
    }),
    
    update: protectedProcedure
      .input(z.object({
        appName: z.string().optional(),
        appLogoUrl: z.string().nullable().optional(),
        primaryColor: z.string().optional()
      }))
      .mutation(async ({ ctx, input }) => {
        // Apenas ADMIN do domínio ou MASTER_ADMIN podem alterar
        if (ctx.user.role !== 'admin' && ctx.user.role !== 'master_admin') {
          throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
        }

        const updateData: any = { domain: ctx.domain };
        if (input.appName !== undefined) updateData.app_name = input.appName;
        if (input.appLogoUrl !== undefined) updateData.app_logo_url = input.appLogoUrl;
        if (input.primaryColor !== undefined) updateData.primary_color = input.primaryColor;
        updateData.updated_at = new Date().toISOString();

        const { error } = await supabase
          .from("app_settings")
          .upsert(updateData, { onConflict: 'domain' });

        if (error) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
        }

        return { success: true };
      }),

    // Rota exclusiva para Master Admin gerenciar todos os domínios
    listAllTenants: protectedProcedure
      .query(async ({ ctx }) => {
        if (ctx.user.role !== 'master_admin') {
          throw new TRPCError({ code: "FORBIDDEN", message: "Apenas Master Admin" });
        }
        const { data } = await supabase.from("app_settings").select("*").order("domain");
        return data || [];
      }),
  }),

  // Lists routers
  lists: router({
    getByBoard: protectedProcedure
      .input(z.object({ boardId: z.number() }))
      .query(async ({ ctx, input }) => {
        const board = await getBoardById(input.boardId, ctx.user.id);
        if (!board) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Board not found",
          });
        }
        return await getBoardLists(input.boardId);
      }),
    create: protectedProcedure
      .input(
        z.object({
          boardId: z.number(),
          name: z.string().min(1).max(255),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const board = await getBoardById(input.boardId, ctx.user.id);
        if (!board) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Board not found",
          });
        }

        const boardLists = await getBoardLists(input.boardId);
        const position = boardLists.length;

        // MÉTODO SIMPLES: Usar API REST para evitar erro de conexão TCP
        const { data, error } = await supabase
          .from("lists")
          .insert({
            board_id: input.boardId,
            name: input.name,
            position,
          })
          .select("id")
          .single();

        if (error) {
          console.error("[Database] Error creating list via REST:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Erro ao criar lista no banco de dados",
            cause: error,
          });
        }

        return { id: data.id };
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const { error } = await supabase.from("lists").delete().eq("id", input.id);
        if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
        return { success: true };
      }),
    update: protectedProcedure
      .input(z.object({ id: z.number(), name: z.string().min(1).max(255) }))
      .mutation(async ({ input }) => {
        const { error } = await supabase
          .from("lists")
          .update({ name: input.name })
          .eq("id", input.id);
        if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
        return { success: true };
      }),
  }),

  // Cards routers
  cards: router({
    getByList: protectedProcedure
      .input(z.object({ listId: z.number() }))
      .query(async ({ ctx, input }) => {
        return await getListCards(input.listId);
      }),
    getArchivedByBoard: protectedProcedure
      .input(z.object({ boardId: z.number() }))
      .query(async ({ ctx, input }) => {
        const { data, error } = await supabase
          .from("cards")
          .select("*, lists!inner(board_id)")
          .eq("lists.board_id", input.boardId)
          .eq("archived", true);

        if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
        return data;
      }),
    create: protectedProcedure
      .input(
        z.object({
          listId: z.number(),
          title: z.string().min(1).max(255),
          description: z.string().optional(),
          dueDate: z.date().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        try {
          const listCards = await getListCards(input.listId);
          const position = listCards.length;

          // MÉTODO DIRETO REST: Garante criação mesmo com instabilidade no pooler
          const { data, error } = await supabase
            .from("cards")
            .insert({
              list_id: input.listId,
              title: input.title,
              description: input.description || "",
              position,
              due_date: input.dueDate ? input.dueDate.toISOString() : null,
              created_by: ctx.user?.id || null,
            })
            .select("id")
            .single();

          if (error) {
            console.error("[Database] Card creation failed via REST:", error);
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: `Erro ao criar cartão: ${error.message}`,
            });
          }

          // Registrar log
          await createAuditLog({
            userId: ctx.user.id,
            action: 'create',
            entityType: 'card',
            entityId: data.id,
            entityName: input.title,
            details: `Cartão criado: ${input.title}`
          });

          return { id: data.id };
        } catch (err: any) {
          console.error("[Database] Unexpected error during card creation:", err);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: err.message || "Erro inesperado ao criar cartão",
          });
        }
      }),
    getDetails: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const card = await getCardById(input.id);
        if (!card) throw new TRPCError({ code: "NOT_FOUND", message: "Card not found" });

        const [labels, checklists, customFields] = await Promise.all([
          getCardLabels(input.id),
          getCardChecklists(input.id),
          getCardCustomFields(input.id),
        ]);

        return {
          ...card,
          labels,
          checklists,
          customFields,
        };
      }),
    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          title: z.string().min(1).max(255).optional(),
          description: z.string().optional(),
          dueDate: z.date().optional(),
          assignedTo: z.number().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const updateData: any = {};
        if (input.title) updateData.title = input.title;
        if (input.description !== undefined) updateData.description = input.description;
        if (input.dueDate) updateData.due_date = input.dueDate.toISOString();
        if (input.assignedTo !== undefined) updateData.assigned_to = input.assignedTo;

        const { error } = await supabase
          .from("cards")
          .update(updateData)
          .eq("id", input.id);

        if (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Erro ao atualizar cartão: ${error.message}`,
          });
        }

        // Registrar log de atualização
        const { data: card } = await supabase.from("cards").select("title").eq("id", input.id).single();
        if (card) {
          await createAuditLog({
            userId: ctx.user.id,
            action: 'update',
            entityType: 'card',
            entityId: input.id,
            entityName: card.title,
            details: `Cartão atualizado: ${Object.keys(updateData).join(", ")}`
          });
        }

        return { success: true };
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        // Restrição: Apenas administradores podem excluir cartões permanentemente
        if (ctx.user.role !== 'admin') {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Apenas administradores podem excluir cartões. Usuários comuns devem arquivar.",
          });
        }

        const { error } = await supabase
          .from("cards")
          .delete()
          .eq("id", input.id);

        if (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Erro ao excluir cartão: ${error.message}`,
          });
        }

        return { success: true };
      }),
    reorder: protectedProcedure
      .input(
        z.object({
          cardId: z.number(),
          newListId: z.number(),
          newPosition: z.number(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { error } = await supabase
          .from("cards")
          .update({
            list_id: input.newListId,
            position: input.newPosition,
          })
          .eq("id", input.cardId);

        if (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Erro ao reordenar cartão: ${error.message}`,
          });
        }

        return { success: true };
      }),
  }),

  // Settings routers
  settings: router({
    getPreferences: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) {
        return {
          emailOnCardAssigned: true,
          emailOnCardUpdated: true,
          emailOnMirroredCard: true,
          emailOnDueDate: true,
        };
      }

      let prefs: Array<(typeof userPreferences.$inferSelect)> = [];
      try {
        prefs = await db
          .select()
          .from(userPreferences)
          .where(eq(userPreferences.userId, ctx.user.id))
          .limit(1);
      } catch (err) {
        // Em alguns ambientes (ex: pooler/tenant), o Postgres pode falhar.
        // Preferimos fallback para não quebrar o app inteiro.
        console.error("[Settings] getPreferences failed, using defaults:", err);
        return {
          emailOnCardAssigned: true,
          emailOnCardUpdated: true,
          emailOnMirroredCard: true,
          emailOnDueDate: true,
        };
      }

      if (prefs.length === 0) {
        return {
          emailOnCardAssigned: true,
          emailOnCardUpdated: true,
          emailOnMirroredCard: true,
          emailOnDueDate: true,
        };
      }

      return {
        emailOnCardAssigned: prefs[0].emailOnCardAssigned,
        emailOnCardUpdated: prefs[0].emailOnCardUpdated,
        emailOnMirroredCard: prefs[0].emailOnMirroredCard,
        emailOnDueDate: prefs[0].emailOnDueDate,
      };
    }),
    updatePreferences: protectedProcedure
      .input(
        z.object({
          emailOnCardAssigned: z.boolean().optional(),
          emailOnCardUpdated: z.boolean().optional(),
          emailOnMirroredCard: z.boolean().optional(),
          emailOnDueDate: z.boolean().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const updateData: any = {};
        if (input.emailOnCardAssigned !== undefined)
          updateData.email_on_card_assigned = input.emailOnCardAssigned;
        if (input.emailOnCardUpdated !== undefined)
          updateData.email_on_card_updated = input.emailOnCardUpdated;
        if (input.emailOnMirroredCard !== undefined)
          updateData.email_on_mirrored_card = input.emailOnMirroredCard;
        if (input.emailOnDueDate !== undefined)
          updateData.email_on_due_date = input.emailOnDueDate;

        const { error } = await supabase
          .from("user_preferences")
          .upsert({
            user_id: ctx.user.id,
            ...updateData
          }, { onConflict: 'user_id' });

        if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });

        return { success: true };
      }),
    updateProfile: protectedProcedure
      .input(
        z.object({
          name: z.string().min(1).max(255).optional(),
          username: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const updateData: Record<string, string> = {};
        if (input.name !== undefined) updateData.name = input.name;
        if (input.username !== undefined) updateData.username = input.username;

        if (Object.keys(updateData).length === 0) {
          return { success: true };
        }

        const { error } = await supabase
          .from("users")
          .update(updateData)
          .eq("id", ctx.user.id);

        if (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: error.message,
          });
        }

        return { success: true };
      }),
  }),

  // Notes routers (conforme SQL)
  notes: router({
    list: protectedProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return await db.select().from(notes);
    }),
    create: protectedProcedure
      .input(z.object({ title: z.string() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        return await db.insert(notes).values({ title: input.title });
      }),
  }),

  // Labels, Checklists, Custom Fields and Project Dates
  cardDetails: router({
    getDetails: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const { data: card, error } = await supabase
          .from("cards")
          .select(`
            *,
            list:list_id(
              id, 
              name, 
              board:board_id(
                id, 
                name,
                owner:owner_id(id, name)
              )
            )
          `)
          .eq("id", input.id)
          .single();

        if (error) throw new TRPCError({ code: "NOT_FOUND", message: "Card not found" });

        const { data: mirrors } = await supabase
          .from("mirrored_cards")
          .select(`
            original_card_id,
            mirror_card_id,
            original_board:original_board_id(id, name),
            mirror_board:mirror_board_id(id, name)
          `)
          .or(`original_card_id.eq.${input.id},mirror_card_id.eq.${input.id}`);

        const linkedBoards = mirrors?.map((m: any) => {
          const isOriginal = m.original_card_id === input.id;
          const board = isOriginal ? m.mirror_board : m.original_board;
          return {
            id: board.id,
            name: board.name,
            type: isOriginal ? "Filial" : "Matriz"
          };
        }) || [];

        const boardOwnerName = (card as any).list?.board?.owner?.name || "Desconhecido";

        return {
          ...card,
          startDate: card.start_date,
          dueDate: card.due_date,
          assignedTo: card.assigned_to,
          linkedBoards,
          boardOwnerName
        };
      }),

    getLabels: protectedProcedure
      .input(z.object({ cardId: z.number() }))
      .query(async ({ input }) => {
        return await getCardLabels(input.cardId);
      }),
    addLabel: protectedProcedure
      .input(z.object({ cardId: z.number(), label: z.string(), color: z.string().optional() }))
      .mutation(async ({ input }) => {
        const { data, error } = await supabase
          .from("card_labels")
          .insert({
            card_id: input.cardId,
            label: input.label,
            color: input.color || "#4b4897",
          })
          .select("id")
          .single();

        if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });

        // Sincronizar com espelhos e Trigger Realtime
        try {
          const { data: mirrors } = await supabase
            .from("mirrored_cards")
            .select("*")
            .or(`original_card_id.eq.${input.cardId},mirror_card_id.eq.${input.cardId}`);

          if (mirrors && mirrors.length > 0) {
            const relatedCardIds = mirrors.flatMap(m => [m.original_card_id, m.mirror_card_id])
              .filter(id => id !== input.cardId);

            for (const cardId of relatedCardIds) {
              await supabase.from("card_labels").insert({
                card_id: cardId,
                label: input.label,
                color: input.color || "#4b4897",
              });
              // Trigger realtime update no card espelhado
              await supabase.from("cards").update({ updated_at: new Date().toISOString() }).eq("id", cardId);
            }
          }
          // Trigger realtime update no card original
          await supabase.from("cards").update({ updated_at: new Date().toISOString() }).eq("id", input.cardId);
        } catch (e) {
          console.error("[Mirror Sync] Label add sync failed:", e);
        }

        return { id: data.id };
      }),
    deleteLabel: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        // Buscar info da etiqueta antes de deletar para sincronizar
        const { data: labelToDelete } = await supabase.from("card_labels").select("*").eq("id", input.id).single();

        const { error } = await supabase.from("card_labels").delete().eq("id", input.id);
        if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });

        // Sincronizar com espelhos e Trigger Realtime
        if (labelToDelete) {
          try {
            const { data: mirrors } = await supabase
              .from("mirrored_cards")
              .select("*")
              .or(`original_card_id.eq.${labelToDelete.card_id},mirror_card_id.eq.${labelToDelete.card_id}`);

            if (mirrors && mirrors.length > 0) {
              const relatedCardIds = mirrors.flatMap(m => [m.original_card_id, m.mirror_card_id])
                .filter(id => id !== labelToDelete.card_id);

              await supabase
                .from("card_labels")
                .delete()
                .in("card_id", relatedCardIds)
                .eq("label", labelToDelete.label);

              for (const targetId of relatedCardIds) {
                // Trigger realtime update no card espelhado
                await supabase.from("cards").update({ updated_at: new Date().toISOString() }).eq("id", targetId);
              }
            }
            // Trigger realtime update no card original
            await supabase.from("cards").update({ updated_at: new Date().toISOString() }).eq("id", labelToDelete.card_id);
          } catch (e) {
            console.error("[Mirror Sync] Label delete sync failed:", e);
          }
        }

        return { success: true };
      }),
    updateDescription: protectedProcedure
      .input(z.object({ cardId: z.number(), description: z.string() }))
      .mutation(async ({ input }) => {
        try {
          const { error } = await supabase
            .from("cards")
            .update({ description: input.description, updated_at: new Date().toISOString() })
            .eq("id", input.cardId);

          if (error) {
            console.error("[Database] Description update failed via Supabase:", error);
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: `Erro ao atualizar descrição: ${error.message}`,
            });
          }

          // Sincronizar com espelhos
          try {
            const { data: mirrors } = await supabase
              .from("mirrored_cards")
              .select("*")
              .or(`original_card_id.eq.${input.cardId},mirror_card_id.eq.${input.cardId}`);

            if (mirrors && mirrors.length > 0) {
              const relatedCardIds = mirrors.flatMap(m => [m.original_card_id, m.mirror_card_id])
                .filter(id => id !== input.cardId);

              await supabase
                .from("cards")
                .update({ description: input.description, updated_at: new Date().toISOString() })
                .in("id", relatedCardIds);
            }
          } catch (e) {
            console.error("[Mirror Sync] Description sync failed:", e);
          }

          return { success: true };
        } catch (err: any) {
          console.error("[Database] Unexpected error during description update:", err);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: err.message || "Erro inesperado ao atualizar descrição",
          });
        }
      }),

    updateDueDate: protectedProcedure
      .input(z.object({ cardId: z.number(), dueDate: z.date().nullish() }))
      .mutation(async ({ input }) => {
        const { error } = await supabase
          .from("cards")
          .update({ due_date: input.dueDate ? input.dueDate.toISOString() : null, updated_at: new Date().toISOString() })
          .eq("id", input.cardId);

        if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });

        // Sincronizar com espelhos
        try {
          const { data: mirrors } = await supabase
            .from("mirrored_cards")
            .select("*")
            .or(`original_card_id.eq.${input.cardId},mirror_card_id.eq.${input.cardId}`);

          if (mirrors && mirrors.length > 0) {
            const relatedCardIds = mirrors.flatMap(m => [m.original_card_id, m.mirror_card_id])
              .filter(id => id !== input.cardId);

            await supabase
              .from("cards")
              .update({ due_date: input.dueDate ? input.dueDate.toISOString() : null, updated_at: new Date().toISOString() })
              .in("id", relatedCardIds);
          }
        } catch (e) {
          console.error("[Mirror Sync] Due date sync failed:", e);
        }

        return { success: true };
      }),

    updateStartDate: protectedProcedure
      .input(z.object({ cardId: z.number(), startDate: z.date().nullish() }))
      .mutation(async ({ input }) => {
        const { error } = await supabase
          .from("cards")
          .update({ start_date: input.startDate ? input.startDate.toISOString() : null, updated_at: new Date().toISOString() })
          .eq("id", input.cardId);

        if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });

        // Sincronizar com espelhos
        try {
          const { data: mirrors } = await supabase
            .from("mirrored_cards")
            .select("*")
            .or(`original_card_id.eq.${input.cardId},mirror_card_id.eq.${input.cardId}`);

          if (mirrors && mirrors.length > 0) {
            const relatedCardIds = mirrors.flatMap(m => [m.original_card_id, m.mirror_card_id])
              .filter(id => id !== input.cardId);

            await supabase
              .from("cards")
              .update({ start_date: input.startDate ? input.startDate.toISOString() : null, updated_at: new Date().toISOString() })
              .in("id", relatedCardIds);
          }
        } catch (e) {
          console.error("[Mirror Sync] Start date sync failed:", e);
        }

        return { success: true };
      }),

    updateAssignedTo: protectedProcedure
      .input(z.object({ cardId: z.number(), userId: z.number().nullish() }))
      .mutation(async ({ input }) => {
        const { error } = await supabase
          .from("cards")
          .update({ assigned_to: input.userId, updated_at: new Date().toISOString() })
          .eq("id", input.cardId);

        if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });

        // Sincronizar com espelhos
        try {
          const { data: mirrors } = await supabase
            .from("mirrored_cards")
            .select("*")
            .or(`original_card_id.eq.${input.cardId},mirror_card_id.eq.${input.cardId}`);

          if (mirrors && mirrors.length > 0) {
            const relatedCardIds = mirrors.flatMap(m => [m.original_card_id, m.mirror_card_id])
              .filter(id => id !== input.cardId);

            await supabase
              .from("cards")
              .update({ assigned_to: input.userId, updated_at: new Date().toISOString() })
              .in("id", relatedCardIds);
          }
        } catch (e) {
          console.error("[Mirror Sync] AssignedTo sync failed:", e);
        }

        return { success: true };
      }),

    updateStatus: protectedProcedure
      .input(z.object({ cardId: z.number(), status: z.enum(["open", "completed"]) }))
      .mutation(async ({ input }) => {
        // Atualiza apenas o cartão específico solicitado
        const { error } = await supabase
          .from("cards")
          .update({ status: input.status, updated_at: new Date().toISOString() })
          .eq("id", input.cardId);

        if (error) {
          console.error("[Database] Status update failed:", error);
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
        }

        return { success: true };
      }),

    cloneCard: protectedProcedure
      .input(z.object({ cardId: z.number(), listId: z.number().optional() }))
      .mutation(async ({ ctx, input }) => {
        // 1. Buscar dados do cartão original
        const { data: original, error: fetchError } = await supabase
          .from("cards")
          .select("*")
          .eq("id", input.cardId)
          .single();

        if (fetchError || !original) throw new TRPCError({ code: "NOT_FOUND", message: "Cartão original não encontrado" });

        // 2. Criar novo cartão (clone)
        const { data: clone, error: cloneError } = await supabase
          .from("cards")
          .insert({
            title: `${original.title} (Cópia)`,
            description: original.description,
            list_id: input.listId || original.list_id,
            position: original.position + 1,
            start_date: original.start_date,
            due_date: original.due_date,
            assigned_to: original.assigned_to,
            created_by: ctx.user.id,
            status: original.status,
          })
          .select("id")
          .single();

        if (cloneError) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Falha ao clonar cartão" });

        // 3. Clonar Etiquetas
        const { data: labels } = await supabase.from("card_labels").select("label, color").eq("card_id", input.cardId);
        if (labels && labels.length > 0) {
          await supabase.from("card_labels").insert(labels.map(l => ({ ...l, card_id: clone.id })));
        }

        // 4. Clonar Checklists
        const { data: groups } = await supabase.from("card_checklist_groups").select("*").eq("card_id", input.cardId);
        if (groups) {
          for (const group of groups) {
            const { data: newGroup } = await supabase.from("card_checklist_groups")
              .insert({ card_id: clone.id, title: group.title, position: group.position })
              .select("id").single();
            
            if (newGroup) {
              const { data: items } = await supabase.from("card_checklists").select("*").eq("group_id", group.id);
              if (items) {
                await supabase.from("card_checklists").insert(items.map(i => ({
                  card_id: clone.id,
                  group_id: newGroup.id,
                  title: i.title,
                  completed: i.completed,
                  position: i.position,
                  assigned_user_id: i.assigned_user_id
                })));
              }
            }
          }
        }

        return { id: clone.id };
      }),

    moveCard: protectedProcedure
      .input(z.object({ cardId: z.number(), targetListId: z.number() }))
      .mutation(async ({ input }) => {
        const { error } = await supabase
          .from("cards")
          .update({ list_id: input.targetListId, updated_at: new Date().toISOString() })
          .eq("id", input.cardId);

        if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Falha ao mover cartão" });
        return { success: true };
      }),

    getCardUsers: protectedProcedure
      .input(z.object({ cardId: z.number() }))
      .query(async () => {
        // Retorna todos os usuários para permitir atribuição no checklist sem restrição de board
        const { data, error } = await supabase.from("users").select("id, name, username");
        if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
        return data;
      }),

    getMirroredInfo: protectedProcedure
      .input(z.object({ cardId: z.number() }))
      .query(async ({ input }) => {
        const { data: mirrors, error } = await supabase
          .from("mirrored_cards")
          .select(`
            original_card_id,
            mirror_card_id,
            original_board_id,
            mirror_board_id,
            original_board:original_board_id(id, name),
            mirror_board:mirror_board_id(id, name)
          `)
          .or(`original_card_id.eq.${input.cardId},mirror_card_id.eq.${input.cardId}`);

        if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });

        const linkedBoards = mirrors.map((m: any) => {
          const isOriginal = m.original_card_id === input.cardId;
          const board = isOriginal ? m.mirror_board : m.original_board;
          return {
            id: board.id,
            name: board.name,
            type: isOriginal ? "Filial" : "Matriz"
          };
        });

        const { data: card } = await supabase
          .from("cards")
          .select("status")
          .eq("id", input.cardId)
          .single();

        return {
          status: card?.status || "open",
          linkedBoards
        };
      }),

    archiveCard: protectedProcedure
      .input(z.object({ id: z.number(), archived: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        const { error } = await supabase
          .from("cards")
          // Alguns bancos não têm `updated_at` (schema cache do PostgREST).
          // Atualizamos somente o campo necessário para evitar erro 42703/PGRST.
          .update({ archived: input.archived })
          .eq("id", input.id);

        if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });

        // Registrar log de arquivamento/restauração
        const { data: card } = await supabase.from("cards").select("title").eq("id", input.id).single();
        if (card) {
          await createAuditLog({
            userId: ctx.user.id,
            action: input.archived ? 'archive' : 'restore',
            entityType: 'card',
            entityId: input.id,
            entityName: card.title,
            details: input.archived ? `Cartão arquivado: ${card.title}` : `Cartão restaurado: ${card.title}`
          });
        }

        return { success: true };
      }),

    getAttachments: protectedProcedure
      .input(z.object({ cardId: z.number() }))
      .query(async ({ input }) => {
        try {
          return await getCardAttachments(input.cardId);
        } catch (error: any) {
          if (error.code === 'PGRST204' || error.code === '42P01') {
            console.warn("[tRPC] Table card_attachments not found, returning empty array");
            return [];
          }
          throw error;
        }
      }),
    addAttachment: protectedProcedure
      .input(z.object({ 
        cardId: z.number(), 
        filename: z.string(), 
        fileUrl: z.string(), 
        fileKey: z.string(),
        mimeType: z.string(),
        fileSize: z.number()
      }))
      .mutation(async ({ ctx, input }) => {
        const insertData: any = {
          card_id: input.cardId,
          filename: input.filename,
          file_url: input.fileUrl,
          mime_type: input.mimeType,
          file_size: input.fileSize,
          uploaded_by: ctx.user.id,
        };

        // Adiciona file_key (requer que você execute o SQL no Supabase conforme discutido)
        insertData.file_key = input.fileKey;

        const { data, error } = await supabase
          .from("card_attachments")
          .insert(insertData)
          .select("id")
          .single();

        if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });

        // Sincronizar com espelhos
        try {
          const { data: mirrors } = await supabase
            .from("mirrored_cards")
            .select("*")
            .or(`original_card_id.eq.${input.cardId},mirror_card_id.eq.${input.cardId}`);

          if (mirrors && mirrors.length > 0) {
            const relatedCardIds = mirrors.flatMap(m => [m.original_card_id, m.mirror_card_id])
              .filter(id => id !== input.cardId);

            for (const cardId of relatedCardIds) {
              await supabase.from("card_attachments").insert({
                card_id: cardId,
                filename: input.filename,
                file_url: input.fileUrl,
                file_key: input.fileKey,
                mime_type: input.mimeType,
                file_size: input.fileSize,
                uploaded_by: ctx.user.id,
              });
            }
          }
        } catch (e) {
          console.error("[Mirror Sync] Attachment sync failed:", e);
        }

        return { id: data.id };
      }),
    deleteAttachment: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const { error } = await supabase.from("card_attachments").delete().eq("id", input.id);
        if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
        return { success: true };
      }),

    getChecklists: protectedProcedure
      .input(z.object({ cardId: z.number() }))
      .query(async ({ input }) => {
        const [groups, items] = await Promise.all([
          supabase.from("card_checklist_groups").select("*").eq("card_id", input.cardId).order("position", { ascending: true }),
          supabase.from("card_checklists").select("*").eq("card_id", input.cardId).order("position", { ascending: true })
        ]);

        const checklistGroups = groups.data || [];
        const checklistItems = items.data || [];

        return checklistGroups.map((g: any) => ({
          ...g,
          items: checklistItems.filter((i: any) => i.group_id === g.id)
        }));
      }),
    addChecklistGroup: protectedProcedure
      .input(z.object({ cardId: z.number(), title: z.string() }))
      .mutation(async ({ input }) => {
        const { data: currentGroups } = await supabase
          .from("card_checklist_groups")
          .select("position")
          .eq("card_id", input.cardId);
        
        const nextPosition = (currentGroups?.length || 0);

        const { data, error } = await supabase
          .from("card_checklist_groups")
          .insert({
            card_id: input.cardId,
            title: input.title,
            position: nextPosition
          })
          .select("id")
          .single();

        if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
        
        // Sincronizar criação de grupo de checklist para cards espelhados
        try {
          const { data: mirrors } = await supabase
            .from("mirrored_cards")
            .select("original_card_id,mirror_card_id")
            .or(`original_card_id.eq.${input.cardId},mirror_card_id.eq.${input.cardId}`);

          if (mirrors && mirrors.length > 0) {
            const relatedCardIds = mirrors
              .flatMap((m: any) => [m.original_card_id, m.mirror_card_id])
              .filter((cardId: any) => cardId !== input.cardId);

            for (const targetCardId of relatedCardIds) {
              // Evita duplicar grupo (mesmo título) no card espelhado
              const { data: existing } = await supabase
                .from("card_checklist_groups")
                .select("id")
                .eq("card_id", targetCardId)
                .eq("title", input.title);

              if (existing && existing.length > 0) continue;

              const { data: targetGroups } = await supabase
                .from("card_checklist_groups")
                .select("position")
                .eq("card_id", targetCardId);

              const targetNextPosition = (targetGroups?.length || 0);

              await supabase.from("card_checklist_groups").insert({
                card_id: targetCardId,
                title: input.title,
                position: targetNextPosition,
              });
            }
          }
        } catch (syncError) {
          console.error("[Mirror Sync] Checklist group add sync failed:", syncError);
          // não interrompe a criação do grupo original
        }

        return { id: data.id };
      }),
    updateChecklistGroup: protectedProcedure
      .input(z.object({ id: z.number(), title: z.string() }))
      .mutation(async ({ input }) => {
        // 1. Buscar info do grupo antes de atualizar para sincronizar
        const { data: groupToUpdate } = await supabase
          .from("card_checklist_groups")
          .select("card_id, title")
          .eq("id", input.id)
          .single();

        const { error } = await supabase
          .from("card_checklist_groups")
          .update({ title: input.title })
          .eq("id", input.id);

        if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });

        // 2. Sincronizar com espelhos
        if (groupToUpdate) {
          try {
            const { data: mirrors } = await supabase
              .from("mirrored_cards")
              .select("*")
              .or(`original_card_id.eq.${groupToUpdate.card_id},mirror_card_id.eq.${groupToUpdate.card_id}`);

            if (mirrors && mirrors.length > 0) {
              const relatedCardIds = mirrors.flatMap(m => [m.original_card_id, m.mirror_card_id])
                .filter(id => id !== groupToUpdate.card_id);

              await supabase
                .from("card_checklist_groups")
                .update({ title: input.title })
                .in("card_id", relatedCardIds)
                .eq("title", groupToUpdate.title);
            }
          } catch (e) {
            console.error("[Mirror Sync] Checklist group update sync failed:", e);
          }
        }

        return { success: true };
      }),
    deleteChecklistGroup: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        // 1. Buscar info do grupo antes de deletar para sincronizar
        const { data: groupToDelete } = await supabase
          .from("card_checklist_groups")
          .select("card_id, title")
          .eq("id", input.id)
          .single();

        await supabase.from("card_checklists").delete().eq("group_id", input.id);
        
        const { error } = await supabase
          .from("card_checklist_groups")
          .delete()
          .eq("id", input.id);

        if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });

        // 2. Sincronizar com espelhos
        if (groupToDelete) {
          try {
            const { data: mirrors } = await supabase
              .from("mirrored_cards")
              .select("*")
              .or(`original_card_id.eq.${groupToDelete.card_id},mirror_card_id.eq.${groupToDelete.card_id}`);

            if (mirrors && mirrors.length > 0) {
              const relatedCardIds = mirrors.flatMap(m => [m.original_card_id, m.mirror_card_id])
                .filter(id => id !== groupToDelete.card_id);

              await supabase
                .from("card_checklist_groups")
                .delete()
                .in("card_id", relatedCardIds)
                .eq("title", groupToDelete.title);
            }
          } catch (e) {
            console.error("[Mirror Sync] Checklist group delete sync failed:", e);
          }
        }

        return { success: true };
      }),
    addChecklist: protectedProcedure
      .input(z.object({ 
        cardId: z.number(), 
        groupId: z.number().optional(), 
        title: z.string(), 
        position: z.number().optional(),
        assignedUserId: z.number().nullish()
      }))
      .mutation(async ({ input }) => {
        const query = supabase.from("card_checklists").select("position").eq("card_id", input.cardId);
        if (input.groupId) query.eq("group_id", input.groupId);
        const { data: currentItems } = await query;
        
        const nextPosition = (currentItems?.length || 0);

        const { data, error } = await supabase
          .from("card_checklists")
          .insert({
            card_id: input.cardId,
            group_id: input.groupId,
            title: input.title,
            position: input.position ?? nextPosition,
            completed: false,
            assigned_user_id: input.assignedUserId
          })
          .select("id")
          .single();

        if (error) {
          console.error("[Database] Checklist creation failed via Supabase:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Erro ao criar checklist: ${error.message}`,
          });
        }

        // Sincronizar criação de item de checklist para cards espelhados
        // Observação: o mapeamento do grupo no espelho é feito por `title`.
        try {
          if (input.groupId) {
            const { data: currentGroup } = await supabase
              .from("card_checklist_groups")
              .select("title")
              .eq("id", input.groupId)
              .single();

            if (currentGroup?.title) {
              const { data: mirrors } = await supabase
                .from("mirrored_cards")
                .select("original_card_id,mirror_card_id")
                .or(`original_card_id.eq.${input.cardId},mirror_card_id.eq.${input.cardId}`);

              if (mirrors && mirrors.length > 0) {
                const relatedCardIds = mirrors
                  .flatMap((m: any) => [m.original_card_id, m.mirror_card_id])
                  .filter((cardId: any) => cardId !== input.cardId);

                for (const targetCardId of relatedCardIds) {
                  const { data: targetGroups } = await supabase
                    .from("card_checklist_groups")
                    .select("id")
                    .eq("card_id", targetCardId)
                    .eq("title", currentGroup.title);

                  if (!targetGroups || targetGroups.length === 0) continue;

                  for (const targetGroup of targetGroups) {
                    // Evita duplicar item (mesmo título) no grupo espelhado
                    const { data: existingItems } = await supabase
                      .from("card_checklists")
                      .select("id")
                      .eq("group_id", targetGroup.id)
                      .eq("title", input.title);

                    if (existingItems && existingItems.length > 0) continue;

                    const { data: targetItems } = await supabase
                      .from("card_checklists")
                      .select("position")
                      .eq("group_id", targetGroup.id);

                    const targetNextPosition = (targetItems?.length || 0);
                    const finalPosition = input.position ?? targetNextPosition;

                    await supabase.from("card_checklists").insert({
                      card_id: targetCardId,
                      group_id: targetGroup.id,
                      title: input.title,
                      position: finalPosition,
                      completed: false,
                      assigned_user_id: input.assignedUserId
                    });
                  }
                }
              }
            }
          }
        } catch (syncError) {
          console.error("[Mirror Sync] Checklist item add sync failed:", syncError);
          // não interrompe a criação do item original
        }

        return { id: data.id };
      }),
    updateChecklistItem: protectedProcedure
      .input(z.object({ 
        id: z.number(), 
        completed: z.boolean().optional(),
        title: z.string().optional(),
        dueDate: z.date().nullish(),
        assignedUserId: z.number().nullish()
      }))
      .mutation(async ({ ctx, input }) => {
        const updateData: any = {};
        if (input.completed !== undefined) updateData.completed = input.completed;
        if (input.title !== undefined) updateData.title = input.title;
        if (input.dueDate !== undefined) updateData.due_date = input.dueDate ? input.dueDate.toISOString() : null;
        if (input.assignedUserId !== undefined) updateData.assigned_user_id = input.assignedUserId;

        // 1. Atualizar o item atual
        const { data: updatedItem, error } = await supabase
          .from("card_checklists")
          .update(updateData)
          .eq("id", input.id)
          .select("card_id, title, group_id")
          .single();

        if (error) {
          console.error("[Database] Checklist update failed via Supabase:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Erro ao atualizar checklist: ${error.message}`,
          });
        }

        // Registrar atividade/log quando houver mudança do responsável do item
        // (usa o `assignedUserId` como "dono" do log, para refletir no feed/atividades do usuário)
        if (input.assignedUserId !== undefined) {
          try {
            const targetUserId = input.assignedUserId ?? ctx.user.id;
            await createAuditLog({
              userId: targetUserId,
              action: "update",
              entityType: "card",
              entityId: updatedItem.card_id,
              entityName: updatedItem.title,
              details:
                input.assignedUserId === null
                  ? `Checklist: responsável removido (${updatedItem.title})`
                  : `Checklist: atribuído para user_id=${input.assignedUserId} (${updatedItem.title})`,
            });
          } catch (logError) {
            console.error("[Checklist Activity] Failed to create audit log:", logError);
          }
        }

        // 2. Sincronizar com cards espelhados (se houver)
        try {
          // Busca se este card é original ou espelho
          const { data: mirrors } = await supabase
            .from("mirrored_cards")
            .select("*")
            .or(`original_card_id.eq.${updatedItem.card_id},mirror_card_id.eq.${updatedItem.card_id}`);

          if (mirrors && mirrors.length > 0) {
            // Coletar todos os IDs de cards relacionados (excluindo o atual)
            const relatedCardIds = mirrors.flatMap(m => [m.original_card_id, m.mirror_card_id])
              .filter(id => id !== updatedItem.card_id);

            if (relatedCardIds.length > 0) {
              // Buscar o título do grupo para encontrar o correspondente nos outros cards
              const { data: currentGroup } = await supabase
                .from("card_checklist_groups")
                .select("title")
                .eq("id", updatedItem.group_id)
                .single();

              if (currentGroup) {
                // Para cada card relacionado, encontrar o item com o mesmo título dentro de um grupo com o mesmo título
                for (const cardId of relatedCardIds) {
                  const { data: targetGroups } = await supabase
                    .from("card_checklist_groups")
                    .select("id")
                    .eq("card_id", cardId)
                    .eq("title", currentGroup.title);

                  if (targetGroups && targetGroups.length > 0) {
                    const targetGroupIds = targetGroups.map(g => g.id);
                    
                    // Atualizar itens que tenham o mesmo título nos grupos correspondentes
                    await supabase
                      .from("card_checklists")
                      .update(updateData)
                      .eq("title", updatedItem.title)
                      .in("group_id", targetGroupIds);
                  }
                }
              }
            }
          }
        } catch (syncError) {
          console.error("[Mirror Sync] Failed to sync checklist item:", syncError);
          // Não lançamos erro aqui para não travar a atualização principal
        }

        // 3. Forçar atualização do card em tempo real para todos os espelhos
        try {
          await supabase.from("cards").update({ updated_at: new Date().toISOString() }).eq("id", updatedItem.card_id);
          const { data: mirrors } = await supabase
            .from("mirrored_cards")
            .select("*")
            .or(`original_card_id.eq.${updatedItem.card_id},mirror_card_id.eq.${updatedItem.card_id}`);
          
          if (mirrors) {
            const ids = mirrors.flatMap(m => [m.original_card_id, m.mirror_card_id]).filter(id => id !== updatedItem.card_id);
            if (ids.length > 0) {
              await supabase.from("cards").update({ updated_at: new Date().toISOString() }).in("id", ids);
            }
          }
        } catch (e) {
          console.error("[Realtime Sync] Failed to trigger card update:", e);
        }

        return { success: true };
      }),
    reorderChecklist: protectedProcedure
      .input(z.object({ 
        items: z.array(z.object({ id: z.number(), position: z.number() }))
      }))
      .mutation(async ({ input }) => {
        for (const item of input.items) {
          const { error } = await supabase
            .from("card_checklists")
            .update({ position: item.position })
            .eq("id", item.id);
          if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
        }
        return { success: true };
      }),
    deleteChecklist: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        // 1. Buscar info do item antes de deletar para sincronizar
        const { data: itemToDelete } = await supabase
          .from("card_checklists")
          .select("card_id, title, group_id")
          .eq("id", input.id)
          .single();

        const { error } = await supabase
          .from("card_checklists")
          .delete()
          .eq("id", input.id);

        if (error) {
          console.error("[Database] Checklist deletion failed via Supabase:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Erro ao remover checklist: ${error.message}`,
          });
        }

        // 2. Sincronizar com espelhos
        if (itemToDelete) {
          try {
            const { data: mirrors } = await supabase
              .from("mirrored_cards")
              .select("*")
              .or(`original_card_id.eq.${itemToDelete.card_id},mirror_card_id.eq.${itemToDelete.card_id}`);

            if (mirrors && mirrors.length > 0) {
              const relatedCardIds = mirrors.flatMap(m => [m.original_card_id, m.mirror_card_id])
                .filter(id => id !== itemToDelete.card_id);

              const { data: groupInfo } = await supabase
                .from("card_checklist_groups")
                .select("title")
                .eq("id", itemToDelete.group_id)
                .single();

              if (groupInfo) {
                for (const cardId of relatedCardIds) {
                  const { data: targetGroups } = await supabase
                    .from("card_checklist_groups")
                    .select("id")
                    .eq("card_id", cardId)
                    .eq("title", groupInfo.title);

                  if (targetGroups && targetGroups.length > 0) {
                    await supabase
                      .from("card_checklists")
                      .delete()
                      .in("group_id", targetGroups.map(g => g.id))
                      .eq("title", itemToDelete.title);
                  }
                }
              }
            }
          } catch (e) {
            console.error("[Mirror Sync] Checklist item delete sync failed:", e);
          }
        }

        return { success: true };
      }),

    getCustomFields: protectedProcedure
      .input(z.object({ cardId: z.number() }))
      .query(async ({ input }) => {
        return await getCardCustomFields(input.cardId);
      }),
    addCustomField: protectedProcedure
      .input(z.object({
        cardId: z.number(),
        fieldName: z.string(),
        fieldValue: z.string(),
        fieldType: z.enum(["text", "select", "date", "number"]).optional(),
      }))
      .mutation(async ({ input }) => {
        const { data, error } = await supabase
          .from("card_custom_fields")
          .insert({
            card_id: input.cardId,
            field_name: input.fieldName,
            field_value: input.fieldValue,
            field_type: input.fieldType || "text",
          })
          .select("id")
          .single();

        if (error) {
          console.error("[Database] Custom field creation failed via Supabase:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Erro ao criar campo personalizado: ${error.message}`,
          });
        }

        return { id: data.id };
      }),
    deleteCustomField: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const { error } = await supabase
          .from("card_custom_fields")
          .delete()
          .eq("id", input.id);

        if (error) {
          console.error("[Database] Custom field deletion failed via Supabase:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Erro ao remover campo personalizado: ${error.message}`,
          });
        }

        return { success: true };
      }),

    updateCustomField: protectedProcedure
      .input(z.object({ 
        id: z.number(), 
        fieldValue: z.string()
      }))
      .mutation(async ({ input }) => {
        const { error } = await supabase
          .from("card_custom_fields")
          .update({ field_value: input.fieldValue })
          .eq("id", input.id);

        if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
        return { success: true };
      }),

    upsertCustomField: protectedProcedure
      .input(z.object({
        cardId: z.number(),
        fieldName: z.string(),
        fieldValue: z.string(),
        fieldType: z.enum(["text", "select", "date", "number"]).optional(),
      }))
      .mutation(async ({ input }) => {
        const { error } = await supabase
          .from("card_custom_fields")
          .upsert({
            card_id: input.cardId,
            field_name: input.fieldName,
            field_value: input.fieldValue,
            field_type: input.fieldType || "text",
          }, { onConflict: 'card_id,field_name' });

        if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });

        // Sincronizar com espelhos e Trigger Realtime
        try {
          const { data: mirrors } = await supabase
            .from("mirrored_cards")
            .select("*")
            .or(`original_card_id.eq.${input.cardId},mirror_card_id.eq.${input.cardId}`);

          if (mirrors && mirrors.length > 0) {
            const relatedCardIds = mirrors.flatMap(m => [m.original_card_id, m.mirror_card_id])
              .filter(id => id !== input.cardId);

            for (const cardId of relatedCardIds) {
              await supabase
                .from("card_custom_fields")
                .upsert({
                  card_id: cardId,
                  field_name: input.fieldName,
                  field_value: input.fieldValue,
                  field_type: input.fieldType || "text",
                }, { onConflict: 'card_id,field_name' });
              
              // Trigger realtime update no card espelhado
              await supabase.from("cards").update({ updated_at: new Date().toISOString() }).eq("id", cardId);
            }
          }
          // Trigger realtime update no card original
          await supabase.from("cards").update({ updated_at: new Date().toISOString() }).eq("id", input.cardId);
        } catch (e) {
          console.error("[Mirror Sync] Custom field sync failed:", e);
        }

        return { success: true };
      }),

    getProjectDates: protectedProcedure
      .input(z.object({ cardId: z.number() }))
      .query(async ({ input }) => {
        const { data, error } = await supabase
          .from("project_dates")
          .select("*")
          .eq("card_id", input.cardId)
          .maybeSingle();
        return data || null;
      }),
    upsertProjectDates: protectedProcedure
      .input(z.object({
        cardId: z.number(),
        startDate: z.date().nullish(),
        endDate: z.date().nullish(),
      }))
      .mutation(async ({ input }) => {
        const { error } = await supabase
          .from("project_dates")
          .upsert({
            card_id: input.cardId,
            start_date: input.startDate ? input.startDate.toISOString() : null,
            end_date: input.endDate ? input.endDate.toISOString() : null,
          }, { onConflict: 'card_id' });

        if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });

        // Sincronizar com espelhos
        try {
          const { data: mirrors } = await supabase
            .from("mirrored_cards")
            .select("*")
            .or(`original_card_id.eq.${input.cardId},mirror_card_id.eq.${input.cardId}`);

          if (mirrors && mirrors.length > 0) {
            const relatedCardIds = mirrors.flatMap(m => [m.original_card_id, m.mirror_card_id])
              .filter(id => id !== input.cardId);

            for (const cardId of relatedCardIds) {
              await supabase
                .from("project_dates")
                .upsert({
                  card_id: cardId,
                  start_date: input.startDate ? input.startDate.toISOString() : null,
                  end_date: input.endDate ? input.endDate.toISOString() : null,
                }, { onConflict: 'card_id' });
            }
          }
        } catch (e) {
          console.error("[Mirror Sync] Project dates sync failed:", e);
        }

        return { success: true };
      }),

    getComments: protectedProcedure
      .input(z.object({ cardId: z.number() }))
      .query(async ({ input }) => {
        const { data, error } = await supabase
          .from("card_comments")
          .select("*, users(name, username)")
          .eq("card_id", input.cardId)
          .order("created_at", { ascending: true });

        if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
        
        return data.map((c: any) => ({
          ...c,
          userName: c.users?.name || c.users?.username || "Usuário"
        }));
      }),
    addComment: protectedProcedure
      .input(z.object({ cardId: z.number(), content: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const { data, error } = await supabase
          .from("card_comments")
          .insert({
            card_id: input.cardId,
            user_id: ctx.user.id,
            content: input.content,
          })
          .select("id")
          .single();

        if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });

        // Sincronizar com espelhos e Trigger Realtime
        try {
          const { data: mirrors } = await supabase
            .from("mirrored_cards")
            .select("*")
            .or(`original_card_id.eq.${input.cardId},mirror_card_id.eq.${input.cardId}`);

          if (mirrors && mirrors.length > 0) {
            const relatedCardIds = mirrors.flatMap(m => [m.original_card_id, m.mirror_card_id])
              .filter(id => id !== input.cardId);

            for (const cardId of relatedCardIds) {
              await supabase.from("card_comments").insert({
                card_id: cardId,
                user_id: ctx.user.id,
                content: input.content,
              });
              // Trigger realtime update no card espelhado
              await supabase.from("cards").update({ updated_at: new Date().toISOString() }).eq("id", cardId);
            }
          }
          // Trigger realtime update no card original
          await supabase.from("cards").update({ updated_at: new Date().toISOString() }).eq("id", input.cardId);
        } catch (e) {
          console.error("[Mirror Sync] Comment sync failed:", e);
        }

        return { id: data.id };
      }),
    deleteComment: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const { error } = await supabase.from("card_comments").delete().eq("id", input.id);
        if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
        return { success: true };
      }),

    createMirror: protectedProcedure
      .input(z.object({
        cardId: z.number(),
        targetListId: z.number(),
        targetBoardId: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { data: originalCard, error: cardError } = await supabase
          .from("cards")
          .select("*")
          .eq("id", input.cardId)
          .single();

        if (cardError || !originalCard) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Cartão original não encontrado" });
        }

        // Evita espelhar novamente o mesmo cartão no mesmo board de destino
        const { data: existingMirrors } = await supabase
          .from("mirrored_cards")
          .select("mirror_card_id")
          .or(`original_card_id.eq.${input.cardId},mirror_card_id.eq.${input.cardId}`)
          .eq("mirror_board_id", input.targetBoardId)
          .limit(1);

        if (existingMirrors && existingMirrors.length > 0) {
          return {
            success: true,
            alreadyExisted: true,
            mirrorCardId: existingMirrors[0].mirror_card_id,
          };
        }

        const { data: originalList, error: listError } = await supabase
          .from("lists")
          .select("board_id")
          .eq("id", originalCard.list_id)
          .single();

        if (listError || !originalList) {
          console.error("[Mirror] Original list fetch error:", listError);
          throw new TRPCError({ code: "NOT_FOUND", message: "Lista original não encontrada" });
        }

        const { data: originalBoard } = await supabase
          .from("boards")
          .select("name")
          .eq("id", originalList.board_id)
          .single();

        const originName = originalBoard?.name || "Desconhecido";

        // Nome limpo: remove sufixos de mirror anteriores se existirem
        const cleanTitle = originalCard.title.replace(/\s\(Mirror:.*\)$/, "");

        // --- NOVO: Buscar configurações do QUADRO DE ORIGEM ---
        const { data: settings } = await supabase
          .from("board_mirror_settings")
          .select("*")
          .eq("board_id", originalList.board_id)
          .maybeSingle();

        const mirrorSettings = settings || {
          mirror_labels: true,
          mirror_checklists: true,
          mirror_comments: false,
          mirror_attachments: false,
          mirror_custom_fields: true,
          mirror_dates: true,
          mirror_description: true,
        };

        const { data: mirrorCard, error: mirrorError } = await supabase
          .from("cards")
          .insert({
            title: `${cleanTitle} (Mirror: ${originName})`,
            description: mirrorSettings.mirror_description ? originalCard.description : null,
            start_date: mirrorSettings.mirror_dates ? originalCard.start_date : null,
            due_date: mirrorSettings.mirror_dates ? originalCard.due_date : null,
            list_id: input.targetListId,
            position: 0,
            created_by: ctx.user.id
          })
          .select("id")
          .single();

        if (mirrorError) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Erro ao criar espelho: ${mirrorError.message}` });
        }

        const { error: linkError } = await supabase
          .from("mirrored_cards")
          .insert({
            original_card_id: input.cardId,
            mirror_card_id: mirrorCard.id,
            original_board_id: originalList.board_id,
            mirror_board_id: input.targetBoardId,
            sync_status: 'synced'
          });

        if (linkError) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Erro ao vincular espelhos: ${linkError.message}` });
        }

        // --- Sincronização Inicial de Atributos Secundários ---
        
        // 1. Sincronizar Etiquetas
        if (mirrorSettings.mirror_labels) {
          const { data: labels } = await supabase.from("card_labels").select("*").eq("card_id", input.cardId);
          if (labels && labels.length > 0) {
            await supabase.from("card_labels").insert(
              labels.map(l => ({ card_id: mirrorCard.id, label: l.label, color: l.color }))
            );
          }
        }

        // 2. Sincronizar Checklists
        if (mirrorSettings.mirror_checklists) {
          const { data: groups } = await supabase.from("card_checklist_groups").select("*").eq("card_id", input.cardId);
          if (groups) {
            for (const group of groups) {
              const { data: newGroup } = await supabase
                .from("card_checklist_groups")
                .insert({ card_id: mirrorCard.id, title: group.title, position: group.position })
                .select("id")
                .single();

              if (newGroup) {
                const { data: items } = await supabase.from("card_checklists").select("*").eq("group_id", group.id);
                if (items && items.length > 0) {
                  await supabase.from("card_checklists").insert(
                    items.map(i => ({
                      card_id: mirrorCard.id,
                      group_id: newGroup.id,
                      title: i.title,
                      completed: i.completed,
                      position: i.position
                    }))
                  );
                }
              }
            }
          }
        }

        // 3. Sincronizar Datas do Projeto (Tabela auxiliar)
        if (mirrorSettings.mirror_dates) {
          const { data: dates } = await supabase.from("project_dates").select("*").eq("card_id", input.cardId).maybeSingle();
          if (dates) {
            await supabase.from("project_dates").upsert({
              card_id: mirrorCard.id,
              project_start_date: dates.project_start_date,
              project_end_date: dates.project_end_date
            });
          }
        }

        // 4. Sincronizar Campos Personalizados
        if (mirrorSettings.mirror_custom_fields) {
          const { data: fields } = await supabase.from("card_custom_fields").select("*").eq("card_id", input.cardId);
          if (fields && fields.length > 0) {
            await supabase.from("card_custom_fields").insert(
              fields.map(f => ({
                card_id: mirrorCard.id,
                field_name: f.field_name,
                field_value: f.field_value,
                field_type: f.field_type
              }))
            );
          }
        }

        // 5. Sincronizar Comentários (Opcional conforme configuração)
        if (mirrorSettings.mirror_comments) {
          const { data: comments } = await supabase.from("card_comments").select("*").eq("card_id", input.cardId);
          if (comments && comments.length > 0) {
            await supabase.from("card_comments").insert(
              comments.map(c => ({
                card_id: mirrorCard.id,
                user_id: c.user_id,
                content: c.content,
                created_at: c.created_at
              }))
            );
          }
        }

        // 6. Sincronizar Anexos (Opcional conforme configuração)
        if (mirrorSettings.mirror_attachments) {
          const { data: attachments } = await supabase.from("card_attachments").select("*").eq("card_id", input.cardId);
          if (attachments && attachments.length > 0) {
            await supabase.from("card_attachments").insert(
              attachments.map(a => ({
                card_id: mirrorCard.id,
                filename: a.filename,
                file_url: a.file_url,
                file_key: a.file_key,
                mime_type: a.mime_type,
                file_size: a.file_size,
                uploaded_by: a.uploaded_by,
                created_at: a.created_at
              }))
            );
          }
        }

        return { success: true, mirrorId: mirrorCard.id };
      }),

    getMirroredCards: protectedProcedure
      .input(z.object({ boardId: z.number() }))
      .query(async ({ input }) => {
        return await getMirroredCards(input.boardId);
      }),

    getCardMirrors: protectedProcedure
      .input(z.object({ cardId: z.number() }))
      .query(async ({ input }) => {
        // Busca onde este card é o ORIGINAL
        const { data, error } = await supabase
          .from("mirrored_cards")
          .select(`
            mirror_board_id,
            boards:mirror_board_id (name)
          `)
          .eq("original_card_id", input.cardId);

        if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
        
        return (data || []).map((m: any) => ({
          boardId: m.mirror_board_id,
          boardName: m.boards?.name || "Quadro Desconhecido"
        }));
      }),
  }),

  // Admin routers - User management

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
          if (ctx.user.role !== 'admin') {
            throw new TRPCError({ code: 'FORBIDDEN', message: 'Apenas administradores podem criar usuários' });
          }
          
          const hashedPassword = await bcrypt.hash(input.password, 10);
          const email = input.username.includes('@') ? input.username : `${input.username}@projeto-maju.com`;

          // Criar no Supabase Auth também para manter consistência se necessário
          const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
            email,
            password: input.password,
            email_confirm: true,
            user_metadata: { name: input.name, role: input.role }
          });

          if (authError) {
            console.error("[Admin] Supabase Auth user creation failed:", authError.message);
          }

          const { data, error } = await supabase.from("users").insert({
            username: input.username,
            password: hashedPassword,
            name: input.name,
            role: input.role,
          }).select("id").single();

          if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
          return { id: data.id };
        }),
      update: protectedProcedure
        .input(z.object({
          id: z.number(),
          name: z.string().optional(),
          role: z.enum(['user', 'admin']).optional(),
          password: z.string().min(6).optional(),
        }))
        .mutation(async ({ ctx, input }) => {
          if (ctx.user.role !== 'admin' && ctx.user.id !== input.id) {
            throw new TRPCError({ code: 'FORBIDDEN', message: 'Você não tem permissão para atualizar este usuário' });
          }

          const updateData: any = {};
          if (input.name) updateData.name = input.name;
          if (input.role && ctx.user.role === 'admin') updateData.role = input.role;
          if (input.password) updateData.password = await bcrypt.hash(input.password, 10);

          const { error } = await supabase.from("users").update(updateData).eq("id", input.id);
          if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
          return { success: true };
        }),
      delete: protectedProcedure
        .input(z.object({ id: z.number() }))
        .mutation(async ({ ctx, input }) => {
          if (ctx.user.role !== 'admin') {
            throw new TRPCError({ code: 'FORBIDDEN', message: 'Apenas administradores podem remover usuários' });
          }
          if (ctx.user.id === input.id) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'Você não pode remover seu próprio usuário' });
          }

          const { error } = await supabase.from("users").delete().eq("id", input.id);
          if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
          return { success: true };
        }),
    }),
    boards: router({
      addMember: protectedProcedure
        .input(z.object({ boardId: z.number(), userId: z.number(), role: z.enum(['viewer', 'editor', 'admin']).default('viewer') }))
        .mutation(async ({ ctx, input }) => {
          const board = await getBoardById(input.boardId, ctx.user.id);
          if (!board || (board.owner_id !== ctx.user.id && ctx.user.role !== 'admin')) {
            throw new TRPCError({ code: 'FORBIDDEN', message: 'Apenas o dono ou admin pode adicionar membros' });
          }

          const { error } = await supabase.from("board_members").upsert({
            board_id: input.boardId,
            user_id: input.userId,
            role: input.role
          }, { onConflict: 'board_id,user_id' });

          if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
          return { success: true };
        }),
      removeMember: protectedProcedure
        .input(z.object({ boardId: z.number(), userId: z.number() }))
        .mutation(async ({ ctx, input }) => {
          const board = await getBoardById(input.boardId, ctx.user.id);
          if (!board || (board.owner_id !== ctx.user.id && ctx.user.role !== 'admin')) {
            throw new TRPCError({ code: 'FORBIDDEN', message: 'Apenas o dono ou admin pode remover membros' });
          }

          const { error } = await supabase.from("board_members").delete().eq("board_id", input.boardId).eq("user_id", input.userId);
          if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
          return { success: true };
        }),
    }),
  }),

  // Statistics/Dashboard
  stats: router({
    getGeneral: protectedProcedure.query(async () => {
      const db = await getDb();
      if (!db) return { totalBoards: 0, totalCards: 0, totalUsers: 0 };
      
      try {
        // Evita crash/loop em ambientes onde o Drizzle/tenant pode falhar.
        const [boardsCount] = await db.select({ count: z.any() as any }).from(boards);
        const [cardsCount] = await db.select({ count: z.any() as any }).from(cards);
        const [usersCount] = await db.select({ count: z.any() as any }).from(users);
      
        return {
          totalBoards: Number(boardsCount?.count || 0),
          totalCards: Number(cardsCount?.count || 0),
          totalUsers: Number(usersCount?.count || 0),
        };
      } catch (err) {
        console.error("[Stats] getGeneral failed, using zeros:", err);
        return { totalBoards: 0, totalCards: 0, totalUsers: 0 };
      }
    }),
  }),

  // Checklist Templates
  checklistTemplates: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const { data, error } = await supabase
        .from("checklist_templates")
        .select("*")
        .or(`is_global.eq.true,created_by.eq.${ctx.user.id}`)
        .order("usage_count", { ascending: false })
        .order("name", { ascending: true });

      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      
      // Os 13 modelos globais que devem existir se a tabela estiver vazia
      const globalTemplates = [
        { name: "Separação 1", items: ["Conferir pedido", "Separar itens", "Embalar"] },
        { name: "Baixa no Sistema", items: ["Atualizar estoque", "Gerar protocolo", "Confirmar baixa"] },
        { name: "Aprovação", items: ["Revisar documentos", "Validar dados", "Assinar aprovação"] },
        { name: "Logística", items: ["Agendar coleta", "Definir rota", "Despachar"] },
        { name: "Faturamento", items: ["Emitir NF", "Enviar boleto", "Registrar financeiro"] },
        { name: "Qualidade", items: ["Inspecionar produto", "Testar funcionalidade", "Liberar lote"] },
        { name: "Manutenção", items: ["Diagnosticar problema", "Trocar peças", "Testar reparo"] },
        { name: "RH Admissão", items: ["Coletar docs", "Assinar contrato", "Onboarding"] },
        { name: "TI Setup", items: ["Configurar PC", "Criar acessos", "Instalar softwares"] },
        { name: "Vendas Lead", items: ["Qualificar contato", "Apresentar proposta", "Follow-up"] },
        { name: "Marketing Campanha", items: ["Definir público", "Criar artes", "Lançar anúncios"] },
        { name: "Compras Suprimentos", items: ["Cotar preços", "Escolher fornecedor", "Emitir pedido"] },
        { name: "Atendimento", items: ["Abrir chamado", "Analisar dúvida", "Responder cliente"] }
      ];

      // Se não houver dados no banco, inserimos os globais (apenas para exibição inicial se desejar, 
      // mas idealmente estariam no banco via migration ou seed)
      if (!data || data.length === 0) {
        return globalTemplates.map((t, idx) => ({
          id: idx + 1000, // IDs fictícios para os padrões se o banco estiver vazio
          name: t.name,
          items: t.items,
          isGlobal: true,
          usageCount: 0
        }));
      }

      return (data || []).map(t => ({
        ...t,
        items: typeof t.items === 'string' ? JSON.parse(t.items) : t.items
      }));
    }),
    applyTemplate: protectedProcedure
      .input(z.object({
        cardId: z.number(),
        templateId: z.number(),
      }))
      .mutation(async ({ input }) => {
        // Buscar o template
        const { data: template, error: tError } = await supabase
          .from("checklist_templates")
          .select("*")
          .eq("id", input.templateId)
          .single();
        
        if (tError || !template) throw new TRPCError({ code: "NOT_FOUND", message: "Modelo não encontrado" });

        const items = typeof template.items === 'string' ? JSON.parse(template.items) : template.items;

        // Criar o grupo de checklist baseado no nome do template
        const { data: group, error: gError } = await supabase
          .from("card_checklist_groups")
          .insert({
            card_id: input.cardId,
            title: template.name,
            position: 0
          })
          .select("id")
          .single();
        
        if (gError) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: gError.message });

        // Inserir os itens
        const checklistItems = items.map((title: string, index: number) => ({
          card_id: input.cardId,
          group_id: group.id,
          title: title,
          position: index,
          completed: false
        }));

        const { error: iError } = await supabase
          .from("card_checklists")
          .insert(checklistItems);

        if (iError) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: iError.message });

        // Incrementar uso
        await supabase.rpc('increment_template_usage', { template_id: input.templateId });

        return { success: true };
      }),
    create: protectedProcedure
      .input(z.object({
        name: z.string(),
        items: z.array(z.string()),
        isGlobal: z.boolean().default(false),
      }))
      .mutation(async ({ ctx, input }) => {
        const { data, error } = await supabase
          .from("checklist_templates")
          .insert({
            name: input.name,
            items: JSON.stringify(input.items),
            is_global: input.isGlobal && ctx.user.role === 'admin',
            created_by: ctx.user.id,
          })
          .select("id")
          .single();

        if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
        return { id: data.id };
      }),
    incrementUsage: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const { data: current } = await supabase
          .from("checklist_templates")
          .select("usage_count")
          .eq("id", input.id)
          .single();
        
        const count = (current?.usage_count || 0) + 1;
        await supabase
          .from("checklist_templates")
          .update({ usage_count: count })
          .eq("id", input.id);
        
        return { success: true };
      }),
  }),

  // AI Chat Assistant
  ai: router({
    chat: protectedProcedure
      .input(z.object({
        messages: z.array(z.object({
          role: z.enum(["user", "assistant", "system"]),
          content: z.string(),
        })),
        useWebSearch: z.boolean().optional(),
        shortResponse: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const lastUserMessage = [...input.messages].reverse().find(m => m.role === 'user')?.content.toLowerCase() || "";

        // Banco de Dados de Perguntas e Respostas (Knowledge Base)
        const knowledgeBase: Record<string, string> = {
          "como criar um quadro": "Para criar um novo quadro, utilize o botão '+ New Board' na barra lateral esquerda. Digite o nome desejado e pressione Enter.",
          "como criar uma lista": "Dentro de um quadro, clique no botão '+ Adicionar outra lista' ao final das colunas existentes.",
          "como criar um cartao": "Em qualquer lista, clique no botão '+ Adicionar um cartão' na parte inferior da coluna.",
          "como excluir um quadro": "Apenas administradores podem excluir quadros. Se você for ADM, clique no ícone de lixeira no canto superior direito do quadro.",
          "como renomear um quadro": "Clique diretamente sobre o título do quadro no topo da página, digite o novo nome e pressione Enter.",
          "como espelhar um cartao": "Abra os detalhes do cartão e clique no botão 'Espelhar' no rodapé. Escolha o quadro e a lista de destino.",
          "como funciona o espelhamento": "O espelhamento cria uma cópia sincronizada. Alterações feitas no cartão original ou no espelho serão refletidas em ambos, dependendo das configurações de espelhamento do quadro.",
          "quem criou o app": "Este aplicativo foi desenvolvido por Diogo Martins. Para questões sobre o desenvolvimento, entre em contato diretamente com o Dev Diogo Martins.",
          "quem desenvolveu": "Este aplicativo foi desenvolvido por Diogo Martins. Para questões sobre o desenvolvimento, entre em contato diretamente com o Dev Diogo Martins.",
          "como configurar o espelhamento": "Administradores podem clicar no ícone de engrenagem no topo do quadro para definir quais atributos (etiquetas, checklists, etc.) devem ser sincronizados.",
          "como adicionar membros": "Clique no botão 'Compartilhar' no topo do quadro para adicionar novos usuários e definir seus níveis de permissão.",
          "o que é o modo ia": "O modo Maju IA é o seu assistente virtual D., projetado para ajudar na organização e tirar dúvidas sobre a plataforma.",
          "como gerenciar prazos": "Você pode definir 'Data de Início' e 'Data de Entrega' nos detalhes de cada cartão. O sistema alertará quando um prazo estiver próximo ou vencido.",
          "como usar etiquetas": "As etiquetas ajudam a categorizar cartões por cores e nomes. Você pode adicionar várias etiquetas a um único cartão para facilitar a filtragem visual.",
          "como funciona o checklist": "Você pode criar grupos de checklist dentro de um cartão para quebrar tarefas grandes em subtarefas menores e acompanhar o progresso através da barra de porcentagem.",
          "privacidade e seguranca": "O Maju Tasks utiliza Supabase para garantir que seus dados estejam seguros. Você pode controlar quem vê seus quadros através do botão 'Compartilhar'.",
          "como anexar arquivos": "Dentro de um cartão, utilize a seção 'Anexos' para fazer upload de documentos, imagens ou links relevantes para a tarefa.",
          "filtros de busca": "Você pode buscar por quadros e cartões específicos utilizando a barra de busca no topo da aplicação.",
          "ola": "Olá! Eu sou o assistente Virtual D. Como posso ajudar você hoje com o Maju Tasks?",
          "oi": "Olá! Eu sou o assistente Virtual D. Como posso ajudar você hoje com o Maju Tasks?",
          "ajuda": "Eu posso te ajudar com dúvidas sobre: criar quadros, listas, cartões, espelhamento, prazos, etiquetas, checklists e muito mais. O que você deseja saber?",
        };

        // Verificação de contato com o Dev
        if (lastUserMessage.includes("desenvolvimento") || 
            lastUserMessage.includes("codigo") || 
            lastUserMessage.includes("programado") ||
            lastUserMessage.includes("dev")) {
          return "Para questões técnicas ou sobre o desenvolvimento da aplicação, por favor, entre em contato com o Dev Diogo Martins.";
        }

        // Busca no banco de conhecimento simples
        // Primeiro tenta encontrar palavras-chave específicas na mensagem do usuário
        for (const question in knowledgeBase) {
          if (lastUserMessage.includes(question)) {
            return knowledgeBase[question];
          }
        }

        // Se a mensagem for muito curta (ex: "quadro"), tenta ver se a palavra-chave está contida na pergunta da base
        if (lastUserMessage.length < 15) {
          for (const question in knowledgeBase) {
            if (question.includes(lastUserMessage)) {
              return knowledgeBase[question];
            }
          }
        }

        // Se não encontrar no banco simples, invoca o LLM com contexto do sistema
        try {
          const systemPrompt: Message = {
            role: "system",
            content: `Você é o assistente Virtual D. do aplicativo Maju Tasks, desenvolvido por Diogo Martins. 
            Seu objetivo é ajudar usuários com o funcionamento da aplicação. 
            ${input.shortResponse ? "Mantenha a resposta extremamente curta e direta ao ponto." : ""}
            ${input.useWebSearch ? "Se necessário, utilize informações recentes da web para responder." : ""}
            Se perguntarem sobre o desenvolvimento ou questões técnicas profundas, direcione-os para o Dev Diogo Martins.
            Mantenha as respostas em português.`
          };

          const response = await invokeLLM({
            messages: [systemPrompt, ...input.messages] as Message[],
          });
          
          const content = response.choices[0]?.message?.content;
          return typeof content === "string" ? content : "Desculpe, não consegui processar sua pergunta.";
        } catch (error: any) {
          console.error("[AI Chat Error]", error);
          
          // Se o erro for de falta de chave, mas temos o openrouter configurado ou o fallback ativado
          if (error.message === "NO_API_KEY") {
             // Tenta uma mensagem amigável antes de desistir
             return "Olá! No momento meu módulo de IA avançada está em repouso, mas posso te ajudar com o básico do Maju Tasks. Tente perguntar sobre 'como criar um quadro' ou 'espelhamento'!";
          }
          
          return "Desculpe, tive um problema ao processar sua pergunta agora. Você pode perguntar sobre o funcionamento básico do app!";
        }
      }),
  }),
});

export type AppRouter = typeof appRouter;
