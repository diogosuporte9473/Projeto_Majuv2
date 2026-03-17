import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus, LogOut, Settings, Users } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";

interface TrelloDashboardLayoutProps {
  children: React.ReactNode;
}

export default function TrelloDashboardLayout({ children }: TrelloDashboardLayoutProps) {
  const { user, logout } = useAuth();
  const { data: boards, isLoading } = trpc.boards.list.useQuery();
  const [showNewBoard, setShowNewBoard] = useState(false);
  const [newBoardName, setNewBoardName] = useState("");
  const createBoardMutation = trpc.boards.create.useMutation();

  const handleCreateBoard = async () => {
    if (!newBoardName.trim()) return;
    
    try {
      await createBoardMutation.mutateAsync({
        name: newBoardName,
        description: "",
        color: "#4b4897",
      });
      setNewBoardName("");
      setShowNewBoard(false);
    } catch (error) {
      console.error("Error creating board:", error);
    }
  };

  return (
    <div className="flex h-screen bg-background">
      <aside className="w-64 bg-primary text-primary-foreground border-r border-border flex flex-col">
        <div className="p-6 border-b border-primary-foreground/10">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <div className="w-10 h-10 bg-accent rounded-lg flex items-center justify-center">
              <span className="text-primary font-bold">M</span>
            </div>
            Maju Tasks
          </h1>
          <p className="text-sm text-primary-foreground/70 mt-1">Task Manager</p>
        </div>

        <div className="p-4 border-b border-primary-foreground/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-accent rounded-full flex items-center justify-center">
              <span className="text-primary font-bold text-sm">
                {user?.name?.charAt(0).toUpperCase() || "U"}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate">{user?.name || "User"}</p>
              <p className="text-xs text-primary-foreground/70 truncate">{user?.email}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-4">
          <div className="mb-6">
            <p className="text-xs font-semibold text-primary-foreground/50 uppercase tracking-wider mb-3">
              Your Boards
            </p>
            
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-10 bg-primary-foreground/10 rounded animate-pulse" />
                ))}
              </div>
            ) : boards && boards.length > 0 ? (
              <div className="space-y-2">
                {boards.map((board) => (
                  <Link key={board.id} href={`/board/${board.id}`} className="block p-3 rounded-lg hover:bg-primary-foreground/10 transition-colors text-sm font-medium">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: board.color }}
                      />
                      <span className="truncate">{board.name}</span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-xs text-primary-foreground/60">No boards yet</p>
            )}
          </div>

          <Button
            onClick={() => setShowNewBoard(!showNewBoard)}
            className="w-full bg-accent text-accent-foreground hover:bg-accent/90 mb-4"
            size="sm"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Board
          </Button>

          {showNewBoard && (
            <Card className="p-3 mb-4 bg-primary-foreground/5 border-accent">
              <input
                type="text"
                placeholder="Board name"
                value={newBoardName}
                onChange={(e) => setNewBoardName(e.target.value)}
                className="w-full px-2 py-2 rounded bg-primary-foreground/10 text-primary-foreground placeholder-primary-foreground/50 text-sm mb-2 border border-primary-foreground/20"
                onKeyPress={(e) => {
                  if (e.key === "Enter") handleCreateBoard();
                }}
              />
              <div className="flex gap-2">
                <Button
                  onClick={handleCreateBoard}
                  disabled={createBoardMutation.isPending}
                  size="sm"
                  className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90 text-xs"
                >
                  Create
                </Button>
                <Button
                  onClick={() => setShowNewBoard(false)}
                  variant="outline"
                  size="sm"
                  className="flex-1 text-xs border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/10"
                >
                  Cancel
                </Button>
              </div>
            </Card>
          )}
        </nav>

        <div className="p-4 border-t border-primary-foreground/10 space-y-2">
          {user?.role === 'admin' && (
            <Link href="/admin" className="flex items-center gap-2 p-2 rounded hover:bg-primary-foreground/10 transition-colors text-sm">
              <Users className="w-4 h-4" />
              Admin
            </Link>
          )}
          <Link href="/settings" className="flex items-center gap-2 p-2 rounded hover:bg-primary-foreground/10 transition-colors text-sm">
            <Settings className="w-4 h-4" />
            Settings
          </Link>
          <Button
            onClick={logout}
            variant="outline"
            size="sm"
            className="w-full justify-start border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/10"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
