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
  cardComments,
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
  const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  
  if (!_db && connectionString) {
    try {
      // DEBUG: Log which environment variable is being used
      console.log("[Database] Connecting using:", process.env.POSTGRES_URL ? "POSTGRES_URL (Vercel Integration)" : "DATABASE_URL");
      
      const queryClient = postgres(connectionString, {
        connect_timeout: 10,
        max: 10,
        prepare: false,
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
      name: user.name || user.username,
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
    console.log(`[Database] getUserByUsername: ${username}`);
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("username", username)
      .maybeSingle();

    if (error) {
      console.error("[Database] Error fetching user via REST:", error);
    }

    if (data) {
      console.log(`[Database] Found user in Supabase: ${data.username}`);
      return {
        ...data,
        tenantId: data.tenant_id,
        authId: data.auth_id,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        lastSignedIn: data.last_signed_in
      } as any;
    }

    // Fallback para Drizzle se não encontrado no Supabase ou se houver erro
    console.log(`[Database] User ${username} not in Supabase users table, trying Drizzle...`);
    const db = await getDb();
    if (!db) {
      console.error("[Database] Drizzle connection not available");
      return undefined;
    }
    const results = await db.select().from(users).where(eq(users.username, username)).limit(1);
    if (results[0]) {
      console.log(`[Database] Found user in Drizzle: ${results[0].username}`);
    } else {
      console.warn(`[Database] User ${username} not found in Drizzle either`);
    }
    return results[0] || undefined;
  } catch (error) {
    console.error("[Database] getUserByUsername failed:", error);
    return undefined;
  }
}

export async function getUserByAuthId(authId: string) {
  try {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("auth_id", authId)
      .maybeSingle();

    if (error) {
      console.error("[Database] Error fetching user by Auth ID via REST:", error);
    }

    if (data) {
      return {
        ...data,
        tenantId: data.tenant_id,
        authId: data.auth_id,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        lastSignedIn: data.last_signed_in
      } as any;
    }

    // Fallback para Drizzle
    const db = await getDb();
    if (!db) return undefined;
    const results = await db.select().from(users).where(eq(users.authId, authId)).limit(1);
    return results[0] || undefined;
  } catch (error) {
    console.error("[Database] getUserByAuthId failed:", error);
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
    }

    if (data) {
      return {
        ...data,
        tenantId: data.tenant_id,
        authId: data.auth_id,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        lastSignedIn: data.last_signed_in
      } as any;
    }

    // Fallback para Drizzle
    const db = await getDb();
    if (!db) return undefined;
    const results = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return results[0] || undefined;
  } catch (error) {
    console.error("[Database] getUserById failed:", error);
    return undefined;
  }
}

// Board queries
export async function getUserBoards(userId: number, tenantId?: string) {
  try {
    // Se não temos tenantId, tentamos obter do usuário via Supabase REST
    if (!tenantId) {
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("tenant_id")
        .eq("id", userId)
        .maybeSingle();
      
      if (userData?.tenant_id) {
        tenantId = userData.tenant_id;
      } else {
        // Fallback para Drizzle se falhar no Supabase
        const db = await getDb();
        if (db) {
          const [user] = await db.select().from(users).where(eq(users.id, userId));
          tenantId = user?.tenantId || undefined;
        }
      }
    }

    if (!tenantId) {
      console.warn(`[Database] No tenantId found for user ${userId}`);
      return [];
    }

    // Primeiro, pegar os IDs dos boards onde o usuário é membro via Supabase REST
    const { data: membershipData, error: membershipError } = await supabase
      .from("board_members")
      .select("board_id")
      .eq("user_id", userId);
    
    const memberBoardIds = membershipData?.map(m => m.board_id) || [];
    
    // Agora buscar boards que o usuário é dono OU que estão na lista de IDs de membro
    // Filtrando obrigatoriamente pelo tenantId
    let query = supabase
      .from("boards")
      .select("*")
      .eq("tenant_id", tenantId);
    
    // Monta a condição OR: owner_id = userId OR id IN (memberBoardIds)
    if (memberBoardIds.length > 0) {
      query = query.or(`owner_id.eq.${userId},id.in.(${memberBoardIds.join(',')})`);
    } else {
      query = query.eq("owner_id", userId);
    }

    const { data: boardsData, error: boardsError } = await query;

    if (boardsError) {
      console.error("[Database] Error fetching boards via REST:", boardsError);
      
      // Fallback para Drizzle se falhar no Supabase REST
      const db = await getDb();
      if (!db) return [];

      const results = await db.select().from(boards).where(
        and(
          eq(boards.tenantId, tenantId),
          or(
            eq(boards.ownerId, userId),
            inArray(boards.id, 
              db.select({ id: boardMembers.boardId })
                .from(boardMembers)
                .where(eq(boardMembers.userId, userId))
            )
          )
        )
      );
      return results;
    }

    // Normaliza os resultados para o formato esperado (camelCase)
    return (boardsData || []).map(b => ({
      ...b,
      ownerId: b.owner_id,
      tenantId: b.tenant_id,
      createdAt: b.created_at,
      updatedAt: b.updated_at
    }));
  } catch (error) {
    console.error("[Database] getUserBoards failed:", error);
    return [];
  }
}

export async function getBoardById(boardId: number, userId?: number, tenantId?: string) {
  try {
    // Tenta via Supabase REST primeiro
    const { data: board, error } = await supabase
      .from("boards")
      .select("*")
      .eq("id", boardId)
      .maybeSingle();

    if (error || !board) {
      if (error) console.error("[Database] Error fetching board by ID via REST:", error);
      
      // Fallback para Drizzle
      const db = await getDb();
      if (!db) return null;
      const [drizzleBoard] = await db.select().from(boards).where(eq(boards.id, boardId));
      if (!drizzleBoard) return null;
      
      // Aplicar mesmas regras de validação ao board do Drizzle
      if (tenantId && drizzleBoard.tenantId !== tenantId) return null;
      if (!userId) return drizzleBoard;
      if (drizzleBoard.ownerId === userId) return drizzleBoard;
      
      const [membership] = await db.select().from(boardMembers).where(
        and(eq(boardMembers.boardId, boardId), eq(boardMembers.userId, userId))
      );
      return membership ? drizzleBoard : null;
    }

    // Normalizar board do Supabase (snake_case -> camelCase)
    const normalizedBoard = {
      ...board,
      ownerId: board.owner_id,
      tenantId: board.tenant_id,
      createdAt: board.created_at,
      updatedAt: board.updated_at
    };

    // Se o tenantId for passado, validar se o quadro pertence a ele
    if (tenantId && normalizedBoard.tenantId !== tenantId) return null;

    // Se não houver userId, apenas retorna o quadro (se o tenant estiver ok)
    if (!userId) return normalizedBoard;

    // Se for o dono, ok
    if (normalizedBoard.ownerId === userId) return normalizedBoard;

    // Verificar se é membro via Supabase REST
    const { data: membership, error: memberError } = await supabase
      .from("board_members")
      .select("id")
      .eq("board_id", boardId)
      .eq("user_id", userId)
      .maybeSingle();

    if (!membership) return null;

    return normalizedBoard;
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
      .eq("board_id", boardId);
      // Removido .order("position") temporariamente para evitar erro 42703 se a coluna não existir

    if (error) throw error;

    return (data || []).map((list: any) => ({
      ...list,
      boardId: list.board_id,
      createdAt: list.created_at || list.createdAt || new Date().toISOString(),
      updatedAt: list.updated_at || list.updatedAt || new Date().toISOString()
    }));
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
      .eq("archived", false);
      // Removido .order("position") temporariamente para evitar erro 42703 se a coluna não existir
    if (error) throw error;

    const cardsRaw = data || [];

    if (cardsRaw.length === 0) {
      return [];
    }

    // Coleta todos os IDs de cartão desta lista para buscar contagens em lote
    const cardIds = cardsRaw.map((c: any) => c.id);

    const [checklistsRes, attachmentsRes] = await Promise.all([
      supabase
        .from("card_checklists")
        .select("card_id, completed")
        .in("card_id", cardIds),
      supabase
        .from("card_attachments")
        .select("card_id")
        .in("card_id", cardIds),
    ]);

    const checklistItems = checklistsRes.data || [];
    const attachmentItems = attachmentsRes.data || [];

    return cardsRaw.map((card: any) => {
      const cardChecklistItems = checklistItems.filter((i: any) => i.card_id === card.id);
      const cardAttachments = attachmentItems.filter((a: any) => a.card_id === card.id);

      const checklistCount = cardChecklistItems.length;
      const completedChecklistCount = cardChecklistItems.filter((i: any) => i.completed).length;
      const attachmentCount = cardAttachments.length;

      return {
        ...card,
        listId: card.list_id,
        startDate: card.start_date,
        dueDate: card.due_date,
        assignedTo: card.assigned_to,
        assignedToName: card.assignedToUser?.name || null,
        createdBy: card.created_by,
        createdAt: card.created_at || card.createdAt || new Date().toISOString(),
        updatedAt: card.updated_at || card.updatedAt || new Date().toISOString(),
        checklistCount,
        completedChecklistCount,
        attachmentCount,
      };
    });
  } catch (error) {
    console.error("[Database] getListCards failed:", error);
    return [];
  }
}

export async function getCardById(cardId: number) {
  try {
    const { data, error } = await supabase
      .from("cards")
      // Inclui join para obter o nome do responsável no `cards.getDetails`
      .select("*, assignedToUser:users!assigned_to(name)")
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
      startDate: data.start_date,
      dueDate: data.due_date,
      assignedTo: data.assigned_to,
      assignedToName: (data as any).assignedToUser?.name || null,
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

    return (data || []).map((label: any) => ({
      ...label,
      cardId: label.card_id,
      createdAt: label.created_at
    }));
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
      .eq("card_id", cardId);

    if (error) throw error;
    return (data || []).map((comment: any) => ({
      ...comment,
      cardId: comment.card_id,
      userId: comment.user_id,
      createdAt: comment.created_at || new Date().toISOString(),
      updatedAt: comment.updated_at || new Date().toISOString()
    }));
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
      .eq("card_id", cardId);

    if (error) throw error;
    return (data || []).map((att: any) => ({
      ...att,
      cardId: att.card_id,
      fileUrl: att.file_url,
      fileKey: att.file_key || null,
      mimeType: att.mime_type,
      fileSize: att.file_size,
      uploadedBy: att.uploaded_by,
      createdAt: att.created_at || new Date().toISOString()
    }));
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
      .eq("card_id", cardId);
      // Removido .order("position") temporariamente para evitar erro 42703 se a coluna não existir

    if (error) throw error;

    return (data || []).map((item: any) => ({
      ...item,
      cardId: item.card_id,
      assignedUserId: item.assigned_user_id,
      dueDate: item.due_date,
      createdAt: item.created_at || item.createdAt || new Date().toISOString(),
      updatedAt: item.updated_at || item.updatedAt || new Date().toISOString()
    }));
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

    return (data || []).map((field: any) => ({
      ...field,
      cardId: field.card_id,
      fieldName: field.field_name,
      fieldValue: field.field_value,
      fieldType: field.field_type
    }));
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

    return (data || []).map((m: any) => ({
      ...m,
      boardId: m.board_id,
      userId: m.user_id,
      user: m.user
    }));
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

    return (data || []).map((mc: any) => ({
      ...mc,
      originalCardId: mc.original_card_id,
      mirrorCardId: mc.mirror_card_id,
      originalBoardId: mc.original_board_id,
      mirrorBoardId: mc.mirror_board_id,
      syncStatus: mc.sync_status
    }));
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

export async function updateCard(cardId: number, data: any) {
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

    return (data || []).map((user: any) => ({
      ...user,
      tenantId: user.tenant_id,
      authId: user.auth_id,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
      lastSignedIn: user.last_signed_in
    }));
  } catch (error) {
    return [];
  }
}

export async function updateUserRole(userId: number, role: "admin" | "user") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.update(users).set({ role }).where(eq(users.id, userId));
}
