import { COOKIE_NAME } from "@shared/const";
import { and } from "drizzle-orm";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import {
  getUserBoards,
  getBoardById,
  getBoardMembers,
  getBoardLists,
  getListCards,
  getCardById,
  getMirroredCards,
} from "./db";
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
} from "../drizzle/schema";
import { getDb } from "./db";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
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
        emailOnCardAssigned: prefs[0].emailOnCardAssigned === 1,
        emailOnCardUpdated: prefs[0].emailOnCardUpdated === 1,
        emailOnMirroredCard: prefs[0].emailOnMirroredCard === 1,
        emailOnDueDate: prefs[0].emailOnDueDate === 1,
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
            emailOnCardAssigned: input.emailOnCardAssigned ? 1 : 0,
            emailOnCardUpdated: input.emailOnCardUpdated ? 1 : 0,
            emailOnMirroredCard: input.emailOnMirroredCard ? 1 : 0,
            emailOnDueDate: input.emailOnDueDate ? 1 : 0,
          });
        } else {
          const updateData: any = {};
          if (input.emailOnCardAssigned !== undefined)
            updateData.emailOnCardAssigned = input.emailOnCardAssigned ? 1 : 0;
          if (input.emailOnCardUpdated !== undefined)
            updateData.emailOnCardUpdated = input.emailOnCardUpdated ? 1 : 0;
          if (input.emailOnMirroredCard !== undefined)
            updateData.emailOnMirroredCard = input.emailOnMirroredCard ? 1 : 0;
          if (input.emailOnDueDate !== undefined)
            updateData.emailOnDueDate = input.emailOnDueDate ? 1 : 0;

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
          email: z.string().email().optional(),
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
        if (input.email) updateData.email = input.email;

        await db
          .update(users)
          .set(updateData)
          .where(eq(users.id, ctx.user.id));

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
        return await db.select().from(users);
      }),
      
      create: protectedProcedure
        .input(z.object({ email: z.string().email(), name: z.string() }))
        .mutation(async ({ ctx, input }) => {
          if (ctx.user.role !== 'admin') {
            throw new TRPCError({ code: 'FORBIDDEN' });
          }
          const db = await getDb();
          if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
          
          await db.insert(users).values({
            openId: `temp-${Date.now()}`,
            email: input.email,
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
          }).onDuplicateKeyUpdate({
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
});


export type AppRouter = typeof appRouter;
