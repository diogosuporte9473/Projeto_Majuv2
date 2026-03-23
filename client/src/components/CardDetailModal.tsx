import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  X, Plus, Trash2, Tag, CheckSquare, Calendar, Loader2,
  AlignLeft, LayoutGrid, Clock, Copy, Archive, Trash,
  MessageSquare, Paperclip, Send, MoreVertical, Maximize2, Minimize2,
  CalendarDays, User as UserIcon,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAuth } from "@/_core/hooks/useAuth";

// ... (keep your interface and props the same)

export default function CardDetailModal({
  isOpen,
  onClose,
  cardId,
  cardTitle,
  cardDescription,
  listName,
}: CardDetailModalProps) {
  const { user: currentUser } = useAuth();
  const utils = trpc.useUtils();

  // ── Queries & Mutations (kept the same, just grouped better) ──
  const { data: card, isLoading } = trpc.cards.getDetails.useQuery({ id: cardId });
  const { data: labels } = trpc.cardDetails.getLabels.useQuery({ cardId });
  const { data: checklists, isLoading: checklistsLoading } = trpc.cardDetails.getChecklists.useQuery({ cardId });
  const { data: comments } = trpc.cardDetails.getComments.useQuery({ cardId });
  const { data: customFields } = trpc.cardDetails.getCustomFields.useQuery({ cardId });
  const { data: projectDates } = trpc.cardDetails.getProjectDates.useQuery({ cardId });

  // Mutations ...
  // (keep all your mutations the same)

  const [description, setDescription] = useState(cardDescription || "");
  const [newComment, setNewComment] = useState("");
  const [isMaximized, setIsMaximized] = useState(false);

  // Mirror dialog states
  const [isMirrorDialogOpen, setIsMirrorDialogOpen] = useState(false);
  const [selectedBoardId, setSelectedBoardId] = useState("");
  const [selectedListId, setSelectedListId] = useState("");

  useEffect(() => {
    setDescription(cardDescription || "");
  }, [cardDescription]);

  const checklistProgress = checklists?.length
    ? (checklists.filter((i: any) => i.completed).length / checklists.length) * 100
    : 0;

  // ──────────────────────────────────────────────────────────────
  //  LAYOUT DECISION: only left column + right sidebar
  //  → no inline expanding sections in main content anymore
  // ──────────────────────────────────────────────────────────────

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        showCloseButton={false}
        className={`
          ${isMaximized 
            ? "max-w-[100vw] w-full h-full rounded-none" 
            : "max-w-5xl w-[95vw] h-[92vh] rounded-xl"} 
          overflow-hidden bg-[#1a1a1a] text-white border-[#333] p-0 transition-all duration-300
          flex flex-col fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
        `}
      >
        {/* Header */}
        <DialogHeader className="p-5 border-b border-[#333]/60 bg-[#1e1e1e] flex-shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-xl font-bold leading-tight break-words">
                {cardTitle}
              </DialogTitle>
              <p className="text-sm text-gray-400 mt-1">
                na lista <span className="font-medium text-gray-300 underline">{listName}</span>
              </p>
            </div>

            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" onClick={() => setIsMaximized(!isMaximized)}>
                {isMaximized ? <Minimize2 /> : <Maximize2 />}
              </Button>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X />
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Main content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left – Main content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-10 custom-scrollbar">
            {/* Quick info row */}
            <div className="flex flex-wrap gap-6">
              {labels?.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-gray-500 uppercase mb-1.5">Etiquetas</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {labels.map((label: any) => (
                      <div
                        key={label.id}
                        className="px-3 py-1 rounded text-xs font-semibold text-white shadow-sm"
                        style={{ backgroundColor: label.color }}
                      >
                        {label.label}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {card?.dueDate && (
                <div>
                  <h4 className="text-xs font-bold text-gray-500 uppercase mb-1.5">Prazo</h4>
                  <div className={`flex items-center gap-2 px-3 py-1 rounded text-sm ${
                    new Date(card.dueDate) < new Date() ? "bg-red-950/40 text-red-300" : "bg-[#2a2a2a] text-gray-200"
                  }`}>
                    <Clock size={14} />
                    {format(new Date(card.dueDate), "dd MMM yyyy", { locale: ptBR })}
                  </div>
                </div>
              )}
            </div>

            {/* Description */}
            <section className="space-y-3">
              <div className="flex items-center gap-3">
                <AlignLeft className="text-gray-400" />
                <h3 className="font-semibold text-lg">Descrição</h3>
              </div>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onBlur={() => {/* call update mutation if changed */}}
                placeholder="Adicione uma descrição mais detalhada..."
                className="w-full min-h-[140px] bg-[#222] border border-[#333] rounded-lg p-4 text-sm resize-y focus:border-accent/60 focus:bg-[#252525] transition-colors"
              />
            </section>

            {/* Custom Fields – example with grid */}
            <section className="space-y-3">
              <div className="flex items-center gap-3">
                <LayoutGrid className="text-gray-400" />
                <h3 className="font-semibold text-lg">Campos personalizados</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {/* MAPA DE CALOR */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-500 uppercase">Mapa de Calor</label>
                  <Select value={getCustomFieldValue("Mapa de Calor")}>
                    <SelectTrigger className="bg-[#222] border-[#333]">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Baixo">Baixo</SelectItem>
                      <SelectItem value="Médio">Médio</SelectItem>
                      <SelectItem value="Alto">Alto</SelectItem>
                      <SelectItem value="Crítico">Crítico</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* STATUS & CLASSIFICAÇÃO → add more as needed */}
              </div>
            </section>

            {/* Checklist */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CheckSquare className="text-gray-400" />
                  <h3 className="font-semibold text-lg">Checklist</h3>
                </div>
                <div className="text-sm font-medium text-gray-400">
                  {Math.round(checklistProgress)}%
                </div>
              </div>
              <Progress value={checklistProgress} className="h-2 bg-[#222]" indicatorClassName="bg-accent" />
              {/* ... rest of checklist items ... */}
            </section>

            {/* Comments – keep mostly the same */}
            {/* ... */}
          </div>

          {/* Right – Sidebar (actions + add-ons) */}
          <div className="w-72 border-l border-[#333] bg-[#1e1e1e] p-5 space-y-8 overflow-y-auto custom-scrollbar">
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide">Adicionar ao cartão</h4>
              <div className="grid grid-cols-2 gap-3">
                <SidebarActionButton icon={Tag}       label="Etiquetas" onClick={() => { /* open popover or modal */ }} />
                <SidebarActionButton icon={CheckSquare} label="Checklist" />
                <SidebarActionButton icon={Clock}      label="Datas" />
                <SidebarActionButton icon={Paperclip}  label="Anexar" />
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide">Ações</h4>
              <div className="space-y-2">
                <SidebarActionButton icon={Copy}    label="Espelhar"    onClick={() => setIsMirrorDialogOpen(true)} />
                <SidebarActionButton icon={Archive} label="Arquivar"   variant="amber" />
                <Separator className="my-3 bg-[#444]" />
                <SidebarActionButton icon={Trash}   label="Excluir"    variant="red"   onClick={handleDeleteCard} />
              </div>
            </div>
          </div>
        </div>

        {/* Mirror Dialog – keep the same */}
      </DialogContent>
    </Dialog>
  );
}

// Small helper component to standardize sidebar buttons
function SidebarActionButton({
  icon: Icon,
  label,
  onClick,
  variant = "default",
}: {
  icon: any;
  label: string;
  onClick?: () => void;
  variant?: "default" | "amber" | "red";
}) {
  const variantStyles = {
    default: "hover:bg-[#333]",
    amber:   "hover:bg-amber-950/40 text-amber-300",
    red:     "hover:bg-red-950/40 text-red-400",
  };

  return (
    <Button
      variant="ghost"
      className={`w-full justify-start gap-3 h-10 text-sm font-medium ${variantStyles[variant]}`}
      onClick={onClick}
    >
      <Icon size={18} />
      {label}
    </Button>
  );
}
