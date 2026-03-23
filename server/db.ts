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

    if (!data) return undefined;

    return {
      ...data,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      lastSignedIn: data.last_signed_in
    } as any;
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

    if (!data) return undefined;

    return {
      ...data,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      lastSignedIn: data.last_signed_in
    } as any;
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

    let data: any[] | null = null;
    let error: any = null;

    if (user?.role === "admin") {
      const { data: adminData, error: adminError } = await supabase
        .from("boards")
        .select("*")
        .order("created_at", { ascending: false });
      
      data = adminData;
      error = adminError;
    } else {
      const { data: memberships } = await supabase
        .from("board_members")
        .select("board_id")
        .eq("user_id", userId);

      const boardIds = memberships?.map(m => m.board_id) || [];

      let query = supabase.from("boards").select("*").order("created_at", { ascending: false });
      
      if (boardIds.length > 0) {
        query = query.or(`owner_id.eq.${userId},id.in.(${boardIds.join(",")})`);
      } else {
        query = query.eq("owner_id", userId);
      }

      const { data: userData, error: userQueryError } = await query;
      data = userData;
      error = userQueryError;
    }

    if (error) {
      console.error("[Database] Error fetching boards via REST:", error);
      return [];
    }

    return (data as any[]).map(board => ({
      ...board,
      ownerId: board.owner_id
    })) || [];
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
    if (user?.role === "admin") {
      return {
        ...board,
        ownerId: board.owner_id
      } as any;
    }

    const isOwner = board.owner_id === userId;
    
    const { data: membership, error: memberError } = await supabase
      .from("board_members")
      .select("*")
      .eq("board_id", boardId)
      .eq("user_id", userId)
      .maybeSingle();

    if (!isOwner && !membership) return null;
    
    return {
      ...board,
      ownerId: board.owner_id
    } as any;
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

    return (data as any[]).map(list => ({
      ...list,
      boardId: list.board_id
    })) || [];
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
      .eq("archived", false)
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
      listId: card.list_id,
      dueDate: card.due_date,
      assignedTo: card.assigned_to,
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

    if (!data) return null;

    return {
      ...data,
      listId: data.list_id,
      dueDate: data.due_date,
      assignedTo: data.assigned_to,
      createdBy: data.created_by,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
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

    return (data as any[]).map(label => ({
      ...label,
      cardId: label.card_id,
      createdAt: label.created_at
    })) || [];
  } catch (error) {
    console.error("[Database] getCardLabels failed:", error);
    return [];
  }
}

// Card Checklist queries
export async function getCardComments(cardId: number) {
  try {
    const { data, error } = await supabase
      .from("card_comments")
      .select("*, user:users(id, name, username)")
      .eq("card_id", cardId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data as any[]).map(comment => ({
      ...comment,
      cardId: comment.card_id,
      userId: comment.user_id,
      createdAt: comment.created_at,
      updatedAt: comment.updated_at
    })) || [];
  } catch (error) {
    console.error("[Database] getCardComments failed:", error);
    return [];
  }
}

export async function getCardAttachments(cardId: number) {
  try {
    const { data, error } = await supabase
      .from("card_attachments")
      .select("*")
      .eq("card_id", cardId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data as any[]).map(att => ({
      ...att,
      cardId: att.card_id,
      fileUrl: att.file_url,
      fileKey: att.file_key,
      mimeType: att.mime_type,
      fileSize: att.file_size,
      uploadedBy: att.uploaded_by,
      createdAt: att.created_at
    })) || [];
  } catch (error) {
    console.error("[Database] getCardAttachments failed:", error);
    return [];
  }
}

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

    return (data as any[]).map(item => ({
      ...item,
      cardId: item.card_id,
      assignedUserId: item.assigned_user_id,
      dueDate: item.due_date
    })) || [];
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

    return (data as any[]).map(field => ({
      ...field,
      cardId: field.card_id,
      fieldName: field.field_name,
      fieldValue: field.field_value,
      fieldType: field.field_type
    })) || [];
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
      boardId: m.board_id,
      userId: m.user_id,
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

    return (data as any[]).map(mc => ({
      ...mc,
      originalCardId: mc.original_card_id,
      mirrorCardId: mc.mirror_card_id,
      originalBoardId: mc.original_board_id,
      mirrorBoardId: mc.mirror_board_id,
      syncStatus: mc.sync_status
    })) || [];
  } catch (error) {
    console.error("[Database] getMirroredCards failed:", error);
    return [];
  }
}

// Project Dates queries
export async function getProjectDate(cardId: number) {
  try {
    const { data, error } = await supabase
      .from("project_dates")
      .select("*")
      .eq("card_id", cardId)
      .maybeSingle();

    if (error) {
      console.error("[Database] Error fetching project date via REST:", error);
      const db = await getDb();
      if (!db) return null;
      const result = await db.select().from(projectDates).where(eq(projectDates.cardId, cardId)).limit(1);
      return result.length > 0 ? result[0] : null;
    }

    if (!data) return null;

    return {
      ...data,
      cardId: data.card_id,
      projectStartDate: data.project_start_date,
      projectEndDate: data.project_end_date
    };
  } catch (error) {
    console.error("[Database] getProjectDate failed:", error);
    return null;
  }
}

export async function upsertProjectDate(cardId: number, projectStartDate?: Date, projectEndDate?: Date) {
  const { error } = await supabase
    .from("project_dates")
    .upsert({
      card_id: cardId,
      project_start_date: projectStartDate ? projectStartDate.toISOString() : null,
      project_end_date: projectEndDate ? projectEndDate.toISOString() : null,
    }, { onConflict: 'card_id' });

  if (error) throw error;
  return { success: true };
}

export async function updateCard(cardId: number, data: Partial<InsertCard>) {
  const updateData: any = {};
  if (data.title) updateData.title = data.title;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.listId) updateData.list_id = data.listId;
  if (data.position !== undefined) updateData.position = data.position;
  if (data.dueDate !== undefined) updateData.due_date = data.dueDate;
  if (data.assignedTo !== undefined) updateData.assigned_to = data.assignedTo;
  if (data.archived !== undefined) updateData.archived = data.archived;

  const { error } = await supabase
    .from("cards")
    .update(updateData)
    .eq("id", cardId);

  if (error) throw error;
  return { success: true };
}

export async function getAllUsers() {
  try {
    const { data, error } = await supabase
      .from("users")
      .select("*");

    if (error) {
      const db = await getDb();
      if (!db) return [];
      return await db.select().from(users);
    }

    return (data as any[]).map(user => ({
      ...user,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
      lastSignedIn: user.last_signed_in
    })) || [];
  } catch (error) {
    return [];
  }
}

export async function updateUserRole(userId: number, role: "admin" | "user") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.update(users).set({ role }).where(eq(users.id, userId));
}
