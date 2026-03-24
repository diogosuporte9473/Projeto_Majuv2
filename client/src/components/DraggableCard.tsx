import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card } from "@/components/ui/card";
import { useState } from "react";
import { Clock } from "lucide-react";
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
            <div className="flex items-center gap-1 mt-2 text-[10px] text-muted-foreground bg-secondary/30 px-2 py-0.5 rounded-md w-fit">
              <Clock size={10} className="text-muted-foreground/70" />
              {startDate && (
                <span>
                  {new Date(startDate).toLocaleDateString("pt-BR", { day: '2-digit', month: 'short' })} -{" "}
                </span>
              )}
              {dueDate ? (
                <span>{new Date(dueDate).toLocaleDateString("pt-BR", { day: '2-digit', month: 'short' })}</span>
              ) : (
                <span className="italic">Sem entrega</span>
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
