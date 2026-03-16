import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import TrelloDashboardLayout from "@/components/TrelloDashboardLayout";
import { Loader2, LogIn } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function Home() {
  const { user, loading, isAuthenticated } = useAuth();

  const handleSupabaseLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin,
        },
      });
      if (error) throw error;
    } catch (error) {
      console.error("Supabase login error:", error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    const loginUrl = getLoginUrl();
    const hasSupabase = !!import.meta.env.VITE_SUPABASE_URL;

    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-primary to-primary/80 text-primary-foreground">
        <div className="text-center max-w-md mx-auto px-4">
          <h1 className="text-4xl font-bold mb-4">Maju Task Manager</h1>
          <p className="text-lg mb-8 text-primary-foreground/90">
            Organize your team work with powerful task management
          </p>

          <div className="flex flex-col gap-4">
            {hasSupabase && (
              <Button
                onClick={handleSupabaseLogin}
                className="bg-white text-primary hover:bg-white/90 px-8 py-3 text-lg font-semibold flex items-center gap-2"
              >
                <LogIn className="w-5 h-5" />
                Sign In with Google
              </Button>
            )}

            {loginUrl ? (
              <Button
                onClick={() => (window.location.href = loginUrl)}
                variant="outline"
                className="border-white text-white hover:bg-white/10 px-8 py-3 text-lg font-semibold"
              >
                Sign In with OAuth Portal
              </Button>
            ) : !hasSupabase && (
              <div className="p-4 bg-white/10 rounded-lg border border-white/20">
                <p className="text-sm text-white/80">
                  Configuration required: VITE_SUPABASE_URL or VITE_OAUTH_PORTAL_URL is missing.
                </p>
              </div>
            )}
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
