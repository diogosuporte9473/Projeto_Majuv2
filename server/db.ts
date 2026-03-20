import { eq, or, and, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
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
} from "../drizzle/schema.js";
import { InsertCard } from "../drizzle/schema.js";
import { ENV } from './_core/env.js';
import { supabase } from "./_core/supabase.js";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      // DEBUG: Log the database URL format to check Vercel env vars
      const urlForLogging = process.env.DATABASE_URL.replace(/:([^:]+)@/, ':[REDACTED]@');
      console.log("[Database] Attempting to connect with URL format:", urlForLogging);

      console.log("[Database] Connecting to:", process.env.DATABASE_URL.split('@')[1] || "local");
      const queryClient = postgres(process.env.DATABASE_URL, {
        connect_timeout: 10,
        max: 10,
        prepare: false, // Necessário para modo Transaction do Supavisor/PgBouncer
      });
      _db = drizzle(queryClient);
    } catch (error) {
      console.error("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.username) {
    throw new Error("Username is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      username: user.username,
      password: user.password,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "password"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      
      // password cannot be null in the database schema
      if (field === "password") {
        if (value === null) return; // skip if null
        values.password = value;
        updateSet.password = value;
      } else {
        const normalized = value ?? null;
        values[field] = normalized;
        updateSet[field] = normalized;
      }
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onConflictDoUpdate({
      target: users.username,
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByUsername(username: string) {
  try {
    // MÉTODO SIMPLES: Usar a API REST do Supabase em vez de conexão direta Postgres
    // Isso evita o erro "Tenant or user not found" definitivamente
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("username", username)
      .maybeSingle();

    if (error) {
      console.error("[Database] Error fetching user via REST:", error);
      // Fallback para Drizzle apenas se necessário
      const db = await getDb();
      if (!db) return undefined;
      const results = await db.select().from(users).where(eq(users.username, username)).limit(1);
      return results[0] || undefined;
    }

    return (data as any) || undefined;
  } catch (error) {
    console.error("[Database] getUserByUsername failed:", error);
    return undefined;
  }
}

export async function getUserById(id: number) {
  try {
    // MÉTODO SIMPLES: Usar a API REST do Supabase para evitar erro de conexão TCP
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.error("[Database] Error fetching user by ID via REST:", error);
      // Fallback para Drizzle
      const db = await getDb();
      if (!db) return undefined;
      const results = await db.select().from(users).where(eq(users.id, id)).limit(1);
      return results[0] || undefined;
    }

    return (data as any) || undefined;
  } catch (error) {
    console.error("[Database] getUserById failed:", error);
    return undefined;
  }
}

// Board queries
export async function getUserBoards(userId: number) {
  try {
    // 1. Buscar IDs dos boards onde o usuário é membro
    const { data: memberships } = await supabase
      .from("board_members")
      .select("boardId")
      .eq("userId", userId);

    const boardIds = memberships?.map(m => m.boardId) || [];

    // 2. Buscar boards onde o usuário é dono OU é membro
    let query = supabase.from("boards").select("*");
    
    if (boardIds.length > 0) {
      query = query.or(`ownerId.eq.${userId},id.in.(${boardIds.join(",")})`);
    } else {
      query = query.eq("ownerId", userId);
    }

    const { data, error } = await query;

    if (error) {
      console.error("[Database] Error fetching boards via REST:", error);
      return [];
    }

    return (data as any[]) || [];
  } catch (error) {
    console.error("[Database] getUserBoards failed:", error);
    return [];
  }
}

export async function getBoardById(boardId: number, userId: number) {
  try {
    // MÉTODO SIMPLES: Usar API REST para evitar erro de conexão TCP
    const { data: board, error: boardError } = await supabase
      .from("boards")
      .select("*")
      .eq("id", boardId)
      .maybeSingle();

    if (boardError || !board) return null;

    const isOwner = board.ownerId === userId;
    
    const { data: membership, error: memberError } = await supabase
      .from("board_members")
      .select("*")
      .eq("boardId", boardId)
      .eq("userId", userId)
      .maybeSingle();

    if (!isOwner && !membership) return null;
    return board as any;
  } catch (error) {
    console.error("[Database] getBoardById failed:", error);
    return null;
  }
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
      userUsername: users.username,
    })
    .from(boardMembers)
    .leftJoin(users, eq(boardMembers.userId, users.id))
    .where(eq(boardMembers.boardId, boardId));
}

// List queries
export async function getBoardLists(boardId: number) {
  try {
    const { data, error } = await supabase
      .from("lists")
      .select("*")
      .eq("boardId", boardId)
      .order("position");

    if (error) {
      console.error("[Database] Error fetching lists via REST:", error);
      const db = await getDb();
      if (!db) return [];
      return await db.select().from(lists).where(eq(lists.boardId, boardId)).orderBy(lists.position);
    }

    return (data as any[]) || [];
  } catch (error) {
    console.error("[Database] getBoardLists failed:", error);
    return [];
  }
}

// Card queries
export async function getListCards(listId: number) {
  try {
    const { data, error } = await supabase
      .from("cards")
      .select("*, assignedToUser:users!assignedTo(name)")
      .eq("listId", listId)
      .order("position");

    if (error) {
      console.error("[Database] Error fetching cards via REST:", error);
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

    // Adaptar formato para o que o frontend espera (assignedToName)
    return (data as any[]).map(card => ({
      ...card,
      assignedToName: card.assignedToUser?.name || null
    })) || [];
  } catch (error) {
    console.error("[Database] getListCards failed:", error);
    return [];
  }
}

export async function getCardById(cardId: number) {
  try {
    const { data, error } = await supabase
      .from("cards")
      .select("*")
      .eq("id", cardId)
      .maybeSingle();

    if (error) {
      console.error("[Database] Error fetching card via REST:", error);
      const db = await getDb();
      if (!db) return null;
      const result = await db.select().from(cards).where(eq(cards.id, cardId)).limit(1);
      return result.length > 0 ? result[0] : null;
    }
    return data || null;
  } catch (error) {
    console.error("[Database] getCardById failed:", error);
    return null;
  }
}

// Card Labels queries
export async function getCardLabels(cardId: number) {
  try {
    const { data, error } = await supabase
      .from("card_labels")
      .select("*")
      .eq("cardId", cardId);

    if (error) {
      console.error("[Database] Error fetching labels via REST:", error);
      const db = await getDb();
      if (!db) return [];
      return await db.select().from(cardLabels).where(eq(cardLabels.cardId, cardId));
    }
    return data || [];
  } catch (error) {
    return [];
  }
}

// Card Checklist queries
export async function getCardChecklists(cardId: number) {
  try {
    const { data, error } = await supabase
      .from("card_checklists")
      .select("*")
      .eq("cardId", cardId)
      .order("position");

    if (error) {
      console.error("[Database] Error fetching checklists via REST:", error);
      const db = await getDb();
      if (!db) return [];
      return await db.select().from(cardChecklists).where(eq(cardChecklists.cardId, cardId)).orderBy(cardChecklists.position);
    }
    return data || [];
  } catch (error) {
    return [];
  }
}

// Card Custom Fields queries
export async function getCardCustomFields(cardId: number) {
  try {
    const { data, error } = await supabase
      .from("card_custom_fields")
      .select("*")
      .eq("cardId", cardId);

    if (error) {
      console.error("[Database] Error fetching custom fields via REST:", error);
      const db = await getDb();
      if (!db) return [];
      return await db.select().from(cardCustomFields).where(eq(cardCustomFields.cardId, cardId));
    }
    return data || [];
  } catch (error) {
    return [];
  }
}

// Board members queries
export async function getBoardMembers(boardId: number) {
  try {
    const { data, error } = await supabase
      .from("board_members")
      .select("*, user:users(*)")
      .eq("boardId", boardId);

    if (error) {
      console.error("[Database] Error fetching board members via REST:", error);
      const db = await getDb();
      if (!db) return [];
      return await db
        .select({
          id: boardMembers.id,
          boardId: boardMembers.boardId,
          userId: boardMembers.userId,
          role: boardMembers.role,
          joinedAt: boardMembers.joinedAt,
          user: users,
        })
        .from(boardMembers)
        .leftJoin(users, eq(boardMembers.userId, users.id))
        .where(eq(boardMembers.boardId, boardId));
    }

    return (data as any[]).map(m => ({
      ...m,
      user: m.user
    })) || [];
  } catch (error) {
    return [];
  }
}

// Mirrored cards queries
export async function getMirroredCards(cardId: number) {
  try {
    const { data, error } = await supabase
      .from("mirrored_cards")
      .select("*")
      .or(`originalCardId.eq.${cardId},mirrorCardId.eq.${cardId}`);

    if (error) {
      const db = await getDb();
      if (!db) return [];
      return await db
        .select()
        .from(mirroredCards)
        .where(or(eq(mirroredCards.originalCardId, cardId), eq(mirroredCards.mirrorCardId, cardId)));
    }
    return data || [];
  } catch (error) {
    return [];
  }
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

export async function updateCard(cardId: number, data: Partial<InsertCard>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.update(cards).set(data).where(eq(cards.id, cardId));
}

export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(users);
}

export async function updateUserRole(userId: number, role: "admin" | "user") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.update(users).set({ role }).where(eq(users.id, userId));
}
