import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card } from "@/components/ui/card";
import { useState } from "react";
import { Clock, CalendarDays } from "lucide-react";
import CardDetailModal from "./CardDetailModal";

interface DraggableCardProps {
  id: number;
  listId: number;
  title: string;
  description?: string;
  startDate?: Date;
  dueDate?: Date;
  listName?: string;
  assignedToName?: string | null;
}

export function DraggableCard({
  id,
  listId,
  title,
  description,
  startDate,
  dueDate,
  listName,
  assignedToName,
}: DraggableCardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `card-${id}-${listId}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        className="p-3"
      >
        <Card
          {...listeners}
          onClick={(e) => {
            if (!isDragging) {
              setIsModalOpen(true);
            }
          }}
          className="p-3 bg-card border border-border cursor-pointer hover:shadow-md transition-shadow hover:bg-card/80"
        >
          <p className="font-medium text-sm text-foreground">{title}</p>
          {description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {description}
            </p>
          )}
          {(startDate || dueDate) && (
            <div className="flex items-center gap-2 mt-2">
              {startDate && (
                <div className="flex items-center gap-1 text-[9px] text-muted-foreground bg-secondary/20 px-1.5 py-0.5 rounded border border-border/30">
                  <CalendarDays size={9} className="text-accent/50" />
                  <span>{new Date(startDate).toLocaleDateString("pt-BR", { day: '2-digit', month: '2-digit' })}</span>
                </div>
              )}
              {dueDate && (
                <div className="flex items-center gap-1 text-[9px] text-muted-foreground bg-secondary/20 px-1.5 py-0.5 rounded border border-border/30">
                  <Clock size={9} className="text-amber-500/50" />
                  <span>{new Date(dueDate).toLocaleDateString("pt-BR", { day: '2-digit', month: '2-digit' })}</span>
                </div>
              )}
            </div>
          )}
        </Card>
      </div>
      {isModalOpen && (
        <CardDetailModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          cardId={id}
          cardTitle={title}
          cardDescription={description}
          listName={listName}
        />
      )}
    </>
  );
}
