import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { X, Plus, Trash2, Tag, CheckSquare, Calendar } from "lucide-react";
import { toast } from "sonner";

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
  const [labels, setLabels] = useState<Array<{ id: number; label: string; color: string }>>([]);
  const [checklists, setChecklists] = useState<Array<{ id: number; title: string; completed: number }>>([]);
  const [customFields, setCustomFields] = useState<Array<{ id: number; fieldName: string; fieldValue: string; fieldType: string }>>([]);
  const [projectDates, setProjectDates] = useState<{ projectStartDate?: Date; projectEndDate?: Date } | null>(null);

  const [newLabel, setNewLabel] = useState("");
  const [newLabelColor, setNewLabelColor] = useState("#4b4897");
  const [newChecklistTitle, setNewChecklistTitle] = useState("");
  const [newFieldName, setNewFieldName] = useState("");
  const [newFieldValue, setNewFieldValue] = useState("");
  const [newFieldType, setNewFieldType] = useState<"text" | "select" | "date" | "number">("text");

  const handleAddLabel = () => {
    if (!newLabel.trim()) {
      toast.error("Nome da etiqueta é obrigatório");
      return;
    }
    setLabels([...labels, { id: Date.now(), label: newLabel, color: newLabelColor }]);
    setNewLabel("");
    setNewLabelColor("#4b4897");
    toast.success("Etiqueta adicionada");
  };

  const handleRemoveLabel = (id: number) => {
    setLabels(labels.filter((l) => l.id !== id));
    toast.success("Etiqueta removida");
  };

  const handleAddChecklist = () => {
    if (!newChecklistTitle.trim()) {
      toast.error("Título do checklist é obrigatório");
      return;
    }
    setChecklists([...checklists, { id: Date.now(), title: newChecklistTitle, completed: 0 }]);
    setNewChecklistTitle("");
    toast.success("Item de checklist adicionado");
  };

  const handleToggleChecklist = (id: number) => {
    setChecklists(
      checklists.map((c) =>
        c.id === id ? { ...c, completed: c.completed === 0 ? 1 : 0 } : c
      )
    );
  };

  const handleRemoveChecklist = (id: number) => {
    setChecklists(checklists.filter((c) => c.id !== id));
    toast.success("Item de checklist removido");
  };

  const handleAddCustomField = () => {
    if (!newFieldName.trim() || !newFieldValue.trim()) {
      toast.error("Nome e valor do campo são obrigatórios");
      return;
    }
    setCustomFields([
      ...customFields,
      { id: Date.now(), fieldName: newFieldName, fieldValue: newFieldValue, fieldType: newFieldType },
    ]);
    setNewFieldName("");
    setNewFieldValue("");
    setNewFieldType("text");
    toast.success("Campo personalizado adicionado");
  };

  const handleRemoveCustomField = (id: number) => {
    setCustomFields(customFields.filter((f) => f.id !== id));
    toast.success("Campo personalizado removido");
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
                defaultValue={cardDescription || ""}
                placeholder="Adicione uma descrição mais detalhada..."
                className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent min-h-[120px]"
              />
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
                    className="bg-accent text-accent-foreground hover:bg-accent/90 ml-auto"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Adicionar
                  </Button>
                </div>
              </div>
            </Card>

            <div className="space-y-2">
              <h3 className="font-semibold text-foreground">Etiquetas</h3>
              {labels.length === 0 ? (
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
                  className="bg-accent text-accent-foreground hover:bg-accent/90"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Adicionar
                </Button>
              </div>
            </Card>

            <div className="space-y-2">
              <h3 className="font-semibold text-foreground">Itens do Checklist</h3>
              {checklists.length === 0 ? (
                <p className="text-muted-foreground text-sm">Nenhum item de checklist</p>
              ) : (
                <div className="space-y-2">
                  {checklists.map((item) => (
                    <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted border border-border">
                      <input
                        type="checkbox"
                        checked={item.completed === 1}
                        onChange={() => handleToggleChecklist(item.id)}
                        className="w-5 h-5 rounded cursor-pointer"
                      />
                      <span
                        className={`flex-1 ${
                          item.completed === 1
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
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Data de Início
                  </label>
                  <input
                    type="date"
                    defaultValue={projectDates?.projectStartDate ? new Date(projectDates.projectStartDate).toISOString().split('T')[0] : ""}
                    onChange={(e) =>
                      setProjectDates({
                        ...projectDates,
                        projectStartDate: e.target.value ? new Date(e.target.value) : undefined,
                      })
                    }
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
                    onChange={(e) =>
                      setProjectDates({
                        ...projectDates,
                        projectEndDate: e.target.value ? new Date(e.target.value) : undefined,
                      })
                    }
                    className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
              </div>
            </Card>

            <Card className="p-4 border border-border">
              <h3 className="font-semibold text-foreground mb-4">Campos Personalizados</h3>
              <div className="space-y-3 mb-4">
                <input
                  type="text"
                  value={newFieldName}
                  onChange={(e) => setNewFieldName(e.target.value)}
                  placeholder="Nome do campo"
                  className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                />
                <input
                  type="text"
                  value={newFieldValue}
                  onChange={(e) => setNewFieldValue(e.target.value)}
                  placeholder="Valor do campo"
                  className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                />
                <select
                  value={newFieldType}
                  onChange={(e) => setNewFieldType(e.target.value as any)}
                  className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  <option value="text">Texto</option>
                  <option value="select">Seleção</option>
                  <option value="date">Data</option>
                  <option value="number">Número</option>
                </select>
                <Button
                  onClick={handleAddCustomField}
                  className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Adicionar Campo
                </Button>
              </div>

              {customFields.length > 0 && (
                <div className="space-y-2">
                  {customFields.map((field) => (
                    <div key={field.id} className="flex items-center justify-between p-3 rounded-lg bg-muted border border-border">
                      <div>
                        <p className="font-medium text-foreground">{field.fieldName}</p>
                        <p className="text-sm text-muted-foreground">{field.fieldValue}</p>
                      </div>
                      <button
                        onClick={() => handleRemoveCustomField(field.id)}
                        className="text-destructive hover:text-destructive/80"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex gap-3 justify-end mt-6">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button className="bg-accent text-accent-foreground hover:bg-accent/90" onClick={onClose}>
            Salvar Alterações
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
