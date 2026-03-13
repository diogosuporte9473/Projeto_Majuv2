import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import TrelloDashboardLayout from "@/components/TrelloDashboardLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, User, Bell } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

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

  return (
    <TrelloDashboardLayout>
      <div className="p-8 max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Configurações</h1>
          <p className="text-muted-foreground">Gerencie seu perfil e preferências</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-8">
            <TabsTrigger value="profile" className="flex items-center gap-2">
              <User className="w-4 h-4" />
              Perfil
            </TabsTrigger>
            <TabsTrigger value="notifications" className="flex items-center gap-2">
              <Bell className="w-4 h-4" />
              Notificações
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <ProfileSettings user={user} />
          </TabsContent>

          <TabsContent value="notifications">
            <NotificationSettings />
          </TabsContent>
        </Tabs>
      </div>
    </TrelloDashboardLayout>
  );
}

function ProfileSettings({ user }: { user: any }) {
  const [name, setName] = useState(user.name || "");
  const [email, setEmail] = useState(user.email || "");
  const updateProfileMutation = trpc.settings.updateProfile.useMutation();

  const handleUpdateProfile = async () => {
    if (!name.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }

    try {
      await updateProfileMutation.mutateAsync({
        name: name.trim(),
        email: email.trim() || undefined,
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
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu.email@exemplo.com"
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
  const { data: preferences, isLoading } = trpc.settings.getPreferences.useQuery();
  const updatePrefsMutation = trpc.settings.updatePreferences.useMutation();

  const [emailOnCardAssigned, setEmailOnCardAssigned] = useState(
    preferences?.emailOnCardAssigned ?? true
  );
  const [emailOnCardUpdated, setEmailOnCardUpdated] = useState(
    preferences?.emailOnCardUpdated ?? true
  );
  const [emailOnMirroredCard, setEmailOnMirroredCard] = useState(
    preferences?.emailOnMirroredCard ?? true
  );
  const [emailOnDueDate, setEmailOnDueDate] = useState(
    preferences?.emailOnDueDate ?? true
  );

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
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={emailOnCardAssigned}
                  onChange={(e) => setEmailOnCardAssigned(e.target.checked)}
                  className="w-5 h-5 rounded border-border"
                />
              </label>
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg bg-muted border border-border">
              <div>
                <p className="font-medium text-foreground">Cartão Atualizado</p>
                <p className="text-sm text-muted-foreground">
                  Receba email quando um cartão for atualizado
                </p>
              </div>
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={emailOnCardUpdated}
                  onChange={(e) => setEmailOnCardUpdated(e.target.checked)}
                  className="w-5 h-5 rounded border-border"
                />
              </label>
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg bg-muted border border-border">
              <div>
                <p className="font-medium text-foreground">Cartão Espelhado</p>
                <p className="text-sm text-muted-foreground">
                  Receba email quando um cartão for espelhado
                </p>
              </div>
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={emailOnMirroredCard}
                  onChange={(e) => setEmailOnMirroredCard(e.target.checked)}
                  className="w-5 h-5 rounded border-border"
                />
              </label>
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg bg-muted border border-border">
              <div>
                <p className="font-medium text-foreground">Data de Vencimento</p>
                <p className="text-sm text-muted-foreground">
                  Receba alerta quando a data de vencimento estiver próxima
                </p>
              </div>
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={emailOnDueDate}
                  onChange={(e) => setEmailOnDueDate(e.target.checked)}
                  className="w-5 h-5 rounded border-border"
                />
              </label>
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
