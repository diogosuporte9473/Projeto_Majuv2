import { useRealtimeSync } from "@/_core/hooks/useRealtimeSync";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus, LogOut, Settings, Users, ShieldAlert, AlertTriangle } from "lucide-react";
import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useLanguage } from "@/contexts/LanguageContext";
import { useBranding } from "@/contexts/BrandingContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";

interface TrelloDashboardLayoutProps {
  children: React.ReactNode;
}

export default function TrelloDashboardLayout({ children }: TrelloDashboardLayoutProps) {
  const { user, logout } = useAuth();
  const { t } = useLanguage();
  const { appName, appLogo, setAppName } = useBranding();
  const { theme } = useTheme();
  
  const { data: brandingData, refetch: refetchBranding } = trpc.branding.get.useQuery();
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [setupCompanyName, setSetupCompanyName] = useState("");

  useEffect(() => {
    // Modal de setup removido em favor da página /onboarding
    setShowSetupModal(false);
  }, [user, brandingData]);
  
  // Ativa sincronização global para a barra lateral (boards)
  useRealtimeSync();

  const { data: boards, isLoading } = trpc.boards.list.useQuery();
  const [showNewBoard, setShowNewBoard] = useState(false);
  const [newBoardName, setNewBoardName] = useState("");
  const createBoardMutation = trpc.boards.create.useMutation();
  const updateBrandingMutation = trpc.branding.update.useMutation();

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
          <Link href="/">
            <div className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity overflow-hidden">
              {appLogo ? (
                <img src={appLogo} alt={appName} className="h-10 w-auto object-contain" />
              ) : (
                <div className="w-10 h-10 bg-accent rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-primary font-bold">{appName.charAt(0)}</span>
                </div>
              )}
              <h1 className="text-xl font-bold truncate">
                {appName}
              </h1>
            </div>
          </Link>
          <p className="text-sm text-primary-foreground/70 mt-1">{t("layout.taskManager")}</p>
        </div>

        <div className="p-4 border-b border-primary-foreground/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-accent rounded-full flex items-center justify-center">
              <span className="text-primary font-bold text-sm">
                {user?.name?.charAt(0).toUpperCase() || "U"}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate">{user?.name || t("layout.userFallback")}</p>
              <p className="text-xs text-primary-foreground/70 truncate">{user?.username}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-4">
          <div className="mb-6">
            <p className="text-xs font-semibold text-primary-foreground/50 uppercase tracking-wider mb-3">
              {t("layout.yourBoards")}
            </p>
            
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-10 bg-primary-foreground/10 rounded animate-pulse" />
                ))}
              </div>
            ) : boards && boards.length > 0 ? (
              <div className="space-y-4">
                {user?.role === 'master_admin' ? (
                  // Agrupamento por Tenant para Master Admin
                  Object.entries(
                    (boards || []).reduce((acc: Record<string, any[]>, board) => {
                      const tenant = (board as any).tenantName || "Geral";
                      if (!acc[tenant]) acc[tenant] = [];
                      acc[tenant].push(board);
                      return acc;
                    }, {})
                  ).map(([tenant, tenantBoards]) => (
                    <div key={tenant} className="space-y-1">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-primary-foreground/40 px-3 py-1 bg-primary-foreground/5 rounded-sm mb-1">
                        {tenant}
                      </p>
                      {(tenantBoards as any[]).map((board: any) => (
                        <Link key={board.id} href={`/board/${board.id}`} className="block p-2 rounded-lg hover:bg-primary-foreground/10 transition-colors text-sm font-bold" style={{ color: 'var(--sidebar-board-text)' }}>
                          <div className="flex items-center gap-2">
                            <div
                              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                              style={{ backgroundColor: board.color }}
                            />
                            <span className="truncate">{board.name}</span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  ))
                ) : (
                  // Listagem normal para usuários comuns
                  <div className="space-y-1">
                    {(boards || []).map((board: any) => (
                      <Link key={board.id} href={`/board/${board.id}`} className="block p-3 rounded-lg hover:bg-primary-foreground/10 transition-colors text-sm font-bold" style={{ color: 'var(--sidebar-board-text)' }}>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: board.color }}
                          />
                          <span className="truncate">{board.name}</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-primary-foreground/60">{t("layout.noBoardsYet")}</p>
            )}
          </div>

          <Button
            onClick={() => setShowNewBoard(!showNewBoard)}
            className="w-full bg-accent text-accent-foreground hover:bg-accent/90 mb-4"
            size="sm"
          >
            <Plus className="w-4 h-4 mr-2" />
            {t("layout.newBoard")}
          </Button>

          {showNewBoard && (
            <Card className="p-3 mb-4 bg-primary-foreground/5 border-accent">
              <input
                type="text"
                placeholder={t("layout.boardName")}
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
                  {t("common.create")}
                </Button>
                <Button
                  onClick={() => setShowNewBoard(false)}
                  variant="outline"
                  size="sm"
                  className="flex-1 text-xs border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/10"
                >
                  {t("common.cancel")}
                </Button>
              </div>
            </Card>
          )}
        </nav>

        <div className="p-4 border-t border-primary-foreground/10 space-y-2">
          {user?.role === 'master_admin' && (
            <Link href="/master" className="flex items-center gap-2 p-2 rounded bg-accent/20 hover:bg-accent/30 text-accent transition-colors text-sm font-bold">
              <ShieldAlert className="w-4 h-4" />
              Painel Master
            </Link>
          )}
          {user?.role === 'admin' && (
            <Link href="/admin" className="flex items-center gap-2 p-2 rounded hover:bg-primary-foreground/10 transition-colors text-sm">
              <Users className="w-4 h-4" />
              {t("layout.admin")}
            </Link>
          )}
          <Link href="/settings" className="flex items-center gap-2 p-2 rounded hover:bg-primary-foreground/10 transition-colors text-sm">
            <Settings className="w-4 h-4" />
            {t("layout.settings")}
          </Link>
          <Button
            onClick={logout}
            variant="outline"
            size="sm"
            className="w-full justify-start border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/10"
          >
            <LogOut className="w-4 h-4 mr-2" />
            {t("layout.logout")}
          </Button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
