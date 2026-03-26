import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card } from "@/components/ui/card";
import { useState } from "react";
import { Clock, CalendarDays, AlignLeft, CheckSquare, Paperclip, User } from "lucide-react";
import { format, isBefore, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import CardDetailModal from "./CardDetailModal";

interface Label {
  id: number;
  label: string;
  color: string;
}

interface DraggableCardProps {
  id: number;
  listId: number;
  title: string;
  description?: string;
  startDate?: Date;
  dueDate?: Date;
  listName?: string;
  assignedToName?: string | null;
  labels?: Label[];
  checklistCount?: number;
  completedChecklistCount?: number;
  attachmentCount?: number;
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
  labels = [],
  checklistCount = 0,
  completedChecklistCount = 0,
  attachmentCount = 0,
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
    zIndex: isDragging ? 50 : 0,
  };

  const isOverdue = dueDate && isBefore(new Date(dueDate), new Date()) && !isToday(new Date(dueDate));
  const isDueToday = dueDate && isToday(new Date(dueDate));

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        className="group relative"
      >
        <Card
          {...attributes}
          {...listeners}
          onClick={(e) => {
            e.stopPropagation();
            if (!isDragging) {
              setIsModalOpen(true);
            }
          }}
          className={cn(
            "p-3 bg-[#3D3D3D] border-[#333] cursor-pointer hover:border-accent/40 hover:bg-[#252525] transition-all shadow-sm hover:shadow-lg rounded-xl flex flex-col gap-2.5",
            isDragging && "ring-2 ring-accent shadow-2xl scale-[1.02]"
          )}
        >
          {/* Labels Section */}
          {labels.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-0.5">
              {labels.map((label) => (
                <div
                  key={label.id}
                  className="h-1.5 w-8 rounded-full transition-all group-hover:w-10"
                  style={{ backgroundColor: label.color }}
                  title={label.label}
                />
              ))}
            </div>
          )}

          {/* Title and Description */}
          <div className="space-y-1">
            <h3 className="font-bold text-[13px] text-gray-100 leading-snug group-hover:text-white transition-colors">
              {title}
            </h3>
            {description && (
              <p className="text-[11px] text-gray-500 line-clamp-2 leading-relaxed">
                {description}
              </p>
            )}
          </div>

          {/* Indicators and Footer */}
          <div className="flex items-center justify-between mt-1 pt-1 border-t border-white/[0.03]">
            <div className="flex items-center gap-3">
              {/* Dates */}
              {(startDate || dueDate) && (
                <div className="flex items-center gap-2">
                  {dueDate && (
                    <div className={cn(
                      "flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-tight",
                      isOverdue 
                        ? "bg-red-500/10 text-red-400 border border-red-500/20" 
                        : isDueToday 
                          ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                          : "bg-accent/10 text-accent/80 border border-accent/20"
                    )}>
                      <Clock size={10} className={cn(isOverdue && "animate-pulse")} />
                      <span>{format(new Date(dueDate), "dd 'de' MMM", { locale: ptBR })}</span>
                    </div>
                  )}
                  {startDate && !dueDate && (
                    <div className="flex items-center gap-1 text-[9px] text-gray-500 font-bold uppercase tracking-tight">
                      <CalendarDays size={10} className="text-blue-400/60" />
                      <span>{format(new Date(startDate), "dd 'de' MMM", { locale: ptBR })}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Status Icons */}
              <div className="flex items-center gap-2 text-gray-500">
                {description && <span title="Tem descrição"><AlignLeft size={11} /></span>}
                {checklistCount > 0 && (
                  <div className={cn(
                    "flex items-center gap-0.5 text-[10px] font-bold",
                    completedChecklistCount === checklistCount ? "text-green-500" : "text-gray-500"
                  )} title="Checklist">
                    <CheckSquare size={11} />
                    <span>{completedChecklistCount}/{checklistCount}</span>
                  </div>
                )}
                {attachmentCount > 0 && (
                  <div className="flex items-center gap-0.5 text-[10px] font-bold" title="Anexos">
                    <Paperclip size={11} />
                    <span>{attachmentCount}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Assignee Avatar */}
            {assignedToName && (
              <Avatar className="h-5 w-5 border border-[#333] shadow-sm ring-1 ring-white/5">
                <AvatarFallback className="bg-[#2a2a2a] text-[9px] font-black text-gray-400 uppercase">
                  {assignedToName.charAt(0)}
                </AvatarFallback>
              </Avatar>
            )}
          </div>
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
