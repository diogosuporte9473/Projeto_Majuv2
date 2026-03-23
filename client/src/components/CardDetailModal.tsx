import React, { useState, useEffect, useRef } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { 
  X, 
  Plus, 
  Trash2, 
  Tag, 
  CheckSquare, 
  Calendar, 
  Loader2, 
  AlignLeft, 
  LayoutGrid, 
  ChevronDown,
  Clock,
  Settings2,
  Copy,
  User as UserIcon,
  CalendarDays,
  Archive,
  Trash,
  MessageSquare,
  Paperclip,
  Send,
  MoreVertical,
  Maximize2,
  Minimize2
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAuth } from "@/_core/hooks/useAuth";

interface CardDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  cardId: number;
  cardTitle: string;
  cardDescription?: string;
  listName?: string;
}

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

  // Queries
  const { data: card, isLoading: cardLoading } = trpc.cards.getDetails.useQuery({ id: cardId });
  const { data: labels } = trpc.cardDetails.getLabels.useQuery({ cardId });
  const { data: checklists, isLoading: checklistsLoading } = trpc.cardDetails.getChecklists.useQuery({ cardId });
  const { data: comments } = trpc.cardDetails.getComments.useQuery({ cardId });
  const { data: attachments } = trpc.cardDetails.getAttachments.useQuery({ cardId });
  const { data: customFields } = trpc.cardDetails.getCustomFields.useQuery({ cardId });
  const { data: projectDates } = trpc.cardDetails.getProjectDates.useQuery({ cardId });

  // Mutations
  const addLabelMutation = trpc.cardDetails.addLabel.useMutation();
  const deleteLabelMutation = trpc.cardDetails.deleteLabel.useMutation();
  const addChecklistMutation = trpc.cardDetails.addChecklist.useMutation();
  const updateChecklistMutation = trpc.cardDetails.updateChecklistItem.useMutation();
  const deleteChecklistMutation = trpc.cardDetails.deleteChecklist.useMutation();
  const upsertProjectDatesMutation = trpc.cardDetails.upsertProjectDates.useMutation();
  const updateDescriptionMutation = trpc.cardDetails.updateDescription.useMutation();
  const updateDueDateMutation = trpc.cardDetails.updateDueDate.useMutation();
  const updateAssignedToMutation = trpc.cardDetails.updateAssignedTo.useMutation();
  const upsertCustomFieldMutation = trpc.cards.upsertCustomField.useMutation();
  const updateCustomFieldMutation = trpc.cardDetails.updateCustomField.useMutation();
  const deleteCustomFieldMutation = trpc.cardDetails.deleteCustomField.useMutation();
  const createMirrorMutation = trpc.cardDetails.createMirror.useMutation();
  const archiveCardMutation = trpc.cardDetails.archiveCard.useMutation();
  const deleteCardMutation = trpc.cards.delete.useMutation();
  const addCommentMutation = trpc.cardDetails.addComment.useMutation();
  const deleteCommentMutation = trpc.cardDetails.deleteComment.useMutation();

  const [newLabel, setNewLabel] = useState("");
  const [newLabelColor, setNewLabelColor] = useState("#4b4897");
  const [newChecklistTitle, setNewChecklistTitle] = useState("");
  const [description, setDescription] = useState(cardDescription || "");
  const [isEditingCustomFields, setIsEditingCustomFields] = useState(false);
  const [newComment, setNewComment] = useState("");
  
  // Mirroring states
  const [isMirrorDialogOpen, setIsMirrorDialogOpen] = useState(false);
  const [selectedBoardId, setSelectedBoardId] = useState<string>("");
  const [selectedListId, setSelectedListId] = useState<string>("");

  const { data: userBoards } = trpc.boards.list.useQuery();
  const { data: allUsers } = trpc.admin.users.list.useQuery();
  const { data: targetLists } = trpc.lists.getByBoard.useQuery(
    { boardId: parseInt(selectedBoardId) },
    { enabled: !!selectedBoardId }
  );

  // Visibility states for optional sections
  const [showLabels, setShowLabels] = useState(false);
  const [showChecklist, setShowChecklist] = useState(false);
  const [showDates, setShowDates] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);

  // Scroll references
  const descriptionRef = useRef<HTMLDivElement>(null);
  const customFieldsRef = useRef<HTMLDivElement>(null);
  const checklistRef = useRef<HTMLDivElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const datesRef = useRef<HTMLDivElement>(null);
  const commentsRef = useRef<HTMLDivElement>(null);

  const handleUpdateDueDate = async (date: Date | null) => {
    try {
      await updateDueDateMutation.mutateAsync({ cardId, dueDate: date });
      toast.success("Data atualizada");
      utils.cards.get.invalidate({ id: cardId });
    } catch (error) {
      toast.error("Erro ao atualizar data");
    }
  };

  const scrollToSection = (ref: React.RefObject<HTMLDivElement | null>) => {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  useEffect(() => {
    setDescription(cardDescription || "");
  }, [cardDescription]);

  // Auto-scroll to sections when they are toggled on
  useEffect(() => {
    if (showLabels) scrollToSection(labelsRef);
  }, [showLabels]);

  useEffect(() => {
    if (showChecklist) scrollToSection(checklistRef);
  }, [showChecklist]);

  useEffect(() => {
    if (showDates) scrollToSection(datesRef);
  }, [showDates]);

  const handleCreateMirror = async () => {
    if (!selectedBoardId || !selectedListId) {
      toast.error("Selecione um quadro e uma lista");
      return;
    }

    try {
      await createMirrorMutation.mutateAsync({
        cardId,
        targetBoardId: parseInt(selectedBoardId),
        targetListId: parseInt(selectedListId)
      });
      toast.success("Cartão espelhado com sucesso!");
      setIsMirrorDialogOpen(false);
    } catch (error: any) {
      toast.error("Erro ao espelhar cartão: " + error.message);
    }
  };

  const handleArchiveCard = async () => {
    try {
      await archiveCardMutation.mutateAsync({ id: cardId, archived: true });
      toast.success("Cartão arquivado");
      onClose();
      utils.cards.getByList.invalidate();
    } catch (error) {
      toast.error("Erro ao arquivar cartão");
    }
  };

  const handleDeleteCard = async () => {
    if (!confirm("Tem certeza que deseja excluir permanentemente este cartão?")) return;
    try {
      await deleteCardMutation.mutateAsync({ id: cardId });
      toast.success("Cartão excluído");
      onClose();
      utils.cards.getByList.invalidate();
    } catch (error) {
      toast.error("Erro ao excluir cartão");
    }
  };

  const handleAddLabel = async () => {
    if (!newLabel.trim()) {
      toast.error("Nome da etiqueta é obrigatório");
      return;
    }
    try {
      await addLabelMutation.mutateAsync({ cardId, label: newLabel, color: newLabelColor });
      await utils.cardDetails.getLabels.invalidate({ cardId });
      setNewLabel("");
      setNewLabelColor("#4b4897");
      toast.success("Etiqueta adicionada");
    } catch (error) {
      toast.error("Erro ao adicionar etiqueta");
    }
  };

  const handleRemoveLabel = async (id: number) => {
    try {
      await deleteLabelMutation.mutateAsync({ id });
      await utils.cardDetails.getLabels.invalidate({ cardId });
      toast.success("Etiqueta removida");
    } catch (error) {
      toast.error("Erro ao remover etiqueta");
    }
  };

  const handleAddChecklist = async () => {
    if (!newChecklistTitle.trim()) {
      toast.error("Título do checklist é obrigatório");
      return;
    }
    try {
      await addChecklistMutation.mutateAsync({ cardId, title: newChecklistTitle });
      await utils.cardDetails.getChecklists.invalidate({ cardId });
      setNewChecklistTitle("");
      toast.success("Item de checklist adicionado");
    } catch (error) {
      toast.error("Erro ao adicionar item");
    }
  };

  const handleUpdateChecklistItem = async (id: number, data: { completed?: boolean, title?: string, dueDate?: Date | null, assignedUserId?: number | null }) => {
    try {
      await updateChecklistMutation.mutateAsync({ id, ...data });
      await utils.cardDetails.getChecklists.invalidate({ cardId });
    } catch (error) {
      toast.error("Erro ao atualizar item");
    }
  };

  const handleRemoveChecklist = async (id: number) => {
    try {
      await deleteChecklistMutation.mutateAsync({ id });
      await utils.cardDetails.getChecklists.invalidate({ cardId });
      toast.success("Item de checklist removido");
    } catch (error) {
      toast.error("Erro ao remover item");
    }
  };

  const handleUpdateDates = async (start: string | undefined, end: string | undefined) => {
    try {
      const startDate = start ? new Date(start) : null;
      const endDate = end ? new Date(end) : null;
      
      await upsertProjectDatesMutation.mutateAsync({
        cardId,
        startDate,
        endDate,
      });
      await utils.cardDetails.getProjectDates.invalidate({ cardId });
      toast.success("Datas atualizadas");
    } catch (error) {
      toast.error("Erro ao atualizar datas");
    }
  };

  const handleUpdateDescription = async () => {
    if (description === cardDescription) return;
    try {
      await updateDescriptionMutation.mutateAsync({
        cardId,
        description,
      });
      toast.success("Descrição atualizada");
    } catch (error) {
      toast.error("Erro ao atualizar descrição");
    }
  };

  const getCustomFieldValue = (fieldName: string) => {
    return customFields?.find((f: any) => f.fieldName === fieldName)?.fieldValue || "";
  };

  const handleUpsertCustomField = async (fieldName: string, fieldValue: string) => {
    try {
      await upsertCustomFieldMutation.mutateAsync({
        cardId,
        fieldName,
        fieldValue,
      });
      await utils.cardDetails.getCustomFields.invalidate({ cardId });
    } catch (error) {
      toast.error("Erro ao atualizar campo");
    }
  };

  const handleDeleteCustomField = async (id: number) => {
    try {
      await deleteCustomFieldMutation.mutateAsync({ id });
      await utils.cardDetails.getCustomFields.invalidate({ cardId });
    } catch (error) {
      toast.error("Erro ao remover campo");
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    try {
      await addCommentMutation.mutateAsync({ cardId, content: newComment });
      setNewComment("");
      await utils.cardDetails.getComments.invalidate({ cardId });
    } catch (error) {
      toast.error("Erro ao adicionar comentário");
    }
  };

  const handleDeleteComment = async (id: number) => {
    try {
      await deleteCommentMutation.mutateAsync({ id });
      await utils.cardDetails.getComments.invalidate({ cardId });
    } catch (error) {
      toast.error("Erro ao remover comentário");
    }
  };

  const checklistProgress = checklists?.length 
    ? (checklists.filter((i: any) => i.completed).length / checklists.length) * 100 
    : 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        showCloseButton={false}
        aria-describedby="card-detail-description"
        className={`${isMaximized ? "max-w-[100vw] w-full h-full rounded-none" : "max-w-4xl w-[95vw] h-[90vh] rounded-xl"} overflow-hidden bg-[#1a1a1a] text-white border-[#333] p-0 gap-0 transition-all duration-300 flex flex-col fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2`}
      >
        <div id="card-detail-description" className="sr-only">
          Detalhes do cartão {cardTitle}
        </div>
        
        {/* Header fixo */}
        <DialogHeader className="p-4 sm:p-6 pb-4 flex-shrink-0 border-b border-[#333]/50 bg-[#1a1a1a] z-10">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4 flex-1 min-w-0">
              <div className="mt-1 w-8 h-8 rounded bg-accent/20 flex items-center justify-center flex-shrink-0">
                <LayoutGrid className="w-5 h-5 text-accent" />
              </div>
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-lg sm:text-xl font-bold leading-tight break-words pr-2">{cardTitle}</DialogTitle>
                <p className="text-xs sm:text-sm text-gray-400 mt-1">na lista <span className="underline font-medium text-gray-300">{listName}</span></p>
              </div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setIsMaximized(!isMaximized)}
                className="text-gray-400 hover:text-white hover:bg-white/10 w-8 h-8 sm:w-10 sm:h-10 transition-colors"
                title={isMaximized ? "Minimizar" : "Maximizar"}
              >
                {isMaximized ? <Minimize2 className="w-4 h-4 sm:w-5 sm:h-5" /> : <Maximize2 className="w-4 h-4 sm:w-5 sm:h-5" />}
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={onClose}
                className="text-gray-400 hover:text-white hover:bg-white/10 w-8 h-8 sm:w-10 sm:h-10 transition-colors"
              >
                <X className="w-5 h-5 sm:w-6 sm:h-6" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Área de conteúdo com scroll */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-6 pt-2 custom-scrollbar">
          <div className="flex flex-col md:flex-row gap-8">
            
            {/* Coluna Principal (Esquerda) */}
            <div className="flex-1 space-y-8 min-w-0">
              
              {/* Labels & Dates Badges (Visualização rápida) */}
              <div className="flex flex-wrap gap-6">
                {(labels && labels.length > 0) && (
                  <div className="space-y-2">
                    <h4 className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Etiquetas</h4>
                    <div className="flex flex-wrap gap-1">
                      {labels.map((label: any) => (
                        <div
                          key={label.id}
                          className="px-3 py-1.5 rounded-sm text-white text-[11px] font-bold min-w-[40px] text-center shadow-sm"
                          style={{ backgroundColor: label.color }}
                        >
                          {label.label}
                        </div>
                      ))}
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className="w-8 h-7 bg-[#2a2a2a] border-none hover:bg-[#333]"
                        onClick={() => setShowLabels(!showLabels)}
                      >
                        <Plus className="w-4 h-4 text-gray-400" />
                      </Button>
                    </div>
                  </div>
                )}

                {card?.dueDate && (
                  <div className="space-y-2">
                    <h4 className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Data de entrega</h4>
                    <div className="flex items-center gap-2 bg-[#2a2a2a] px-3 py-1.5 rounded-sm border border-[#333] shadow-sm">
                      <Clock className={`w-3.5 h-3.5 ${new Date(card.dueDate) < new Date() ? "text-red-400" : "text-gray-400"}`} />
                      <span className="text-[11px] font-medium text-gray-200">
                        {format(new Date(card.dueDate), "dd 'de' MMM 'às' HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Editores condicionais (Inline) */}
              {showLabels && (
                <section ref={labelsRef} className="bg-[#222] p-4 rounded-lg border border-[#333] animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Tag className="w-4 h-4 text-accent" />
                      <h3 className="font-semibold text-sm">Gerenciar Etiquetas</h3>
                    </div>
                    <Button variant="ghost" size="icon-sm" onClick={() => setShowLabels(false)}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-2 mb-4">
                    <input
                      type="text"
                      value={newLabel}
                      onChange={(e) => setNewLabel(e.target.value)}
                      placeholder="Nome da etiqueta..."
                      className="bg-[#1a1a1a] border border-[#333] rounded px-3 py-1.5 text-sm flex-1 outline-none focus:ring-1 focus:ring-accent"
                    />
                    <input
                      type="color"
                      value={newLabelColor}
                      onChange={(e) => setNewLabelColor(e.target.value)}
                      className="w-8 h-8 rounded bg-transparent border-none cursor-pointer p-0"
                    />
                    <Button onClick={handleAddLabel} size="sm" className="bg-accent text-white hover:bg-accent/90 h-8">
                      Adicionar
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {labels?.map((label: any) => (
                      <div
                        key={label.id}
                        className="flex items-center gap-2 px-2 py-1 rounded text-white text-[11px] font-bold group"
                        style={{ backgroundColor: label.color }}
                      >
                        {label.label}
                        <button onClick={() => handleRemoveLabel(label.id)} className="hover:bg-black/20 rounded p-0.5">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {showDates && (
                <section ref={datesRef} className="bg-[#222] p-4 rounded-lg border border-[#333] animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2 text-accent font-semibold">
                      <Calendar className="w-4 h-4" />
                      <h3 className="text-sm">Definir Data de Entrega</h3>
                    </div>
                    <Button variant="ghost" size="icon-sm" onClick={() => setShowDates(false)}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="bg-[#1a1a1a] p-2 rounded border border-[#333] flex items-center gap-3 relative hover:bg-[#2a2a2a] transition-colors group cursor-pointer flex-1">
                      <Calendar className="w-4 h-4 text-gray-400 group-hover:text-accent" />
                      <span className="text-sm font-medium">
                        {card?.dueDate ? format(new Date(card.dueDate), "dd/MM/yyyy", { locale: ptBR }) : "Escolher uma data"}
                      </span>
                      <input 
                        type="date" 
                        className="bg-transparent border-none outline-none text-xs w-full cursor-pointer opacity-0 absolute inset-0"
                        onChange={(e) => handleUpdateDueDate(e.target.value ? new Date(e.target.value) : null)}
                        defaultValue={card?.dueDate ? new Date(card.dueDate).toISOString().split('T')[0] : ''}
                      />
                    </div>
                    {card?.dueDate && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-xs text-red-400 hover:text-red-500 hover:bg-red-500/10 h-9 px-4"
                        onClick={() => handleUpdateDueDate(null)}
                      >
                        Remover
                      </Button>
                    )}
                  </div>
                </section>
              )}

              {/* Description */}
              <section ref={descriptionRef} className="space-y-4">
                <div className="flex items-center gap-3">
                  <AlignLeft className="w-5 h-5 text-gray-400" />
                  <h3 className="font-bold text-lg text-gray-200">Descrição</h3>
                </div>
                <div className="ml-9">
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    onBlur={handleUpdateDescription}
                    placeholder="Adicione uma descrição mais detalhada..."
                    className="w-full bg-[#2a2a2a]/50 border border-transparent hover:border-[#444] focus:bg-[#2a2a2a] rounded-lg p-4 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-accent min-h-[120px] resize-none transition-all"
                  />
                </div>
              </section>

              {/* Custom Fields */}
              <section ref={customFieldsRef} className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <LayoutGrid className="w-5 h-5 text-gray-400" />
                    <h3 className="font-bold text-lg text-gray-200">Campos personalizados</h3>
                  </div>
                </div>

                <div className="ml-9 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 bg-[#222]/30 p-4 rounded-xl border border-[#333]/50">
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                      <div className="w-1.5 h-1.5 rounded-full bg-red-400" /> Mapa de Calor
                    </label>
                    <Select 
                      value={getCustomFieldValue("Mapa de Calor")} 
                      onValueChange={(val) => handleUpsertCustomField("Mapa de Calor", val)}
                    >
                      <SelectTrigger className="bg-[#2a2a2a] border-none text-gray-300 h-9 text-xs shadow-sm hover:bg-[#333]">
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent className="bg-[#1a1a1a] border-[#333] text-white">
                        <SelectItem value="Baixo">Baixo</SelectItem>
                        <SelectItem value="Médio">Médio</SelectItem>
                        <SelectItem value="Alto">Alto</SelectItem>
                        <SelectItem value="Crítico">Crítico</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-400" /> Status
                    </label>
                    <Select 
                      value={getCustomFieldValue("Status")} 
                      onValueChange={(val) => handleUpsertCustomField("Status", val)}
                    >
                      <SelectTrigger className="bg-[#2a2a2a] border-none text-gray-300 h-9 text-xs shadow-sm hover:bg-[#333]">
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent className="bg-[#1a1a1a] border-[#333] text-white">
                        <SelectItem value="Aguardando">Aguardando</SelectItem>
                        <SelectItem value="Em progresso">Em progresso</SelectItem>
                        <SelectItem value="Concluído">Concluído</SelectItem>
                        <SelectItem value="Pausado">Pausado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-400" /> Classificação
                    </label>
                    <Select 
                      value={getCustomFieldValue("Classificação do Cliente")} 
                      onValueChange={(val) => handleUpsertCustomField("Classificação do Cliente", val)}
                    >
                      <SelectTrigger className="bg-[#2a2a2a] border-none text-gray-300 h-9 text-xs shadow-sm hover:bg-[#333]">
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent className="bg-[#1a1a1a] border-[#333] text-white">
                        <SelectItem value="Bronze">Bronze</SelectItem>
                        <SelectItem value="Prata">Prata</SelectItem>
                        <SelectItem value="Ouro">Ouro</SelectItem>
                        <SelectItem value="Diamante">Diamante</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </section>

              {/* Checklist */}
              <section ref={checklistRef} className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CheckSquare className="w-5 h-5 text-gray-400" />
                    <h3 className="font-bold text-lg text-gray-200">Checklist</h3>
                  </div>
                  <div className="text-[11px] font-bold text-gray-500 bg-[#2a2a2a] px-2 py-1 rounded">
                    {Math.round(checklistProgress)}%
                  </div>
                </div>
                
                <div className="ml-9 space-y-4">
                  <div className="h-2 w-full bg-[#2a2a2a] rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-accent transition-all duration-500 ease-out shadow-[0_0_10px_rgba(var(--accent),0.5)]"
                      style={{ width: `${checklistProgress}%` }}
                    />
                  </div>

                  <div className="space-y-1">
                    {checklistsLoading ? (
                      <div className="flex justify-center py-4">
                        <Loader2 className="w-6 h-6 animate-spin text-accent" />
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {checklists?.map((item: any) => {
                          const assignedUser = allUsers?.find((u: any) => u.id === item.assigned_user_id);
                          const isOverdue = item.due_date && new Date(item.due_date) < new Date() && !item.completed;
                          
                          return (
                            <div key={item.id} className="group flex items-start gap-4 p-2 rounded-lg hover:bg-white/5 transition-colors">
                              <input
                                type="checkbox"
                                checked={item.completed}
                                onChange={() => handleUpdateChecklistItem(item.id, { completed: !item.completed })}
                                className="w-5 h-5 mt-1 rounded border-[#444] bg-[#1a1a1a] text-accent focus:ring-0 focus:ring-offset-0 cursor-pointer"
                              />
                              <div className="flex-1 min-w-0 space-y-1">
                                <div className="flex items-center justify-between gap-2">
                                  <input
                                    defaultValue={item.title}
                                    onBlur={(e) => handleUpdateChecklistItem(item.id, { title: e.target.value })}
                                    className={`text-sm flex-1 bg-transparent border-none p-0 focus:ring-0 focus:outline-none ${item.completed ? "line-through text-gray-500" : "text-gray-200"}`}
                                  />
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <button className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-white/10 transition-all">
                                        <MoreVertical className="w-4 h-4 text-gray-500" />
                                      </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent className="bg-[#1a1a1a] border-[#333] text-white">
                                      <DropdownMenuItem onClick={() => handleRemoveChecklist(item.id)} className="text-red-400 focus:text-red-400 focus:bg-red-400/10 cursor-pointer text-xs">
                                        <Trash2 className="w-3.5 h-3.5 mr-2" /> Remover item
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>

                                <div className="flex flex-wrap items-center gap-3">
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <button className={`flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-sm transition-colors ${
                                        item.completed ? "bg-green-500/10 text-green-500" : 
                                        isOverdue ? "bg-red-500/10 text-red-500" : 
                                        item.due_date ? "bg-blue-500/10 text-blue-400" : "bg-[#2a2a2a] text-gray-500 hover:bg-[#333]"
                                      }`}>
                                        <CalendarDays className="w-3 h-3" />
                                        {item.due_date ? format(new Date(item.due_date), "dd MMM", { locale: ptBR }) : "Adicionar data"}
                                      </button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0 bg-[#1a1a1a] border-[#333]">
                                      <input 
                                        type="date" 
                                        className="bg-[#1a1a1a] text-white p-3 text-xs outline-none border-none"
                                        onChange={(e) => handleUpdateChecklistItem(item.id, { dueDate: e.target.value ? new Date(e.target.value) : null })}
                                      />
                                    </PopoverContent>
                                  </Popover>

                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <button className="flex items-center gap-2 group/avatar">
                                        {assignedUser ? (
                                          <Avatar className="w-5 h-5 border border-white/10 shadow-sm ring-2 ring-transparent group-hover/avatar:ring-accent/50 transition-all">
                                            <AvatarFallback className="text-[9px] bg-accent text-white font-bold">
                                              {assignedUser.name?.charAt(0).toUpperCase()}
                                            </AvatarFallback>
                                          </Avatar>
                                        ) : (
                                          <div className="w-5 h-5 rounded-full bg-[#2a2a2a] flex items-center justify-center border border-dashed border-gray-600 group-hover/avatar:border-accent group-hover/avatar:bg-[#333] transition-all">
                                            <UserIcon className="w-3 h-3 text-gray-500 group-hover/avatar:text-accent" />
                                          </div>
                                        )}
                                      </button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-64 p-0 bg-[#1a1a1a] border-[#333] shadow-2xl overflow-hidden">
                                      <div className="bg-[#222] px-3 py-2 border-b border-[#333]">
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Atribuir a...</p>
                                      </div>
                                      <div className="max-h-60 overflow-y-auto p-1 custom-scrollbar">
                                        <button 
                                          onClick={() => handleUpdateChecklistItem(item.id, { assignedUserId: null })}
                                          className="w-full text-left px-3 py-2 rounded hover:bg-white/5 text-xs text-gray-400 transition-colors"
                                        >
                                          Ninguém
                                        </button>
                                        {allUsers?.map((u: any) => (
                                          <button 
                                            key={u.id}
                                            onClick={() => handleUpdateChecklistItem(item.id, { assignedUserId: u.id })}
                                            className="w-full flex items-center gap-3 px-3 py-2 rounded hover:bg-white/5 text-xs text-white transition-colors"
                                          >
                                            <Avatar className="w-6 h-6">
                                              <AvatarFallback className="text-[10px] bg-accent text-white font-bold">
                                                {u.name?.charAt(0).toUpperCase()}
                                              </AvatarFallback>
                                            </Avatar>
                                            <span className="truncate font-medium">{u.name || u.username}</span>
                                          </button>
                                        ))}
                                      </div>
                                    </PopoverContent>
                                  </Popover>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <div className="pt-2">
                      <div className="relative">
                        <input
                          type="text"
                          value={newChecklistTitle}
                          onChange={(e) => setNewChecklistTitle(e.target.value)}
                          placeholder="Adicionar um item..."
                          className="w-full bg-[#2a2a2a]/30 hover:bg-[#2a2a2a]/50 border border-transparent focus:border-accent/30 rounded-lg px-4 py-2.5 text-sm text-gray-200 outline-none transition-all placeholder:text-gray-600"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleAddChecklist();
                            if (e.key === "Escape") setNewChecklistTitle("");
                          }}
                        />
                        <Plus className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600 pointer-events-none" />
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Comments */}
              <section ref={commentsRef} className="space-y-6 pt-4">
                <div className="flex items-center gap-3">
                  <MessageSquare className="w-5 h-5 text-gray-400" />
                  <h3 className="font-bold text-lg text-gray-200">Comentários</h3>
                </div>
                
                <div className="ml-9 space-y-8">
                  <div className="flex gap-4">
                    <Avatar className="w-9 h-9 border border-white/10 flex-shrink-0">
                      <AvatarFallback className="bg-accent text-white text-xs font-bold">
                        {currentUser?.name?.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 space-y-3">
                      <div className="relative group">
                        <textarea
                          value={newComment}
                          onChange={(e) => setNewComment(e.target.value)}
                          placeholder="Escreva um comentário..."
                          className="w-full bg-[#2a2a2a]/50 border border-transparent hover:border-[#444] focus:border-accent/30 focus:bg-[#2a2a2a] rounded-xl p-4 text-sm text-gray-200 placeholder-gray-600 focus:outline-none min-h-[100px] resize-none transition-all shadow-inner"
                        />
                      </div>
                      <div className="flex justify-end">
                        <Button 
                          onClick={handleAddComment} 
                          size="sm" 
                          disabled={!newComment.trim() || addCommentMutation.isPending}
                          className="bg-accent hover:bg-accent/90 text-white gap-2 font-bold px-6 h-9 rounded-lg shadow-lg shadow-accent/20"
                        >
                          {addCommentMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-3.5 h-3.5" /> Enviar</>}
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6 pb-4">
                    {comments?.map((comment: any) => (
                      <div key={comment.id} className="flex gap-4 group/comment">
                        <Avatar className="w-9 h-9 border border-white/5 flex-shrink-0">
                          <AvatarFallback className="bg-[#222] text-gray-500 text-xs font-bold">
                            {comment.user?.name?.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 space-y-1.5 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-gray-200">{comment.user?.name || comment.user?.username}</span>
                            <span className="text-[10px] text-gray-500 font-medium">
                              {format(new Date(comment.created_at), "dd 'de' MMM 'às' HH:mm", { locale: ptBR })}
                            </span>
                          </div>
                          <div className="bg-[#222] p-4 rounded-2xl rounded-tl-none text-sm text-gray-300 border border-[#333]/50 shadow-sm leading-relaxed break-words">
                            {comment.content}
                          </div>
                          {(comment.user_id === currentUser?.id || currentUser?.role === 'admin') && (
                            <button 
                              onClick={() => handleDeleteComment(comment.id)}
                              className="text-[10px] text-gray-500 hover:text-red-400 font-bold transition-colors opacity-0 group-hover/comment:opacity-100 px-1"
                            >
                              Excluir
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            </div>

            {/* Coluna Lateral (Direita) - Barra de Ações */}
            <div className="w-full md:w-52 space-y-8 flex-shrink-0">
              <div className="space-y-3">
                <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] px-1">Adicionar ao card</h4>
                <div className="flex flex-col gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setShowLabels(!showLabels)}
                    className={`justify-start bg-[#2a2a2a] border-none hover:bg-[#333] text-white gap-2.5 h-9 text-[11px] font-semibold transition-all ${showLabels ? "bg-accent/20 text-accent" : ""}`}
                  >
                    <Tag className="w-4 h-4" /> Etiquetas
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setShowChecklist(!showChecklist)}
                    className={`justify-start bg-[#2a2a2a] border-none hover:bg-[#333] text-white gap-2.5 h-9 text-[11px] font-semibold transition-all ${showChecklist ? "bg-accent/20 text-accent" : ""}`}
                  >
                    <CheckSquare className="w-4 h-4" /> Checklist
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setShowDates(!showDates)}
                    className={`justify-start bg-[#2a2a2a] border-none hover:bg-[#333] text-white gap-2.5 h-9 text-[11px] font-semibold transition-all ${showDates ? "bg-accent/20 text-accent" : ""}`}
                  >
                    <Clock className="w-4 h-4" /> Datas
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="justify-start bg-[#2a2a2a] border-none hover:bg-[#333] text-white gap-2.5 h-9 text-[11px] font-semibold transition-all"
                  >
                    <Paperclip className="w-4 h-4" /> Anexar
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] px-1">Ações</h4>
                <div className="flex flex-col gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setIsMirrorDialogOpen(true)}
                    className="justify-start bg-[#2a2a2a] border-none hover:bg-[#333] text-white gap-2.5 h-9 text-[11px] font-semibold transition-all"
                  >
                    <Copy className="w-4 h-4" /> Espelhar
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleArchiveCard}
                    className="justify-start bg-[#2a2a2a] border-none hover:bg-amber-600/20 text-white gap-2.5 h-9 text-[11px] font-semibold transition-all"
                  >
                    <Archive className="w-4 h-4" /> Arquivar
                  </Button>
                  <Separator className="my-1 bg-[#333]" />
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleDeleteCard}
                    className="justify-start bg-[#2a2a2a] border-none hover:bg-red-600/20 text-red-400 gap-2.5 h-9 text-[11px] font-semibold transition-all"
                  >
                    <Trash className="w-4 h-4" /> Excluir
                  </Button>
                </div>
              </div>

              {/* Anexos (se houver) */}
              {attachments && attachments.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] px-1">Anexos</h4>
                  <div className="space-y-2">
                    {attachments.map((file: any) => (
                      <a 
                        key={file.id} 
                        href={file.file_url} 
                        target="_blank" 
                        rel="noreferrer"
                        className="flex items-center gap-3 p-2 rounded bg-[#2a2a2a]/50 hover:bg-[#2a2a2a] transition-all border border-[#333]/30 group"
                      >
                        <div className="w-8 h-8 rounded bg-[#1a1a1a] flex items-center justify-center flex-shrink-0 group-hover:bg-accent/10 transition-colors">
                          <Paperclip className="w-3.5 h-3.5 text-gray-500 group-hover:text-accent" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-bold text-gray-300 truncate">{file.filename}</p>
                          <p className="text-[8px] text-gray-500 uppercase font-medium">{(file.file_size / 1024).toFixed(0)} KB</p>
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mirror Selection Modal */}
        <Dialog open={isMirrorDialogOpen} onOpenChange={setIsMirrorDialogOpen}>
          <DialogContent className="bg-[#1a1a1a] text-white border-[#333] max-w-md">
            <DialogHeader>
              <DialogTitle className="text-lg">Espelhar Cartão</DialogTitle>
              <p className="text-xs text-gray-400">Crie uma cópia sincronizada deste cartão em outro quadro.</p>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-gray-500 uppercase">Quadro de Destino</label>
                <Select value={selectedBoardId} onValueChange={(val) => {
                  setSelectedBoardId(val);
                  setSelectedListId("");
                }}>
                  <SelectTrigger className="bg-[#2a2a2a] border-none text-white h-11">
                    <SelectValue placeholder="Selecione um quadro..." />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a1a1a] border-[#333] text-white">
                    {userBoards?.map(board => (
                      <SelectItem key={board.id} value={board.id.toString()}>{board.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-bold text-gray-500 uppercase">Lista de Destino</label>
                <Select value={selectedListId} onValueChange={setSelectedListId} disabled={!selectedBoardId}>
                  <SelectTrigger className="bg-[#2a2a2a] border-none text-white h-11">
                    <SelectValue placeholder="Selecione uma lista..." />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a1a1a] border-[#333] text-white">
                    {targetLists?.map(list => (
                      <SelectItem key={list.id} value={list.id.toString()}>{list.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="ghost" onClick={() => setIsMirrorDialogOpen(false)} className="text-xs">Cancelar</Button>
              <Button 
                onClick={handleCreateMirror} 
                className="bg-accent hover:bg-accent/90 text-xs px-6"
                disabled={createMirrorMutation.isPending || !selectedListId}
              >
                {createMirrorMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Criar Espelho"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}
