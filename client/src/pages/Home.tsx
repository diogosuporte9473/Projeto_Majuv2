import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import TrelloDashboardLayout from "@/components/TrelloDashboardLayout";
import { Loader2, Layout, CheckSquare, Sparkles, MessageSquare } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";

export default function Home() {
  const { user, loading, isAuthenticated, refresh } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: async (data) => {
      // Atualizar o cache do tRPC manualmente para garantir que a UI mude instantaneamente
      utils.auth.me.setData(undefined, data as any);
      await refresh();
      setLocation("/");
      toast.success("Login realizado com sucesso!");
    },
    onError: (error) => {
      toast.error(error.message || "Falha na autenticação");
    }
  });

  const registerMutation = trpc.auth.register.useMutation({
    onSuccess: async (data) => {
      utils.auth.me.setData(undefined, data as any);
      await refresh();
      setLocation("/");
      toast.success("Conta criada com sucesso!");
    },
    onError: (error) => {
      toast.error(error.message || "Falha no registro");
    }
  });

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    try {
      if (isSignUp) {
        await registerMutation.mutateAsync({ username, password, name });
      } else {
        await loginMutation.mutateAsync({ username, password });
      }
    } finally {
      setAuthLoading(false);
    }
  };

  // Only show the full-page loader on initial session check or when explicitly needed
  if (loading && !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Carregando sessão...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-primary to-primary/80 text-primary-foreground p-4">
        <div className="bg-white text-foreground p-8 rounded-xl shadow-2xl w-full max-w-md">
          <h1 className="text-3xl font-bold mb-2 text-center text-primary">Maju Task Manager</h1>
          <p className="text-muted-foreground mb-8 text-center">
            {isSignUp ? "Create your account" : "Sign in to manage your tasks"}
          </p>
          
          <form onSubmit={handleAuth} className="space-y-4">
            {isSignUp && (
              <div>
                <label className="text-sm font-medium">Nome</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full p-2 border rounded-md"
                  placeholder="Seu nome"
                  required
                />
              </div>
            )}
            <div>
              <label className="text-sm font-medium">Usuário (Email)</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full p-2 border rounded-md"
                placeholder="exemplo@email.com"
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium">Senha</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-2 border rounded-md"
                required
              />
            </div>
            <Button
              type="submit"
              disabled={authLoading}
              className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-2"
            >
              {authLoading ? <Loader2 className="animate-spin mr-2" /> : null}
              {isSignUp ? "Sign Up" : "Sign In"}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-primary hover:underline text-sm"
            >
              {isSignUp ? "Already have an account? Sign In" : "Don't have an account? Sign Up"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <TrelloDashboardLayout>
      <div className="p-8">
        <div className="max-w-6xl mx-auto">
          <div className="mb-12">
            <h1 className="text-4xl font-extrabold text-foreground mb-3">Bem-vindo, {user?.name}! 👋</h1>
            <p className="text-xl text-muted-foreground">
              Seu centro de produtividade pessoal. Comece a organizar suas tarefas hoje.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-card p-8 rounded-2xl border border-border shadow-sm hover:shadow-md transition-all group">
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-colors">
                <Layout className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-foreground">Quadros Dinâmicos</h3>
              <p className="text-muted-foreground leading-relaxed">
                Crie quadros para diferentes projetos e organize suas tarefas em listas personalizáveis.
              </p>
            </div>

            <div className="bg-card p-8 rounded-2xl border border-border shadow-sm hover:shadow-md transition-all group">
              <div className="w-12 h-12 bg-accent/10 rounded-xl flex items-center justify-center mb-6 group-hover:bg-accent/20 transition-colors">
                <CheckSquare className="w-6 h-6 text-accent" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-foreground">Checklists & Etiquetas</h3>
              <p className="text-muted-foreground leading-relaxed">
                Adicione detalhes minuciosos aos seus cartões com checklists e etiquetas coloridas para fácil identificação.
              </p>
            </div>

            <div className="bg-card p-8 rounded-2xl border border-border shadow-sm hover:shadow-md transition-all group">
              <div className="w-12 h-12 bg-green-500/10 rounded-xl flex items-center justify-center mb-6 group-hover:bg-green-500/20 transition-colors">
                <Sparkles className="w-6 h-6 text-green-500" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-foreground">Assistente IA</h3>
              <p className="text-muted-foreground leading-relaxed">
                Use nossa inteligência artificial integrada para sugerir passos de projeto e organizar seu fluxo de trabalho.
              </p>
            </div>
          </div>

          <div className="mt-16 p-8 bg-gradient-to-r from-primary to-primary/80 rounded-3xl text-primary-foreground shadow-xl">
            <div className="flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="flex-1">
                <h2 className="text-3xl font-bold mb-4">Pronto para começar?</h2>
                <p className="text-primary-foreground/80 text-lg">
                  Crie seu primeiro quadro agora e experimente uma nova forma de gerenciar projetos.
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex flex-col items-center">
                   <p className="text-sm font-medium mb-2 opacity-80 italic">Dica: Use o botão de chat na visualização do quadro para falar com a Maju AI!</p>
                   <div className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full border border-white/20">
                     <MessageSquare className="w-4 h-4" />
                     <span className="text-sm font-semibold">Assistente IA Ativo</span>
                   </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </TrelloDashboardLayout>
  );
}
