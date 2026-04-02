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
      setNewTenant({ slug: "", name: "", primaryColor: "#4b4897" });
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
  const [newTenant, setNewTenant] = useState({ slug: "", name: "", primaryColor: "#4b4897" });

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
            <p className="text-muted-foreground">Gerenciamento global de empresas (tenants)</p>
          </div>
          <Button onClick={() => setShowNewForm(!showNewForm)} className="bg-accent text-accent-foreground">
            <Plus className="w-4 h-4 mr-2" />
            Nova Empresa
          </Button>
        </div>

        {showNewForm && (
          <Card className="p-6 mb-8 border-accent/20 bg-accent/5">
            <h3 className="text-lg font-semibold mb-4">Cadastrar Novo Tenant</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-muted-foreground">Slug (URL)</label>
                <Input 
                  placeholder="ex: empresa-a" 
                  value={newTenant.slug}
                  onChange={e => setNewTenant({...newTenant, slug: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-muted-foreground">Nome da Empresa</label>
                <Input 
                  placeholder="Empresa A LTDA" 
                  value={newTenant.name}
                  onChange={e => setNewTenant({...newTenant, name: e.target.value})}
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
                disabled={!newTenant.slug || !newTenant.name}
              >
                Criar Empresa
              </Button>
            </div>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {isLoading ? (
            <p>Carregando ambientes...</p>
          ) : tenants?.map((t: any) => (
            <Card key={t.id} className="p-6 border-accent/10 hover:border-accent/30 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold"
                    style={{ backgroundColor: t.primaryColor || '#4b4897' }}
                  >
                    {t.name?.charAt(0)}
                  </div>
                  <div>
                    <h4 className="font-bold text-foreground">{t.name}</h4>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Globe className="w-3 h-3" />
                      {t.slug}
                    </p>
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => {
                    if(confirm('Tem certeza que deseja remover este ambiente?')) {
                      deleteTenantMutation.mutate({ id: t.id });
                    }
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </TrelloDashboardLayout>
  );
}
