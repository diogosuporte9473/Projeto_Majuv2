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
} from "../drizzle/schema.js";
import { invokeLLM, Message as LLMMessage } from "./_core/llm.js";

import { supabase } from "./_core/supabase.js";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "your-secret-key");

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
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
        const { data, error } = await supabase
          .from("boards")
          .insert({
            name: input.name,
            description: input.description || "",
            color: input.color,
            owner_id: ctx.user.id,
          })
          .select("id")
          .single();

        if (error) {
          console.error("[Database] Board creation failed via REST:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Erro ao criar quadro: ${error.message}`,
          });
        }

        return { id: data.id };
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

        if (board.owner_id !== ctx.user.id && ctx.user.role !== 'admin') {
          throw new TRPCError({ code: "FORBIDDEN", message: "Only board owner or admin can update" });
        }

        const updateData: any = {};
        if (input.name) updateData.name = input.name;
        if (input.description !== undefined) updateData.description = input.description;
        if (input.color) updateData.color = input.color;

        const { error } = await supabase.from("boards").update(updateData).eq("id", input.id);
        if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });

        return { success: true };
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const board = await getBoardById(input.id, ctx.user.id);
        if (!board) throw new TRPCError({ code: "NOT_FOUND", message: "Board not found" });

        if (board.owner_id !== ctx.user.id && ctx.user.role !== 'admin') {
          throw new TRPCError({ code: "FORBIDDEN", message: "Only board owner or admin can delete" });
        }

        const { error } = await supabase.from("boards").delete().eq("id", input.id);
        if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });

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

        return { success: true };
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
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
    // Checklist mutations
    toggleChecklist: protectedProcedure
      .input(z.object({ id: z.number(), completed: z.boolean() }))
      .mutation(async ({ input }) => {
        const { error } = await supabase
          .from("card_checklists")
          .update({ completed: input.completed })
          .eq("id", input.id);
        
        if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
        return { success: true };
      }),
    addChecklist: protectedProcedure
      .input(z.object({ cardId: z.number(), title: z.string() }))
      .mutation(async ({ input }) => {
        const { data, error } = await supabase
          .from("card_checklists")
          .insert({ card_id: input.cardId, title: input.title, completed: false })
          .select("id")
          .single();
        
        if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
        return { id: data.id };
      }),
    // Custom Fields mutations
    upsertCustomField: protectedProcedure
      .input(z.object({ 
        cardId: z.number(), 
        fieldName: z.string(), 
        fieldValue: z.string(),
        fieldType: z.enum(["text", "select", "date", "number"]).default("text")
      }))
      .mutation(async ({ input }) => {
        const { error } = await supabase
          .from("card_custom_fields")
          .upsert({ 
            card_id: input.cardId, 
            field_name: input.fieldName, 
            field_value: input.fieldValue,
            field_type: input.fieldType 
          }, { onConflict: 'card_id,field_name' });
        
        if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
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

      const prefs = await db
        .select()
        .from(userPreferences)
        .where(eq(userPreferences.userId, ctx.user.id))
        .limit(1);

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
        const db = await getDb();
        if (!db) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Database not available",
          });
        }

        const updateData: any = {};
        if (input.name) updateData.name = input.name;
        if (input.username) updateData.username = input.username;

        await db
          .update(users)
          .set(updateData)
          .where(eq(users.id, ctx.user.id));

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
    updateDescription: protectedProcedure
      .input(z.object({ cardId: z.number(), description: z.string() }))
      .mutation(async ({ input }) => {
        try {
          const { error } = await supabase
            .from("cards")
            .update({ description: input.description })
            .eq("id", input.cardId);

          if (error) {
            console.error("[Database] Description update failed via Supabase:", error);
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: `Erro ao atualizar descrição: ${error.message}`,
            });
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
  }),

  // Labels, Checklists, Custom Fields and Project Dates
  cardDetails: router({
    updateDescription: protectedProcedure
      .input(z.object({ cardId: z.number(), description: z.string() }))
      .mutation(async ({ input }) => {
        try {
          const { error } = await supabase
            .from("cards")
            .update({ description: input.description })
            .eq("id", input.cardId);

          if (error) {
            console.error("[Database] Description update failed via Supabase:", error);
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: `Erro ao atualizar descrição: ${error.message}`,
            });
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
          .update({ due_date: input.dueDate ? input.dueDate.toISOString() : null })
          .eq("id", input.cardId);

        if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
        return { success: true };
      }),

    updateAssignedTo: protectedProcedure
      .input(z.object({ cardId: z.number(), userId: z.number().nullish() }))
      .mutation(async ({ input }) => {
        const { error } = await supabase
          .from("cards")
          .update({ assigned_to: input.userId })
          .eq("id", input.cardId);

        if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
        return { success: true };
      }),

    archiveCard: protectedProcedure
      .input(z.object({ id: z.number(), archived: z.boolean() }))
      .mutation(async ({ input }) => {
        const { error } = await supabase
          .from("cards")
          .update({ archived: input.archived })
          .eq("id", input.id);

        if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
        return { success: true };
      }),

    getLabels: protectedProcedure
      .input(z.object({ cardId: z.number() }))
      .query(async ({ input }) => {
        return await getCardLabels(input.cardId);
      }),
    addLabel: protectedProcedure
      .input(z.object({ cardId: z.number(), label: z.string(), color: z.string() }))
      .mutation(async ({ input }) => {
        const { data, error } = await supabase
          .from("card_labels")
          .insert({
            card_id: input.cardId,
            label: input.label,
            color: input.color,
          })
          .select("id")
          .single();

        if (error) {
          console.error("[Database] Label creation failed via Supabase:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Erro ao adicionar etiqueta: ${error.message}`,
          });
        }

        return { id: data.id };
      }),
    deleteLabel: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const { error } = await supabase
          .from("card_labels")
          .delete()
          .eq("id", input.id);

        if (error) {
          console.error("[Database] Label deletion failed via Supabase:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Erro ao remover etiqueta: ${error.message}`,
          });
        }

        return { success: true };
      }),

    // Comments Procedures
    getComments: protectedProcedure
      .input(z.object({ cardId: z.number() }))
      .query(async ({ input }) => {
        return await getCardComments(input.cardId);
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
        return { id: data.id };
      }),
    deleteComment: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        // Apenas o dono do comentário ou admin pode deletar
        const { data: comment } = await supabase.from("card_comments").select("user_id").eq("id", input.id).single();
        if (!comment) throw new TRPCError({ code: "NOT_FOUND" });
        if (comment.user_id !== ctx.user.id && ctx.user.role !== 'admin') {
          throw new TRPCError({ code: "FORBIDDEN" });
        }

        const { error } = await supabase.from("card_comments").delete().eq("id", input.id);
        if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
        return { success: true };
      }),

    // Attachments Procedures
    getAttachments: protectedProcedure
      .input(z.object({ cardId: z.number() }))
      .query(async ({ input }) => {
        return await getCardAttachments(input.cardId);
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
        const { data, error } = await supabase
          .from("card_attachments")
          .insert({
            card_id: input.cardId,
            filename: input.filename,
            file_url: input.fileUrl,
            file_key: input.fileKey,
            mime_type: input.mimeType,
            file_size: input.fileSize,
            uploaded_by: ctx.user.id,
          })
          .select("id")
          .single();

        if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
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
        return await getCardChecklists(input.cardId);
      }),
    addChecklist: protectedProcedure
      .input(z.object({ cardId: z.number(), title: z.string(), position: z.number().optional() }))
      .mutation(async ({ input }) => {
        // Get current max position
        const { data: currentItems } = await supabase
          .from("card_checklists")
          .select("position")
          .eq("card_id", input.cardId);
        
        const nextPosition = (currentItems?.length || 0);

        const { data, error } = await supabase
          .from("card_checklists")
          .insert({
            card_id: input.cardId,
            title: input.title,
            position: input.position ?? nextPosition,
            completed: false,
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
      .mutation(async ({ input }) => {
        const updateData: any = {};
        if (input.completed !== undefined) updateData.completed = input.completed;
        if (input.title !== undefined) updateData.title = input.title;
        if (input.dueDate !== undefined) updateData.due_date = input.dueDate ? input.dueDate.toISOString() : null;
        if (input.assignedUserId !== undefined) updateData.assigned_user_id = input.assignedUserId;

        const { error } = await supabase
          .from("card_checklists")
          .update(updateData)
          .eq("id", input.id);

        if (error) {
          console.error("[Database] Checklist update failed via Supabase:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Erro ao atualizar checklist: ${error.message}`,
          });
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
            project_start_date: input.startDate ? input.startDate.toISOString() : null,
            project_end_date: input.endDate ? input.endDate.toISOString() : null,
          }, { onConflict: 'card_id' });

        if (error) {
          console.error("[Database] Project dates upsert failed via Supabase:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Erro ao atualizar datas: ${error.message}`,
          });
        }

        return { success: true };
      }),

    getMirroredCards: protectedProcedure
      .input(z.object({ boardId: z.number() }))
      .query(async ({ input }) => {
        const { data, error } = await supabase
          .from("mirrored_cards")
          .select("*")
          .or(`original_board_id.eq.${input.boardId},mirror_board_id.eq.${input.boardId}`);
        
        if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
        return data || [];
      }),
    createMirror: protectedProcedure
      .input(z.object({ 
        cardId: z.number(), 
        targetListId: z.number(),
        targetBoardId: z.number()
      }))
      .mutation(async ({ ctx, input }) => {
        // 1. Get original card data
        const { data: originalCard, error: cardError } = await supabase
          .from("cards")
          .select("*")
          .eq("id", input.cardId)
          .single();

        if (cardError || !originalCard) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Cartão original não encontrado" });
        }

        // 2. Get original list to find its boardId
        const { data: originalList, error: listError } = await supabase
          .from("lists")
          .select("board_id")
          .eq("id", originalCard.list_id)
          .single();

        if (listError || !originalList) {
          console.error("[Mirror] Original list fetch error:", listError);
          throw new TRPCError({ code: "NOT_FOUND", message: "Lista original não encontrada" });
        }

        // 3. Get original board name for the title
        const { data: originalBoard } = await supabase
          .from("boards")
          .select("name")
          .eq("id", originalList.board_id)
          .single();

        const originName = originalBoard?.name || "Desconhecido";

        // 4. Create new card in target list
        const { data: mirrorCard, error: mirrorError } = await supabase
          .from("cards")
          .insert({
            title: `${originalCard.title} (Mirror: ${originName})`,
            description: originalCard.description,
            list_id: input.targetListId,
            position: 0,
            created_by: ctx.user.id
          })
          .select("id")
          .single();

        if (mirrorError) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Erro ao criar espelho: ${mirrorError.message}` });
        }

        // 5. Create link in mirrored_cards table
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

        return { success: true, mirrorId: mirrorCard.id };
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
      
      const [boardsCount] = await db.select({ count: z.any() as any }).from(boards);
      const [cardsCount] = await db.select({ count: z.any() as any }).from(cards);
      const [usersCount] = await db.select({ count: z.any() as any }).from(users);
      
      return {
        totalBoards: Number(boardsCount?.count || 0),
        totalCards: Number(cardsCount?.count || 0),
        totalUsers: Number(usersCount?.count || 0),
      };
    }),
  }),

  // AI Chat Assistant
  ai: router({
    chat: protectedProcedure
      .input(z.object({
        messages: z.array(z.object({
          role: z.enum(["user", "assistant", "system"]),
          content: z.string(),
        }))
      }))
      .mutation(async ({ input }) => {
        const response = await invokeLLM({
          messages: input.messages as LLMMessage[],
        });
        
        const content = response.choices[0]?.message?.content;
        if (typeof content !== "string") {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Unexpected AI response format",
          });
        }
        
        return content;
      }),
  }),
});


export type AppRouter = typeof appRouter;
