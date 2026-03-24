import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import TrelloDashboardLayout from "@/components/TrelloDashboardLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Loader2, User, Bell, Users, Plus, Trash2, Edit2, Shield, UserCheck } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export default function Settings() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("profile");

  if (!user) {
    return (
      <TrelloDashboardLayout>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </TrelloDashboardLayout>
    );
  }

  const isAdmin = user.role === "admin";

  return (
    <TrelloDashboardLayout>
      <div className="p-8 max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Configurações</h1>
          <p className="text-muted-foreground">Gerencie seu perfil e preferências</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className={`grid w-full ${isAdmin ? 'grid-cols-3' : 'grid-cols-2'} mb-8`}>
            <TabsTrigger value="profile" className="flex items-center gap-2">
              <User className="w-4 h-4" />
              Perfil
            </TabsTrigger>
            <TabsTrigger value="notifications" className="flex items-center gap-2">
              <Bell className="w-4 h-4" />
              Notificações
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="users" className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                Usuários
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="profile">
            <ProfileSettings user={user} />
          </TabsContent>

          <TabsContent value="notifications">
            <NotificationSettings />
          </TabsContent>

          {isAdmin && (
            <TabsContent value="users">
              <UserManagement />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </TrelloDashboardLayout>
  );
}

function UserManagement() {
  const utils = trpc.useUtils();
  const { data: users, isLoading } = trpc.admin.users.list.useQuery();
  const createUserMutation = trpc.admin.users.create.useMutation();
  const updateUserMutation = trpc.admin.users.update.useMutation();
  const deleteUserMutation = trpc.admin.users.delete.useMutation();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  
  // Form states
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"user" | "admin">("user");

  const resetForm = () => {
    setUsername("");
    setName("");
    setPassword("");
    setRole("user");
    setEditingUser(null);
  };

  const handleOpenCreate = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (user: any) => {
    setEditingUser(user);
    setUsername(user.username);
    setName(user.name || "");
    setRole(user.role);
    setPassword(""); // Don't show password
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingUser) {
        await updateUserMutation.mutateAsync({
          id: editingUser.id,
          name,
          role,
          password: password || undefined,
        });
        toast.success("Usuário atualizado com sucesso");
      } else {
        await createUserMutation.mutateAsync({
          username,
          password,
          name,
          role,
        });
        toast.success("Usuário criado com sucesso");
      }
      setIsDialogOpen(false);
      utils.admin.users.list.invalidate();
    } catch (error: any) {
      toast.error(error.message || "Erro ao salvar usuário");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Tem certeza que deseja remover este usuário?")) return;
    try {
      await deleteUserMutation.mutateAsync({ id });
      toast.success("Usuário removido");
      utils.admin.users.list.invalidate();
    } catch (error: any) {
      toast.error(error.message || "Erro ao remover usuário");
    }
  };

  if (isLoading) {
    return (
      <Card className="p-12 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-semibold">Gerenciamento de Usuários</h3>
        <Button onClick={handleOpenCreate} className="bg-accent hover:bg-accent/90 flex items-center gap-2">
          <Plus className="w-4 h-4" /> Novo Usuário
        </Button>
      </div>

      <Card className="overflow-hidden border border-border">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted text-muted-foreground uppercase text-xs font-semibold">
              <tr>
                <th className="px-6 py-4">Nome</th>
                <th className="px-6 py-4">Username / Email</th>
                <th className="px-6 py-4">Função</th>
                <th className="px-6 py-4">Criado em</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users?.map((u: any) => (
                <tr key={u.id} className="hover:bg-muted/50 transition-colors">
                  <td className="px-6 py-4 font-medium text-foreground">{u.name || "Sem nome"}</td>
                  <td className="px-6 py-4 text-muted-foreground">{u.username}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      u.role === 'admin' ? 'bg-amber-500/10 text-amber-500' : 'bg-blue-500/10 text-blue-500'
                    }`}>
                      {u.role === 'admin' ? <Shield className="w-3 h-3" /> : <UserCheck className="w-3 h-3" />}
                      {u.role === 'admin' ? 'Admin' : 'Usuário'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">
                    {new Date(u.createdAt).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-6 py-4 text-right space-x-2">
                    <Button variant="ghost" size="sm" onClick={() => handleOpenEdit(u)} className="hover:bg-accent/10 hover:text-accent">
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(u.id)} className="hover:bg-red-500/10 hover:text-red-500">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent 
          aria-describedby={undefined}
          className="bg-background border-border"
        >
          <DialogHeader>
            <DialogTitle>{editingUser ? "Editar Usuário" : "Novo Usuário"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-4">
            {!editingUser && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Username / Email</label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-border bg-background"
                  placeholder="ex: diogo ou email@exemplo.com"
                />
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium">Nome Completo</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-border bg-background"
                placeholder="Nome do usuário"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Senha {editingUser && "(deixe em branco para manter)"}</label>
              <input
                type="password"
                required={!editingUser}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-border bg-background"
                placeholder="Mínimo 6 caracteres"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Função</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as any)}
                className="w-full px-4 py-2 rounded-lg border border-border bg-background"
              >
                <option value="user">Usuário Comum</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
            <DialogFooter className="pt-6">
              <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" className="bg-accent hover:bg-accent/90" disabled={createUserMutation.isPending || updateUserMutation.isPending}>
                {(createUserMutation.isPending || updateUserMutation.isPending) ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProfileSettings({ user }: { user: any }) {
  const [name, setName] = useState(user.name || "");
  const updateProfileMutation = trpc.settings.updateProfile.useMutation();

  const handleUpdateProfile = async () => {
    if (!name.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }

    try {
      await updateProfileMutation.mutateAsync({
        name: name.trim(),
      });
      toast.success("Perfil atualizado com sucesso!");
    } catch (error) {
      toast.error("Erro ao atualizar perfil");
      console.error(error);
    }
  };

  return (
    <Card className="p-6 border border-border">
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-foreground mb-4">
            Informações Pessoais
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Nome Completo
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Seu nome"
                className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Método de Login
              </label>
              <div className="px-4 py-2 rounded-lg bg-muted border border-border text-foreground capitalize">
                {user.loginMethod || "Não especificado"}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Função
              </label>
              <div className="px-4 py-2 rounded-lg bg-muted border border-border text-foreground capitalize">
                {user.role === "admin" ? "Administrador" : "Usuário"}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Membro desde
              </label>
              <div className="px-4 py-2 rounded-lg bg-muted border border-border text-foreground">
                {new Date(user.createdAt).toLocaleDateString("pt-BR")}
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-4 border-t border-border">
          <Button
            onClick={handleUpdateProfile}
            disabled={updateProfileMutation.isPending}
            className="bg-accent text-accent-foreground hover:bg-accent/90"
          >
            {updateProfileMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              "Salvar Alterações"
            )}
          </Button>
        </div>
      </div>
    </Card>
  );
}

function NotificationSettings() {
  const { data: preferences, isLoading } = trpc.settings.getPreferences.useQuery(undefined);
  const updatePrefsMutation = trpc.settings.updatePreferences.useMutation();

  const [emailOnCardAssigned, setEmailOnCardAssigned] = useState(true);
  const [emailOnCardUpdated, setEmailOnCardUpdated] = useState(true);
  const [emailOnMirroredCard, setEmailOnMirroredCard] = useState(true);
  const [emailOnDueDate, setEmailOnDueDate] = useState(true);

  useEffect(() => {
    if (preferences) {
      setEmailOnCardAssigned(preferences.emailOnCardAssigned);
      setEmailOnCardUpdated(preferences.emailOnCardUpdated);
      setEmailOnMirroredCard(preferences.emailOnMirroredCard);
      setEmailOnDueDate(preferences.emailOnDueDate);
    }
  }, [preferences]);

  const handleUpdatePreferences = async () => {
    try {
      await updatePrefsMutation.mutateAsync({
        emailOnCardAssigned,
        emailOnCardUpdated,
        emailOnMirroredCard,
        emailOnDueDate,
      });
      toast.success("Preferências atualizadas com sucesso!");
    } catch (error) {
      toast.error("Erro ao atualizar preferências");
      console.error(error);
    }
  };

  if (isLoading) {
    return (
      <Card className="p-6 border border-border flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </Card>
    );
  }

  return (
    <Card className="p-6 border border-border">
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-foreground mb-4">
            Preferências de Notificações
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted border border-border">
              <div>
                <p className="font-medium text-foreground">Cartão Atribuído</p>
                <p className="text-sm text-muted-foreground">
                  Receba email quando um cartão for atribuído a você
                </p>
              </div>
              <Switch
                checked={emailOnCardAssigned}
                onCheckedChange={setEmailOnCardAssigned}
              />
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg bg-muted border border-border">
              <div>
                <p className="font-medium text-foreground">Cartão Atualizado</p>
                <p className="text-sm text-muted-foreground">
                  Receba email quando um cartão for atualizado
                </p>
              </div>
              <Switch
                checked={emailOnCardUpdated}
                onCheckedChange={setEmailOnCardUpdated}
              />
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg bg-muted border border-border">
              <div>
                <p className="font-medium text-foreground">Cartão Espelhado</p>
                <p className="text-sm text-muted-foreground">
                  Receba email quando um cartão for espelhado
                </p>
              </div>
              <Switch
                checked={emailOnMirroredCard}
                onCheckedChange={setEmailOnMirroredCard}
              />
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg bg-muted border border-border">
              <div>
                <p className="font-medium text-foreground">Data de Vencimento</p>
                <p className="text-sm text-muted-foreground">
                  Receba alerta quando a data de vencimento estiver próxima
                </p>
              </div>
              <Switch
                checked={emailOnDueDate}
                onCheckedChange={setEmailOnDueDate}
              />
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-4 border-t border-border">
          <Button
            onClick={handleUpdatePreferences}
            disabled={updatePrefsMutation.isPending}
            className="bg-accent text-accent-foreground hover:bg-accent/90"
          >
            {updatePrefsMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              "Salvar Preferências"
            )}
          </Button>
        </div>
      </div>
    </Card>
  );
}
