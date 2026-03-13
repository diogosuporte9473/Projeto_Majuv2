import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import TrelloDashboardLayout from "@/components/TrelloDashboardLayout";
import { Loader2 } from "lucide-react";

export default function Home() {
  const { user, loading, isAuthenticated } = useAuth();

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
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-primary to-primary/80 text-primary-foreground">
        <div className="text-center max-w-md mx-auto px-4">
          <h1 className="text-4xl font-bold mb-4">Maju Task Manager</h1>
          <p className="text-lg mb-8 text-primary-foreground/90">
            Organize your team work with powerful task management
          </p>
          <Button
            onClick={() => (window.location.href = getLoginUrl())}
            className="bg-accent text-accent-foreground hover:bg-accent/90 px-8 py-3 text-lg font-semibold"
          >
            Sign In
          </Button>
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
