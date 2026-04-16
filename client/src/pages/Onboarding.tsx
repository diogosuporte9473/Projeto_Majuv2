import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { useBranding } from "@/contexts/BrandingContext";

export default function Onboarding() {
  const [, setLocation] = useLocation();
  const [name, setName] = useState("");
  const { refresh } = useAuth();
  const { appName } = useBranding();
  
  const createTenant = trpc.tenant.create.useMutation({
    onSuccess: async () => {
      toast.success("Empresa criada com sucesso!");
      await refresh();
      setLocation("/");
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao criar empresa");
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    createTenant.mutate({ name });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Bem-vindo ao {appName}</CardTitle>
          <CardDescription>
            Para começar, precisamos criar o perfil da sua empresa.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome da Empresa</Label>
              <Input
                id="name"
                placeholder="Ex: Minha Empresa LTDA"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={createTenant.isPending}
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button 
              type="submit" 
              className="w-full" 
              disabled={createTenant.isPending || !name.trim()}
            >
              {createTenant.isPending ? "Criando..." : "Criar Empresa"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
