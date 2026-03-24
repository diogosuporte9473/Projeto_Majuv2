import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { router, protectedProcedure } from "./trpc.js";
import { supabase } from "./supabase.js";
import {
  getCardLabels,
  getCardAttachments,
  getCardCustomFields,
  getCardChecklists,
  getBoardById,
} from "../db.js";

export const cardDetailsRouter = router({
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
      const { error } = await supabase.from("card_labels").delete().eq("id", input.id);
      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
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
      const [groups, items] = await Promise.all([
        supabase.from("card_checklist_groups").select("*").eq("card_id", input.cardId),
        supabase.from("card_checklists").select("*").eq("card_id", input.cardId)
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
      return { id: data.id };
    }),
  updateChecklistGroup: protectedProcedure
    .input(z.object({ id: z.number(), title: z.string() }))
    .mutation(async ({ input }) => {
      const { error } = await supabase
        .from("card_checklist_groups")
        .update({ title: input.title })
        .eq("id", input.id);

      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      return { success: true };
    }),
  deleteChecklistGroup: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await supabase.from("card_checklists").delete().eq("group_id", input.id);
      
      const { error } = await supabase
        .from("card_checklist_groups")
        .delete()
        .eq("id", input.id);

      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      return { success: true };
    }),
  addChecklist: protectedProcedure
    .input(z.object({ cardId: z.number(), groupId: z.number().optional(), title: z.string(), position: z.number().optional() }))
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
          start_date: input.startDate ? input.startDate.toISOString() : null,
          end_date: input.endDate ? input.endDate.toISOString() : null,
        }, { onConflict: 'card_id' });

      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
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
});
