import { useRoute } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import TrelloDashboardLayout from "@/components/TrelloDashboardLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus, Loader2 } from "lucide-react";
import { useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  closestCorners,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { DraggableCard } from "@/components/DraggableCard";

export default function BoardView() {
  const [, params] = useRoute("/board/:id");
  const boardId = params?.id ? parseInt(params.id) : null;
  const { user } = useAuth();

  const { data: board, isLoading: boardLoading } = trpc.boards.get.useQuery(
    { id: boardId || 0 },
    { enabled: !!boardId }
  );

  const { data: lists, isLoading: listsLoading } = trpc.lists.getByBoard.useQuery(
    { boardId: boardId || 0 },
    { enabled: !!boardId }
  );

  const [newListName, setNewListName] = useState("");
  const [showNewList, setShowNewList] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const createListMutation = trpc.lists.create.useMutation();
  const reorderCardMutation = trpc.cards.reorder.useMutation();

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

  return (
    <TrelloDashboardLayout>
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">{board.name}</h1>
          {board.description && (
            <p className="text-muted-foreground">{board.description}</p>
          )}
        </div>

        <DndContext
          collisionDetection={closestCorners}
          onDragEnd={handleDragEnd}
          onDragStart={(event) => {
            setActiveId(event.active.id as string);
          }}
        >
          <div className="flex gap-6 overflow-x-auto pb-4">
            {lists && lists.map((list) => (
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
      </div>
    </TrelloDashboardLayout>
  );
}

function ListColumn({ listId, listName }: { listId: number; listName: string }) {
  const { data: cards, isLoading } = trpc.cards.getByList.useQuery({ listId });
  const [newCardTitle, setNewCardTitle] = useState("");
  const [showNewCard, setShowNewCard] = useState(false);
  const createCardMutation = trpc.cards.create.useMutation();

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

  const cardIds = cards?.map((card) => `card-${card.id}-${listId}`) || [];

  return (
    <div className="bg-muted rounded-lg p-4 flex flex-col h-full">
      <h3 className="font-semibold text-foreground mb-4">{listName}</h3>

      <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
        <div className="flex-1 space-y-3 overflow-y-auto mb-4">
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 bg-card rounded animate-pulse" />
              ))}
            </div>
          ) : cards && cards.length > 0 ? (
            cards.map((card) => (
              <DraggableCard
                key={card.id}
                id={card.id}
                title={card.title}
                description={card.description || undefined}
                dueDate={card.dueDate ? new Date(card.dueDate) : undefined}
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
