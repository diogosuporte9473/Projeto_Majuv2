import { useRoute, useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { useRealtimeSync } from "@/_core/hooks/useRealtimeSync";
import { trpc } from "@/lib/trpc";
import TrelloDashboardLayout from "@/components/TrelloDashboardLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus, Loader2, MessageSquare, X, UserPlus, Users, Shield, Trash2, MoreHorizontal, Edit2, Archive, Settings2, AlignLeft, Tag, CheckSquare, Clock, LayoutGrid, Paperclip, History as HistoryIcon } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { DraggableCard } from "@/components/DraggableCard";
import { AIChatBox, Message } from "@/components/AIChatBox";
import { toast } from "sonner";
import type { List as DBList, Card as DBCard } from "../../../drizzle/schema";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface CardWithUser extends DBCard {
  assignedToName?: string | null;
}

export default function BoardView() {
  const [, params] = useRoute("/board/:id");
  const boardId = params?.id ? parseInt(params.id) : null;
  const { user } = useAuth();
  
  // Ativa sincronização em tempo real para este quadro
  useRealtimeSync(boardId || undefined);

  const { data: board, isLoading: boardLoading } = trpc.boards.get.useQuery(
    { id: boardId || 0 },
    { enabled: !!boardId } as any
  );

  const { data: lists, isLoading: listsLoading } = trpc.lists.getByBoard.useQuery(
    { boardId: boardId || 0 },
    { enabled: !!boardId } as any
  );

  const [newListName, setNewListName] = useState("");
  const [showNewList, setShowNewList] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showAIChat, setShowAIChat] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showArchivedModal, setShowArchivedModal] = useState(false);
  const [showMirrorSettings, setShowMirrorSettings] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: "system", content: "You are a helpful assistant for the Maju Task Manager. You can help users organize their tasks, suggest project steps, and answer questions about their boards." }
  ]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const utils = trpc.useUtils();
  const createListMutation = trpc.lists.create.useMutation();
  const reorderCardMutation = trpc.cards.reorder.useMutation();
  const updateBoardMutation = trpc.boards.update.useMutation();
  const deleteBoardMutation = trpc.boards.delete.useMutation();
  const aiChatMutation = trpc.ai.chat.useMutation();
  const [, setLocation] = useLocation();

  const [isEditingBoardName, setIsEditingBoardName] = useState(false);
  const [editedBoardName, setEditedBoardName] = useState("");
  const [showActivityModal, setShowActivityModal] = useState(false);

  useEffect(() => {
    (window as any).showBoardActivity = () => setShowActivityModal(true);
    return () => { delete (window as any).showBoardActivity; };
  }, []);

  const { data: boardActivity, isLoading: logsLoading } = trpc.audit.list.useQuery({
    search: board?.name,
    limit: 10,
  }, { enabled: !!board?.name && showActivityModal } as any);

  useEffect(() => {
    if (board) {
      setEditedBoardName(board.name);
    }
  }, [board]);

  const handleUpdateBoardName = async () => {
    if (!editedBoardName.trim() || !boardId || editedBoardName === board?.name) {
      setIsEditingBoardName(false);
      return;
    }

    try {
      await updateBoardMutation.mutateAsync({
        id: boardId,
        name: editedBoardName,
      });
      setIsEditingBoardName(false);
      toast.success("Quadro renomeado");
      utils.boards.get.invalidate({ id: boardId });
    } catch (error) {
      toast.error("Erro ao renomear quadro");
    }
  };

  const handleDeleteBoard = async () => {
    if (!boardId) return;
    if (!confirm("TEM CERTEZA? Esta ação excluirá o quadro e todos os seus dados permanentemente.")) return;

    try {
      await deleteBoardMutation.mutateAsync({ id: boardId });
      toast.success("Quadro excluído");
      setLocation("/");
    } catch (error: any) {
      toast.error(error.message || "Erro ao excluir quadro");
    }
  };

  const handleSendMessage = async (content: string, options?: { useWebSearch?: boolean; shortResponse?: boolean }) => {
    const newMessages: Message[] = [...messages, { role: "user", content }];
    setMessages(newMessages);
    
    try {
      const response = await aiChatMutation.mutateAsync({ 
        messages: newMessages,
        useWebSearch: options?.useWebSearch,
        shortResponse: options?.shortResponse
      });
      setMessages(prev => [...prev, { role: "assistant", content: response }]);
    } catch (error) {
      toast.error("Erro ao falar com a IA");
    }
  };

  const handleCreateList = async () => {
    if (!newListName.trim() || !boardId) return;

    try {
      await createListMutation.mutateAsync({
        boardId,
        name: newListName,
      });
      setNewListName("");
      setShowNewList(false);
    } catch (error) {
      console.error("Error creating list:", error);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    if (activeId === overId) return;

    const activeParts = activeId.split("-");
    const overParts = overId.split("-");

    if (activeParts[0] === "card") {
      const cardId = parseInt(activeParts[1]);
      let newListId: number | null = null;

      if (overParts[0] === "card") {
        newListId = parseInt(overParts[2]);
      } else if (overParts[0] === "list") {
        newListId = parseInt(overParts[1]);
      }

      if (cardId && newListId) {
        try {
          await reorderCardMutation.mutateAsync({
            cardId,
            newListId,
            newPosition: 0,
          });
          toast.success("Cartão movido");
          utils.cards.getByList.invalidate();
        } catch (error) {
          toast.error("Erro ao mover cartão");
        }
      }
    }
  };

  if (boardLoading || listsLoading) {
    return (
      <TrelloDashboardLayout>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </TrelloDashboardLayout>
    );
  }

  if (!board) {
    return (
      <TrelloDashboardLayout>
        <div className="p-8">
          <p className="text-muted-foreground">Board not found</p>
        </div>
      </TrelloDashboardLayout>
    );
  }

  const isOwnerOrAdmin = user?.id === board.ownerId || user?.role === 'admin';

  return (
    <TrelloDashboardLayout>
      <div className="h-full flex flex-col">
        <BoardActivityModal 
          isOpen={showActivityModal} 
          onClose={() => setShowActivityModal(false)} 
          boardName={board.name}
          logs={boardActivity?.logs || []}
          isLoading={logsLoading}
        />
        <div className="p-6 flex justify-between items-start flex-shrink-0">
          <div className="flex-1 min-w-0">
            {isEditingBoardName ? (
              <div className="flex items-center gap-2 mb-2">
                <input
                  type="text"
                  value={editedBoardName}
                  onChange={(e) => setEditedBoardName(e.target.value)}
                  className="text-3xl font-bold bg-transparent border-b-2 border-accent outline-none text-foreground w-full max-w-lg"
                  autoFocus
                  onBlur={handleUpdateBoardName}
                  onKeyDown={(e) => e.key === "Enter" && handleUpdateBoardName()}
                />
              </div>
            ) : (
              <h1 
                className="text-3xl font-bold text-foreground mb-2 cursor-pointer hover:text-accent transition-colors flex items-center gap-2 group"
                onClick={() => setIsEditingBoardName(true)}
              >
                {board.name}
                <Edit2 className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity" />
              </h1>
            )}
            {board.description && (
              <p className="text-muted-foreground">{board.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button 
              onClick={() => (window as any).showBoardActivity?.()} 
              variant="ghost" 
              size="icon" 
              className="text-muted-foreground hover:text-accent transition-all hover:bg-accent/10" 
              title="Últimas Atividades"
            >
              <HistoryIcon className="w-4 h-4" />
            </Button>
            <Button onClick={() => setShowArchivedModal(true)} variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground" title="Itens Arquivados">
              <Archive className="w-4 h-4" />
            </Button>
            {user?.role === 'admin' && (
              <Button 
                onClick={() => setShowMirrorSettings(true)} 
                variant="ghost" 
                size="icon" 
                className="text-muted-foreground hover:text-accent" 
                title="Configurações de Espelhamento"
              >
                <Settings2 className="w-4 h-4" />
              </Button>
            )}
            {user?.role === 'admin' && (
              <Button 
                onClick={handleDeleteBoard} 
                variant="ghost" 
                size="icon" 
                className="text-muted-foreground hover:text-red-500 hover:bg-red-500/10" 
                title="Excluir Quadro"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
            {isOwnerOrAdmin && (
              <Button onClick={() => setShowShareModal(true)} variant="outline" className="flex items-center gap-2">
                <UserPlus className="w-4 h-4" /> Compartilhar
              </Button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-x-auto overflow-y-hidden px-6 pb-6">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragEnd={handleDragEnd}
            onDragStart={(event) => {
              setActiveId(event.active.id as string);
            }}
          >
            <div className="flex gap-4 h-full items-start">
              {lists && (lists as DBList[]).map((list: DBList) => (
                <ListColumn key={list.id} listId={list.id} listName={list.name} />
              ))}

              {showNewList ? (
                <div className="flex-shrink-0 w-72 bg-card rounded-lg p-3 border border-border shadow-sm">
                  <input
                    type="text"
                    placeholder="Nome da lista..."
                    value={newListName}
                    onChange={(e) => setNewListName(e.target.value)}
                    className="w-full px-3 py-2 rounded bg-background border border-border text-foreground placeholder-muted-foreground text-sm mb-2 focus:ring-1 focus:ring-accent outline-none"
                    autoFocus
                    onKeyDown={(e) => e.key === "Enter" && handleCreateList()}
                  />
                  <div className="flex gap-2">
                    <Button
                      onClick={handleCreateList}
                      disabled={createListMutation.isPending}
                      size="sm"
                      className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90"
                    >
                      Criar Lista
                    </Button>
                    <Button
                      onClick={() => setShowNewList(false)}
                      variant="ghost"
                      size="sm"
                      className="flex-1"
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex-shrink-0 w-72">
                  <Button
                    onClick={() => setShowNewList(true)}
                    variant="outline"
                    className="w-full justify-start bg-background/50 border-dashed border-2 hover:bg-background hover:border-accent text-muted-foreground hover:text-foreground h-12 transition-all"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Adicionar outra lista
                  </Button>
                </div>
              )}
            </div>

            <DragOverlay>
              {activeId && activeId.startsWith("card-") ? (
                <div className="bg-card rounded p-3 border border-border shadow-2xl rotate-3 cursor-grabbing w-64">
                  <p className="font-medium text-sm text-foreground">Movendo cartão...</p>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>

        {/* Share Modal */}
        {boardId && (
          <ShareModal 
            isOpen={showShareModal} 
            onClose={() => setShowShareModal(false)} 
            boardId={boardId} 
          />
        )}

        {/* Mirror Settings Modal */}
        {boardId && (
          <MirrorSettingsModal
            isOpen={showMirrorSettings}
            onClose={() => setShowMirrorSettings(false)}
            boardId={boardId}
          />
        )}

        {/* Archived Cards Modal */}
        {boardId && (
          <ArchivedCardsModal
            isOpen={showArchivedModal}
            onClose={() => setShowArchivedModal(false)}
            boardId={boardId}
          />
        )}

        {/* AI Chat Button */}
        <div className="fixed bottom-8 right-8 z-50">
          {showAIChat ? (
            <div className="w-96 h-[500px] shadow-2xl transition-all duration-300 transform scale-100 opacity-100 origin-bottom-right">
              <div className="bg-primary text-primary-foreground p-3 rounded-t-lg flex items-center justify-between border-b border-primary-foreground/10">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  <span className="font-semibold">Maju IA</span>
                </div>
                <Button 
                  onClick={() => setShowAIChat(false)} 
                  variant="ghost" 
                  size="icon-sm"
                  className="hover:bg-primary-foreground/10 text-primary-foreground"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <AIChatBox 
                messages={messages}
                onSendMessage={handleSendMessage}
                isLoading={aiChatMutation.isPending}
                height="100%"
                className="rounded-t-none border-t-0"
              />
            </div>
          ) : (
            <Button
              onClick={() => setShowAIChat(true)}
              className="w-14 h-14 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg flex items-center justify-center transition-all hover:scale-110 active:scale-95"
            >
              <MessageSquare className="w-6 h-6" />
            </Button>
          )}
        </div>
      </div>
    </TrelloDashboardLayout>
  );
}

function MirrorSettingsModal({ isOpen, onClose, boardId }: { isOpen: boolean; onClose: () => void; boardId: number }) {
  const utils = trpc.useUtils();
  const { data: settings, isLoading } = trpc.boards.getMirrorSettings.useQuery({ boardId });
  const updateSettingsMutation = trpc.boards.updateMirrorSettings.useMutation();

  const handleToggle = async (key: string, value: boolean) => {
    if (!settings) return;
    
    const newSettings = {
      mirror_labels: settings.mirror_labels,
      mirror_checklists: settings.mirror_checklists,
      mirror_comments: settings.mirror_comments,
      mirror_attachments: settings.mirror_attachments,
      mirror_custom_fields: settings.mirror_custom_fields,
      mirror_dates: settings.mirror_dates,
      mirror_description: settings.mirror_description,
      [key]: value
    };

    try {
      await updateSettingsMutation.mutateAsync({
        boardId,
        settings: newSettings
      });
      utils.boards.getMirrorSettings.invalidate({ boardId });
      toast.success("Configuração atualizada");
    } catch (error) {
      toast.error("Erro ao atualizar configuração");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-[#1a1a1a] text-white border-[#333] max-w-md" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-accent" />
            Configurações de Espelhamento
          </DialogTitle>
          <DialogDescription className="text-gray-400 text-sm">
            Defina quais atributos serão sincronizados quando um cartão deste quadro for espelhado.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-accent" />
          </div>
        ) : (
          <div className="space-y-6 py-4">
            <div className="space-y-4">
              {[
                { key: 'mirror_description', label: 'Descrição', icon: AlignLeft },
                { key: 'mirror_labels', label: 'Etiquetas', icon: Tag },
                { key: 'mirror_checklists', label: 'Checklists', icon: CheckSquare },
                { key: 'mirror_dates', label: 'Datas (Início/Entrega)', icon: Clock },
                { key: 'mirror_custom_fields', label: 'Campos Personalizados', icon: LayoutGrid },
                { key: 'mirror_comments', label: 'Comentários', icon: MessageSquare },
                { key: 'mirror_attachments', label: 'Anexos', icon: Paperclip },
              ].map((item) => (
                <div key={item.key} className="flex items-center justify-between p-3 rounded-lg bg-[#222] border border-[#333] hover:border-accent/30 transition-all">
                  <div className="flex items-center gap-3">
                    <item.icon className="w-4 h-4 text-gray-400" />
                    <span className="text-sm font-medium text-gray-200">{item.label}</span>
                  </div>
                  <Switch 
                    checked={(settings as any)?.[item.key]} 
                    onCheckedChange={(val) => handleToggle(item.key, val)}
                    className="data-[state=checked]:bg-accent"
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ShareModal({ isOpen, onClose, boardId }: { isOpen: boolean; onClose: () => void; boardId: number }) {
  const utils = trpc.useUtils();
  const { data: members } = trpc.boards.getMembers.useQuery({ boardId });
  const { data: allUsers } = trpc.admin.users.list.useQuery();
  const addMemberMutation = trpc.admin.boards.addMember.useMutation();
  const removeMemberMutation = trpc.admin.boards.removeMember.useMutation();

  const handleAddMember = async (userId: number) => {
    try {
      await addMemberMutation.mutateAsync({ boardId, userId, role: 'viewer' });
      toast.success("Membro adicionado");
      utils.boards.getMembers.invalidate({ boardId });
    } catch (error: any) {
      toast.error(error.message || "Erro ao adicionar membro");
    }
  };

  const handleRemoveMember = async (userId: number) => {
    try {
      await removeMemberMutation.mutateAsync({ boardId, userId });
      toast.success("Membro removido");
      utils.boards.getMembers.invalidate({ boardId });
    } catch (error: any) {
      toast.error(error.message || "Erro ao remover membro");
    }
  };

  const memberIds = members?.map((m: any) => m.userId) || [];
  const nonMembers = allUsers?.filter((u: any) => !memberIds.includes(u.id)) || [];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        aria-describedby={undefined}
        className="max-w-md bg-background border-border"
      >
        <DialogHeader>
          <DialogTitle>Compartilhar Quadro</DialogTitle>
        </DialogHeader>
        <div className="space-y-6 pt-4">
          <div>
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Users className="w-4 h-4" /> Membros Atuais
            </h4>
            <div className="space-y-2">
              {members?.length === 0 && <p className="text-xs text-muted-foreground">Apenas você tem acesso a este quadro.</p>}
              {members?.map((m: any) => (
                <div key={m.userId} className="flex items-center justify-between p-2 rounded bg-muted">
                  <span className="text-sm font-medium">{m.userName || `Usuário ${m.userId}`}</span>
                  <Button variant="ghost" size="sm" onClick={() => handleRemoveMember(m.userId)} className="text-red-500 hover:bg-red-500/10">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold mb-3">Adicionar Novos Membros</h4>
            <div className="max-h-48 overflow-y-auto space-y-2 pr-2">
              {nonMembers.map((u: any) => (
                <div key={u.id} className="flex items-center justify-between p-2 rounded border border-border hover:bg-muted transition-colors">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{u.name || u.username}</span>
                    <span className="text-xs text-muted-foreground">{u.username}</span>
                  </div>
                  <Button size="sm" onClick={() => handleAddMember(u.id)} className="bg-accent hover:bg-accent/90">
                    Convidar
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ArchivedCardsModal({ isOpen, onClose, boardId }: { isOpen: boolean, onClose: () => void, boardId: number }) {
  const utils = trpc.useUtils();
  const { data: archivedCards, isLoading } = trpc.cards.getArchivedByBoard.useQuery({ boardId });
  const unarchiveMutation = trpc.cardDetails.archiveCard.useMutation();
  const deleteMutation = trpc.cards.delete.useMutation();

  const handleUnarchive = async (cardId: number) => {
    try {
      await unarchiveMutation.mutateAsync({ id: cardId, archived: false });
      utils.cards.getArchivedByBoard.invalidate({ boardId });
      utils.cards.getByList.invalidate();
      toast.success("Cartão restaurado");
    } catch (error) {
      toast.error("Erro ao restaurar cartão");
    }
  };

  const handleDelete = async (cardId: number) => {
    if (!confirm("Excluir permanentemente este cartão?")) return;
    try {
      await deleteMutation.mutateAsync({ id: cardId });
      utils.cards.getArchivedByBoard.invalidate({ boardId });
      toast.success("Cartão excluído");
    } catch (error) {
      toast.error("Erro ao excluir cartão");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        aria-describedby={undefined}
        className="max-w-2xl bg-[#1a1a1a] border-[#333] text-white"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Archive className="w-5 h-5 text-accent" />
            Itens Arquivados
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-4 max-h-[60vh] overflow-y-auto custom-scrollbar pr-2">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-accent" />
            </div>
          ) : archivedCards?.length === 0 ? (
            <p className="text-center py-8 text-gray-500 text-sm">Nenhum cartão arquivado neste quadro.</p>
          ) : (
            archivedCards?.map((card: any) => (
              <div key={card.id} className="flex items-center justify-between p-4 rounded-xl bg-[#222] border border-[#333] group hover:border-accent/30 transition-all">
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-sm text-gray-200 truncate">{card.title}</h4>
                  <p className="text-[10px] text-gray-500 mt-1">Arquivado em: {new Date(card.updated_at).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => handleUnarchive(card.id)}
                    className="text-xs h-8 bg-[#2a2a2a] hover:bg-accent hover:text-white"
                  >
                    Restaurar
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => handleDelete(card.id)}
                    className="h-8 w-8 text-gray-500 hover:text-red-400 hover:bg-red-400/10"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function BoardActivityModal({ isOpen, onClose, boardName, logs, isLoading }: { isOpen: boolean, onClose: () => void, boardName: string, logs: any[], isLoading: boolean }) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        aria-describedby={undefined}
        className="max-w-2xl bg-[#1a1a1a] border-[#333] text-white"
      >
        <DialogHeader>
          <div className="flex items-center justify-between pr-8">
            <DialogTitle className="flex items-center gap-2 text-xl">
              <HistoryIcon className="w-5 h-5 text-accent" />
              Atividades do Quadro
            </DialogTitle>
            <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 bg-accent/10 text-accent rounded border border-accent/20">
              {boardName}
            </span>
          </div>
          <DialogDescription className="text-gray-500 text-xs mt-1">
            Histórico recente de ações realizadas neste quadro.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-6 max-h-[65vh] overflow-y-auto custom-scrollbar pr-2">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <Loader2 className="w-10 h-10 animate-spin text-accent/50" />
              <p className="text-xs text-gray-500 font-medium animate-pulse uppercase tracking-widest">Carregando atividades...</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
              <div className="w-16 h-16 rounded-full bg-[#222] flex items-center justify-center border border-[#333]">
                <Clock className="w-8 h-8 text-gray-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-400 uppercase tracking-tight">Nenhuma atividade recente</p>
                <p className="text-[10px] text-gray-600 uppercase font-black tracking-widest mt-1">Os logs aparecerão aqui conforme as ações ocorrerem.</p>
              </div>
            </div>
          ) : (
            logs?.map((log: any) => (
              <div key={log.id} className="flex gap-4 p-4 rounded-2xl bg-[#222]/50 border border-[#333] hover:border-accent/20 transition-all group">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent text-xs font-black uppercase tracking-tighter shadow-inner group-hover:bg-accent group-hover:text-white transition-all duration-300">
                    {log.users?.name?.substring(0, 2) || "S"}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-black text-gray-200 group-hover:text-white transition-colors">
                      {log.users?.name || "Sistema"}
                    </p>
                    <span className="text-[10px] text-gray-500 font-black uppercase tracking-widest whitespace-nowrap bg-[#1a1a1a] px-2 py-0.5 rounded border border-[#333]">
                      {formatDistanceToNow(new Date(log.created_at), { addSuffix: true, locale: ptBR })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={cn(
                      "px-1.5 py-0.5 rounded-[4px] text-[9px] font-black uppercase tracking-[0.1em] border",
                      log.action === 'create' && "bg-green-500/10 text-green-500 border-green-500/20",
                      log.action === 'update' && "bg-blue-500/10 text-blue-500 border-blue-500/20",
                      log.action === 'delete' && "bg-red-500/10 text-red-500 border-red-500/20",
                      log.action === 'archive' && "bg-orange-500/10 text-orange-500 border-orange-500/20",
                      log.action === 'restore' && "bg-purple-500/10 text-purple-500 border-purple-500/20",
                    )}>
                      {log.action}
                    </span>
                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter truncate">
                      {log.entity_type}: {log.entity_name}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-500 italic line-clamp-2 leading-relaxed font-medium border-l-2 border-[#333] pl-3 py-1 group-hover:border-accent/40 group-hover:text-gray-400 transition-all">
                    {log.details}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ListColumn({ listId, listName }: { listId: number; listName: string }) {
  const { data: cards, isLoading } = trpc.cards.getByList.useQuery({ listId });
  const utils = trpc.useUtils();
  const deleteListMutation = trpc.lists.delete.useMutation();
  const updateListMutation = trpc.lists.update.useMutation();
  const createCardMutation = trpc.cards.create.useMutation();

  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(listName);
  const [newCardTitle, setNewCardTitle] = useState("");
  const [showNewCard, setShowNewCard] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { setNodeRef } = useDroppable({ id: `list-${listId}` });

  useEffect(() => {
    if (isEditingName && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditingName]);

  const handleDeleteList = async () => {
    if (!confirm("Tem certeza que deseja excluir esta lista e todos os seus cartões?")) return;
    try {
      await deleteListMutation.mutateAsync({ id: listId });
      toast.success("Lista removida");
      utils.lists.getByBoard.invalidate();
    } catch (error) {
      toast.error("Erro ao remover lista");
    }
  };

  const handleUpdateName = async () => {
    if (!editedName.trim() || editedName === listName) {
      setIsEditingName(false);
      setEditedName(listName);
      return;
    }
    try {
      await updateListMutation.mutateAsync({ id: listId, name: editedName });
      setIsEditingName(false);
      utils.lists.getByBoard.invalidate();
    } catch (error) {
      toast.error("Erro ao renomear lista");
    }
  };

  const handleCreateCard = async () => {
    if (!newCardTitle.trim()) return;
    try {
      await createCardMutation.mutateAsync({
        listId,
        title: newCardTitle,
      });
      setNewCardTitle("");
      setShowNewCard(false);
      utils.cards.getByList.invalidate({ listId });
    } catch (error) {
      console.error("Error creating card:", error);
    }
  };

  const cardIds = (cards as DBCard[])?.map((card: DBCard) => `card-${card.id}-${listId}`) || [];

  return (
    <div 
      ref={setNodeRef}
      className="flex-shrink-0 w-72 bg-[#1a1a1a] rounded-lg flex flex-col max-h-full border border-[#333] shadow-lg"
    >
      <div className="p-3 flex items-center justify-between group/list bg-[#222] rounded-t-lg border-b border-[#333]">
        {isEditingName ? (
          <input
            ref={inputRef}
            value={editedName}
            onChange={(e) => setEditedName(e.target.value)}
            onBlur={handleUpdateName}
            onKeyDown={(e) => e.key === "Enter" && handleUpdateName()}
            className="bg-[#2a2a2a] text-white text-sm font-semibold px-2 py-1 rounded w-full outline-none ring-1 ring-accent"
          />
        ) : (
          <h2 
            onClick={() => setIsEditingName(true)}
            className="text-sm font-semibold text-white px-2 py-1 cursor-pointer hover:bg-[#2a2a2a] rounded flex-1 truncate uppercase tracking-tight"
          >
            {listName}
          </h2>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="w-8 h-8 text-gray-400 hover:text-white hover:bg-white/10">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-[#1a1a1a] border-[#333] text-white">
            <DropdownMenuItem onClick={() => setIsEditingName(true)} className="flex items-center gap-2 cursor-pointer hover:bg-[#2a2a2a]">
              <Edit2 className="w-4 h-4" /> Renomear
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleDeleteList} className="flex items-center gap-2 text-red-400 cursor-pointer focus:text-red-400 focus:bg-red-400/10">
              <Trash2 className="w-4 h-4" /> Excluir Lista
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex-1 overflow-y-auto p-2 min-h-[100px] space-y-2 scrollbar-thin scrollbar-thumb-white/10 hover:scrollbar-thumb-white/20">
        <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 bg-card/50 rounded animate-pulse" />
              ))}
            </div>
          ) : cards && (cards as CardWithUser[]).map((card: CardWithUser) => (
            <DraggableCard
              key={card.id}
              id={card.id}
              listId={listId}
              title={card.title}
              description={card.description || undefined}
              startDate={card.startDate ? new Date(card.startDate) : undefined}
              dueDate={card.dueDate ? new Date(card.dueDate) : undefined}
              listName={listName}
              assignedToName={card.assignedToName}
            />
          ))}
        </SortableContext>
      </div>

      <div className="p-2 border-t border-[#333] bg-[#222]/30 rounded-b-lg">
        {showNewCard ? (
          <div className="p-2 bg-[#2a2a2a] rounded border border-[#444] shadow-sm">
            <textarea
              placeholder="Digite o título do cartão..."
              value={newCardTitle}
              onChange={(e) => setNewCardTitle(e.target.value)}
              className="w-full bg-[#1a1a1a] border border-[#444] rounded p-2 text-sm text-white placeholder-gray-500 resize-none focus:ring-1 focus:ring-accent outline-none mb-2"
              rows={3}
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), handleCreateCard())}
            />
            <div className="flex gap-2">
              <Button onClick={handleCreateCard} size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90">
                Adicionar
              </Button>
              <Button onClick={() => setShowNewCard(false)} variant="ghost" size="sm" className="text-gray-400 hover:text-white">
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <Button
            onClick={() => setShowNewCard(true)}
            variant="ghost"
            size="sm"
            className="w-full justify-start text-gray-400 hover:text-white hover:bg-white/5 h-10"
          >
            <Plus className="w-4 h-4 mr-2" />
            Adicionar um cartão
          </Button>
        )}
      </div>
    </div>
  );
}
