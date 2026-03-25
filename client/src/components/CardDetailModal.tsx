import React, { useState, useEffect } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { 
  X, Plus, Trash2, Tag, CheckSquare, Calendar, Loader2, 
  AlignLeft, LayoutGrid, Clock, Copy, Archive, Trash, 
  MessageSquare, Paperclip, Send, MoreVertical, Maximize2, Minimize2, 
  CalendarDays, User as UserIcon, Edit2, FileText, ImageIcon,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { format, isBefore } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAuth } from "@/_core/hooks/useAuth";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";

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
  const { data: templates } = trpc.checklistTemplates.list.useQuery();

  // Mutations
  const addLabelMutation = trpc.cardDetails.addLabel.useMutation();
  const deleteLabelMutation = trpc.cardDetails.deleteLabel.useMutation();
  const addChecklistGroupMutation = trpc.cardDetails.addChecklistGroup.useMutation();
  const updateChecklistGroupMutation = trpc.cardDetails.updateChecklistGroup.useMutation();
  const deleteChecklistGroupMutation = trpc.cardDetails.deleteChecklistGroup.useMutation();
  const addChecklistMutation = trpc.cardDetails.addChecklist.useMutation();
  const createTemplateMutation = trpc.checklistTemplates.create.useMutation();
  const incrementUsageMutation = trpc.checklistTemplates.incrementUsage.useMutation();
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
  const deleteAttachmentMutation = trpc.cardDetails.deleteAttachment.useMutation();

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

  // Template states
  const [isSavingAsTemplate, setIsSavingAsTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");

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
      const group = await addChecklistGroupMutation.mutateAsync({ cardId, title });
      
      // Se um modelo foi selecionado, adicionar seus itens
      if (selectedTemplateId) {
        const template = (templates as any)?.find((t: any) => t.id === parseInt(selectedTemplateId));
        if (template && Array.isArray(template.items)) {
          // Usar Promise.all para performance
          await Promise.all(template.items.map((itemTitle: string, index: number) => 
            addChecklistMutation.mutateAsync({ 
              cardId, 
              groupId: group.id, 
              title: itemTitle,
              position: index
            })
          ));
          await incrementUsageMutation.mutateAsync({ id: template.id });
        }
      }

      setNewChecklistGroupTitle("");
      setSelectedTemplateId("");
      setIsCreatingChecklist(false);
      await utils.cardDetails.getChecklists.invalidate({ cardId });
      toast.success("Checklist criado");
    } catch (error) {
      console.error("Erro ao criar checklist:", error);
      toast.error("Erro ao criar checklist");
    }
  };

  const handleSaveAsTemplate = async (items: string[]) => {
    if (!templateName.trim()) {
      toast.error("Por favor, digite um nome para o modelo");
      return;
    }
    try {
      await createTemplateMutation.mutateAsync({
        name: templateName,
        items: items,
      });
      setTemplateName("");
      setIsSavingAsTemplate(false);
      await (utils as any).checklistTemplates.list.invalidate();
      toast.success("Modelo salvo com sucesso");
    } catch (error) {
      toast.error("Erro ao salvar modelo");
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

    const toastId = toast.loading(`Fazendo upload de ${file.name}...`);

    try {
      // 1. Gerar um caminho único para o arquivo
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `cards/${cardId}/${fileName}`;

      // 2. Fazer o upload para o bucket 'attachments'
      const { data, error: uploadError } = await supabase.storage
        .from('attachments')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // 3. Obter a URL pública do arquivo
      const { data: { publicUrl } } = supabase.storage
        .from('attachments')
        .getPublicUrl(filePath);

      // 4. Salvar os metadados no banco de dados via tRPC
      await addAttachmentMutation.mutateAsync({
        cardId,
        filename: file.name,
        fileUrl: publicUrl,
        fileKey: filePath,
        mimeType: file.type,
        fileSize: file.size,
      });

      await utils.cardDetails.getAttachments.invalidate({ cardId });
      toast.success("Arquivo anexado com sucesso", { id: toastId });
    } catch (error: any) {
      console.error("Erro no upload:", error);
      toast.error(`Erro ao anexar arquivo: ${error.message || 'Erro desconhecido'}`, { id: toastId });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
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

  const isOverdue = card?.dueDate && isBefore(new Date(card.dueDate), new Date());

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        showCloseButton={false}
        className={cn(
          "overflow-y-auto bg-[#1a1a1a] text-white border-[#333] p-0 transition-all duration-500 ease-in-out flex flex-col",
          isMaximized 
            ? "max-w-[95vw] w-[min(1400px,95vw)] min-w-[1000px] h-[94vh] rounded-2xl shadow-2xl" 
            : "max-w-[1100px] w-[min(1100px,92vw)] min-w-[850px] h-[88vh] rounded-xl shadow-xl"
        )}
      >
        <div className="sr-only">
          <DialogTitle>{cardTitle}</DialogTitle>
          <DialogDescription>Detalhes do cartão {cardTitle} na lista {listName}</DialogDescription>
        </div>

        {/* Header */}
        <DialogHeader className="p-4 px-6 border-b border-[#333]/60 bg-[#1e1e1e] flex-shrink-0">
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
                  <Edit2 className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity text-gray-400" />
                </DialogTitle>
              )}
              
              <div className="flex flex-col gap-1.5 mt-1.5">
                <p className="text-sm text-gray-400 flex items-center gap-2">
                  na lista <span className="font-semibold text-gray-200 underline decoration-gray-600 underline-offset-4">{listName}</span>
                </p>

                <div className="flex flex-wrap items-center gap-2.5 py-1">
                  {card?.startDate && (
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-blue-500/5 border border-blue-500/10">
                      <Calendar className="w-3 h-3 text-blue-400" />
                      <span className="text-[11px] font-medium text-gray-400">
                        Início: <span className="text-gray-200">{format(new Date(card.startDate), "dd 'de' MMM, yyyy", { locale: ptBR })}</span>
                      </span>
                    </div>
                  )}
                  
                  {card?.dueDate && (
                    <div className={cn(
                      "flex items-center gap-1.5 px-2 py-1 rounded-md border",
                      isOverdue 
                        ? "bg-red-500/10 border-red-500/20 animate-pulse" 
                        : "bg-green-500/5 border-green-500/10"
                    )}>
                      <Clock className={cn("w-3 h-3", isOverdue ? "text-red-400" : "text-green-400")} />
                      <span className="text-[11px] font-medium text-gray-400">
                        Entrega: <span className={cn(isOverdue ? "text-red-400 font-bold" : "text-gray-200")}>
                          {format(new Date(card.dueDate), "dd 'de' MMM, yyyy", { locale: ptBR })}
                        </span>
                      </span>
                    </div>
                  )}

                  {!card?.startDate && !card?.dueDate && (
                    <span className="text-[10px] text-gray-500 font-black uppercase tracking-widest opacity-60">Sem datas definidas</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setIsMaximized(!isMaximized)}
                className={cn(
                  "hover:bg-accent/10 h-9 w-9 rounded-lg transition-all duration-300",
                  isMaximized ? "text-accent bg-accent/5" : "text-gray-400"
                )}
                title={isMaximized ? "Recolher" : "Expandir"}
              >
                {isMaximized ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={onClose}
                className="hover:bg-red-500/10 hover:text-red-400 text-gray-400 h-9 w-9 rounded-lg transition-colors"
              >
                <X size={18} />
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Main Content Area */}
        <div className={cn(
          "flex-1 overflow-y-auto custom-scrollbar transition-all duration-500",
          isMaximized ? "p-6 px-10" : "p-5 px-6"
        )}>
          <div className={cn(
            "grid gap-6",
            isMaximized ? "grid-cols-12" : "grid-cols-1 lg:grid-cols-12"
          )}>
            
            {/* Left Column (Main Content) */}
            <div className={cn(
              "space-y-8 transition-all duration-500",
              isMaximized ? "col-span-9" : "col-span-1 lg:col-span-9"
            )}>
              
              {/* Quick Actions & Labels */}
              <div className="flex flex-col md:flex-row justify-between items-start gap-4 pb-5 border-b border-[#333]/40">
                <div className="flex flex-wrap gap-4">
                  <div className="space-y-4">
                    <h4 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                      <Tag className="w-3 h-3" /> Etiquetas
                    </h4>
                    <div className="flex flex-wrap gap-2.5">
                      {labels && labels.length > 0 ? (
                        labels.map((label: any) => (
                          <div 
                            key={label.id} 
                            className="px-4 py-1.5 rounded-md text-[11px] font-bold text-white shadow-sm ring-1 ring-white/10 hover:brightness-110 transition-all cursor-default" 
                            style={{ backgroundColor: label.color }}
                          >
                            {label.label}
                          </div>
                        ))
                      ) : (
                        <span className="text-[10px] text-gray-500 italic">Nenhuma etiqueta</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Adicionar ao cartão</h4>
                  <div className="flex flex-wrap gap-3">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="bg-[#2a2a2a] border border-[#333] hover:bg-[#333] text-xs h-10 px-5 font-bold rounded-xl transition-all">
                          <Tag className="w-4 h-4 mr-2.5 text-purple-400" /> Etiquetas
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-64 bg-[#1a1a1a] border-[#333] p-4 shadow-2xl">
                        <div className="space-y-4">
                          <h3 className="text-sm font-bold text-gray-200">Gerenciar Etiquetas</h3>
                          <div className="flex flex-wrap gap-2">
                            {labels?.map((label: any) => (
                              <div
                                key={label.id}
                                className="flex items-center gap-2 px-2.5 py-1 rounded text-white text-[10px] font-bold group ring-1 ring-white/10"
                                style={{ backgroundColor: label.color }}
                              >
                                {label.label}
                                <button onClick={() => handleRemoveLabel(label.id)} className="hover:bg-black/20 rounded p-0.5 transition-colors">
                                  <X className="w-3.5 h-3.5" />
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
                              placeholder="Nome da etiqueta..."
                              className="w-full bg-[#2a2a2a] border border-[#333] rounded px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-accent"
                            />
                            <div className="flex items-center justify-between gap-3">
                              <input
                                type="color"
                                value={newLabelColor}
                                onChange={(e) => setNewLabelColor(e.target.value)}
                                className="w-10 h-10 rounded-lg bg-transparent border-none cursor-pointer p-0"
                              />
                              <Button onClick={handleAddLabel} size="sm" className="bg-accent text-white h-9 px-4 text-xs font-bold">
                                Adicionar
                              </Button>
                            </div>
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>

                    <Popover open={isCreatingChecklist} onOpenChange={setIsCreatingChecklist}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="bg-[#2a2a2a] border border-[#333] hover:bg-[#333] text-xs h-10 px-5 font-bold rounded-xl transition-all">
                          <CheckSquare className="w-4 h-4 mr-2.5 text-accent" /> Checklist
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-80 bg-[#1a1a1a] border-[#333] p-5 shadow-2xl animate-in fade-in zoom-in duration-200">
                        <div className="space-y-5">
                          <div className="flex items-center justify-between">
                            <h3 className="text-sm font-bold text-gray-200">Novo Checklist</h3>
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
                              placeholder="Ex: Tarefas Iniciais"
                              className="w-full bg-[#2a2a2a] border border-[#333] rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-accent transition-all"
                              onKeyDown={(e) => e.key === "Enter" && handleAddChecklistGroup()}
                            />
                          </div>

                          <div className="space-y-2">
                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Usar Modelo</label>
                            <Select 
                              value={selectedTemplateId} 
                              onValueChange={(val) => {
                                setSelectedTemplateId(val);
                                const template = (templates as any)?.find((t: any) => t.id === parseInt(val));
                                if (template) setNewChecklistGroupTitle(template.name);
                              }}
                            >
                              <SelectTrigger className="bg-[#2a2a2a] border-[#333] h-10 rounded-lg text-xs text-gray-300">
                                <SelectValue placeholder="Selecione um modelo..." />
                              </SelectTrigger>
                              <SelectContent className="bg-[#1a1a1a] border-[#333] text-white">
                                {(templates as any)?.map((t: any) => (
                                  <SelectItem key={t.id} value={t.id.toString()} className="text-xs">
                                    <div className="flex items-center gap-2">
                                      <span>{t.name}</span>
                                      {t.isGlobal && <span className="text-[8px] bg-accent/20 text-accent px-1 rounded font-bold uppercase">Global</span>}
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="flex items-center gap-2 pt-2">
                            <Button 
                              onClick={handleAddChecklistGroup} 
                              size="sm" 
                              className="flex-1 bg-accent text-white h-10 text-xs font-bold rounded-lg shadow-lg shadow-accent/20"
                              disabled={addChecklistGroupMutation.isPending}
                            >
                              {addChecklistGroupMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                              Criar Checklist
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => setIsCreatingChecklist(false)} 
                              className="h-10 px-4 text-xs text-gray-400 hover:text-white"
                            >
                              Cancelar
                            </Button>
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>

                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="bg-[#2a2a2a] border border-[#333] hover:bg-[#333] text-xs h-10 px-5 font-bold rounded-xl transition-all">
                          <Clock className="w-4 h-4 mr-2.5 text-blue-400" /> Datas
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-80 p-0 bg-[#1a1a1a] border-[#333] shadow-2xl overflow-hidden rounded-xl">
                        <div className="p-5 space-y-5">
                          <h3 className="text-sm font-bold text-gray-200">Gerenciar Prazos</h3>
                          
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Data de Início</label>
                            <input 
                              type="date" 
                              className="bg-[#2a2a2a] border border-[#333] rounded-lg px-3.5 py-2.5 text-sm text-white w-full focus:ring-1 focus:ring-accent outline-none transition-all"
                              onChange={(e) => handleUpdateStartDate(e.target.value ? new Date(e.target.value) : null)}
                              defaultValue={card?.startDate ? new Date(card.startDate).toISOString().split('T')[0] : ''}
                            />
                          </div>

                          <div className="space-y-2">
                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Data de Entrega</label>
                            <input 
                              type="date" 
                              className="bg-[#2a2a2a] border border-[#333] rounded-lg px-3.5 py-2.5 text-sm text-white w-full focus:ring-1 focus:ring-accent outline-none transition-all"
                              onChange={(e) => handleUpdateDueDate(e.target.value ? new Date(e.target.value) : null)}
                              defaultValue={card?.dueDate ? new Date(card.dueDate).toISOString().split('T')[0] : ''}
                            />
                          </div>

                          {(card?.startDate || card?.dueDate) && (
                            <div className="pt-2">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="w-full text-xs text-red-400 hover:text-red-500 hover:bg-red-500/10 h-10 rounded-lg font-bold"
                                onClick={() => {
                                  handleUpdateStartDate(null);
                                  handleUpdateDueDate(null);
                                }}
                              >
                                <Trash className="w-3.5 h-3.5 mr-2" /> Remover Datas
                              </Button>
                            </div>
                          )}
                        </div>
                      </PopoverContent>
                    </Popover>

                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="bg-[#2a2a2a] border border-[#333] hover:bg-[#333] text-xs h-10 px-5 font-bold rounded-xl transition-all"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Paperclip className="w-4 h-4 mr-2.5 text-amber-400" /> Anexar
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

              {/* Description Section */}
              <section className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="p-2.5 rounded-xl bg-white/5 border border-white/5 shadow-inner">
                    <AlignLeft className="w-5 h-5 text-gray-400" />
                  </div>
                  <h3 className="font-bold text-xl text-gray-200 tracking-tight">Descrição</h3>
                </div>
                <div className={cn("transition-all duration-500", isMaximized ? "pl-10" : "pl-10")}>
                  <textarea 
                    value={description} 
                    onChange={(e) => setDescription(e.target.value)} 
                    onBlur={handleUpdateDescription} 
                    placeholder="Adicione uma descrição detalhada sobre esta tarefa..." 
                    className="w-full min-h-[160px] bg-[#222]/50 border border-[#333] rounded-2xl p-6 text-sm leading-relaxed text-gray-300 resize-y focus:border-accent/40 focus:ring-1 focus:ring-accent/20 transition-all outline-none shadow-inner" 
                  />
                </div>
              </section>

              {/* Custom Fields Section */}
              <section className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="p-2.5 rounded-xl bg-white/5 border border-white/5 shadow-inner">
                    <LayoutGrid className="w-5 h-5 text-gray-400" />
                  </div>
                  <h3 className="font-bold text-xl text-gray-200 tracking-tight">Dados Adicionais</h3>
                </div>
                <div className={cn(
                  "grid gap-4 transition-all duration-500",
                  isMaximized ? "pl-10 grid-cols-2 xl:grid-cols-4" : "pl-10 grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
                )}>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.6)] animate-pulse" />
                      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Prioridade</label>
                    </div>
                    <Select 
                      value={getCustomFieldValue("Mapa de Calor")}
                      onValueChange={(val) => handleUpsertCustomField("Mapa de Calor", val)}
                    >
                      <SelectTrigger className="bg-[#222] border-[#333] h-11 rounded-xl text-xs font-bold text-gray-300 hover:bg-[#2a2a2a] transition-all hover:border-gray-600">
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

                  <div className="space-y-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.6)] animate-pulse" />
                      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Status Atual</label>
                    </div>
                    <Select 
                      value={getCustomFieldValue("Status")}
                      onValueChange={(val) => handleUpsertCustomField("Status", val)}
                    >
                      <SelectTrigger className="bg-[#222] border-[#333] h-11 rounded-xl text-xs font-bold text-gray-300 hover:bg-[#2a2a2a] transition-all hover:border-gray-600">
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

                  <div className="space-y-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.6)] animate-pulse" />
                      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Perfil do Cliente</label>
                    </div>
                    <Select 
                      value={getCustomFieldValue("Classificação")}
                      onValueChange={(val) => handleUpsertCustomField("Classificação", val)}
                    >
                      <SelectTrigger className="bg-[#222] border-[#333] h-11 rounded-xl text-xs font-bold text-gray-300 hover:bg-[#2a2a2a] transition-all hover:border-gray-600">
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

                  {isMaximized && (
                    <div className="space-y-3 animate-in fade-in slide-in-from-left-2 duration-500">
                      <div className="flex items-center gap-2.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-purple-400 shadow-[0_0_8px_rgba(192,132,252,0.6)] animate-pulse" />
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Origem</label>
                      </div>
                      <div className="h-11 rounded-xl bg-[#222] border border-[#333] flex items-center px-4 text-xs text-gray-400 font-bold">
                        {listName || "N/A"}
                      </div>
                    </div>
                  )}
                </div>
              </section>

              {/* Checklists Section */}
              {checklistsLoading ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="w-12 h-12 animate-spin text-accent/40" />
                </div>
              ) : (
                <div className="space-y-10">
                  {checklists?.map((group: any) => {
                    const groupItems = group.items || [];
                    const groupProgress = groupItems.length 
                      ? (groupItems.filter((i: any) => i.completed).length / groupItems.length) * 100 
                      : 0;

                    return (
                      <section key={group.id} className="space-y-8 animate-in fade-in slide-in-from-top-4 duration-700">
                        <div className="flex items-center justify-between gap-6 pb-2">
                          <div className="flex items-center gap-4 flex-1 min-w-0">
                            <div className="p-2.5 rounded-xl bg-accent/10 border border-accent/10">
                              <CheckSquare className="w-5 h-5 text-accent" />
                            </div>
                            {editingGroupId === group.id ? (
                              <input
                                autoFocus
                                defaultValue={group.title}
                                onBlur={(e) => handleUpdateChecklistGroup(group.id, e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleUpdateChecklistGroup(group.id, (e.target as HTMLInputElement).value)}
                                className="bg-[#2a2a2a] border border-accent/40 rounded-xl px-4 py-2 text-xl font-bold text-gray-200 outline-none w-full max-w-2xl focus:ring-2 focus:ring-accent/20"
                              />
                            ) : (
                              <h3 
                                onClick={() => setEditingGroupId(group.id)}
                                className="font-bold text-2xl text-gray-200 cursor-pointer hover:text-accent transition-all truncate tracking-tight"
                              >
                                {group.title}
                              </h3>
                            )}
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-xs font-black text-accent bg-accent/10 px-4 py-2 rounded-full border border-accent/20 shadow-sm shadow-accent/5">
                              {Math.round(groupProgress)}%
                            </div>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => handleDeleteChecklistGroup(group.id)}
                              className="text-gray-500 hover:text-red-400 h-10 px-4 rounded-xl hover:bg-red-400/5 transition-all font-bold"
                            >
                              Remover
                            </Button>
                            <Popover open={isSavingAsTemplate && editingGroupId === group.id} onOpenChange={(open) => {
                              setIsSavingAsTemplate(open);
                              setEditingGroupId(open ? group.id : null);
                            }}>
                              <PopoverTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="text-gray-500 hover:text-accent h-10 px-4 rounded-xl hover:bg-accent/5 transition-all"
                                  title="Salvar como modelo"
                                >
                                  <Copy className="w-4 h-4" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-72 bg-[#1a1a1a] border-[#333] p-4 shadow-2xl rounded-xl">
                                <div className="space-y-4">
                                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Nome do Novo Modelo</p>
                                  <input
                                    type="text"
                                    value={templateName}
                                    onChange={(e) => setTemplateName(e.target.value)}
                                    placeholder="Ex: Padrão de Entrega..."
                                    className="w-full bg-[#222] border border-[#333] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-accent transition-all"
                                    autoFocus
                                  />
                                  <div className="flex justify-end gap-2">
                                    <Button 
                                      variant="ghost" 
                                      size="sm" 
                                      onClick={() => {
                                        setIsSavingAsTemplate(false);
                                        setTemplateName("");
                                      }}
                                      className="h-9 px-4 text-xs font-bold"
                                    >
                                      Cancelar
                                    </Button>
                                    <Button 
                                      size="sm" 
                                      onClick={() => handleSaveAsTemplate(groupItems.map((i: any) => i.title))}
                                      className="h-9 px-5 text-xs font-bold bg-accent hover:bg-accent/90 rounded-lg"
                                    >
                                      Salvar Modelo
                                    </Button>
                                  </div>
                                </div>
                              </PopoverContent>
                            </Popover>
                          </div>
                        </div>

                        <div className={cn(
                          isMaximized ? "pl-4 pr-2" : "pl-10", 
                          "space-y-6 transition-all duration-500"
                        )}>
                          <div className="flex items-center gap-5">
                            <Progress value={groupProgress} className="h-2 bg-[#222] rounded-full flex-1" />
                            <span className="text-[11px] font-bold text-gray-500 tabular-nums w-8">{Math.round(groupProgress)}%</span>
                          </div>
                          
                          <div className="grid gap-3">
                            {groupItems.map((item: any) => {
                              const isItemOverdue = item.due_date && isBefore(new Date(item.due_date), new Date()) && !item.completed;
                              const assignedUser = allUsers?.find((u: any) => u.id === item.assignedUserId);
                              
                              return (
                                <div 
                                  key={item.id} 
                                  className={cn(
                                    "group flex items-start gap-5 rounded-2xl transition-all border border-transparent hover:border-[#333]/60 hover:bg-white/[0.03] shadow-sm",
                                    isMaximized ? "p-5" : "p-4"
                                  )}
                                >
                                  <div className="pt-1.5">
                                    <input
                                      type="checkbox"
                                      checked={item.completed}
                                      onChange={() => handleUpdateChecklistItem(item.id, { completed: !item.completed })}
                                      className="w-5 h-5 rounded border-[#444] bg-[#1a1a1a] text-accent focus:ring-0 cursor-pointer transition-transform active:scale-90"
                                    />
                                  </div>
                                  <div className="flex-1 min-w-0 flex flex-col gap-3">
                                    <div className="flex items-start justify-between gap-8">
                                      <textarea
                                        defaultValue={item.title}
                                        onBlur={(e) => handleUpdateChecklistItem(item.id, { title: e.target.value })}
                                        rows={1}
                                        className={cn(
                                          "text-[15px] flex-1 bg-transparent border-none p-0 focus:ring-0 focus:outline-none font-medium transition-colors break-words h-auto whitespace-normal leading-relaxed resize-none overflow-hidden",
                                          item.completed ? "line-through text-gray-500" : "text-gray-200"
                                        )}
                                        onInput={(e) => {
                                          const target = e.target as HTMLTextAreaElement;
                                          target.style.height = 'auto';
                                          target.style.height = target.scrollHeight + 'px';
                                        }}
                                      />
                                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                        <Popover>
                                          <PopoverTrigger asChild>
                                            <button className="p-2 rounded-xl hover:bg-white/10 text-gray-500 transition-all border border-transparent hover:border-[#333]" title="Atribuir responsável">
                                              {assignedUser ? (
                                                <Avatar className="w-7 h-7 ring-2 ring-accent/20">
                                                  <AvatarFallback className="bg-accent text-[10px] text-white font-black">
                                                    {assignedUser.name?.charAt(0).toUpperCase()}
                                                  </AvatarFallback>
                                                </Avatar>
                                              ) : (
                                                <UserIcon className="w-4.5 h-4.5" />
                                              )}
                                            </button>
                                          </PopoverTrigger>
                                          <PopoverContent className="w-72 bg-[#1a1a1a] border-[#333] p-2 shadow-2xl rounded-xl">
                                            <div className="max-h-72 overflow-y-auto custom-scrollbar">
                                              <div className="p-2 border-b border-[#333] mb-2">
                                                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Delegar Tarefa</p>
                                              </div>
                                              {allUsers?.map((u: any) => (
                                                <button
                                                  key={u.id}
                                                  onClick={() => handleUpdateChecklistItem(item.id, { assignedUserId: u.id })}
                                                  className={cn(
                                                    "w-full flex items-center gap-3 p-2.5 rounded-lg text-left transition-all",
                                                    item.assignedUserId === u.id ? "bg-accent/15 text-accent" : "text-gray-300 hover:bg-white/5"
                                                  )}
                                                >
                                                  <Avatar className="w-8 h-8">
                                                    <AvatarFallback className="bg-[#2a2a2a] text-xs font-bold">
                                                      {u.name?.charAt(0).toUpperCase()}
                                                    </AvatarFallback>
                                                  </Avatar>
                                                  <div className="flex flex-col min-w-0">
                                                    <span className="text-xs font-bold truncate">{u.name}</span>
                                                    <span className="text-[10px] text-gray-500 truncate">@{u.username}</span>
                                                  </div>
                                                </button>
                                              ))}
                                              {item.assignedUserId && (
                                                <button
                                                  onClick={() => handleUpdateChecklistItem(item.id, { assignedUserId: null })}
                                                  className="w-full text-center p-2.5 text-[10px] text-red-400 hover:bg-red-400/10 mt-2 rounded-lg transition-colors font-bold"
                                                >
                                                  Remover Responsável
                                                </button>
                                              )}
                                            </div>
                                          </PopoverContent>
                                        </Popover>

                                        <Popover>
                                          <PopoverTrigger asChild>
                                            <button className={cn(
                                              "p-2 rounded-xl hover:bg-white/10 transition-all border border-transparent hover:border-[#333]",
                                              item.due_date ? "text-accent" : "text-gray-500"
                                            )} title="Definir prazo do item">
                                              <CalendarDays className="w-4.5 h-4.5" />
                                            </button>
                                          </PopoverTrigger>
                                          <PopoverContent className="w-auto p-0 bg-[#1a1a1a] border-[#333] shadow-2xl rounded-xl overflow-hidden">
                                            <div className="p-4 space-y-4">
                                              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Prazo da Subtarefa</p>
                                              <input
                                                type="date"
                                                className="bg-[#2a2a2a] border border-[#333] rounded-lg px-3.5 py-2 text-xs text-white outline-none focus:ring-2 focus:ring-accent/30 transition-all"
                                                onChange={(e) => handleUpdateChecklistItem(item.id, { dueDate: e.target.value ? new Date(e.target.value) : null })}
                                                defaultValue={item.due_date ? new Date(item.due_date).toISOString().split('T')[0] : ''}
                                              />
                                              {item.due_date && (
                                                <button
                                                  onClick={() => handleUpdateChecklistItem(item.id, { dueDate: null })}
                                                  className="w-full text-center text-[10px] text-red-400 hover:text-red-500 py-2 font-bold transition-colors"
                                                >
                                                  Limpar Prazo
                                                </button>
                                              )}
                                            </div>
                                          </PopoverContent>
                                        </Popover>

                                        <DropdownMenu>
                                          <DropdownMenuTrigger asChild>
                                            <button className="p-2 rounded-xl hover:bg-white/10 transition-all border border-transparent hover:border-[#333]">
                                              <MoreVertical className="w-4.5 h-4.5 text-gray-500" />
                                            </button>
                                          </DropdownMenuTrigger>
                                          <DropdownMenuContent className="bg-[#1a1a1a] border-[#333] text-white shadow-2xl rounded-xl min-w-[160px]">
                                            <DropdownMenuItem 
                                              onClick={() => handleRemoveChecklist(item.id)} 
                                              className="text-red-400 focus:text-red-400 focus:bg-red-400/10 cursor-pointer text-xs font-bold p-3 rounded-lg"
                                            >
                                              <Trash2 className="w-4 h-4 mr-2.5" /> Remover item
                                            </DropdownMenuItem>
                                          </DropdownMenuContent>
                                        </DropdownMenu>
                                      </div>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-3">
                                      {item.due_date && (
                                        <div className={cn(
                                          "flex items-center gap-1.5 text-[10px] font-black px-3 py-1 rounded-md border",
                                          isItemOverdue 
                                            ? "bg-red-500/10 text-red-400 border-red-500/20 shadow-[0_0_10px_rgba(239,68,68,0.1)]" 
                                            : "bg-accent/10 text-accent border-accent/20 shadow-[0_0_10px_rgba(var(--accent-rgb),0.1)]"
                                        )}>
                                          <Clock className="w-3 h-3" />
                                          {format(new Date(item.due_date), "dd 'de' MMM", { locale: ptBR })}
                                        </div>
                                      )}
                                      {assignedUser && (
                                        <div className="flex items-center gap-2 bg-[#2a2a2a] px-3 py-1 rounded-md border border-[#333] shadow-sm">
                                          <Avatar className="w-4 h-4 ring-1 ring-white/10">
                                            <AvatarFallback className="bg-accent text-[7px] text-white font-black">
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
                            
                            <div className="mt-6">
                              <div className="relative group">
                                <input
                                  type="text"
                                  value={newChecklistItems[group.id] || ""}
                                  onChange={(e) => setNewChecklistItems(prev => ({ ...prev, [group.id]: e.target.value }))}
                                  placeholder="Escreva uma nova subtarefa..."
                                  className="w-full bg-[#222]/50 hover:bg-[#2a2a2a]/60 border border-transparent focus:border-accent/40 rounded-2xl px-6 py-4 text-sm text-gray-300 outline-none transition-all shadow-inner pr-28"
                                  onKeyDown={(e) => e.key === "Enter" && handleAddChecklistItem(group.id)}
                                />
                                {newChecklistItems[group.id] && (
                                  <Button 
                                    onClick={() => handleAddChecklistItem(group.id)} 
                                    size="sm" 
                                    className="absolute right-2.5 top-2.5 bg-accent hover:bg-accent/90 h-10 px-6 text-xs font-bold rounded-xl shadow-lg shadow-accent/30 animate-in fade-in slide-in-from-right-2 duration-300"
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

              {/* Attachments Section */}
              {attachments && attachments.length > 0 && (
                <section className="space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="p-2.5 rounded-xl bg-white/5 border border-white/5 shadow-inner">
                      <Paperclip className="w-5 h-5 text-gray-400" />
                    </div>
                    <h3 className="font-bold text-xl text-gray-200 tracking-tight">Anexos</h3>
                  </div>
                  <div className={cn(
                    "grid gap-6 transition-all duration-500",
                    isMaximized ? "pl-10 grid-cols-2 xl:grid-cols-4" : "pl-10 grid-cols-1 sm:grid-cols-2"
                  )}>
                    {attachments.map((file: any) => {
                      const isImage = file.mime_type?.startsWith('image/') || 
                                    ['.png', '.jpg', '.jpeg', '.gif', '.webp'].some(ext => file.filename.toLowerCase().endsWith(ext));
                      
                      return (
                        <div key={file.id} className="group relative">
                          <a 
                            href={file.file_url} 
                            target="_blank" 
                            rel="noreferrer"
                            className="flex flex-col overflow-hidden rounded-2xl bg-[#222]/50 hover:bg-[#2a2a2a]/80 transition-all border border-[#333] group hover:border-accent/40 shadow-sm h-full"
                          >
                            {/* Thumbnail Area */}
                            <div className="aspect-video w-full bg-[#1a1a1a] flex items-center justify-center overflow-hidden border-b border-[#333]">
                              {isImage ? (
                                <img 
                                  src={file.file_url} 
                                  alt={file.filename}
                                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                />
                              ) : (
                                <div className="flex flex-col items-center gap-2">
                                  <FileText className="w-8 h-8 text-gray-600 group-hover:text-accent/50 transition-colors" />
                                  <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest">
                                    {file.filename.split('.').pop()}
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* Info Area */}
                            <div className="p-4 flex items-center gap-4">
                              <div className="w-10 h-10 rounded-xl bg-[#1a1a1a] flex items-center justify-center flex-shrink-0 group-hover:bg-accent/10 transition-colors border border-[#333] group-hover:border-accent/20">
                                {isImage ? (
                                  <ImageIcon className="w-4 h-4 text-gray-500 group-hover:text-accent" />
                                ) : (
                                  <Paperclip className="w-4 h-4 text-gray-500 group-hover:text-accent" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-black text-gray-300 truncate group-hover:text-accent transition-colors">
                                  {file.filename}
                                </p>
                                <p className="text-[10px] text-gray-500 uppercase font-black mt-1 tracking-wider">
                                  {(file.file_size / 1024).toFixed(0)} KB
                                </p>
                              </div>
                            </div>
                          </a>
                          
                          {/* Delete Button (Opcional, se quiser adicionar) */}
                          <button 
                            onClick={(e) => {
                              e.preventDefault();
                              if(confirm('Excluir anexo?')) {
                                deleteAttachmentMutation.mutateAsync({ id: file.id }).then(() => {
                                  utils.cardDetails.getAttachments.invalidate({ cardId });
                                  toast.success("Anexo removido");
                                });
                              }
                            }}
                            className="absolute top-2 right-2 p-2 rounded-lg bg-black/50 text-white/50 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all backdrop-blur-sm border border-white/10"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* Comments Section */}
              <section className="space-y-8 pt-8 border-t border-[#333]/40">
                <div className="flex items-center gap-4">
                  <div className="p-2.5 rounded-xl bg-white/5 border border-white/5 shadow-inner">
                    <MessageSquare className="w-5 h-5 text-gray-400" />
                  </div>
                  <h3 className="font-bold text-xl text-gray-200 tracking-tight">Comentários</h3>
                </div>
                
                <div className={cn("transition-all duration-500 space-y-8", isMaximized ? "pl-10" : "pl-10")}>
                  <div className="flex gap-6">
                    <Avatar className="w-12 h-12 flex-shrink-0 border-2 border-accent/20 shadow-lg shadow-accent/5">
                      <AvatarFallback className="bg-accent text-white text-sm font-black uppercase">
                        {currentUser?.name?.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 space-y-4">
                      <textarea
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="Escreva um comentário ou anote algo importante..."
                        className="w-full bg-[#222]/50 border border-[#333] rounded-2xl p-6 text-sm leading-relaxed text-gray-300 focus:border-accent/40 focus:ring-1 focus:ring-accent/20 transition-all outline-none resize-none min-h-[120px] shadow-inner"
                      />
                      <div className="flex justify-end">
                        <Button 
                          onClick={handleAddComment} 
                          disabled={!newComment.trim()} 
                          size="sm" 
                          className="bg-accent hover:bg-accent/90 px-10 h-12 rounded-full font-black text-xs shadow-lg shadow-accent/20 transition-all active:scale-95"
                        >
                          <Send className="w-4 h-4 mr-3" /> Enviar Comentário
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    {comments?.map((comment: any) => (
                      <div key={comment.id} className="flex gap-6 group">
                        <Avatar className="w-12 h-12 flex-shrink-0 border-2 border-[#333] shadow-md transition-transform group-hover:scale-105">
                          <AvatarFallback className="bg-[#2a2a2a] text-gray-400 text-sm font-black uppercase">
                            {comment.userName?.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 space-y-3.5 min-w-0">
                          <div className="flex items-center gap-4">
                            <span className="text-sm font-black text-gray-200">{comment.userName}</span>
                            <span className="text-[10px] text-gray-500 font-bold bg-[#222] px-3 py-1 rounded-md border border-[#333]/50">
                              {format(new Date(comment.created_at), "dd 'de' MMM, HH:mm", { locale: ptBR })}
                            </span>
                          </div>
                          <div className="bg-[#222]/80 p-6 rounded-3xl rounded-tl-none text-sm text-gray-300 border border-[#333]/40 shadow-sm leading-relaxed break-words relative ring-1 ring-white/5">
                            {comment.content}
                          </div>
                          {(comment.user_id === currentUser?.id || currentUser?.role === 'admin') && (
                            <button 
                              onClick={() => handleDeleteComment(comment.id)}
                              className="text-[10px] text-gray-500 hover:text-red-400 transition-all opacity-0 group-hover:opacity-100 font-black ml-4 uppercase tracking-widest"
                            >
                              Excluir Registro
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            </div>

            {/* Right Sidebar Column */}
            <div className={cn(
              "space-y-6 transition-all duration-500",
              isMaximized ? "col-span-3" : "col-span-1 lg:col-span-3"
            )}>
              <div className="bg-[#1e1e1e]/80 p-5 rounded-2xl border border-[#333]/60 h-fit shadow-xl backdrop-blur-sm space-y-6">
                <div className="space-y-6">
                  <h4 className="text-[11px] font-black text-gray-500 uppercase tracking-[0.2em] flex items-center gap-3">
                    <LayoutGrid size={14} className="text-gray-600" /> Ações Rápidas
                  </h4>
                    <div className="flex flex-col gap-3">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setIsMirrorDialogOpen(true)}
                      className="bg-[#2a2a2a] hover:bg-[#333] text-gray-200 justify-start h-11 px-4 rounded-xl text-[10px] font-black transition-all border border-[#333]/50 hover:border-accent/30 shadow-sm w-full"
                    >
                      <Copy className="w-3.5 h-3.5 mr-3 text-accent flex-shrink-0" /> <span className="truncate">Espelhar Cartão</span>
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={handleArchiveCard}
                      className="bg-[#2a2a2a] hover:bg-amber-950/20 hover:text-amber-400 text-gray-200 justify-start h-11 px-4 rounded-xl text-[10px] font-black transition-all border border-[#333]/50 hover:border-amber-400/30 shadow-sm w-full"
                    >
                      <Archive className="w-3.5 h-3.5 mr-3 text-amber-500 flex-shrink-0" /> <span className="truncate">Arquivar Cartão</span>
                    </Button>
                    {currentUser?.role === 'admin' && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={handleDeleteCard}
                        className="hover:bg-red-950/30 text-red-400/70 hover:text-red-400 justify-start h-11 px-4 rounded-xl text-[10px] font-black transition-all w-full"
                      >
                        <Trash className="w-3.5 h-3.5 mr-3 flex-shrink-0" /> <span className="truncate">Excluir Permanentemente</span>
                      </Button>
                    )}
                  </div>
                </div>

                <Separator className="bg-[#333]/80" />

                {mirrors && mirrors.length > 0 && (
                  <div className="space-y-5">
                    <h4 className="text-[11px] font-black text-gray-500 uppercase tracking-[0.2em]">Conexões Ativas</h4>
                    <div className="space-y-3">
                      {mirrors.map((m: any) => (
                        <div key={m.boardId} className="flex items-center gap-3 text-[10px] text-accent font-black bg-accent/10 px-4 py-3 rounded-xl border border-accent/20 shadow-sm shadow-accent/5 w-full overflow-hidden">
                          <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse flex-shrink-0" />
                          <span className="truncate">{m.boardName}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Info Card (Visible in sidebar) */}
                <div className="bg-white/[0.02] p-3 rounded-xl border border-white/[0.05] space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest flex-shrink-0">Responsável</span>
                    <span className="text-[9px] font-black text-gray-300 truncate">Nenhum</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest flex-shrink-0">Criado em</span>
                    <span className="text-[9px] font-black text-gray-300 truncate">
                      {card?.created_at ? format(new Date(card.created_at), "dd/MM/yyyy") : "-"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Mirror Selection Modal */}
        <Dialog open={isMirrorDialogOpen} onOpenChange={setIsMirrorDialogOpen}>
          <DialogContent className="bg-[#1a1a1a] text-white border-[#333] max-w-md rounded-2xl shadow-2xl">
            <DialogHeader className="space-y-2">
              <DialogTitle className="text-xl font-black">Espelhar este Cartão</DialogTitle>
              <p className="text-xs text-gray-400 font-medium leading-relaxed">Crie uma cópia sincronizada em tempo real deste cartão em outro quadro estratégico.</p>
            </DialogHeader>
            <div className="space-y-5 py-6">
              <div className="space-y-2.5">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Quadro de Destino</label>
                <Select value={selectedBoardId} onValueChange={(val) => {
                  setSelectedBoardId(val);
                  setSelectedListId("");
                }}>
                  <SelectTrigger className="bg-[#2a2a2a] border border-[#333] text-white h-12 rounded-xl px-4 font-bold focus:ring-accent">
                    <SelectValue placeholder="Selecione um quadro..." />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a1a1a] border-[#333] text-white rounded-xl">
                    {userBoards?.map(board => (
                      <SelectItem key={board.id} value={board.id.toString()} className="font-bold py-3">{board.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2.5">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Lista de Destino</label>
                <Select value={selectedListId} onValueChange={setSelectedListId} disabled={!selectedBoardId}>
                  <SelectTrigger className="bg-[#2a2a2a] border border-[#333] text-white h-12 rounded-xl px-4 font-bold focus:ring-accent disabled:opacity-50">
                    <SelectValue placeholder="Escolha uma coluna..." />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a1a1a] border-[#333] text-white rounded-xl">
                    {targetLists?.map(list => (
                      <SelectItem key={list.id} value={list.id.toString()} className="font-bold py-3">{list.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter className="gap-3 pt-2">
              <Button variant="ghost" onClick={() => setIsMirrorDialogOpen(false)} className="text-xs font-black uppercase tracking-widest h-11 px-6 rounded-xl">Cancelar</Button>
              <Button 
                onClick={handleCreateMirror} 
                className="bg-accent hover:bg-accent/90 text-xs font-black uppercase tracking-widest px-8 h-11 rounded-xl shadow-lg shadow-accent/20 transition-all active:scale-95"
                disabled={createMirrorMutation.isPending || !selectedListId}
              >
                {createMirrorMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirmar Espelhamento"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}
