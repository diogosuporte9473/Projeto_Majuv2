import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card } from "@/components/ui/card";
import { useState } from "react";
import CardDetailModal from "./CardDetailModal";

interface DraggableCardProps {
  id: number;
  title: string;
  description?: string;
  dueDate?: Date;
}

export function DraggableCard({
  id,
  title,
  description,
  dueDate,
}: DraggableCardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `card-${id}` });

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
        {...listeners}
        className="p-3"
      >
        <Card
          onClick={(e) => {
            e.stopPropagation();
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
          {dueDate && (
            <p className="text-xs text-muted-foreground mt-2">
              Due: {new Date(dueDate).toLocaleDateString()}
            </p>
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
        />
      )}
    </>
  );
}
