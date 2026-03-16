import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import TrelloDashboardLayout from "@/components/TrelloDashboardLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Shield, BarChart2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function Admin() {
  const { user } = useAuth();
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [selectedBoardId, setSelectedBoardId] = useState<number | null>(null);

  // Queries
  const { data: stats } = trpc.stats.getGeneral.useQuery(
    undefined,
    { enabled: user?.role === "admin" } as any
  );

  const { data: users, isLoading: usersLoading } = trpc.admin.users.list.useQuery(
    undefined,
    { enabled: user?.role === "admin" } as any
  );

  const { data: boards } = trpc.boards.list.useQuery(
    undefined,
    { enabled: user?.role === "admin" } as any
  );

  const { data: boardMembers, isLoading: membersLoading } = trpc.admin.permissions.getByBoard.useQuery(
    { boardId: selectedBoardId || 0 },
    { enabled: !!selectedBoardId && user?.role === "admin" } as any
  );

  // Mutations
  const createUserMutation = trpc.admin.users.create.useMutation();
  const updateRoleMutation = trpc.admin.users.updateRole.useMutation();
  const grantPermissionMutation = trpc.admin.permissions.grant.useMutation();
  const revokePermissionMutation = trpc.admin.permissions.revoke.useMutation();

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
    if (!newUserEmail.trim() || !newUserName.trim()) {
      toast.error("Email e nome são obrigatórios");
      return;
    }

    try {
      await createUserMutation.mutateAsync({
        email: newUserEmail,
        name: newUserName,
      });
      setNewUserEmail("");
      setNewUserName("");
      toast.success("Usuário criado com sucesso");
    } catch (error) {
      toast.error("Erro ao criar usuário");
    }
  };

  const handleUpdateRole = async (userId: number, newRole: "admin" | "user") => {
    try {
      await updateRoleMutation.mutateAsync({
        userId,
        role: newRole,
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

  return (
    <TrelloDashboardLayout>
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Gestão de Acesso</h1>
          <p className="text-muted-foreground">Gerenciar usuários e permissões do sistema</p>
        </div>

        <Tabs defaultValue="users" className="w-full">
          <TabsList className="grid w-full max-w-lg grid-cols-3">
            <TabsTrigger value="users">Usuários</TabsTrigger>
            <TabsTrigger value="permissions">Permissões</TabsTrigger>
            <TabsTrigger value="stats">Estatísticas</TabsTrigger>
          </TabsList>

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
                  placeholder="Email"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  type="email"
                  className="bg-background border-border"
                />
                <Input
                  placeholder="Nome"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
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
                        <p className="text-sm text-muted-foreground">{u.email}</p>
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
                    {users?.map((u) => {
                      const member = boardMembers?.find((m) => m.userId === u.id);
                      return (
                        <div key={u.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                          <div>
                            <p className="font-medium text-foreground">{u.name}</p>
                            <p className="text-sm text-muted-foreground">{u.email}</p>
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
