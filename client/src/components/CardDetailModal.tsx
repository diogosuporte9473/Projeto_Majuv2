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
      <DialogContent className={`${isMaximized ? "max-w-[98vw] h-[98vh]" : "max-w-3xl max-h-[90vh]"} overflow-y-auto bg-[#1a1a1a] text-white border-[#333] p-0 gap-0 transition-all duration-300`}>
        <DialogHeader className="p-6 pb-2">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded bg-accent flex items-center justify-center">
                <LayoutGrid className="w-5 h-5 text-white" />
              </div>
              <div>
                <DialogTitle className="text-2xl font-bold">{cardTitle}</DialogTitle>
                <p className="text-sm text-gray-400">na lista <span className="underline">{listName}</span></p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="icon-sm" 
                onClick={() => setIsMaximized(!isMaximized)}
                className="text-gray-400 hover:text-white hover:bg-white/10"
                title={isMaximized ? "Minimizar" : "Maximizar"}
              >
                {isMaximized ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
              </Button>
              <Button 
                variant="ghost" 
                size="icon-sm" 
                onClick={onClose}
                className="text-gray-400 hover:text-white hover:bg-white/10"
              >
                <X className="w-6 h-6" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="px-6 py-4 grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="md:col-span-3 space-y-10">
            {/* Top Buttons */}
            <div className="flex flex-wrap gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                className={`bg-[#2a2a2a] border-none hover:bg-[#333] text-white flex items-center gap-2 ${showLabels ? "ring-1 ring-gray-400" : ""}`}
                onClick={() => setShowLabels(!showLabels)}
              >
                <Tag className="w-4 h-4" /> Etiquetas
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className={`bg-[#2a2a2a] border-none hover:bg-[#333] text-white flex items-center gap-2 ${showDates ? "ring-1 ring-gray-400" : ""}`}
                onClick={() => setShowDates(!showDates)}
              >
                <Clock className="w-4 h-4" /> Datas
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className={`bg-[#2a2a2a] border-none hover:bg-[#333] text-white flex items-center gap-2 ${showChecklist ? "ring-1 ring-gray-400" : ""}`}
                onClick={() => setShowChecklist(!showChecklist)}
              >
                <CheckSquare className="w-4 h-4" /> Checklist
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="bg-[#2a2a2a] border-none hover:bg-[#333] text-white flex items-center gap-2"
                onClick={() => setIsMirrorDialogOpen(true)}
              >
                <Copy className="w-4 h-4" /> Espelhar
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="bg-[#2a2a2a] border-none hover:bg-amber-600/20 text-white flex items-center gap-2"
                onClick={handleArchiveCard}
              >
                <Archive className="w-4 h-4" /> Arquivar
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="bg-[#2a2a2a] border-none hover:bg-red-600/20 text-white flex items-center gap-2"
                onClick={handleDeleteCard}
              >
                <Trash className="w-4 h-4" /> Excluir
              </Button>
            </div>

            {/* Labels Section */}
            {showLabels && (
              <section ref={labelsRef}>
                <div className="flex items-center gap-2 mb-4">
                  <Tag className="w-5 h-5 text-gray-400" />
                  <h3 className="font-semibold text-lg">Etiquetas</h3>
                </div>
                <div className="ml-7 flex flex-wrap gap-2">
                  <div className="flex items-center gap-2 w-full mb-4">
                    <input
                      type="text"
                      value={newLabel}
                      onChange={(e) => setNewLabel(e.target.value)}
                      placeholder="Nova etiqueta..."
                      className="bg-[#2a2a2a] border-none rounded px-3 py-2 text-sm flex-1"
                      onKeyDown={(e) => e.key === "Enter" && handleAddLabel()}
                    />
                    <input
                      type="color"
                      value={newLabelColor}
                      onChange={(e) => setNewLabelColor(e.target.value)}
                      className="w-8 h-8 rounded bg-transparent border-none cursor-pointer p-0"
                    />
                    <Button onClick={handleAddLabel} size="sm" className="bg-[#2a2a2a] hover:bg-[#333] text-white">
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                  {labels?.map((label: any) => (
                    <div
                      key={label.id}
                      className="flex items-center gap-2 px-3 py-1 rounded text-white text-xs font-medium"
                      style={{ backgroundColor: label.color }}
                    >
                      {label.label}
                      <button onClick={() => handleRemoveLabel(label.id)} className="hover:opacity-80">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Seção de Datas do Card */}
             {showDates && (
               <section ref={datesRef} className="animate-in fade-in slide-in-from-top-4 duration-300">
                 <div className="flex items-center gap-2 mb-4">
                   <Calendar className="w-5 h-5 text-accent" />
                   <h3 className="font-semibold text-lg">Datas</h3>
                 </div>
                 <div className="ml-7 flex items-center gap-3">
                   <div className="bg-[#2a2a2a] p-2 rounded border border-[#333] flex items-center gap-3 relative hover:bg-[#333] transition-colors group cursor-pointer">
                     <Calendar className="w-4 h-4 text-gray-400 group-hover:text-accent" />
                     <span className="text-sm font-medium">
                       {card?.dueDate ? new Date(card.dueDate).toLocaleDateString('pt-BR') : "Clique para definir"}
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
                       className="text-xs text-red-400 hover:text-red-500 hover:bg-red-500/10 h-8"
                       onClick={() => handleUpdateDueDate(null)}
                     >
                       <Trash2 className="w-3 h-3 mr-2" />
                       Remover
                     </Button>
                   )}
                 </div>
               </section>
             )}

            {/* Description */}
            <section ref={descriptionRef}>
              <div className="flex items-center gap-2 mb-3">
                <AlignLeft className="w-5 h-5 text-gray-400" />
                <h3 className="font-semibold text-lg">Descrição</h3>
              </div>
              <div className="ml-7">
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  onBlur={handleUpdateDescription}
                  placeholder="Adicione uma descrição mais detalhada..."
                  className="w-full bg-[#2a2a2a] border border-[#333] rounded-lg p-4 text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-400 min-h-[100px] resize-none"
                />
              </div>
            </section>

            {/* Custom Fields */}
            <section ref={customFieldsRef}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <LayoutGrid className="w-5 h-5 text-gray-400" />
                  <h3 className="font-semibold text-lg">Campos personalizados</h3>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="bg-[#2a2a2a] hover:bg-[#333] text-white h-8"
                  onClick={() => setIsEditingCustomFields(!isEditingCustomFields)}
                >
                  Editar
                </Button>
              </div>

              <div className="ml-7 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="flex items-center gap-2 text-xs font-medium text-gray-400 mb-2">
                    <LayoutGrid className="w-3 h-3" /> Mapa de Calor
                  </label>
                  <Select 
                    value={getCustomFieldValue("Mapa de Calor")} 
                    onValueChange={(val) => handleUpsertCustomField("Mapa de Calor", val)}
                  >
                    <SelectTrigger className="bg-[#2a2a2a] border-none text-gray-400 h-10">
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

                <div>
                  <label className="flex items-center gap-2 text-xs font-medium text-gray-400 mb-2">
                    <LayoutGrid className="w-3 h-3" /> Status
                  </label>
                  <Select 
                    value={getCustomFieldValue("Status")} 
                    onValueChange={(val) => handleUpsertCustomField("Status", val)}
                  >
                    <SelectTrigger className="bg-[#2a2a2a] border-none text-gray-400 h-10">
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

                <div>
                  <label className="flex items-center gap-2 text-xs font-medium text-gray-400 mb-2">
                    <LayoutGrid className="w-3 h-3" /> Classificação do Cliente
                  </label>
                  <Select 
                    value={getCustomFieldValue("Classificação do Cliente")} 
                    onValueChange={(val) => handleUpsertCustomField("Classificação do Cliente", val)}
                  >
                    <SelectTrigger className="bg-[#2a2a2a] border-none text-gray-400 h-10">
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
            {showChecklist && (
              <section ref={checklistRef}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <CheckSquare className="w-5 h-5 text-gray-400" />
                    <h3 className="font-semibold text-lg">Checklist</h3>
                  </div>
                  <div className="text-xs text-gray-400 font-medium">
                    {Math.round(checklistProgress)}% concluído
                  </div>
                </div>
                
                <div className="ml-7 mb-6">
                  <Progress value={checklistProgress} className="h-2 bg-[#2a2a2a]" />
                </div>

                <div className="ml-7 space-y-4">
                  {checklistsLoading ? (
                    <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                  ) : (
                    <div className="space-y-2">
                      {checklists?.map((item: any) => {
                        const assignedUser = allUsers?.find((u: any) => u.id === item.assigned_user_id);
                        const isOverdue = item.due_date && new Date(item.due_date) < new Date() && !item.completed;
                        
                        return (
                          <div key={item.id} className="group bg-[#222] hover:bg-[#2a2a2a] p-3 rounded-lg transition-all border border-transparent hover:border-[#444]">
                            <div className="flex items-start gap-3">
                              <input
                                type="checkbox"
                                checked={item.completed}
                                onChange={() => handleUpdateChecklistItem(item.id, { completed: !item.completed })}
                                className="w-5 h-5 mt-0.5 rounded border-gray-600 bg-[#2a2a2a] text-accent focus:ring-offset-0 cursor-pointer"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <input
                                    defaultValue={item.title}
                                    onBlur={(e) => handleUpdateChecklistItem(item.id, { title: e.target.value })}
                                    className={`text-sm flex-1 bg-transparent border-none focus:outline-none focus:ring-0 ${item.completed ? "line-through text-gray-500" : "text-white"}`}
                                  />
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <button className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-[#333] transition-opacity">
                                        <MoreVertical className="w-4 h-4 text-gray-400" />
                                      </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent className="bg-[#1a1a1a] border-[#333] text-white">
                                      <DropdownMenuItem onClick={() => handleRemoveChecklist(item.id)} className="text-red-400 focus:text-red-400 focus:bg-red-400/10 cursor-pointer">
                                        <Trash2 className="w-4 h-4 mr-2" /> Remover item
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>

                                <div className="flex flex-col md:flex-row md:items-center gap-3 mt-2">
                                  {/* Date Badge */}
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <button className={`flex items-center gap-1.5 text-[10px] uppercase font-bold px-2 py-0.5 rounded transition-colors w-fit ${
                                        item.completed ? "bg-green-500/10 text-green-500" : 
                                        isOverdue ? "bg-red-500/10 text-red-500" : 
                                        item.due_date ? "bg-amber-500/10 text-amber-500" : "bg-[#2a2a2a] text-gray-500 hover:bg-[#333]"
                                      }`}>
                                        <CalendarDays className="w-3 h-3" />
                                        {item.due_date ? format(new Date(item.due_date), "dd 'de' MMM", { locale: ptBR }) : "Data"}
                                      </button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0 bg-[#1a1a1a] border-[#333]">
                                      <input 
                                        type="date" 
                                        className="bg-transparent text-white p-2 outline-none"
                                        onChange={(e) => handleUpdateChecklistItem(item.id, { dueDate: e.target.value ? new Date(e.target.value) : null })}
                                      />
                                    </PopoverContent>
                                  </Popover>

                                  {/* User Avatar */}
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <button className="flex items-center gap-1.5 hover:opacity-80 transition-opacity w-fit">
                                        {assignedUser ? (
                                          <div className="flex items-center gap-2">
                                            <Avatar className="w-5 h-5 border border-white/10 shadow-sm">
                                              <AvatarFallback className="text-[8px] bg-accent text-white font-bold">
                                                {assignedUser.name?.charAt(0).toUpperCase()}
                                              </AvatarFallback>
                                            </Avatar>
                                            <span className="text-[10px] text-gray-400 md:hidden">{assignedUser.name}</span>
                                          </div>
                                        ) : (
                                          <div className="flex items-center gap-2">
                                            <div className="w-5 h-5 rounded-full bg-[#2a2a2a] flex items-center justify-center hover:bg-[#333] border border-dashed border-gray-600">
                                              <UserIcon className="w-3 h-3 text-gray-500" />
                                            </div>
                                            <span className="text-[10px] text-gray-500 md:hidden">Atribuir</span>
                                          </div>
                                        )}
                                      </button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-64 p-2 bg-[#1a1a1a] border-[#333]">
                                      <div className="space-y-1">
                                        <p className="text-[10px] font-bold text-gray-500 px-2 py-1 uppercase tracking-wider">Atribuir item</p>
                                        <div className="max-h-48 overflow-y-auto">
                                          <button 
                                            onClick={() => handleUpdateChecklistItem(item.id, { assignedUserId: null })}
                                            className="w-full text-left px-2 py-1.5 rounded hover:bg-[#2a2a2a] text-sm text-gray-400"
                                          >
                                            Ninguém
                                          </button>
                                          {allUsers?.map((u: any) => (
                                            <button 
                                              key={u.id}
                                              onClick={() => handleUpdateChecklistItem(item.id, { assignedUserId: u.id })}
                                              className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[#2a2a2a] text-sm text-white"
                                            >
                                              <Avatar className="w-5 h-5">
                                                <AvatarFallback className="text-[10px] bg-accent text-white">
                                                  {u.name?.charAt(0).toUpperCase()}
                                                </AvatarFallback>
                                              </Avatar>
                                              <span className="truncate">{u.name || u.username}</span>
                                            </button>
                                          ))}
                                        </div>
                                      </div>
                                    </PopoverContent>
                                  </Popover>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="pt-2">
                    <input
                      type="text"
                      value={newChecklistTitle}
                      onChange={(e) => setNewChecklistTitle(e.target.value)}
                      placeholder="Adicionar um item..."
                      className="w-full bg-[#2a2a2a] border-none rounded-lg px-4 py-2.5 text-sm focus:ring-1 focus:ring-accent transition-all placeholder:text-gray-500"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleAddChecklist();
                        if (e.key === "Escape") setNewChecklistTitle("");
                      }}
                    />
                  </div>
                </div>
              </section>
            )}

            {/* Comments Section */}
            <section ref={commentsRef} className="pt-4">
              <div className="flex items-center gap-2 mb-6">
                <MessageSquare className="w-5 h-5 text-gray-400" />
                <h3 className="font-semibold text-lg">Comentários</h3>
              </div>
              <div className="ml-7 space-y-6">
                <div className="flex gap-3">
                  <Avatar className="w-8 h-8 flex-shrink-0 border border-white/10">
                    <AvatarFallback className="bg-accent text-white text-xs font-bold">
                      {currentUser?.name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 space-y-2">
                    <textarea
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Escreva um comentário..."
                      className="w-full bg-[#2a2a2a] border border-[#333] rounded-lg p-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-accent min-h-[80px] resize-none transition-all shadow-inner"
                    />
                    <div className="flex justify-end">
                      <Button 
                        onClick={handleAddComment} 
                        size="sm" 
                        disabled={!newComment.trim() || addCommentMutation.isPending}
                        className="bg-accent hover:bg-accent/90 text-white gap-2 font-bold px-4"
                      >
                        {addCommentMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-3.5 h-3.5" /> Enviar</>}
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  {comments?.map((comment: any) => (
                    <div key={comment.id} className="flex gap-3 group">
                      <Avatar className="w-8 h-8 flex-shrink-0 border border-white/5">
                        <AvatarFallback className="bg-[#333] text-gray-400 text-xs">
                          {comment.user?.name?.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-bold text-white">{comment.user?.name || comment.user?.username}</span>
                          <span className="text-[10px] text-gray-500">
                            {format(new Date(comment.created_at), "dd 'de' MMM 'às' HH:mm", { locale: ptBR })}
                          </span>
                        </div>
                        <div className="bg-[#2a2a2a] p-3 rounded-lg rounded-tl-none text-sm text-gray-200 border border-[#333] shadow-sm">
                          {comment.content}
                        </div>
                        {(comment.user_id === currentUser?.id || currentUser?.role === 'admin') && (
                          <button 
                            onClick={() => handleDeleteComment(comment.id)}
                            className="text-[10px] text-gray-500 hover:text-red-400 mt-1 opacity-0 group-hover:opacity-100 transition-opacity"
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

          {/* Sidebar */}
          <div className="space-y-6">
            <div className="space-y-3">
              <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-1">Ações do Card</h4>
              <div className="grid grid-cols-1 gap-2">
                <Button variant="outline" size="sm" className="justify-start bg-[#2a2a2a] border-none hover:bg-[#333] text-white gap-2 h-9 text-xs">
                  <Paperclip className="w-3.5 h-3.5" /> Anexar arquivo
                </Button>
                <Button variant="outline" size="sm" className="justify-start bg-[#2a2a2a] border-none hover:bg-[#333] text-white gap-2 h-9 text-xs">
                  <Settings2 className="w-3.5 h-3.5" /> Configurações
                </Button>
              </div>
            </div>

            {attachments && attachments.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-1">Anexos</h4>
                <div className="space-y-2">
                  {attachments.map((file: any) => (
                    <a 
                      key={file.id} 
                      href={file.file_url} 
                      target="_blank" 
                      rel="noreferrer"
                      className="flex items-center gap-3 p-2 rounded bg-[#2a2a2a] hover:bg-[#333] transition-colors border border-[#333]"
                    >
                      <div className="w-8 h-8 rounded bg-[#1a1a1a] flex items-center justify-center">
                        <Paperclip className="w-4 h-4 text-gray-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-bold text-white truncate">{file.filename}</p>
                        <p className="text-[9px] text-gray-500 uppercase">{(file.file_size / 1024).toFixed(1)} KB</p>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Mirror Selection Modal */}
        <Dialog open={isMirrorDialogOpen} onOpenChange={setIsMirrorDialogOpen}>
          <DialogContent className="bg-[#1a1a1a] text-white border-[#333]">
            <DialogHeader>
              <DialogTitle>Espelhar Cartão</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-400">Quadro de Destino</label>
                <Select value={selectedBoardId} onValueChange={(val) => {
                  setSelectedBoardId(val);
                  setSelectedListId("");
                }}>
                  <SelectTrigger className="bg-[#2a2a2a] border-none text-white">
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
                <label className="text-sm font-medium text-gray-400">Lista de Destino</label>
                <Select value={selectedListId} onValueChange={setSelectedListId} disabled={!selectedBoardId}>
                  <SelectTrigger className="bg-[#2a2a2a] border-none text-white">
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
            <DialogFooter>
              <Button variant="ghost" onClick={() => setIsMirrorDialogOpen(false)}>Cancelar</Button>
              <Button 
                onClick={handleCreateMirror} 
                className="bg-accent hover:bg-accent/90"
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
