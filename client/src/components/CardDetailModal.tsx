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
  CalendarDays, User as UserIcon, Edit2,
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
  const { data: mirrors } = trpc.cardDetails.getCardMirrors.useQuery({ cardId });

  // Mutations
  const addLabelMutation = trpc.cardDetails.addLabel.useMutation();
  const deleteLabelMutation = trpc.cardDetails.deleteLabel.useMutation();
  const addChecklistGroupMutation = trpc.cardDetails.addChecklistGroup.useMutation();
  const updateChecklistGroupMutation = trpc.cardDetails.updateChecklistGroup.useMutation();
  const deleteChecklistGroupMutation = trpc.cardDetails.deleteChecklistGroup.useMutation();
  const addChecklistMutation = trpc.cardDetails.addChecklist.useMutation();
  const updateChecklistMutation = trpc.cardDetails.updateChecklistItem.useMutation();
  const deleteChecklistMutation = trpc.cardDetails.deleteChecklist.useMutation();
  const upsertProjectDatesMutation = trpc.cardDetails.upsertProjectDates.useMutation();
  const updateDescriptionMutation = trpc.cardDetails.updateDescription.useMutation();
  const updateDueDateMutation = trpc.cardDetails.updateDueDate.useMutation();
  const updateStartDateMutation = trpc.cardDetails.updateStartDate.useMutation();
  const updateAssignedToMutation = trpc.cardDetails.updateAssignedTo.useMutation();
  const upsertCustomFieldMutation = trpc.cardDetails.upsertCustomField.useMutation();
  const createMirrorMutation = trpc.cardDetails.createMirror.useMutation();
  const archiveCardMutation = trpc.cardDetails.archiveCard.useMutation();
  const deleteCardMutation = trpc.cards.delete.useMutation();
  const addCommentMutation = trpc.cardDetails.addComment.useMutation();
  const deleteCommentMutation = trpc.cardDetails.deleteComment.useMutation();
  const addAttachmentMutation = trpc.cardDetails.addAttachment.useMutation();

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [description, setDescription] = useState(cardDescription || "");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(cardTitle);
  const [newComment, setNewComment] = useState("");
  const [isMaximized, setIsMaximized] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newLabelColor, setNewLabelColor] = useState("#4b4897");
  const [isCreatingChecklist, setIsCreatingChecklist] = useState(false);
  const [newChecklistGroupTitle, setNewChecklistGroupTitle] = useState("");
  const [editingGroupId, setEditingGroupId] = useState<number | null>(null);
  const [newChecklistItems, setNewChecklistItems] = useState<Record<number, string>>({});
  
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

  const updateCardMutation = trpc.cards.update.useMutation();

  useEffect(() => {
    setDescription(cardDescription || "");
  }, [cardDescription]);

  useEffect(() => {
    setEditedTitle(cardTitle);
  }, [cardTitle]);

  // Handlers
  const handleUpdateTitle = async () => {
    if (!editedTitle.trim() || editedTitle === cardTitle) {
      setIsEditingTitle(false);
      setEditedTitle(cardTitle);
      return;
    }
    try {
      await updateCardMutation.mutateAsync({
        id: cardId,
        title: editedTitle,
      });
      setIsEditingTitle(false);
      await utils.cards.getDetails.invalidate({ id: cardId });
      await utils.cards.getByList.invalidate();
      toast.success("Título do cartão atualizado");
    } catch (error) {
      toast.error("Erro ao atualizar título");
    }
  };
  const handleAddLabel = async () => {
    if (!newLabel.trim()) return;
    try {
      await addLabelMutation.mutateAsync({ cardId, label: newLabel, color: newLabelColor });
      setNewLabel("");
      await utils.cardDetails.getLabels.invalidate({ cardId });
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

  const handleAddChecklistGroup = async () => {
    const title = newChecklistGroupTitle.trim() || "Checklist";
    try {
      await addChecklistGroupMutation.mutateAsync({ cardId, title });
      setNewChecklistGroupTitle("");
      setIsCreatingChecklist(false);
      await utils.cardDetails.getChecklists.invalidate({ cardId });
      toast.success("Checklist criado");
    } catch (error) {
      toast.error("Erro ao criar checklist");
    }
  };

  const handleUpdateChecklistGroup = async (groupId: number, title: string) => {
    try {
      await updateChecklistGroupMutation.mutateAsync({ id: groupId, title });
      setEditingGroupId(null);
      await utils.cardDetails.getChecklists.invalidate({ cardId });
    } catch (error) {
      toast.error("Erro ao atualizar título do checklist");
    }
  };

  const handleDeleteChecklistGroup = async (groupId: number) => {
    if (!confirm("Tem certeza que deseja excluir este checklist inteiro?")) return;
    try {
      await deleteChecklistGroupMutation.mutateAsync({ id: groupId });
      await utils.cardDetails.getChecklists.invalidate({ cardId });
      toast.success("Checklist removido");
    } catch (error) {
      toast.error("Erro ao remover checklist");
    }
  };

  const handleAddChecklistItem = async (groupId: number) => {
    const title = newChecklistItems[groupId]?.trim();
    if (!title) return;
    try {
      await addChecklistMutation.mutateAsync({ cardId, groupId, title });
      setNewChecklistItems(prev => ({ ...prev, [groupId]: "" }));
      await utils.cardDetails.getChecklists.invalidate({ cardId });
    } catch (error) {
      toast.error("Erro ao adicionar item");
    }
  };

  const handleUpdateDueDate = async (date: Date | null) => {
    try {
      await updateDueDateMutation.mutateAsync({ cardId, dueDate: date });
      await utils.cards.getDetails.invalidate({ id: cardId });
      toast.success("Data de entrega atualizada");
    } catch (error) {
      toast.error("Erro ao atualizar data de entrega");
    }
  };

  const handleUpdateStartDate = async (date: Date | null) => {
    try {
      await updateStartDateMutation.mutateAsync({ cardId, startDate: date });
      await utils.cards.getDetails.invalidate({ id: cardId });
      toast.success("Data de início atualizada");
    } catch (error) {
      toast.error("Erro ao atualizar data de início");
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

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    try {
      await addCommentMutation.mutateAsync({ cardId, content: newComment });
      setNewComment("");
      await utils.cardDetails.getComments.invalidate({ cardId });
      toast.success("Comentário adicionado");
    } catch (error) {
      toast.error("Erro ao adicionar comentário");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      // Aqui integraria com Supabase Storage, mas para agora salvamos o metadado
      // Simulação de upload
      await addAttachmentMutation.mutateAsync({
        cardId,
        filename: file.name,
        fileUrl: "#", // URL temporária
        fileKey: `cards/${cardId}/${file.name}`,
        mimeType: file.type,
        fileSize: file.size,
      });
      await utils.cardDetails.getAttachments.invalidate({ cardId });
      toast.success("Arquivo anexado (Simulado)");
    } catch (error) {
      toast.error("Erro ao anexar arquivo");
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

  const handleUpsertCustomField = async (fieldName: string, fieldValue: string) => {
    try {
      await upsertCustomFieldMutation.mutateAsync({
        cardId,
        fieldName,
        fieldValue,
      });
      await utils.cardDetails.getCustomFields.invalidate({ cardId });
      toast.success(`${fieldName} atualizado`);
    } catch (error) {
      toast.error("Erro ao atualizar campo");
    }
  };

  const handleArchiveCard = async () => {
    try {
      await archiveCardMutation.mutateAsync({ id: cardId, archived: true });
      onClose();
      toast.success("Cartão arquivado");
    } catch (error) {
      toast.error("Erro ao arquivar cartão");
    }
  };

  const handleDeleteCard = async () => {
    if (!confirm("Tem certeza que deseja excluir este cartão?")) return;
    try {
      await deleteCardMutation.mutateAsync({ id: cardId });
      onClose();
      toast.success("Cartão excluído");
    } catch (error) {
      toast.error("Erro ao excluir cartão");
    }
  };

  const handleCreateMirror = async () => {
    if (!selectedListId || !selectedBoardId) return;
    try {
      await createMirrorMutation.mutateAsync({
        cardId,
        targetListId: parseInt(selectedListId),
        targetBoardId: parseInt(selectedBoardId),
      });
      setIsMirrorDialogOpen(false);
      toast.success("Cartão espelhado com sucesso");
    } catch (error) {
      toast.error("Erro ao espelhar cartão");
    }
  };

  const checklistProgress = checklists?.length 
    ? (checklists.filter((i: any) => i.completed).length / checklists.length) * 100 
    : 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        aria-describedby={undefined}
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
              {isEditingTitle ? (
                <div className="flex items-center gap-2 mb-1">
                  <input
                    type="text"
                    value={editedTitle}
                    onChange={(e) => setEditedTitle(e.target.value)}
                    className="text-xl font-bold bg-[#2a2a2a] border-b-2 border-accent outline-none text-white w-full px-2 py-1 rounded shadow-inner"
                    autoFocus
                    onBlur={handleUpdateTitle}
                    onKeyDown={(e) => e.key === "Enter" && handleUpdateTitle()}
                  />
                </div>
              ) : (
                <DialogTitle 
                  className="text-xl font-bold leading-tight break-words cursor-pointer hover:text-accent transition-colors flex items-center gap-2 group"
                  onClick={() => setIsEditingTitle(true)}
                >
                  {cardTitle}
                  <Edit2 className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                </DialogTitle>
              )}
              <p className="text-sm text-gray-400 mt-1 flex items-center gap-2">
                na lista <span className="font-medium text-gray-300 underline">{listName}</span>
                {(card?.startDate || card?.dueDate) && (
                  <>
                    <span className="text-gray-600">•</span>
                    <span className="flex items-center gap-1.5 text-[11px] font-medium text-gray-500">
                      <CalendarDays size={12} className="text-gray-600" />
                      {card.startDate && format(new Date(card.startDate), "dd/MM/yy")}
                      {card.startDate && card.dueDate && " — "}
                      {card.dueDate && format(new Date(card.dueDate), "dd/MM/yy")}
                    </span>
                  </>
                )}
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

        {/* Main content - Single Column Layout */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
          
          {/* Section 1: Quick Info & Actions Row */}
          <div className="flex flex-col md:flex-row justify-between gap-6 pb-6 border-b border-[#333]/30">
            <div className="flex flex-wrap gap-8">
              {labels && labels.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Etiquetas</h4>
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
                    <Button variant="ghost" size="icon" className="w-6 h-6 rounded-full bg-[#2a2a2a] hover:bg-[#333]">
                      <Plus className="w-3 h-3 text-gray-400" />
                    </Button>
                  </div>
                </div>
              )}

              {(card?.startDate || card?.dueDate) && (
                <div className="space-y-2">
                  <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Prazo</h4>
                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium ${ 
                    card.dueDate && new Date(card.dueDate) < new Date() ? "bg-red-950/40 text-red-300" : "bg-[#2a2a2a] text-gray-200" 
                  }`}>
                    <Clock size={14} />
                    {card.startDate && (
                      <span>
                        {format(new Date(card.startDate), "dd 'de' MMM", { locale: ptBR })} -{" "}
                      </span>
                    )}
                    {card.dueDate ? (
                      <span>{format(new Date(card.dueDate), "dd 'de' MMM, yyyy", { locale: ptBR })}</span>
                    ) : (
                      <span className="text-gray-500 italic">Sem data de entrega</span>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Adicionar ao cartão</h4>
              <div className="flex flex-wrap gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="bg-[#2a2a2a] border-none hover:bg-[#333] text-xs h-8">
                      <Tag className="w-3.5 h-3.5 mr-2" /> Etiquetas
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 bg-[#1a1a1a] border-[#333] p-4">
                    <div className="space-y-4">
                      <h3 className="text-sm font-bold text-gray-200">Etiquetas</h3>
                      <div className="flex flex-wrap gap-2">
                        {labels?.map((label: any) => (
                          <div
                            key={label.id}
                            className="flex items-center gap-2 px-2 py-1 rounded text-white text-[10px] font-bold group"
                            style={{ backgroundColor: label.color }}
                          >
                            {label.label}
                            <button onClick={() => handleRemoveLabel(label.id)} className="hover:bg-black/20 rounded p-0.5 transition-colors">
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                      <Separator className="bg-[#333]" />
                      <div className="space-y-3">
                        <input
                          type="text"
                          value={newLabel}
                          onChange={(e) => setNewLabel(e.target.value)}
                          placeholder="Nova etiqueta..."
                          className="w-full bg-[#2a2a2a] border border-[#333] rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-accent"
                        />
                        <div className="flex items-center justify-between gap-3">
                          <input
                            type="color"
                            value={newLabelColor}
                            onChange={(e) => setNewLabelColor(e.target.value)}
                            className="w-8 h-8 rounded bg-transparent border-none cursor-pointer p-0"
                          />
                          <Button onClick={handleAddLabel} size="sm" className="bg-accent text-white h-8 text-[10px]">
                            Adicionar
                          </Button>
                        </div>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>

                <Popover open={isCreatingChecklist} onOpenChange={setIsCreatingChecklist}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="bg-[#2a2a2a] border-none hover:bg-[#333] text-xs h-8">
                      <CheckSquare className="w-3.5 h-3.5 mr-2" /> Checklist
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72 bg-[#1a1a1a] border-[#333] p-4 shadow-2xl animate-in fade-in zoom-in duration-200">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-gray-200">Adicionar Checklist</h3>
                        <button onClick={() => setIsCreatingChecklist(false)} className="text-gray-500 hover:text-white transition-colors">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Título</label>
                        <input
                          autoFocus
                          type="text"
                          value={newChecklistGroupTitle}
                          onChange={(e) => setNewChecklistGroupTitle(e.target.value)}
                          placeholder="Ex: Checklist de Pagamento"
                          className="w-full bg-[#2a2a2a] border border-[#333] rounded px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-accent transition-all"
                          onKeyDown={(e) => e.key === "Enter" && handleAddChecklistGroup()}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Button 
                          onClick={handleAddChecklistGroup} 
                          size="sm" 
                          className="bg-accent text-white h-9 px-4 text-xs font-bold rounded-lg shadow-lg shadow-accent/20"
                          disabled={addChecklistGroupMutation.isPending}
                        >
                          {addChecklistGroupMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : null}
                          Adicionar checklist
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => setIsCreatingChecklist(false)} 
                          className="h-9 text-xs text-gray-400 hover:text-white"
                        >
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="bg-[#2a2a2a] border-none hover:bg-[#333] text-xs h-8">
                      <Clock className="w-3.5 h-3.5 mr-2" /> Datas
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72 p-0 bg-[#1a1a1a] border-[#333] shadow-2xl">
                    <div className="p-4 space-y-4">
                      <h3 className="text-sm font-bold text-gray-200">Definir Período</h3>
                      
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Data de Início</label>
                        <input 
                          type="date" 
                          className="bg-[#2a2a2a] border border-[#333] rounded px-3 py-2 text-xs text-white w-full focus:ring-1 focus:ring-accent outline-none"
                          onChange={(e) => handleUpdateStartDate(e.target.value ? new Date(e.target.value) : null)}
                          defaultValue={card?.startDate ? new Date(card.startDate).toISOString().split('T')[0] : ''}
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Data de Entrega</label>
                        <input 
                          type="date" 
                          className="bg-[#2a2a2a] border border-[#333] rounded px-3 py-2 text-xs text-white w-full focus:ring-1 focus:ring-accent outline-none"
                          onChange={(e) => handleUpdateDueDate(e.target.value ? new Date(e.target.value) : null)}
                          defaultValue={card?.dueDate ? new Date(card.dueDate).toISOString().split('T')[0] : ''}
                        />
                      </div>

                      <div className="flex gap-2 pt-2">
                        {(card?.startDate || card?.dueDate) && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="flex-1 text-[10px] text-red-400 hover:text-red-500 hover:bg-red-500/10 h-8"
                            onClick={() => {
                              handleUpdateStartDate(null);
                              handleUpdateDueDate(null);
                            }}
                          >
                            Remover Tudo
                          </Button>
                        )}
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>

                <Button 
                  variant="outline" 
                  size="sm" 
                  className="bg-[#2a2a2a] border-none hover:bg-[#333] text-xs h-8"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Paperclip className="w-3.5 h-3.5 mr-2" /> Anexar
                </Button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  onChange={handleFileUpload}
                />
              </div>
            </div>
          </div>

          {/* Section 2: Description */}
          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <AlignLeft className="w-5 h-5 text-gray-400" />
              <h3 className="font-bold text-lg text-gray-200">Descrição</h3>
            </div>
            <div className="pl-8">
              <textarea 
                value={description} 
                onChange={(e) => setDescription(e.target.value)} 
                onBlur={handleUpdateDescription} 
                placeholder="Adicione uma descrição mais detalhada..." 
                className="w-full min-h-[120px] bg-[#222] border border-[#333] rounded-xl p-4 text-sm resize-y focus:border-accent/40 focus:ring-1 focus:ring-accent/20 transition-all outline-none" 
              />
            </div>
          </section>

          {/* Section 3: Custom Fields */}
          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <LayoutGrid className="w-5 h-5 text-gray-400" />
              <h3 className="font-bold text-lg text-gray-200">Campos personalizados</h3>
            </div>
            <div className="pl-8 grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Mapa de Calor</label>
                </div>
                <Select 
                  value={getCustomFieldValue("Mapa de Calor")}
                  onValueChange={(val) => handleUpsertCustomField("Mapa de Calor", val)}
                >
                  <SelectTrigger className="bg-[#222] border-[#333] h-10 rounded-lg text-xs font-medium">
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
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Status</label>
                </div>
                <Select 
                  value={getCustomFieldValue("Status")}
                  onValueChange={(val) => handleUpsertCustomField("Status", val)}
                >
                  <SelectTrigger className="bg-[#222] border-[#333] h-10 rounded-lg text-xs font-medium">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a1a1a] border-[#333] text-white">
                    <SelectItem value="Pendente">Pendente</SelectItem>
                    <SelectItem value="Em Andamento">Em Andamento</SelectItem>
                    <SelectItem value="Concluído">Concluído</SelectItem>
                    <SelectItem value="Bloqueado">Bloqueado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Classificação do Cliente</label>
                </div>
                <Select 
                  value={getCustomFieldValue("Classificação")}
                  onValueChange={(val) => handleUpsertCustomField("Classificação", val)}
                >
                  <SelectTrigger className="bg-[#222] border-[#333] h-10 rounded-lg text-xs font-medium">
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

          {/* Section 4: Checklists (Multiple Groups) */}
          {checklistsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-accent" />
            </div>
          ) : (
            <div className="space-y-12">
              {checklists?.map((group: any) => {
                const groupItems = group.items || [];
                const groupProgress = groupItems.length 
                  ? (groupItems.filter((i: any) => i.completed).length / groupItems.length) * 100 
                  : 0;

                return (
                  <section key={group.id} className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <CheckSquare className="w-5 h-5 text-gray-400" />
                        {editingGroupId === group.id ? (
                          <input
                            autoFocus
                            defaultValue={group.title}
                            onBlur={(e) => handleUpdateChecklistGroup(group.id, e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleUpdateChecklistGroup(group.id, (e.target as HTMLInputElement).value)}
                            className="bg-[#2a2a2a] border border-accent/40 rounded px-2 py-1 text-lg font-bold text-gray-200 outline-none w-full max-w-md focus:ring-1 focus:ring-accent/30"
                          />
                        ) : (
                          <h3 
                            onClick={() => setEditingGroupId(group.id)}
                            className="font-bold text-lg text-gray-200 cursor-pointer hover:bg-white/5 px-2 py-1 rounded transition-all"
                          >
                            {group.title}
                          </h3>
                        )}
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-sm font-bold text-gray-500 bg-[#222] px-2 py-1 rounded border border-[#333]">
                          {Math.round(groupProgress)}%
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleDeleteChecklistGroup(group.id)}
                          className="text-gray-500 hover:text-red-400 h-8 px-2"
                        >
                          Remover
                        </Button>
                      </div>
                    </div>

                    <div className="pl-8 space-y-4">
                      <Progress value={groupProgress} className="h-2 bg-[#222]" />
                      
                      <div className="space-y-1">
                        {groupItems.map((item: any) => {
                          const isOverdue = item.due_date && new Date(item.due_date) < new Date() && !item.completed;
                          const assignedUser = allUsers?.find((u: any) => u.id === item.assignedUserId);
                          
                          return (
                            <div key={item.id} className="group flex items-start gap-4 p-2.5 rounded-xl hover:bg-white/5 transition-all">
                              <input
                                type="checkbox"
                                checked={item.completed}
                                onChange={() => handleUpdateChecklistItem(item.id, { completed: !item.completed })}
                                className="w-5 h-5 mt-0.5 rounded border-[#444] bg-[#1a1a1a] text-accent focus:ring-0 cursor-pointer"
                              />
                              <div className="flex-1 min-w-0 space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                  <input
                                    defaultValue={item.title}
                                    onBlur={(e) => handleUpdateChecklistItem(item.id, { title: e.target.value })}
                                    className={`text-sm flex-1 bg-transparent border-none p-0 focus:ring-0 focus:outline-none font-medium ${item.completed ? "line-through text-gray-500" : "text-gray-200"}`}
                                  />
                                  <div className="flex items-center gap-1">
                                    {/* Atribuir Usuário */}
                                    <Popover>
                                      <PopoverTrigger asChild>
                                        <button className="p-1 rounded-full hover:bg-white/10 text-gray-500 transition-all" title="Atribuir tarefa">
                                          {assignedUser ? (
                                            <Avatar className="w-5 h-5">
                                              <AvatarFallback className="bg-accent text-[8px] text-white">
                                                {assignedUser.name?.charAt(0).toUpperCase()}
                                              </AvatarFallback>
                                            </Avatar>
                                          ) : (
                                            <UserIcon className="w-4 h-4" />
                                          )}
                                        </button>
                                      </PopoverTrigger>
                                      <PopoverContent className="w-64 bg-[#1a1a1a] border-[#333] p-1 shadow-2xl">
                                        <div className="max-h-60 overflow-y-auto custom-scrollbar">
                                          <div className="p-2 border-b border-[#333] mb-1">
                                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Atribuir a...</p>
                                          </div>
                                          {allUsers?.map((u: any) => (
                                            <button
                                              key={u.id}
                                              onClick={() => handleUpdateChecklistItem(item.id, { assignedUserId: u.id })}
                                              className={`w-full flex items-center gap-2 p-2 rounded hover:bg-white/5 text-left transition-colors ${item.assignedUserId === u.id ? "bg-accent/10 text-accent" : "text-gray-300"}`}
                                            >
                                              <Avatar className="w-6 h-6">
                                                <AvatarFallback className="bg-[#2a2a2a] text-[10px]">
                                                  {u.name?.charAt(0).toUpperCase()}
                                                </AvatarFallback>
                                              </Avatar>
                                              <div className="flex flex-col">
                                                <span className="text-xs font-bold">{u.name}</span>
                                                <span className="text-[10px] text-gray-500">@{u.username}</span>
                                              </div>
                                            </button>
                                          ))}
                                          {item.assignedUserId && (
                                            <button
                                              onClick={() => handleUpdateChecklistItem(item.id, { assignedUserId: null })}
                                              className="w-full text-center p-2 text-[10px] text-red-400 hover:bg-red-400/10 mt-1 rounded transition-colors"
                                            >
                                              Remover Atribuição
                                            </button>
                                          )}
                                        </div>
                                      </PopoverContent>
                                    </Popover>

                                    {/* Definir Data */}
                                    <Popover>
                                      <PopoverTrigger asChild>
                                        <button className={`p-1 rounded-full hover:bg-white/10 transition-all ${item.due_date ? "text-accent" : "text-gray-500"}`} title="Definir data">
                                          <CalendarDays className="w-4 h-4" />
                                        </button>
                                      </PopoverTrigger>
                                      <PopoverContent className="w-auto p-0 bg-[#1a1a1a] border-[#333] shadow-2xl">
                                        <div className="p-3 space-y-3">
                                          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Prazo do item</p>
                                          <input
                                            type="date"
                                            className="bg-[#2a2a2a] border border-[#333] rounded px-3 py-1.5 text-xs text-white outline-none focus:ring-1 focus:ring-accent"
                                            onChange={(e) => handleUpdateChecklistItem(item.id, { dueDate: e.target.value ? new Date(e.target.value) : null })}
                                            defaultValue={item.due_date ? new Date(item.due_date).toISOString().split('T')[0] : ''}
                                          />
                                          {item.due_date && (
                                            <button
                                              onClick={() => handleUpdateChecklistItem(item.id, { dueDate: null })}
                                              className="w-full text-center text-[10px] text-red-400 hover:text-red-500 py-1"
                                            >
                                              Remover Data
                                            </button>
                                          )}
                                        </div>
                                      </PopoverContent>
                                    </Popover>

                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <button className="opacity-0 group-hover:opacity-100 p-1 rounded-full hover:bg-white/10 transition-all">
                                          <MoreVertical className="w-4 h-4 text-gray-500" />
                                        </button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent className="bg-[#1a1a1a] border-[#333] text-white shadow-2xl">
                                        <DropdownMenuItem onClick={() => handleRemoveChecklist(item.id)} className="text-red-400 focus:text-red-400 focus:bg-red-400/10 cursor-pointer text-xs">
                                          <Trash2 className="w-3.5 h-3.5 mr-2" /> Remover item
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-3">
                                  {item.due_date && (
                                    <div className={`flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded ${isOverdue ? "bg-red-500/10 text-red-400" : "bg-accent/10 text-accent"}`}>
                                      <Clock className="w-3 h-3" />
                                      {format(new Date(item.due_date), "dd 'de' MMM", { locale: ptBR })}
                                    </div>
                                  )}
                                  {assignedUser && (
                                    <div className="flex items-center gap-1.5 bg-[#2a2a2a] px-2 py-0.5 rounded border border-[#333]">
                                      <Avatar className="w-3.5 h-3.5">
                                        <AvatarFallback className="bg-accent text-[7px] text-white">
                                          {assignedUser.name?.charAt(0).toUpperCase()}
                                        </AvatarFallback>
                                      </Avatar>
                                      <span className="text-[10px] font-bold text-gray-400">{assignedUser.name}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        
                        <div className="mt-4">
                          <div className="relative group">
                            <input
                              type="text"
                              value={newChecklistItems[group.id] || ""}
                              onChange={(e) => setNewChecklistItems(prev => ({ ...prev, [group.id]: e.target.value }))}
                              placeholder="Adicionar um item..."
                              className="w-full bg-[#222] hover:bg-[#2a2a2a] border border-transparent focus:border-accent/40 rounded-lg px-4 py-2 text-sm text-gray-300 outline-none transition-all"
                              onKeyDown={(e) => e.key === "Enter" && handleAddChecklistItem(group.id)}
                            />
                            {newChecklistItems[group.id] && (
                              <Button 
                                onClick={() => handleAddChecklistItem(group.id)} 
                                size="sm" 
                                className="absolute right-1 top-1 bg-accent hover:bg-accent/90 h-7 text-[10px] px-3 rounded-md"
                              >
                                Adicionar
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </section>
                );
              })}
            </div>
          )}

          {/* Section 5: Attachments */}
          {attachments && attachments.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center gap-3">
                <Paperclip className="w-5 h-5 text-gray-400" />
                <h3 className="font-bold text-lg text-gray-200">Anexos</h3>
              </div>
              <div className="pl-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {attachments.map((file: any) => (
                  <a 
                    key={file.id} 
                    href={file.file_url} 
                    target="_blank" 
                    rel="noreferrer"
                    className="flex items-center gap-3 p-3 rounded-xl bg-[#222] hover:bg-[#2a2a2a] transition-all border border-[#333] group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-[#1a1a1a] flex items-center justify-center flex-shrink-0 group-hover:bg-accent/10 transition-colors">
                      <Paperclip className="w-4 h-4 text-gray-500 group-hover:text-accent" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-gray-300 truncate">{file.filename}</p>
                      <p className="text-[10px] text-gray-500 uppercase font-medium">{(file.file_size / 1024).toFixed(0)} KB</p>
                    </div>
                  </a>
                ))}
              </div>
            </section>
          )}

          {/* Section 6: Comments */}
          <section className="space-y-6 pt-4">
            <div className="flex items-center gap-3">
              <MessageSquare className="w-5 h-5 text-gray-400" />
              <h3 className="font-bold text-lg text-gray-200">Comentários</h3>
            </div>
            
            <div className="pl-8 space-y-8">
              <div className="flex gap-4">
                <Avatar className="w-9 h-9 flex-shrink-0 border border-white/5">
                  <AvatarFallback className="bg-accent text-white text-xs font-bold shadow-lg">
                    {currentUser?.name?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-3">
                  <textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Escreva um comentário..."
                    className="w-full bg-[#222] border border-[#333] rounded-xl p-4 text-sm focus:border-accent/40 focus:ring-1 focus:ring-accent/20 transition-all outline-none resize-none min-h-[100px]"
                  />
                  <div className="flex justify-end">
                    <Button 
                      onClick={handleAddComment} 
                      disabled={!newComment.trim()} 
                      size="sm" 
                      className="bg-accent hover:bg-accent/90 px-6 rounded-full font-bold text-xs"
                    >
                      <Send className="w-3.5 h-3.5 mr-2" /> Comentar
                    </Button>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                {comments?.map((comment: any) => (
                  <div key={comment.id} className="flex gap-4 group">
                    <Avatar className="w-9 h-9 flex-shrink-0 border border-white/5">
                      <AvatarFallback className="bg-[#2a2a2a] text-gray-500 text-xs font-bold">
                        {comment.userName?.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 space-y-2 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-gray-200">{comment.userName}</span>
                        <span className="text-[10px] text-gray-500 font-medium bg-[#222] px-2 py-0.5 rounded">
                          {format(new Date(comment.created_at), "dd 'de' MMM, HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                      <div className="bg-[#222] p-4 rounded-2xl rounded-tl-none text-sm text-gray-300 border border-[#333]/30 shadow-sm leading-relaxed break-words">
                        {comment.content}
                      </div>
                      {(comment.user_id === currentUser?.id || currentUser?.role === 'admin') && (
                        <button 
                          onClick={() => handleDeleteComment(comment.id)}
                          className="text-[10px] text-gray-500 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 font-bold ml-2"
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

          {/* Section 7: Final Actions Footer */}
          <div className="pt-10 pb-6 border-t border-[#333]/30 flex flex-col space-y-4">
            {mirrors && mirrors.length > 0 && (
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mr-2">Espelhado em:</span>
                {mirrors.map((m: any) => (
                  <div key={m.boardId} className="flex items-center gap-1.5 text-[10px] text-accent font-bold bg-accent/10 px-3 py-1 rounded-full border border-accent/20">
                    <LayoutGrid size={12} />
                    {m.boardName}
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap gap-2">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setIsMirrorDialogOpen(true)}
                  className="bg-[#222] hover:bg-[#2a2a2a] text-gray-300 gap-2 h-9 px-4 rounded-lg text-xs font-bold"
                >
                  <Copy className="w-4 h-4" /> Espelhar
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleArchiveCard}
                  className="bg-[#222] hover:bg-amber-950/30 hover:text-amber-400 text-gray-300 gap-2 h-9 px-4 rounded-lg text-xs font-bold transition-all"
                >
                  <Archive className="w-4 h-4" /> Arquivar
                </Button>
              </div>
              
              {currentUser?.role === 'admin' && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleDeleteCard}
                  className="hover:bg-red-950/30 text-red-400/70 hover:text-red-400 gap-2 h-9 px-4 rounded-lg text-xs font-bold transition-all"
                >
                  <Trash className="w-4 h-4" /> Excluir Cartão
                </Button>
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
    default: "hover:bg-[#333] text-gray-300",
    amber:   "hover:bg-amber-950/40 text-amber-300",
    red:     "hover:bg-red-950/40 text-red-400",
  };

  return (
    <Button
      variant="ghost"
      className={`w-full justify-start gap-3 h-10 text-sm font-medium transition-colors ${variantStyles[variant]}`}
      onClick={onClick}
    >
      <Icon size={18} />
      {label}
    </Button>
  );
}
