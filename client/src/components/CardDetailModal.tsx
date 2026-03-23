import React, { useState, useEffect, useRef } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
  Trash
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
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

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
  const utils = trpc.useUtils();

  // Queries
  const { data: labels, isLoading: labelsLoading } = trpc.cardDetails.getLabels.useQuery({ cardId });
  const { data: checklists, isLoading: checklistsLoading } = trpc.cardDetails.getChecklists.useQuery({ cardId });
  const { data: projectDates, isLoading: datesLoading } = trpc.cardDetails.getProjectDates.useQuery({ cardId });
  const { data: customFields, isLoading: customFieldsLoading } = trpc.cardDetails.getCustomFields.useQuery({ cardId });

  // Mutations
  const addLabelMutation = trpc.cardDetails.addLabel.useMutation();
  const deleteLabelMutation = trpc.cardDetails.deleteLabel.useMutation();
  const addChecklistMutation = trpc.cardDetails.addChecklist.useMutation();
  const updateChecklistMutation = trpc.cardDetails.updateChecklist.useMutation();
  const deleteChecklistMutation = trpc.cardDetails.deleteChecklist.useMutation();
  const upsertDatesMutation = trpc.cardDetails.upsertProjectDates.useMutation();
  const updateDescriptionMutation = trpc.cardDetails.updateDescription.useMutation();
  const upsertCustomFieldMutation = trpc.cards.upsertCustomField.useMutation();
  const deleteCustomFieldMutation = trpc.cardDetails.deleteCustomField.useMutation();
  const createMirrorMutation = trpc.cardDetails.createMirror.useMutation();
  const archiveCardMutation = trpc.cardDetails.archiveCard.useMutation();
  const deleteCardMutation = trpc.cards.delete.useMutation();

  const [newLabel, setNewLabel] = useState("");
  const [newLabelColor, setNewLabelColor] = useState("#4b4897");
  const [newChecklistTitle, setNewChecklistTitle] = useState("");
  const [description, setDescription] = useState(cardDescription || "");
  const [isEditingCustomFields, setIsEditingCustomFields] = useState(false);
  
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

  // Scroll references
  const descriptionRef = useRef<HTMLDivElement>(null);
  const customFieldsRef = useRef<HTMLDivElement>(null);
  const checklistRef = useRef<HTMLDivElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const datesRef = useRef<HTMLDivElement>(null);

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

  const handleUpdateDates = async (start?: string, end?: string) => {
    try {
      await upsertDatesMutation.mutateAsync({
        cardId,
        startDate: start ? new Date(start) : undefined,
        endDate: end ? new Date(end) : undefined,
      });
      await utils.cardDetails.getProjectDates.invalidate({ cardId });
      toast.success("Datas atualizadas");
    } catch (error) {
      toast.error("Erro ao atualizar datas");
    }
  };

  const handleUpdateDescription = async () => {
    try {
      await updateDescriptionMutation.mutateAsync({ cardId, description });
      await utils.cards.getByList.invalidate();
      toast.success("Descrição atualizada");
    } catch (error) {
      toast.error("Erro ao atualizar descrição");
    }
  };

  const handleUpsertCustomField = async (fieldName: string, fieldValue: string) => {
    try {
      await upsertCustomFieldMutation.mutateAsync({
        cardId,
        fieldName,
        fieldValue,
        fieldType: "text"
      });
      await utils.cardDetails.getCustomFields.invalidate({ cardId });
    } catch (error) {
      toast.error("Erro ao atualizar campo personalizado");
    }
  };

  const handleDeleteCustomField = async (id: number) => {
    try {
      await deleteCustomFieldMutation.mutateAsync({ id });
      await utils.cardDetails.getCustomFields.invalidate({ cardId });
      toast.success("Campo removido");
    } catch (error) {
      toast.error("Erro ao remover campo");
    }
  };

  const getCustomFieldValue = (fieldName: string) => {
    return customFields?.find(f => f.fieldName === fieldName)?.fieldValue || "";
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[95vh] overflow-y-auto bg-[#1a1a1a] text-white border-[#333] p-0">
        <div className="p-6">
          <div className="flex items-center gap-2 mb-2 text-sm text-gray-400">
            <span className="flex items-center gap-1 bg-[#2a2a2a] px-2 py-0.5 rounded cursor-pointer hover:bg-[#333]">
              {listName || "Caixa de Entrada"} <ChevronDown className="w-3 h-3" />
            </span>
          </div>

          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 border-2 border-gray-500 rounded-full flex items-center justify-center">
                <div className="w-2 h-2 bg-gray-500 rounded-full" />
              </div>
              <DialogTitle className="text-3xl font-bold">{cardTitle}</DialogTitle>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-white">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="flex flex-wrap gap-2 mb-8">
            <Button 
              variant="outline" 
              size="sm" 
              className="bg-[#2a2a2a] border-none hover:bg-[#333] text-white flex items-center gap-2"
              onClick={() => scrollToSection(descriptionRef)}
            >
              <Plus className="w-4 h-4" /> Adicionar
            </Button>
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

          <div className="space-y-8">
            {/* Descrição */}
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

            {/* Campos Personalizados */}
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

              {isEditingCustomFields && (
                <div className="mt-6 ml-7 p-4 border border-dashed border-[#444] rounded-lg">
                  <h4 className="text-sm font-medium mb-4">Gerenciar outros campos</h4>
                  <div className="space-y-3">
                    {customFields?.filter(f => !["Mapa de Calor", "Status", "Classificação do Cliente"].includes(f.fieldName)).map(field => (
                      <div key={field.id} className="flex items-center justify-between bg-[#2a2a2a] p-2 rounded">
                        <span>{field.fieldName}: {field.fieldValue}</span>
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteCustomField(field.id)}>
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </Button>
                      </div>
                    ))}
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        placeholder="Nome do campo" 
                        className="flex-1 bg-[#2a2a2a] border-none rounded px-3 py-1 text-sm"
                        id="new-field-name"
                      />
                      <input 
                        type="text" 
                        placeholder="Valor" 
                        className="flex-1 bg-[#2a2a2a] border-none rounded px-3 py-1 text-sm"
                        id="new-field-value"
                      />
                      <Button size="sm" onClick={() => {
                        const nameEl = document.getElementById("new-field-name") as HTMLInputElement;
                        const valEl = document.getElementById("new-field-value") as HTMLInputElement;
                        if (nameEl.value && valEl.value) {
                          handleUpsertCustomField(nameEl.value, valEl.value);
                          nameEl.value = "";
                          valEl.value = "";
                        }
                      }}>
                        Add
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* Checklist */}
            {showChecklist && (
              <section ref={checklistRef}>
                <div className="flex items-center gap-2 mb-4">
                  <CheckSquare className="w-5 h-5 text-gray-400" />
                  <h3 className="font-semibold text-lg">Checklist</h3>
                </div>
                <div className="ml-7 space-y-4">
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={newChecklistTitle}
                      onChange={(e) => setNewChecklistTitle(e.target.value)}
                      placeholder="Adicionar item..."
                      className="flex-1 bg-[#2a2a2a] border-none rounded-lg px-4 py-2 text-sm focus:ring-1 focus:ring-gray-400"
                      onKeyDown={(e) => e.key === "Enter" && handleAddChecklist()}
                    />
                    <Button onClick={handleAddChecklist} size="sm" className="bg-[#2a2a2a] hover:bg-[#333] text-white">
                      Adicionar
                    </Button>
                  </div>
                  
                  {checklistsLoading ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : (
                    <div className="space-y-3">
                      {checklists?.map((item: any) => {
                        const assignedUser = allUsers?.find((u: any) => u.id === item.assignedUserId);
                        
                        return (
                          <div key={item.id} className="group bg-[#222] hover:bg-[#2a2a2a] p-3 rounded-lg transition-colors">
                            <div className="flex items-start gap-3">
                              <input
                                type="checkbox"
                                checked={item.completed}
                                onChange={() => handleUpdateChecklistItem(item.id, { completed: !item.completed })}
                                className="w-5 h-5 mt-0.5 rounded border-gray-600 bg-[#2a2a2a] text-accent focus:ring-offset-0"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <span className={`text-sm flex-1 ${item.completed ? "line-through text-gray-500" : "text-white"}`}>
                                    {item.title}
                                  </span>
                                  <button
                                    onClick={() => handleRemoveChecklist(item.id)}
                                    className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 transition-opacity"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>

                                <div className="flex items-center gap-3 mt-2">
                                  {/* Seletor de Data */}
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <button className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded hover:bg-[#333] transition-colors ${item.dueDate ? "text-accent bg-accent/10" : "text-gray-500 bg-[#2a2a2a]"}`}>
                                        <CalendarDays className="w-3.5 h-3.5" />
                                        {item.dueDate ? format(new Date(item.dueDate), "dd 'de' MMM", { locale: ptBR }) : "Data"}
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

                                  {/* Seletor de Usuário */}
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <button className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded hover:bg-[#333] transition-colors ${assignedUser ? "text-green-400 bg-green-400/10" : "text-gray-500 bg-[#2a2a2a]"}`}>
                                        {assignedUser ? (
                                          <>
                                            <Avatar className="w-4 h-4 border border-green-400/20">
                                              <AvatarFallback className="text-[8px] bg-green-400 text-black">
                                                {assignedUser.name?.charAt(0).toUpperCase()}
                                              </AvatarFallback>
                                            </Avatar>
                                            <span className="truncate max-w-[80px]">{assignedUser.name}</span>
                                          </>
                                        ) : (
                                          <>
                                            <UserIcon className="w-3.5 h-3.5" />
                                            Atribuir
                                          </>
                                        )}
                                      </button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-64 p-2 bg-[#1a1a1a] border-[#333]">
                                      <div className="space-y-1">
                                        <p className="text-xs font-semibold text-gray-400 px-2 py-1 uppercase">Atribuir a um usuário</p>
                                        <div className="max-h-48 overflow-y-auto">
                                          <button 
                                            onClick={() => handleUpdateChecklistItem(item.id, { assignedUserId: null })}
                                            className="w-full text-left px-2 py-1.5 rounded hover:bg-[#2a2a2a] text-sm text-gray-400"
                                          >
                                            Remover atribuição
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
                                              <span className="truncate">{u.name}</span>
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
                </div>
              </section>
            )}

            {/* Etiquetas */}
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
                  {labels?.map((label) => (
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

            {/* Datas */}
            {showDates && (
              <section ref={datesRef}>
                <div className="flex items-center gap-2 mb-4">
                  <Calendar className="w-5 h-5 text-gray-400" />
                  <h3 className="font-semibold text-lg">Datas do Projeto</h3>
                </div>
                <div className="ml-7 grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-400 mb-2">Início</label>
                    <div className="relative">
                      <input
                        type="date"
                        defaultValue={projectDates?.projectStartDate ? new Date(projectDates.projectStartDate).toISOString().split('T')[0] : ""}
                        onChange={(e) => handleUpdateDates(e.target.value, projectDates?.projectEndDate ? new Date(projectDates.projectEndDate).toISOString().split('T')[0] : undefined)}
                        className="w-full bg-[#2a2a2a] border-none rounded-lg px-4 py-3 text-sm text-white appearance-none"
                      />
                      <Calendar className="w-4 h-4 text-gray-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-2">Término</label>
                    <div className="relative">
                      <input
                        type="date"
                        defaultValue={projectDates?.projectEndDate ? new Date(projectDates.projectEndDate).toISOString().split('T')[0] : ""}
                        onChange={(e) => handleUpdateDates(projectDates?.projectStartDate ? new Date(projectDates.projectStartDate).toISOString().split('T')[0] : undefined, e.target.value)}
                        className="w-full bg-[#2a2a2a] border-none rounded-lg px-4 py-3 text-sm text-white appearance-none"
                      />
                      <Calendar className="w-4 h-4 text-gray-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>
                </div>
              </section>
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
