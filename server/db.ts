import { eq, or, and, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  users,
  boards,
  boardMembers,
  lists,
  cards,
  mirroredCards,
  cardAttachments,
  notifications,
  userPreferences,
  cardLabels,
  cardChecklists,
  cardCustomFields,
  projectDates,
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// Board queries
export async function getUserBoards(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db
    .select()
    .from(boards)
    .where(
      or(
        eq(boards.ownerId, userId),
        inArray(
          boards.id,
          db.select({ id: boardMembers.boardId }).from(boardMembers).where(eq(boardMembers.userId, userId))
        )
      )
    );
  return result;
}

export async function getBoardById(boardId: number, userId: number) {
  const db = await getDb();
  if (!db) return null;
  
  // Check if user has access to this board
  const board = await db.select().from(boards).where(eq(boards.id, boardId)).limit(1);
  if (!board.length) return null;
  
  const isOwner = board[0].ownerId === userId;
  const isMember = await db
    .select()
    .from(boardMembers)
    .where(and(eq(boardMembers.boardId, boardId), eq(boardMembers.userId, userId)))
    .limit(1);
  
  if (!isOwner && !isMember.length) return null;
  return board[0];
}

export async function getBoardMembers(boardId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db
    .select({
      id: boardMembers.id,
      userId: boardMembers.userId,
      role: boardMembers.role,
      userName: users.name,
      userEmail: users.email,
    })
    .from(boardMembers)
    .leftJoin(users, eq(boardMembers.userId, users.id))
    .where(eq(boardMembers.boardId, boardId));
}

// List queries
export async function getBoardLists(boardId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db
    .select()
    .from(lists)
    .where(eq(lists.boardId, boardId))
    .orderBy(lists.position);
}

// Card queries
export async function getListCards(listId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db
    .select({
      id: cards.id,
      listId: cards.listId,
      title: cards.title,
      description: cards.description,
      position: cards.position,
      dueDate: cards.dueDate,
      assignedTo: cards.assignedTo,
      assignedToName: users.name,
      createdBy: cards.createdBy,
      createdAt: cards.createdAt,
      updatedAt: cards.updatedAt,
    })
    .from(cards)
    .leftJoin(users, eq(cards.assignedTo, users.id))
    .where(eq(cards.listId, listId))
    .orderBy(cards.position);
}

export async function getCardById(cardId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db
    .select()
    .from(cards)
    .where(eq(cards.id, cardId))
    .limit(1);
  
  return result.length > 0 ? result[0] : null;
}

// Mirrored cards queries
export async function getMirroredCards(cardId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db
    .select()
    .from(mirroredCards)
    .where(or(eq(mirroredCards.originalCardId, cardId), eq(mirroredCards.mirrorCardId, cardId)));
}

// TODO: add more feature queries here as your schema grows.

// Card Labels queries
export async function getCardLabels(cardId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(cardLabels).where(eq(cardLabels.cardId, cardId));
}

export async function addCardLabel(cardId: number, label: string, color: string = "#4b4897") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.insert(cardLabels).values({ cardId, label, color });
}

export async function deleteCardLabel(labelId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.delete(cardLabels).where(eq(cardLabels.id, labelId));
}

// Card Checklist queries
export async function getCardChecklists(cardId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(cardChecklists).where(eq(cardChecklists.cardId, cardId)).orderBy(cardChecklists.position);
}

export async function addCardChecklist(cardId: number, title: string, position: number = 0) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.insert(cardChecklists).values({ cardId, title, position, completed: 0 });
}

export async function updateCardChecklist(checklistId: number, completed: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.update(cardChecklists).set({ completed }).where(eq(cardChecklists.id, checklistId));
}

export async function deleteCardChecklist(checklistId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.delete(cardChecklists).where(eq(cardChecklists.id, checklistId));
}

// Card Custom Fields queries
export async function getCardCustomFields(cardId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(cardCustomFields).where(eq(cardCustomFields.cardId, cardId));
}

export async function addCardCustomField(cardId: number, fieldName: string, fieldValue: string, fieldType: "text" | "select" | "date" | "number" = "text") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.insert(cardCustomFields).values({ cardId, fieldName, fieldValue, fieldType });
}

export async function updateCardCustomField(fieldId: number, fieldValue: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.update(cardCustomFields).set({ fieldValue }).where(eq(cardCustomFields.id, fieldId));
}

export async function deleteCardCustomField(fieldId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.delete(cardCustomFields).where(eq(cardCustomFields.id, fieldId));
}

// Project Dates queries
export async function getProjectDate(cardId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(projectDates).where(eq(projectDates.cardId, cardId)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function upsertProjectDate(cardId: number, projectStartDate?: Date, projectEndDate?: Date) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const existing = await getProjectDate(cardId);
  if (existing) {
    return await db.update(projectDates).set({ projectStartDate, projectEndDate }).where(eq(projectDates.cardId, cardId));
  } else {
    return await db.insert(projectDates).values({ cardId, projectStartDate, projectEndDate });
  }
}
