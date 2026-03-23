import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { trpc } from "@/lib/trpc";

export function useRealtimeSync(boardId?: number) {
  const utils = trpc.useUtils();

  useEffect(() => {
    // Configura o canal de tempo real
    const channel = supabase
      .channel("db-changes")
      // Escuta mudanças na tabela de cartões
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cards" },
        () => {
          console.log("Realtime: Cards updated, invalidating queries...");
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
          console.log("Realtime: Lists updated, invalidating queries...");
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
          console.log("Realtime: Boards updated, invalidating queries...");
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
        () => utils.cardDetails.getLabels.invalidate()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "card_checklists" },
        () => utils.cardDetails.getChecklists.invalidate()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "card_custom_fields" },
        () => utils.cardDetails.getCustomFields.invalidate()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "project_dates" },
        () => utils.cardDetails.getProjectDates.invalidate()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [boardId, utils]);
}
