import { useState } from "react";
import { trpc } from "@/lib/trpc";
import TrelloDashboardLayout from "@/components/TrelloDashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Plus, Globe, Trash2, Layout, Settings } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Redirect } from "wouter";

export default function MasterDashboard() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  
  const { data: tenants, isLoading } = trpc.branding.listAllTenants.useQuery();
  const createTenantMutation = trpc.branding.createTenant.useMutation({
    onSuccess: () => {
      utils.branding.listAllTenants.invalidate();
      setShowNewForm(false);
      setNewTenant({ domain: "", appName: "", primaryColor: "#4b4897" });
      toast.success("Novo ambiente criado com sucesso!");
    },
    onError: (err) => toast.error(`Erro ao criar: ${err.message}`)
  });

  const deleteTenantMutation = trpc.branding.deleteTenant.useMutation({
    onSuccess: () => {
      utils.branding.listAllTenants.invalidate();
      toast.success("Ambiente removido");
    }
  });

  const [showNewForm, setShowNewForm] = useState(false);
  const [newTenant, setNewTenant] = useState({ domain: "", appName: "", primaryColor: "#4b4897" });

  // Proteção de rota
  if (!user || user.role !== 'master_admin') {
    return <Redirect to="/" />;
  }

  return (
    <TrelloDashboardLayout>
      <div className="p-8 max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Painel Master</h1>
            <p className="text-muted-foreground">Gerenciamento global de ambientes e domínios</p>
          </div>
          <Button onClick={() => setShowNewForm(!showNewForm)} className="bg-accent text-accent-foreground">
            <Plus className="w-4 h-4 mr-2" />
            Novo Ambiente
          </Button>
        </div>

        {showNewForm && (
          <Card className="p-6 mb-8 border-accent/20 bg-accent/5">
            <h3 className="text-lg font-semibold mb-4">Cadastrar Novo Cliente/Domínio</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-muted-foreground">Domínio (Host)</label>
                <Input 
                  placeholder="ex: cliente.maju.io" 
                  value={newTenant.domain}
                  onChange={e => setNewTenant({...newTenant, domain: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-muted-foreground">Nome da Aplicação</label>
                <Input 
                  placeholder="Maju Tasks Cliente" 
                  value={newTenant.appName}
                  onChange={e => setNewTenant({...newTenant, appName: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-muted-foreground">Cor Primária</label>
                <div className="flex gap-2">
                  <Input 
                    type="color" 
                    className="w-12 p-1 h-10"
                    value={newTenant.primaryColor}
                    onChange={e => setNewTenant({...newTenant, primaryColor: e.target.value})}
                  />
                  <Input 
                    value={newTenant.primaryColor}
                    onChange={e => setNewTenant({...newTenant, primaryColor: e.target.value})}
                  />
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setShowNewForm(false)}>Cancelar</Button>
              <Button 
                onClick={() => createTenantMutation.mutate(newTenant)}
                disabled={!newTenant.domain || !newTenant.appName}
              >
                Criar Ambiente
              </Button>
            </div>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {isLoading ? (
            <p>Carregando ambientes...</p>
          ) : tenants?.map((tenant: any) => (
            <Card key={tenant.id} className="p-5 border-border hover:border-accent/50 transition-colors">
              <div className="flex items-start justify-between mb-4">
                <div className="p-2 bg-accent/10 rounded-lg">
                  <Globe className="w-6 h-6 text-accent" />
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400" onClick={() => {
                    if(confirm(`Deseja remover o ambiente ${tenant.domain}?`)) {
                      deleteTenantMutation.mutate({ id: tenant.id });
                    }
                  }}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              
              <h3 className="font-bold text-lg mb-1">{tenant.app_name}</h3>
              <p className="text-sm text-muted-foreground mb-4 font-mono">{tenant.domain}</p>
              
              <div className="flex items-center gap-2 pt-4 border-t border-border text-xs text-muted-foreground">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: tenant.primary_color }} />
                <span>Tema: {tenant.primary_color}</span>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </TrelloDashboardLayout>
  );
}
