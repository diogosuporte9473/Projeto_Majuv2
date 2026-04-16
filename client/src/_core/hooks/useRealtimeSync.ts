import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { trpc } from "@/lib/trpc";
import { useAuth } from "./useAuth";

export function useRealtimeSync(boardId?: number) {
  const utils = trpc.useUtils();
  const utilsRef = useRef(utils);
  const { user } = useAuth();
  const tenantId = user?.tenantId;

  useEffect(() => {
    // Mantém a referência atual sem re-iniciar a assinatura do realtime a cada render.
    utilsRef.current = utils;
  }, [utils]);

  useEffect(() => {
    if (!tenantId) return;

    // eslint-disable-next-line no-console
    console.log(`[Supabase Realtime] Subscribing to changes for tenant: ${tenantId}, board: ${boardId || "all"}`);

    // Configura o canal de tempo real com identificador único para o tenant
    const channel = supabase
      .channel(`db-changes-${tenantId}-${boardId || 'global'}`)
      // Escuta mudanças na tabela de cartões (Filtrado por tenant)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cards", filter: `tenant_id=eq.${tenantId}` },
        (payload) => {
          console.log("[Realtime] Cards change detected:", payload.eventType);
          utilsRef.current.cards.getByList.invalidate();
          if (boardId) {
            utilsRef.current.cardDetails.getMirroredCards.invalidate({ boardId });
          }
        }
      )
      // Escuta mudanças na tabela de listas (Filtrado por tenant)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "lists", filter: `tenant_id=eq.${tenantId}` },
        () => {
          console.log("[Realtime] Lists change detected");
          if (boardId) {
            utilsRef.current.lists.getByBoard.invalidate({ boardId });
          }
        }
      )
      // Escuta mudanças na tabela de quadros (Filtrado por tenant)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "boards", filter: `tenant_id=eq.${tenantId}` },
        () => {
          console.log("[Realtime] Boards change detected");
          utilsRef.current.boards.list.invalidate();
          utilsRef.current.boards.listAll.invalidate();
          if (boardId) {
            utilsRef.current.boards.get.invalidate({ id: boardId });
          }
        }
      )
      // Escuta mudanças nos detalhes do cartão (labels, checklists, etc)
      // Tabelas secundárias não têm tenant_id direto, então ouvimos globalmente
      // mas o impacto é limitado aos cards do tenant que o usuário já carregou.
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
        { event: "*", schema: "public", table: "card_checklist_groups" },
        () => {
          console.log("[Realtime] Checklist groups change detected");
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
      // Mudanças no Tenant (Branding, etc)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tenants", filter: `id=eq.${tenantId}` },
        () => {
          console.log("[Realtime] Tenant branding change detected");
          utilsRef.current.branding.get.invalidate();
        }
      )
      // Mudanças nos Usuários (Novos usuários no tenant)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "users", filter: `tenant_id=eq.${tenantId}` },
        () => {
          console.log("[Realtime] Users change detected");
          utilsRef.current.cardDetails.getCardUsers.invalidate();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [boardId, tenantId]);
}
