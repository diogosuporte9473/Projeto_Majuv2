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
        (values as any)[field] = normalized;
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
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("role")
      .eq("id", userId)
      .maybeSingle();

    if (userError) {
      console.error("[Database] Error checking user role:", userError);
      return [];
    }

    if (user?.role === "admin") {
      const { data, error } = await supabase
        .from("boards")
        .select("*");
      
      if (error) {
        console.error("[Database] Error fetching all boards for admin:", error);
        return [];
      }
      return (data as any[]) || [];
    }

    const { data: memberships } = await supabase
      .from("board_members")
      .select("board_id")
      .eq("user_id", userId);

    const boardIds = memberships?.map(m => m.board_id) || [];

    let query = supabase.from("boards").select("*");
    
    if (boardIds.length > 0) {
      query = query.or(`owner_id.eq.${userId},id.in.(${boardIds.join(",")})`);
    } else {
      query = query.eq("owner_id", userId);
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
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("role")
      .eq("id", userId)
      .maybeSingle();

    if (userError) {
      console.error("[Database] Error checking user role for board access:", userError);
      return null;
    }

    const { data: board, error: boardError } = await supabase
      .from("boards")
      .select("*")
      .eq("id", boardId)
      .maybeSingle();

    if (boardError || !board) return null;

    // Se for ADMIN, tem acesso total
    if (user?.role === "admin") return board as any;

    const isOwner = board.owner_id === userId;
    
    const { data: membership, error: memberError } = await supabase
      .from("board_members")
      .select("*")
      .eq("board_id", boardId)
      .eq("user_id", userId)
      .maybeSingle();

    if (!isOwner && !membership) return null;
    return board as any;
  } catch (error) {
    console.error("[Database] getBoardById failed:", error);
    return null;
  }
}

// List queries
export async function getBoardLists(boardId: number) {
  try {
    const { data, error } = await supabase
      .from("lists")
      .select("*")
      .eq("board_id", boardId)
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
      .select("*, assignedToUser:users!assigned_to(name)")
      .eq("list_id", listId)
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
      console.error("[Database] Error fetching card by ID via REST:", error);
      const db = await getDb();
      if (!db) return null;
      const results = await db.select().from(cards).where(eq(cards.id, cardId)).limit(1);
      return results[0] || null;
    }

    return (data as any) || null;
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
      .eq("card_id", cardId);

    if (error) {
      console.error("[Database] Error fetching card labels via REST:", error);
      const db = await getDb();
      if (!db) return [];
      return await db.select().from(cardLabels).where(eq(cardLabels.cardId, cardId));
    }

    return (data as any[]) || [];
  } catch (error) {
    console.error("[Database] getCardLabels failed:", error);
    return [];
  }
}

// Card Checklist queries
export async function getCardChecklists(cardId: number) {
  try {
    const { data, error } = await supabase
      .from("card_checklists")
      .select("*")
      .eq("card_id", cardId)
      .order("position");

    if (error) {
      console.error("[Database] Error fetching card checklists via REST:", error);
      const db = await getDb();
      if (!db) return [];
      return await db.select().from(cardChecklists).where(eq(cardChecklists.cardId, cardId)).orderBy(cardChecklists.position);
    }

    return (data as any[]) || [];
  } catch (error) {
    console.error("[Database] getCardChecklists failed:", error);
    return [];
  }
}

// Card Custom Fields queries
export async function getCardCustomFields(cardId: number) {
  try {
    const { data, error } = await supabase
      .from("card_custom_fields")
      .select("*")
      .eq("card_id", cardId);

    if (error) {
      console.error("[Database] Error fetching card custom fields via REST:", error);
      const db = await getDb();
      if (!db) return [];
      return await db.select().from(cardCustomFields).where(eq(cardCustomFields.cardId, cardId));
    }

    return (data as any[]) || [];
  } catch (error) {
    console.error("[Database] getCardCustomFields failed:", error);
    return [];
  }
}

// Board members queries
export async function getBoardMembers(boardId: number) {
  try {
    const { data, error } = await supabase
      .from("board_members")
      .select("*, user:users(*)")
      .eq("board_id", boardId);

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
export async function getMirroredCards(boardId: number) {
  try {
    const { data, error } = await supabase
      .from("mirrored_cards")
      .select("*")
      .or(`original_board_id.eq.${boardId},mirror_board_id.eq.${boardId}`);

    if (error) {
      console.error("[Database] Error fetching mirrored cards via REST:", error);
      const db = await getDb();
      if (!db) return [];
      return await db.select().from(mirroredCards).where(or(eq(mirroredCards.originalBoardId, boardId), eq(mirroredCards.mirrorBoardId, boardId)));
    }

    return (data as any[]) || [];
  } catch (error) {
    console.error("[Database] getMirroredCards failed:", error);
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
