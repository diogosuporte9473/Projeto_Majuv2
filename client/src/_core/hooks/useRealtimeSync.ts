import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { trpc } from "@/lib/trpc";

export function useRealtimeSync(boardId?: number) {
  const utils = trpc.useUtils();

  useEffect(() => {
    console.log(`[Supabase Realtime] Subscribing to changes for board: ${boardId || 'all'}`);

    // Configura o canal de tempo real com identificador único para evitar conflitos
    const channel = supabase
      .channel(`db-changes-${boardId || 'global'}`)
      // Escuta mudanças na tabela de cartões
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cards" },
        (payload) => {
          console.log("[Realtime] Cards change detected:", payload.eventType);
          utils.cards.getByList.invalidate();
          if (boardId) {
            utils.cardDetails.getMirroredCards.invalidate({ boardId });
          }
        }
      )
      // Escuta mudanças na tabela de listas
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "lists" },
        () => {
          console.log("[Realtime] Lists change detected");
          if (boardId) {
            utils.lists.getByBoard.invalidate({ boardId });
          }
        }
      )
      // Escuta mudanças na tabela de quadros
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "boards" },
        () => {
          console.log("[Realtime] Boards change detected");
          utils.boards.list.invalidate();
          if (boardId) {
            utils.boards.get.invalidate({ id: boardId });
          }
        }
      )
      // Escuta mudanças nos detalhes do cartão (labels, checklists, etc)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "card_labels" },
        () => {
          console.log("[Realtime] Labels change detected");
          utils.cardDetails.getLabels.invalidate();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "card_checklists" },
        () => {
          console.log("[Realtime] Checklists change detected");
          utils.cardDetails.getChecklists.invalidate();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "card_custom_fields" },
        () => {
          console.log("[Realtime] Custom fields change detected");
          utils.cardDetails.getCustomFields.invalidate();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "project_dates" },
        () => {
          console.log("[Realtime] Project dates change detected");
          utils.cardDetails.getProjectDates.invalidate();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "card_comments" },
        () => {
          console.log("[Realtime] Comments change detected");
          utils.cardDetails.getComments.invalidate();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "card_attachments" },
        () => {
          console.log("[Realtime] Attachments change detected");
          utils.cardDetails.getAttachments.invalidate();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "mirrored_cards" },
        () => {
          console.log("[Realtime] Mirrored cards change detected");
          if (boardId) utils.cardDetails.getMirroredCards.invalidate({ boardId });
        }
      );

    channel.subscribe((status) => {
      console.log(`[Supabase Realtime] Subscription status for ${boardId || 'global'}:`, status);
      if (status === 'CHANNEL_ERROR') {
        console.error("[Supabase Realtime] WebSocket connection error detected");
      }
    });

    return () => {
      console.log(`[Supabase Realtime] Unsubscribing from board: ${boardId || 'all'}`);
      supabase.removeChannel(channel);
    };
  }, [boardId, utils]);
}
