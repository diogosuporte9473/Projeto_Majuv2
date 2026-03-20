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
        if (!board) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Board not found",
          });
        }
        return board;
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
            ownerId: ctx.user.id,
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
        const db = await getDb();
        if (!db) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Database not available",
          });
        }

        const board = await getBoardById(input.id, ctx.user.id);
        if (!board) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Board not found",
          });
        }

        if (board.ownerId !== ctx.user.id) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Only board owner can update",
          });
        }

        const updateData: any = {};
        if (input.name) updateData.name = input.name;
        if (input.description !== undefined) updateData.description = input.description;
        if (input.color) updateData.color = input.color;

        await db.update(boards).set(updateData).where(eq(boards.id, input.id));

        return { success: true };
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Database not available",
          });
        }

        const board = await getBoardById(input.id, ctx.user.id);
        if (!board) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Board not found",
          });
        }

        if (board.ownerId !== ctx.user.id) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Only board owner can delete",
          });
        }

        await db.delete(boards).where(eq(boards.id, input.id));

        return { success: true };
      }),
    getMembers: protectedProcedure
      .input(z.object({ boardId: z.number() }))
      .query(async ({ ctx, input }) => {
        const board = await getBoardById(input.boardId, ctx.user.id);
        if (!board) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Board not found",
          });
        }
        return await getBoardMembers(input.boardId);
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
        const db = await getDb();
        if (!db) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Database not available",
          });
        }

        const board = await getBoardById(input.boardId, ctx.user.id);
        if (!board) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Board not found",
          });
        }

        if (board.ownerId !== ctx.user.id) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Only board owner can add members",
          });
        }

        await db.insert(boardMembers).values({
          boardId: input.boardId,
          userId: input.userId,
          role: input.role,
        });

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
            boardId: input.boardId,
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
              listId: input.listId,
              title: input.title,
              description: input.description || "",
              position,
              dueDate: input.dueDate ? input.dueDate.toISOString() : null,
              createdBy: ctx.user?.id || null, // Permite nulo se não houver usuário na sessão
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
        if (input.dueDate) updateData.dueDate = input.dueDate.toISOString();
        if (input.assignedTo !== undefined) updateData.assignedTo = input.assignedTo;

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
            listId: input.newListId,
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
          .insert({ cardId: input.cardId, title: input.title, completed: false })
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
            cardId: input.cardId, 
            fieldName: input.fieldName, 
            fieldValue: input.fieldValue,
            fieldType: input.fieldType 
          }, { onConflict: 'cardId,fieldName' });
        
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
        const db = await getDb();
        if (!db) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Database not available",
          });
        }

        const existing = await db
          .select()
          .from(userPreferences)
          .where(eq(userPreferences.userId, ctx.user.id))
          .limit(1);

        if (existing.length === 0) {
          await db.insert(userPreferences).values({
            userId: ctx.user.id,
            emailOnCardAssigned: input.emailOnCardAssigned ?? true,
            emailOnCardUpdated: input.emailOnCardUpdated ?? true,
            emailOnMirroredCard: input.emailOnMirroredCard ?? true,
            emailOnDueDate: input.emailOnDueDate ?? true,
          });
        } else {
          const updateData: any = {};
          if (input.emailOnCardAssigned !== undefined)
            updateData.emailOnCardAssigned = input.emailOnCardAssigned;
          if (input.emailOnCardUpdated !== undefined)
            updateData.emailOnCardUpdated = input.emailOnCardUpdated;
          if (input.emailOnMirroredCard !== undefined)
            updateData.emailOnMirroredCard = input.emailOnMirroredCard;
          if (input.emailOnDueDate !== undefined)
            updateData.emailOnDueDate = input.emailOnDueDate;

          await db
            .update(userPreferences)
            .set(updateData)
            .where(eq(userPreferences.userId, ctx.user.id));
        }

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
  }),

  // Labels, Checklists, Custom Fields and Project Dates
  cardDetails: router({
    getLabels: protectedProcedure
      .input(z.object({ cardId: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        return await db.select().from(cardLabels).where(eq(cardLabels.cardId, input.cardId));
      }),
    addLabel: protectedProcedure
      .input(z.object({ cardId: z.number(), label: z.string(), color: z.string().optional() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        return await db.insert(cardLabels).values({
          cardId: input.cardId,
          label: input.label,
          color: input.color || "#4b4897",
        });
      }),
    deleteLabel: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        return await db.delete(cardLabels).where(eq(cardLabels.id, input.id));
      }),

    getChecklists: protectedProcedure
      .input(z.object({ cardId: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        return await db
          .select()
          .from(cardChecklists)
          .where(eq(cardChecklists.cardId, input.cardId))
          .orderBy(cardChecklists.position);
      }),
    addChecklist: protectedProcedure
      .input(z.object({ cardId: z.number(), title: z.string(), position: z.number().optional() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        return await db.insert(cardChecklists).values({
          cardId: input.cardId,
          title: input.title,
          position: input.position || 0,
          completed: false,
        });
      }),

    getMirroredCards: protectedProcedure
      .input(z.object({ boardId: z.number() }))
      .query(async ({ input }) => {
        return await getMirroredCards(input.boardId);
      }),
    updateChecklist: protectedProcedure
      .input(z.object({ id: z.number(), completed: z.boolean() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        return await db
          .update(cardChecklists)
          .set({ completed: input.completed })
          .where(eq(cardChecklists.id, input.id));
      }),
    deleteChecklist: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        return await db.delete(cardChecklists).where(eq(cardChecklists.id, input.id));
      }),

    getCustomFields: protectedProcedure
      .input(z.object({ cardId: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        return await db.select().from(cardCustomFields).where(eq(cardCustomFields.cardId, input.cardId));
      }),
    addCustomField: protectedProcedure
      .input(z.object({
        cardId: z.number(),
        fieldName: z.string(),
        fieldValue: z.string(),
        fieldType: z.enum(["text", "select", "date", "number"]).optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        return await db.insert(cardCustomFields).values({
          cardId: input.cardId,
          fieldName: input.fieldName,
          fieldValue: input.fieldValue,
          fieldType: input.fieldType || "text",
        });
      }),
    deleteCustomField: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        return await db.delete(cardCustomFields).where(eq(cardCustomFields.id, input.id));
      }),

    getProjectDates: protectedProcedure
      .input(z.object({ cardId: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return null;
        const result = await db.select().from(projectDates).where(eq(projectDates.cardId, input.cardId)).limit(1);
        return result.length > 0 ? result[0] : null;
      }),
    upsertProjectDates: protectedProcedure
      .input(z.object({
        cardId: z.number(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        
        const existing = await db.select().from(projectDates).where(eq(projectDates.cardId, input.cardId)).limit(1);
        if (existing.length > 0) {
          return await db.update(projectDates)
            .set({ projectStartDate: input.startDate, projectEndDate: input.endDate })
            .where(eq(projectDates.cardId, input.cardId));
        } else {
          return await db.insert(projectDates).values({
            cardId: input.cardId,
            projectStartDate: input.startDate,
            projectEndDate: input.endDate,
          });
        }
      }),
    updateDescription: protectedProcedure
      .input(z.object({ cardId: z.number(), description: z.string() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await db.update(cards).set({ description: input.description }).where(eq(cards.id, input.cardId));
        return { success: true };
      }),
  }),

  // Admin routers - User management
  admin: router({
    users: router({
      list: protectedProcedure.query(async ({ ctx }) => {
        if (ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        const db = await getDb();
        if (!db) return [];
        const result = await db.select().from(users);
        return result.map(({ password, ...u }) => u);
      }),
      
      create: protectedProcedure
        .input(z.object({ 
          username: z.string(), 
          password: z.string(), 
          name: z.string()
        }))
        .mutation(async ({ ctx, input }) => {
          if (ctx.user.role !== 'admin') {
            throw new TRPCError({ code: 'FORBIDDEN' });
          }
          const db = await getDb();
          if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
          
          const hashedPassword = await bcrypt.hash(input.password, 10);
          await db.insert(users).values({
            username: input.username,
            password: hashedPassword,
            name: input.name,
            role: 'user',
          });
          return { success: true };
        }),
      
      updateRole: protectedProcedure
        .input(z.object({ userId: z.number(), role: z.enum(['admin', 'user']) }))
        .mutation(async ({ ctx, input }) => {
          if (ctx.user.role !== 'admin') {
            throw new TRPCError({ code: 'FORBIDDEN' });
          }
          const db = await getDb();
          if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
          
          await db.update(users).set({ role: input.role }).where(eq(users.id, input.userId));
          return { success: true };
        }),
    }),
    
    permissions: router({
      getByBoard: protectedProcedure
        .input(z.object({ boardId: z.number() }))
        .query(async ({ ctx, input }) => {
          if (ctx.user.role !== 'admin') {
            throw new TRPCError({ code: 'FORBIDDEN' });
          }
          const db = await getDb();
          if (!db) return [];
          return await db.select().from(boardMembers).where(eq(boardMembers.boardId, input.boardId));
        }),
      
      grant: protectedProcedure
        .input(z.object({ boardId: z.number(), userId: z.number(), role: z.enum(['viewer', 'editor', 'admin']) }))
        .mutation(async ({ ctx, input }) => {
          if (ctx.user.role !== 'admin') {
            throw new TRPCError({ code: 'FORBIDDEN' });
          }
          const db = await getDb();
          if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
          
          await db.insert(boardMembers).values({
            boardId: input.boardId,
            userId: input.userId,
            role: input.role,
          }).onConflictDoUpdate({
            target: [boardMembers.id],
            set: { role: input.role },
          });
          return { success: true };
        }),
      
      revoke: protectedProcedure
        .input(z.object({ boardId: z.number(), userId: z.number() }))
        .mutation(async ({ ctx, input }) => {
          if (ctx.user.role !== 'admin') {
            throw new TRPCError({ code: 'FORBIDDEN' });
          }
          const db = await getDb();
          if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
          
          await db.delete(boardMembers)
            .where(and(eq(boardMembers.boardId, input.boardId), eq(boardMembers.userId, input.userId)));
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
