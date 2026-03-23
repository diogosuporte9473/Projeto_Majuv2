import { useRoute } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { useRealtimeSync } from "@/_core/hooks/useRealtimeSync";
import { trpc } from "@/lib/trpc";
import TrelloDashboardLayout from "@/components/TrelloDashboardLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus, Loader2, MessageSquare, X, UserPlus, Users, Shield, Trash2, MoreHorizontal, Edit2 } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
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
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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

  const createListMutation = trpc.lists.create.useMutation();
  const reorderCardMutation = trpc.cards.reorder.useMutation();
  const aiChatMutation = trpc.ai.chat.useMutation();

  const handleSendMessage = async (content: string) => {
    const newMessages: Message[] = [...messages, { role: "user", content }];
    setMessages(newMessages);
    
    try {
      const response = await aiChatMutation.mutateAsync({ messages: newMessages });
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

    if (activeParts[0] === "card" && overParts[0] === "card") {
      const cardId = parseInt(activeParts[1]);
      const newListId = parseInt(overParts[2]);

      if (isNaN(cardId) || isNaN(newListId)) {
        console.error("Invalid card or list ID", { cardId, newListId });
        return;
      }

      try {
        await reorderCardMutation.mutateAsync({
          cardId,
          newListId,
          newPosition: 0,
        });
      } catch (error) {
        console.error("Error reordering card:", error);
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
      <div className="p-8">
        <div className="mb-8 flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">{board.name}</h1>
            {board.description && (
              <p className="text-muted-foreground">{board.description}</p>
            )}
          </div>
          {isOwnerOrAdmin && (
            <Button onClick={() => setShowShareModal(true)} variant="outline" className="flex items-center gap-2">
              <UserPlus className="w-4 h-4" /> Compartilhar
            </Button>
          )}
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragEnd={handleDragEnd}
          onDragStart={(event) => {
            setActiveId(event.active.id as string);
          }}
        >
          <div className="flex gap-6 overflow-x-auto pb-4">
            {lists && (lists as DBList[]).map((list: DBList) => (
              <div key={list.id} className="flex-shrink-0 w-80">
                <ListColumn listId={list.id} listName={list.name} />
              </div>
            ))}

            {showNewList ? (
              <div className="flex-shrink-0 w-80 bg-card rounded-lg p-4 border border-border">
                <input
                  type="text"
                  placeholder="List name"
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  className="w-full px-3 py-2 rounded bg-background border border-border text-foreground placeholder-muted-foreground text-sm mb-3"
                  autoFocus
                />
                <div className="flex gap-2">
                  <Button
                    onClick={handleCreateList}
                    disabled={createListMutation.isPending}
                    size="sm"
                    className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90"
                  >
                    Create
                  </Button>
                  <Button
                    onClick={() => setShowNewList(false)}
                    variant="outline"
                    size="sm"
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex-shrink-0 w-80">
                <Button
                  onClick={() => setShowNewList(true)}
                  variant="outline"
                  className="w-full justify-start text-muted-foreground hover:text-foreground"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add List
                </Button>
              </div>
            )}
          </div>

          <DragOverlay>
            {activeId && activeId.startsWith("card-") ? (
              <div className="bg-card rounded p-3 border border-border shadow-lg">
                <p className="font-medium text-sm text-foreground">Dragging...</p>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>

        {/* Share Modal */}
        {boardId && (
          <ShareBoardModal 
            isOpen={showShareModal} 
            onClose={() => setShowShareModal(false)} 
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
                  <span className="font-semibold">Maju AI</span>
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

function ShareBoardModal({ isOpen, onClose, boardId }: { isOpen: boolean, onClose: () => void, boardId: number }) {
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
      <DialogContent className="max-w-md bg-background border-border">
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
    } catch (error) {
      console.error("Error creating card:", error);
    }
  };

  const cardIds = (cards as DBCard[])?.map((card: DBCard) => `card-${card.id}-${listId}`) || [];

  return (
    <div className="bg-[#1a1a1a] rounded-lg flex flex-col max-h-full border border-[#333]">
      <div className="p-3 flex items-center justify-between group/list">
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
            className="text-sm font-semibold text-white px-2 py-1 cursor-pointer hover:bg-[#2a2a2a] rounded flex-1 truncate"
          >
            {listName}
          </h2>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" className="text-gray-400 hover:text-white">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-[#1a1a1a] border-[#333] text-white">
            <DropdownMenuItem onClick={() => setIsEditingName(true)} className="flex items-center gap-2 cursor-pointer">
              <Edit2 className="w-4 h-4" /> Renomear
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleDeleteList} className="flex items-center gap-2 text-red-400 cursor-pointer focus:text-red-400 focus:bg-red-400/10">
              <Trash2 className="w-4 h-4" /> Excluir Lista
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
        <div className="flex-1 space-y-3 overflow-y-auto mb-4">
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 bg-card rounded animate-pulse" />
              ))}
            </div>
          ) : cards && cards.length > 0 ? (
            (cards as DBCard[]).map((card: DBCard) => (
              <DraggableCard
                key={card.id}
                id={card.id}
                listId={listId}
                title={card.title}
                description={card.description || undefined}
                dueDate={card.dueDate ? new Date(card.dueDate) : undefined}
                listName={listName}
              />
            ))
          ) : (
            <p className="text-xs text-muted-foreground">No cards yet</p>
          )}
        </div>
      </SortableContext>

      {showNewCard ? (
        <div className="bg-card rounded p-3 border border-border">
          <textarea
            placeholder="Card title"
            value={newCardTitle}
            onChange={(e) => setNewCardTitle(e.target.value)}
            className="w-full px-2 py-2 rounded bg-background border border-border text-foreground placeholder-muted-foreground text-sm mb-2 resize-none"
            rows={2}
          />
          <div className="flex gap-2">
            <Button
              onClick={handleCreateCard}
              disabled={createCardMutation.isPending}
              size="sm"
              className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90 text-xs"
            >
              Add Card
            </Button>
            <Button
              onClick={() => setShowNewCard(false)}
              variant="outline"
              size="sm"
              className="flex-1 text-xs"
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button
          onClick={() => setShowNewCard(true)}
          variant="outline"
          className="w-full justify-start text-muted-foreground hover:text-foreground text-sm"
          size="sm"
        >
          <Plus className="w-3 h-3 mr-2" />
          Add Card
        </Button>
      )}
    </div>
  );
}
