import { COOKIE_NAME } from "../shared/const.js";
import { and } from "drizzle-orm";
import { getSessionCookieOptions } from "./_core/cookies.js";
import { systemRouter } from "./_core/systemRouter.js";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc.js";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import * as bcrypt from "bcryptjs";
import { SignJWT } from "jose";
import {
  getUserBoards,
  getBoardById,
  getBoardMembers,
  getBoardLists,
  getListCards,
  getCardById,
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
} from "../drizzle/schema.js";
import { invokeLLM, Message as LLMMessage } from "./_core/llm.js";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "your-secret-key");

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => {
      if (!opts.ctx.user) return null;
      const { password, ...userWithoutPassword } = opts.ctx.user;
      return userWithoutPassword;
    }),
    login: publicProcedure
      .input(z.object({ username: z.string(), password: z.string() }))
      .mutation(async ({ input, ctx }) => {
        const user = await getUserByUsername(input.username);
        if (!user) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "User not found" });
        }

        const valid = await bcrypt.compare(input.password, user.password);
        if (!valid) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid password" });
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
      .input(z.object({ username: z.string(), password: z.string(), name: z.string().optional() }))
      .mutation(async ({ input, ctx }) => {
        const existing = await getUserByUsername(input.username);
        if (existing) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Username already exists" });
        }

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
        const db = await getDb();
        if (!db) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Database not available",
          });
        }

        const result = await db.insert(boards).values({
          name: input.name,
          description: input.description,
          color: input.color,
          ownerId: ctx.user.id,
        });

        return { id: (result as any).insertId };
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

        const boardLists = await getBoardLists(input.boardId);
        const position = boardLists.length;

        const result = await db.insert(lists).values({
          boardId: input.boardId,
          name: input.name,
          position,
        });

        return { id: (result as any).insertId };
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
        const db = await getDb();
        if (!db) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Database not available",
          });
        }

        const cardList = await db.select().from(lists).where(eq(lists.id, input.listId)).limit(1);
        if (!cardList.length) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "List not found",
          });
        }

        const listCards = await getListCards(input.listId);
        const position = listCards.length;

        const result = await db.insert(cards).values({
          listId: input.listId,
          title: input.title,
          description: input.description,
          position,
          dueDate: input.dueDate,
          createdBy: ctx.user.id,
        });

        return { id: (result as any).insertId };
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
        const db = await getDb();
        if (!db) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Database not available",
          });
        }

        const card = await getCardById(input.id);
        if (!card) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Card not found",
          });
        }

        const updateData: any = {};
        if (input.title) updateData.title = input.title;
        if (input.description !== undefined) updateData.description = input.description;
        if (input.dueDate) updateData.dueDate = input.dueDate;
        if (input.assignedTo !== undefined) updateData.assignedTo = input.assignedTo;

        await db.update(cards).set(updateData).where(eq(cards.id, input.id));

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

        const card = await getCardById(input.id);
        if (!card) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Card not found",
          });
        }

        await db.delete(cards).where(eq(cards.id, input.id));

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
        const db = await getDb();
        if (!db) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Database not available",
          });
        }

        const card = await getCardById(input.cardId);
        if (!card) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Card not found",
          });
        }

        await db
          .update(cards)
          .set({
            listId: input.newListId,
            position: input.newPosition,
          })
          .where(eq(cards.id, input.cardId));

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
        .input(z.object({ username: z.string(), password: z.string(), name: z.string() }))
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
