import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { X, Plus, Trash2, Tag, CheckSquare, Calendar, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

interface CardDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  cardId: number;
  cardTitle: string;
  cardDescription?: string;
}

export default function CardDetailModal({
  isOpen,
  onClose,
  cardId,
  cardTitle,
  cardDescription,
}: CardDetailModalProps) {
  const utils = trpc.useUtils();

  // Queries
  const { data: labels, isLoading: labelsLoading } = trpc.cardDetails.getLabels.useQuery({ cardId });
  const { data: checklists, isLoading: checklistsLoading } = trpc.cardDetails.getChecklists.useQuery({ cardId });
  const { data: projectDates, isLoading: datesLoading } = trpc.cardDetails.getProjectDates.useQuery({ cardId });

  // Mutations
  const addLabelMutation = trpc.cardDetails.addLabel.useMutation({
    onSuccess: () => utils.cardDetails.getLabels.invalidate({ cardId }),
  });
  const deleteLabelMutation = trpc.cardDetails.deleteLabel.useMutation({
    onSuccess: () => utils.cardDetails.getLabels.invalidate({ cardId }),
  });
  const addChecklistMutation = trpc.cardDetails.addChecklist.useMutation({
    onSuccess: () => utils.cardDetails.getChecklists.invalidate({ cardId }),
  });
  const updateChecklistMutation = trpc.cardDetails.updateChecklist.useMutation({
    onSuccess: () => utils.cardDetails.getChecklists.invalidate({ cardId }),
  });
  const deleteChecklistMutation = trpc.cardDetails.deleteChecklist.useMutation({
    onSuccess: () => utils.cardDetails.getChecklists.invalidate({ cardId }),
  });
  const upsertDatesMutation = trpc.cardDetails.upsertProjectDates.useMutation({
    onSuccess: () => utils.cardDetails.getProjectDates.invalidate({ cardId }),
  });
  const updateDescriptionMutation = trpc.cardDetails.updateDescription.useMutation({
    onSuccess: () => {
      utils.cards.getByList.invalidate();
      toast.success("Descrição atualizada");
    }
  });

  const [newLabel, setNewLabel] = useState("");
  const [newLabelColor, setNewLabelColor] = useState("#4b4897");
  const [newChecklistTitle, setNewChecklistTitle] = useState("");
  const [description, setDescription] = useState(cardDescription || "");

  const handleAddLabel = async () => {
    if (!newLabel.trim()) {
      toast.error("Nome da etiqueta é obrigatório");
      return;
    }
    try {
      await addLabelMutation.mutateAsync({ cardId, label: newLabel, color: newLabelColor });
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
      setNewChecklistTitle("");
      toast.success("Item de checklist adicionado");
    } catch (error) {
      toast.error("Erro ao adicionar item");
    }
  };

  const handleToggleChecklist = async (id: number, currentStatus: boolean) => {
    try {
      await updateChecklistMutation.mutateAsync({ id, completed: !currentStatus });
    } catch (error) {
      toast.error("Erro ao atualizar item");
    }
  };

  const handleRemoveChecklist = async (id: number) => {
    try {
      await deleteChecklistMutation.mutateAsync({ id });
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
      toast.success("Datas atualizadas");
    } catch (error) {
      toast.error("Erro ao atualizar datas");
    }
  };

  const handleUpdateDescription = async () => {
    try {
      await updateDescriptionMutation.mutateAsync({ cardId, description });
    } catch (error) {
      toast.error("Erro ao atualizar descrição");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-foreground">{cardTitle}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="description" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="description">Descrição</TabsTrigger>
            <TabsTrigger value="labels" className="flex items-center gap-1">
              <Tag className="w-4 h-4" />
              Etiquetas
            </TabsTrigger>
            <TabsTrigger value="checklist" className="flex items-center gap-1">
              <CheckSquare className="w-4 h-4" />
              Checklist
            </TabsTrigger>
            <TabsTrigger value="dates" className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              Datas
            </TabsTrigger>
          </TabsList>

          <TabsContent value="description" className="space-y-4">
            <div className="p-4 rounded-lg bg-muted border border-border">
              <h3 className="font-semibold text-foreground mb-3">Descrição</h3>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Adicione uma descrição mais detalhada..."
                className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent min-h-[120px] mb-2"
              />
              <Button 
                onClick={handleUpdateDescription}
                disabled={updateDescriptionMutation.isPending}
                size="sm"
                className="bg-accent text-accent-foreground hover:bg-accent/90"
              >
                {updateDescriptionMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Salvar Descrição
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="labels" className="space-y-4">
            <Card className="p-4 border border-border">
              <h3 className="font-semibold text-foreground mb-4">Adicionar Etiqueta</h3>
              <div className="space-y-3">
                <input
                  type="text"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="Nome da etiqueta"
                  className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                />
                <div className="flex gap-2">
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-foreground">Cor:</label>
                    <input
                      type="color"
                      value={newLabelColor}
                      onChange={(e) => setNewLabelColor(e.target.value)}
                      className="w-10 h-10 rounded cursor-pointer"
                    />
                  </div>
                  <Button
                    onClick={handleAddLabel}
                    disabled={addLabelMutation.isPending}
                    className="bg-accent text-accent-foreground hover:bg-accent/90 ml-auto"
                  >
                    {addLabelMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                    Adicionar
                  </Button>
                </div>
              </div>
            </Card>

            <div className="space-y-2">
              <h3 className="font-semibold text-foreground">Etiquetas</h3>
              {labelsLoading ? (
                <Loader2 className="w-6 h-6 animate-spin mx-auto" />
              ) : !labels || labels.length === 0 ? (
                <p className="text-muted-foreground text-sm">Nenhuma etiqueta adicionada</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {labels.map((label) => (
                    <div
                      key={label.id}
                      className="flex items-center gap-2 px-3 py-1 rounded-full text-white text-sm"
                      style={{ backgroundColor: label.color }}
                    >
                      {label.label}
                      <button
                        onClick={() => handleRemoveLabel(label.id)}
                        className="ml-1 hover:opacity-80"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="checklist" className="space-y-4">
            <Card className="p-4 border border-border">
              <h3 className="font-semibold text-foreground mb-4">Adicionar Item de Checklist</h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newChecklistTitle}
                  onChange={(e) => setNewChecklistTitle(e.target.value)}
                  placeholder="Título do item"
                  className="flex-1 px-4 py-2 rounded-lg border border-border bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                />
                <Button
                  onClick={handleAddChecklist}
                  disabled={addChecklistMutation.isPending}
                  className="bg-accent text-accent-foreground hover:bg-accent/90"
                >
                  {addChecklistMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                  Adicionar
                </Button>
              </div>
            </Card>

            <div className="space-y-2">
              <h3 className="font-semibold text-foreground">Itens do Checklist</h3>
              {checklistsLoading ? (
                <Loader2 className="w-6 h-6 animate-spin mx-auto" />
              ) : !checklists || checklists.length === 0 ? (
                <p className="text-muted-foreground text-sm">Nenhum item de checklist</p>
              ) : (
                <div className="space-y-2">
                  {checklists.map((item) => (
                    <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted border border-border">
                      <input
                        type="checkbox"
                        checked={item.completed}
                        onChange={() => handleToggleChecklist(item.id, item.completed)}
                        className="w-5 h-5 rounded cursor-pointer"
                      />
                      <span
                        className={`flex-1 ${
                          item.completed
                            ? "line-through text-muted-foreground"
                            : "text-foreground"
                        }`}
                      >
                        {item.title}
                      </span>
                      <button
                        onClick={() => handleRemoveChecklist(item.id)}
                        className="text-destructive hover:text-destructive/80"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="dates" className="space-y-4">
            <Card className="p-4 border border-border">
              <h3 className="font-semibold text-foreground mb-4">Datas do Projeto</h3>
              {datesLoading ? (
                <Loader2 className="w-6 h-6 animate-spin mx-auto" />
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Data de Início
                    </label>
                    <input
                      type="date"
                      defaultValue={projectDates?.projectStartDate ? new Date(projectDates.projectStartDate).toISOString().split('T')[0] : ""}
                      onChange={(e) => handleUpdateDates(e.target.value, projectDates?.projectEndDate ? new Date(projectDates.projectEndDate).toISOString().split('T')[0] : undefined)}
                      className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Data de Término
                    </label>
                    <input
                      type="date"
                      defaultValue={projectDates?.projectEndDate ? new Date(projectDates.projectEndDate).toISOString().split('T')[0] : ""}
                      onChange={(e) => handleUpdateDates(projectDates?.projectStartDate ? new Date(projectDates.projectStartDate).toISOString().split('T')[0] : undefined, e.target.value)}
                      className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                    />
                  </div>
                </div>
              )}
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
