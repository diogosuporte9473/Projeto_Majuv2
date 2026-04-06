import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { trpc } from "@/lib/trpc";

export function useRealtimeSync(boardId?: number) {
  const utils = trpc.useUtils();
  const utilsRef = useRef(utils);

  useEffect(() => {
    // Mantém a referência atual sem re-iniciar a assinatura do realtime a cada render.
    utilsRef.current = utils;
  }, [utils]);

  useEffect(() => {
    // eslint-disable-next-line no-console
    console.log(`[Supabase Realtime] Subscribing to changes for board: ${boardId || "all"}`);

    // Configura o canal de tempo real com identificador único para evitar conflitos
    const channel = supabase
      .channel(`db-changes-${boardId || 'global'}`)
      // Escuta mudanças na tabela de cartões
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cards" },
        (payload) => {
          console.log("[Realtime] Cards change detected:", payload.eventType);
          utilsRef.current.cards.getByList.invalidate();
          if (boardId) {
            utilsRef.current.cardDetails.getMirroredCards.invalidate({ boardId });
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
            utilsRef.current.lists.getByBoard.invalidate({ boardId });
          }
        }
      )
      // Escuta mudanças na tabela de quadros
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "boards" },
        () => {
          console.log("[Realtime] Boards change detected");
          utilsRef.current.boards.list.invalidate();
          if (boardId) {
            utilsRef.current.boards.get.invalidate({ id: boardId });
          }
        }
      )
      // Escuta mudanças nos detalhes do cartão (labels, checklists, etc)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "card_labels" },
        () => {
          console.log("[Realtime] Labels change detected");
          utilsRef.current.cardDetails.getLabels.invalidate();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "card_checklists" },
        () => {
          console.log("[Realtime] Checklists change detected");
          utilsRef.current.cardDetails.getChecklists.invalidate();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "card_custom_fields" },
        () => {
          console.log("[Realtime] Custom fields change detected");
          utilsRef.current.cardDetails.getCustomFields.invalidate();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "project_dates" },
        () => {
          console.log("[Realtime] Project dates change detected");
          utilsRef.current.cardDetails.getProjectDates.invalidate();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "card_comments" },
        () => {
          console.log("[Realtime] Comments change detected");
          utilsRef.current.cardDetails.getComments.invalidate();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "card_attachments" },
        () => {
          console.log("[Realtime] Attachments change detected");
          utilsRef.current.cardDetails.getAttachments.invalidate();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "mirrored_cards" },
        () => {
          console.log("[Realtime] Mirrored cards change detected");
          if (boardId) utilsRef.current.cardDetails.getMirroredCards.invalidate({ boardId });
        }
      );

    let retryTimeout: NodeJS.Timeout;

    const subscribeChannel = () => {
      channel.subscribe(async (status) => {
        console.log(`[Supabase Realtime] Subscription status for ${boardId || 'global'}:`, status);
        
        if (status === 'CHANNEL_ERROR') {
          console.error("[Supabase Realtime] WebSocket connection error detected, retrying in 5s...");
          clearTimeout(retryTimeout);
          retryTimeout = setTimeout(() => {
            console.log("[Supabase Realtime] Re-subscribing...");
            subscribeChannel();
          }, 5000);
        }
        
        if (status === 'TIMED_OUT') {
          console.warn("[Supabase Realtime] Connection timed out, retrying...");
          subscribeChannel();
        }
      });
    };

    subscribeChannel();

    return () => {
      console.log(`[Supabase Realtime] Unsubscribing from board: ${boardId || 'all'}`);
      clearTimeout(retryTimeout);
      supabase.removeChannel(channel);
    };
  }, [boardId]);
}
