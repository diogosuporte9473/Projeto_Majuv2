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
  const createMirrorMutation = trpc.cardDetails.createMirror.useMutation();
  const archiveCardMutation = trpc.cardDetails.archiveCard.useMutation();
  const deleteCardMutation = trpc.cards.delete.useMutation();
  const addCommentMutation = trpc.cardDetails.addComment.useMutation();
  const deleteCommentMutation = trpc.cardDetails.deleteComment.useMutation();

  const [description, setDescription] = useState(cardDescription || "");
  const [newComment, setNewComment] = useState("");
  const [isMaximized, setIsMaximized] = useState(false);
  
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

  useEffect(() => {
    setDescription(cardDescription || "");
  }, [cardDescription]);

  // Handlers
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
    if (!selectedListId) return;
    try {
      await createMirrorMutation.mutateAsync({
        cardId,
        targetListId: parseInt(selectedListId),
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

              {card?.dueDate && (
                <div className="space-y-2">
                  <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Prazo</h4>
                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium ${ 
                    new Date(card.dueDate) < new Date() ? "bg-red-950/40 text-red-300" : "bg-[#2a2a2a] text-gray-200" 
                  }`}>
                    <Clock size={14} />
                    {format(new Date(card.dueDate), "dd 'de' MMM, yyyy", { locale: ptBR })}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Adicionar ao cartão</h4>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" className="bg-[#2a2a2a] border-none hover:bg-[#333] text-xs h-8">
                  <Tag className="w-3.5 h-3.5 mr-2" /> Etiquetas
                </Button>
                <Button variant="outline" size="sm" className="bg-[#2a2a2a] border-none hover:bg-[#333] text-xs h-8">
                  <CheckSquare className="w-3.5 h-3.5 mr-2" /> Checklist
                </Button>
                <Button variant="outline" size="sm" className="bg-[#2a2a2a] border-none hover:bg-[#333] text-xs h-8">
                  <Clock className="w-3.5 h-3.5 mr-2" /> Datas
                </Button>
                <Button variant="outline" size="sm" className="bg-[#2a2a2a] border-none hover:bg-[#333] text-xs h-8">
                  <Paperclip className="w-3.5 h-3.5 mr-2" /> Anexar
                </Button>
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
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Mapa de Calor</label>
                <Select value={getCustomFieldValue("Mapa de Calor")}>
                  <SelectTrigger className="bg-[#222] border-[#333] h-10 rounded-lg">
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
              {/* Espaço para mais campos */}
            </div>
          </section>

          {/* Section 4: Checklist */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckSquare className="w-5 h-5 text-gray-400" />
                <h3 className="font-bold text-lg text-gray-200">Checklist</h3>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-sm font-bold text-gray-500 bg-[#222] px-2 py-1 rounded">
                  {Math.round(checklistProgress)}%
                </div>
              </div>
            </div>
            <div className="pl-8 space-y-4">
              <Progress value={checklistProgress} className="h-2 bg-[#222]" />
              
              <div className="space-y-1">
                {checklistsLoading ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="w-6 h-6 animate-spin text-accent" />
                  </div>
                ) : (
                  <div className="space-y-1">
                    {checklists?.map((item: any) => {
                      const isOverdue = item.due_date && new Date(item.due_date) < new Date() && !item.completed;
                      return (
                        <div key={item.id} className="group flex items-start gap-4 p-2.5 rounded-xl hover:bg-white/5 transition-all">
                          <input
                            type="checkbox"
                            checked={item.completed}
                            onChange={() => handleUpdateChecklistItem(item.id, { completed: !item.completed })}
                            className="w-5 h-5 mt-0.5 rounded border-[#444] bg-[#1a1a1a] text-accent focus:ring-0 cursor-pointer"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <input
                                defaultValue={item.title}
                                onBlur={(e) => handleUpdateChecklistItem(item.id, { title: e.target.value })}
                                className={`text-sm flex-1 bg-transparent border-none p-0 focus:ring-0 focus:outline-none font-medium ${item.completed ? "line-through text-gray-500" : "text-gray-200"}`}
                              />
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button className="opacity-0 group-hover:opacity-100 p-1 rounded-full hover:bg-white/10 transition-all">
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
                            {item.due_date && (
                              <div className={`flex items-center gap-1.5 mt-1 text-[10px] font-bold ${isOverdue ? "text-red-400" : "text-gray-500"}`}>
                                <Clock className="w-3 h-3" />
                                {format(new Date(item.due_date), "dd 'de' MMM", { locale: ptBR })}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </section>

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
                        {comment.user?.name?.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 space-y-2 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-gray-200">{comment.user?.name || comment.user?.username}</span>
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
          <div className="pt-10 pb-6 border-t border-[#333]/30 flex flex-wrap items-center justify-between gap-4">
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
            
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleDeleteCard}
              className="hover:bg-red-950/30 text-red-400/70 hover:text-red-400 gap-2 h-9 px-4 rounded-lg text-xs font-bold transition-all"
            >
              <Trash className="w-4 h-4" /> Excluir Cartão
            </Button>
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
