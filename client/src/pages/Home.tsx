import { useAuth } from "@/_core/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import TrelloDashboardLayout from "@/components/TrelloDashboardLayout";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function Home() {
  const { user, loading, isAuthenticated } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    try {
      if (isSignUp) {
        const { error } = await (supabase.auth as any).signUp({ email, password });
        if (error) throw error;
        toast.success("Check your email for the confirmation link!");
      } else {
        const { error } = await (supabase.auth as any).signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (error: any) {
      toast.error(error.message || "Authentication failed");
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
            <div>
              <label className="text-sm font-medium">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-2 border rounded-md"
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium">Password</label>
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
        <div className="max-w-6xl">
          <h2 className="text-3xl font-bold text-foreground mb-2">Welcome, {user?.name}!</h2>
          <p className="text-muted-foreground mb-8">
            Select a board from the sidebar or create a new one to get started.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-card rounded-lg p-6 border border-border">
              <h3 className="font-semibold mb-2">Getting Started</h3>
              <p className="text-sm text-muted-foreground">Create your first board and start organizing tasks with your team.</p>
            </div>
          </div>
        </div>
      </div>
    </TrelloDashboardLayout>
  );
}
