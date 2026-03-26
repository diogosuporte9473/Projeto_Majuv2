import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import TrelloDashboardLayout from "@/components/TrelloDashboardLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Shield, BarChart2, History as HistoryIcon, Search, Filter, Download, User as UserIcon, Calendar as CalendarIcon, ArrowLeft, ArrowRight } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function Admin() {
  const { user } = useAuth();
  const [newUserName, setNewUserName] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newName, setNewName] = useState("");
  const [selectedBoardId, setSelectedBoardId] = useState<number | null>(null);

  // Filtros de Log
  const [logPage, setLogPage] = useState(1);
  const [logSearch, setLogSearch] = useState("");
  const [logAction, setLogAction] = useState<string>("all");
  const [logDays, setLogDays] = useState<string>("7");

  // Queries
  const { data: stats } = trpc.stats.getGeneral.useQuery(
    undefined,
    { enabled: user?.role === "admin" } as any
  );

  const { data: users, isLoading: usersLoading } = trpc.admin.users.list.useQuery();
  const { data: boards } = trpc.boards.list.useQuery();
  const { data: boardMembers, isLoading: membersLoading } = trpc.boards.getMembers.useQuery(
    { boardId: selectedBoardId || 0 },
    { enabled: !!selectedBoardId && user?.role === "admin" } as any
  );

  // Query de Logs
  const { data: auditData, isLoading: logsLoading } = trpc.audit.list.useQuery({
    page: logPage,
    search: logSearch || undefined,
    action: logAction === "all" ? undefined : logAction,
    startDate: logDays === "all" ? undefined : new Date(Date.now() - parseInt(logDays) * 24 * 60 * 60 * 1000).toISOString(),
  }, { enabled: user?.role === "admin" } as any);

  // Mutations
  const createUserMutation = trpc.admin.users.create.useMutation();
  const updateRoleMutation = trpc.admin.users.update.useMutation();
  const grantPermissionMutation = trpc.admin.boards.addMember.useMutation();
  const revokePermissionMutation = trpc.admin.boards.removeMember.useMutation();

  if (user?.role !== "admin") {
    return (
      <TrelloDashboardLayout>
        <div className="p-8">
          <p className="text-red-500">Acesso negado. Apenas administradores podem acessar esta página.</p>
        </div>
      </TrelloDashboardLayout>
    );
  }

  const handleCreateUser = async () => {
    if (!newUserName.trim() || !newUserPassword.trim() || !newName.trim()) {
      toast.error("Usuário, senha e nome são obrigatórios");
      return;
    }

    try {
      await createUserMutation.mutateAsync({
        username: newUserName,
        password: newUserPassword,
        name: newName,
      });
      setNewUserName("");
      setNewUserPassword("");
      setNewName("");
      toast.success("Usuário criado com sucesso");
    } catch (error) {
      toast.error("Erro ao criar usuário");
    }
  };

  const handleUpdateRole = async (id: number, role: "admin" | "user") => {
    try {
      await updateRoleMutation.mutateAsync({
        id,
        role,
      });
      toast.success("Função atualizada");
    } catch (error) {
      toast.error("Erro ao atualizar função");
    }
  };

  const handleGrantPermission = async (userId: number, role: "viewer" | "editor" | "admin") => {
    if (!selectedBoardId) return;

    try {
      await grantPermissionMutation.mutateAsync({
        boardId: selectedBoardId,
        userId,
        role,
      });
      toast.success("Permissão concedida");
    } catch (error) {
      toast.error("Erro ao conceder permissão");
    }
  };

  const handleRevokePermission = async (userId: number) => {
    if (!selectedBoardId) return;

    try {
      await revokePermissionMutation.mutateAsync({
        boardId: selectedBoardId,
        userId,
      });
      toast.success("Permissão removida");
    } catch (error) {
      toast.error("Erro ao remover permissão");
    }
  };

  const exportLogsToCSV = () => {
    if (!auditData?.logs) return;

    const headers = ["Data", "Usuário", "Ação", "Entidade", "ID Entidade", "Detalhes"];
    const rows = auditData.logs.map((log: any) => [
      format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss"),
      log.users?.name || log.users?.username || "Sistema",
      log.action.toUpperCase(),
      log.entity_type.toUpperCase(),
      log.entity_id,
      log.details.replace(/,/g, ";")
    ]);

    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `audit_logs_${format(new Date(), "yyyyMMdd")}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <TrelloDashboardLayout>
      <div className="p-8">
        <div className="mb-8 flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Painel Administrativo</h1>
            <p className="text-muted-foreground">Gerenciar usuários, permissões e auditar atividades do sistema</p>
          </div>
          <div className="flex gap-4">
            <Card className="px-4 py-2 flex items-center gap-2 bg-accent/5 border-accent/20">
              <BarChart2 className="w-4 h-4 text-accent" />
              <span className="text-sm font-medium">{stats?.totalUsers || 0} Usuários</span>
            </Card>
          </div>
        </div>

        <Tabs defaultValue="users" className="w-full">
          <TabsList className="grid w-full max-w-2xl grid-cols-4 mb-8">
            <TabsTrigger value="users">Usuários</TabsTrigger>
            <TabsTrigger value="permissions">Permissões</TabsTrigger>
            <TabsTrigger value="stats">Estatísticas</TabsTrigger>
            <TabsTrigger value="logs" className="flex items-center gap-2">
              <HistoryIcon className="w-4 h-4" /> Logs
            </TabsTrigger>
          </TabsList>

          {/* Aba de Logs de Atividades */}
          <TabsContent value="logs" className="space-y-6">
            <div className="flex flex-col md:flex-row gap-4 items-end mb-6">
              <div className="flex-1 space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Busca</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input 
                    placeholder="Buscar por nome da entidade..." 
                    className="pl-10 bg-background"
                    value={logSearch}
                    onChange={(e) => {
                      setLogSearch(e.target.value);
                      setLogPage(1);
                    }}
                  />
                </div>
              </div>

              <div className="w-full md:w-48 space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Ação</label>
                <Select value={logAction} onValueChange={(v) => { setLogAction(v); setLogPage(1); }}>
                  <SelectTrigger className="bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as ações</SelectItem>
                    <SelectItem value="create">Criação</SelectItem>
                    <SelectItem value="update">Edição</SelectItem>
                    <SelectItem value="archive">Arquivamento</SelectItem>
                    <SelectItem value="delete">Exclusão</SelectItem>
                    <SelectItem value="restore">Restauração</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="w-full md:w-48 space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Período</label>
                <Select value={logDays} onValueChange={(v) => { setLogDays(v); setLogPage(1); }}>
                  <SelectTrigger className="bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Últimas 24h</SelectItem>
                    <SelectItem value="7">Últimos 7 dias</SelectItem>
                    <SelectItem value="30">Últimos 30 dias</SelectItem>
                    <SelectItem value="90">Últimos 90 dias</SelectItem>
                    <SelectItem value="all">Todo o histórico</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button variant="outline" onClick={exportLogsToCSV} className="flex items-center gap-2">
                <Download className="w-4 h-4" /> Exportar CSV
              </Button>
            </div>

            <Card className="overflow-hidden border-border bg-card">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs font-bold text-muted-foreground uppercase tracking-wider bg-muted/50 border-b border-border">
                    <tr>
                      <th className="px-6 py-4">Data/Hora</th>
                      <th className="px-6 py-4">Usuário</th>
                      <th className="px-6 py-4">Ação</th>
                      <th className="px-6 py-4">Entidade</th>
                      <th className="px-6 py-4">Detalhes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {logsLoading ? (
                      [1, 2, 3, 4, 5].map(i => (
                        <tr key={i} className="animate-pulse">
                          <td colSpan={5} className="px-6 py-8 bg-muted/20" />
                        </tr>
                      ))
                    ) : auditData?.logs && auditData.logs.length > 0 ? (
                      auditData.logs.map((log: any) => (
                        <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex flex-col">
                              <span className="font-medium text-foreground">
                                {format(new Date(log.created_at), "dd MMM, HH:mm", { locale: ptBR })}
                              </span>
                              <span className="text-[10px] text-muted-foreground uppercase">
                                {formatDistanceToNow(new Date(log.created_at), { addSuffix: true, locale: ptBR })}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center text-[10px] font-bold text-accent border border-accent/20 uppercase">
                                {log.users?.name?.substring(0, 2) || "S"}
                              </div>
                              <div className="flex flex-col">
                                <span className="font-medium text-foreground text-xs">{log.users?.name || "Sistema"}</span>
                                <span className="text-[10px] text-muted-foreground">@{log.users?.username || "system"}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest border ${ 
                              log.action === 'create' ? "bg-green-500/10 text-green-500 border-green-500/20" :
                              log.action === 'update' ? "bg-blue-500/10 text-blue-500 border-blue-500/20" :
                              log.action === 'delete' ? "bg-red-500/10 text-red-500 border-red-500/20" :
                              log.action === 'archive' ? "bg-orange-500/10 text-orange-500 border-orange-500/20" :
                              log.action === 'restore' ? "bg-purple-500/10 text-purple-500 border-purple-500/20" : ""
                            }`}>
                              {log.action}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <span className="text-[10px] text-muted-foreground uppercase font-black tracking-tighter mb-0.5">{log.entity_type}</span>
                              <span className="font-medium text-foreground truncate max-w-[200px]">{log.entity_name}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-xs text-muted-foreground italic line-clamp-1">{log.details || "-"}</p>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground italic">
                          Nenhum registro de atividade encontrado para os filtros selecionados.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              
              {/* Paginação */}
              {auditData && auditData.pages > 1 && (
                <div className="px-6 py-4 border-t border-border flex items-center justify-between bg-muted/20">
                  <p className="text-xs text-muted-foreground font-medium">
                    Mostrando <span className="text-foreground">{auditData.logs.length}</span> de <span className="text-foreground">{auditData.total}</span> logs
                  </p>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      disabled={logPage === 1}
                      onClick={() => setLogPage(p => p - 1)}
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </Button>
                    <div className="flex items-center px-4 text-xs font-bold">
                      Página {logPage} de {auditData.pages}
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      disabled={logPage === auditData.pages}
                      onClick={() => setLogPage(p => p + 1)}
                    >
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          </TabsContent>

          {/* Aba de Estatísticas */}
          <TabsContent value="stats" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="p-6 flex flex-col items-center justify-center text-center">
                <BarChart2 className="w-12 h-12 text-primary mb-4" />
                <h3 className="text-lg font-semibold text-muted-foreground uppercase tracking-wider">Total de Quadros</h3>
                <p className="text-4xl font-bold text-foreground">{stats?.totalBoards || 0}</p>
              </Card>
              <Card className="p-6 flex flex-col items-center justify-center text-center">
                <BarChart2 className="w-12 h-12 text-accent mb-4" />
                <h3 className="text-lg font-semibold text-muted-foreground uppercase tracking-wider">Total de Cartões</h3>
                <p className="text-4xl font-bold text-foreground">{stats?.totalCards || 0}</p>
              </Card>
              <Card className="p-6 flex flex-col items-center justify-center text-center">
                <BarChart2 className="w-12 h-12 text-green-500 mb-4" />
                <h3 className="text-lg font-semibold text-muted-foreground uppercase tracking-wider">Total de Usuários</h3>
                <p className="text-4xl font-bold text-foreground">{stats?.totalUsers || 0}</p>
              </Card>
            </div>
          </TabsContent>

          {/* Aba de Usuários */}
          <TabsContent value="users" className="space-y-6">
            <Card className="p-6">
              <h2 className="text-xl font-semibold text-foreground mb-4">Adicionar Novo Usuário</h2>
              <div className="space-y-4">
                <Input
                  placeholder="Usuário (Email)"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  className="bg-background border-border"
                />
                <Input
                  placeholder="Senha"
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  type="password"
                  className="bg-background border-border"
                />
                <Input
                  placeholder="Nome Completo"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="bg-background border-border"
                />
                <Button
                  onClick={handleCreateUser}
                  disabled={createUserMutation.isPending}
                  className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Adicionar Usuário
                </Button>
              </div>
            </Card>

            <Card className="p-6">
              <h2 className="text-xl font-semibold text-foreground mb-4">Lista de Usuários</h2>
              {usersLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-12 bg-muted rounded animate-pulse" />
                  ))}
                </div>
              ) : users && users.length > 0 ? (
                <div className="space-y-3">
                  {users.map((u) => (
                    <div key={u.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div>
                        <p className="font-medium text-foreground">{u.name}</p>
                        <p className="text-sm text-muted-foreground">{u.username}</p>
                      </div>
                      <Select
                        value={u.role}
                        onValueChange={(value) => handleUpdateRole(u.id, value as "admin" | "user")}
                      >
                        <SelectTrigger className="w-32 bg-background border-border">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="user">Usuário</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">Nenhum usuário encontrado</p>
              )}
            </Card>
          </TabsContent>

          {/* Aba de Permissões */}
          <TabsContent value="permissions" className="space-y-6">
            <Card className="p-6">
              <h2 className="text-xl font-semibold text-foreground mb-4">Selecionar Quadro</h2>
              <Select
                value={selectedBoardId?.toString() || ""}
                onValueChange={(value) => setSelectedBoardId(parseInt(value))}
              >
                <SelectTrigger className="w-full bg-background border-border">
                  <SelectValue placeholder="Selecione um quadro" />
                </SelectTrigger>
                <SelectContent>
                  {boards?.map((board) => (
                    <SelectItem key={board.id} value={board.id.toString()}>
                      {board.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Card>

            {selectedBoardId && (
              <Card className="p-6">
                <h2 className="text-xl font-semibold text-foreground mb-4">Permissões do Quadro</h2>
                {membersLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-12 bg-muted rounded animate-pulse" />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {users?.map((u: any) => {
                      const member = (boardMembers as any[])?.find((m: any) => m.userId === u.id);
                      return (
                        <div key={u.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                          <div>
                            <p className="font-medium text-foreground">{u.name}</p>
                            <p className="text-sm text-muted-foreground">{u.username}</p>
                          </div>
                          <div className="flex gap-2">
                            {member ? (
                              <>
                                <Select
                                  value={member.role}
                                  onValueChange={(value) =>
                                    handleGrantPermission(u.id, value as "viewer" | "editor" | "admin")
                                  }
                                >
                                  <SelectTrigger className="w-32 bg-background border-border">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="viewer">Visualizador</SelectItem>
                                    <SelectItem value="editor">Editor</SelectItem>
                                    <SelectItem value="admin">Admin</SelectItem>
                                  </SelectContent>
                                </Select>
                                <Button
                                  onClick={() => handleRevokePermission(u.id)}
                                  variant="destructive"
                                  size="sm"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </>
                            ) : (
                              <Button
                                onClick={() => handleGrantPermission(u.id, "viewer")}
                                variant="outline"
                                size="sm"
                              >
                                <Shield className="w-4 h-4 mr-2" />
                                Conceder Acesso
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </TrelloDashboardLayout>
  );
}
