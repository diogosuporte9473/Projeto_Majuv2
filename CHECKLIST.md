# Checklist de Arquivos do Projeto

## Raiz do Projeto
- [ ] `.env`
- [ ] `.gitignore`
- [ ] `.npmrc`
- [ ] `.prettierignore`
- [ ] `.prettierrc`
- [ ] `components.json`
- [ ] `drizzle.config.ts`
- [ ] `package.json`
- [ ] `pnpm-lock.yaml`
- [ ] `test-db.ts`
- [ ] `todo.md`
- [ ] `tsconfig.json`
- [ ] `vercel.json`
- [ ] `vite.config.ts`
- [ ] `vitest.config.ts`

## API
- [ ] `api/index.ts`

## Client
- [ ] `client/index.html`
- [ ] `client/src/App.tsx`
- [ ] `client/src/const.ts`
- [ ] `client/src/index.css`
- [ ] `client/src/main.tsx`

### Components
- [ ] `client/src/components/AIChatBox.tsx`
- [ ] `client/src/components/CardDetailModal.tsx`
- [ ] `client/src/components/DashboardLayout.tsx`
- [ ] `client/src/components/DashboardLayoutSkeleton.tsx`
- [ ] `client/src/components/DraggableCard.tsx`
- [ ] `client/src/components/ErrorBoundary.tsx`
- [ ] `client/src/components/ManusDialog.tsx`
- [ ] `client/src/components/Map.tsx`
- [ ] `client/src/components/TrelloDashboardLayout.tsx`

### UI Components
- [ ] `client/src/components/ui/accordion.tsx`
- [ ] `client/src/components/ui/alert-dialog.tsx`
- [ ] `client/src/components/ui/alert.tsx`
- [ ] `client/src/components/ui/aspect-ratio.tsx`
- [ ] `client/src/components/ui/avatar.tsx`
- [ ] `client/src/components/ui/badge.tsx`
- [ ] `client/src/components/ui/breadcrumb.tsx`
- [ ] `client/src/components/ui/button-group.tsx`
- [ ] `client/src/components/ui/button.tsx`
- [ ] `client/src/components/ui/calendar.tsx`
- [ ] `client/src/components/ui/card.tsx`
- [ ] `client/src/components/ui/carousel.tsx`
- [ ] `client/src/components/ui/chart.tsx`
- [ ] `client/src/components/ui/checkbox.tsx`
- [ ] `client/src/components/ui/collapsible.tsx`
- [ ] `client/src/components/ui/command.tsx`
- [ ] `client/src/components/ui/context-menu.tsx`
- [ ] `client/src/components/ui/dialog.tsx`
- [ ] `client/src/components/ui/drawer.tsx`
- [ ] `client/src/components/ui/dropdown-menu.tsx`
- [ ] `client/src/components/ui/empty.tsx`
- [ ] `client/src/components/ui/field.tsx`
- [ ] `client/src/components/ui/form.tsx`
- [ ] `client/src/components/ui/hover-card.tsx`
- [ ] `client/src/components/ui/input-group.tsx`
- [ ] `client/src/components/ui/input-otp.tsx`
- [ ] `client/src/components/ui/input.tsx`
- [ ] `client/src/components/ui/item.tsx`
- [ ] `client/src/components/ui/kbd.tsx`
- [ ] `client/src/components/ui/label.tsx`
- [ ] `client/src/components/ui/menubar.tsx`
- [ ] `client/src/components/ui/navigation-menu.tsx`
- [ ] `client/src/components/ui/pagination.tsx`
- [ ] `client/src/components/ui/popover.tsx`
- [ ] `client/src/components/ui/progress.tsx`
- [ ] `client/src/components/ui/radio-group.tsx`
- [ ] `client/src/components/ui/resizable.tsx`
- [ ] `client/src/components/ui/scroll-area.tsx`
- [ ] `client/src/components/ui/select.tsx`
- [ ] `client/src/components/ui/separator.tsx`
- [ ] `client/src/components/ui/sheet.tsx`
- [ ] `client/src/components/ui/sidebar.tsx`
- [ ] `client/src/components/ui/skeleton.tsx`
- [ ] `client/src/components/ui/slider.tsx`
- [ ] `client/src/components/ui/sonner.tsx`
- [ ] `client/src/components/ui/spinner.tsx`
- [ ] `client/src/components/ui/switch.tsx`
- [ ] `client/src/components/ui/table.tsx`
- [ ] `client/src/components/ui/tabs.tsx`
- [ ] `client/src/components/ui/textarea.tsx`
- [ ] `client/src/components/ui/toggle-group.tsx`
- [ ] `client/src/components/ui/toggle.tsx`
- [ ] `client/src/components/ui/tooltip.tsx`

### Contexts & Hooks
- [ ] `client/src/contexts/ThemeContext.tsx`
- [ ] `client/src/hooks/useComposition.ts`
- [ ] `client/src/hooks/useMobile.tsx`
- [ ] `client/src/hooks/usePersistFn.ts`

### Lib & Core
- [ ] `client/src/lib/supabase.ts`
- [ ] `client/src/lib/trpc.ts`
- [ ] `client/src/lib/utils.ts`
- [ ] `client/src/_core/hooks/useAuth.ts`
- [ ] `client/src/_core/hooks/useRealtimeSync.ts`

### Pages
- [ ] `client/src/pages/Admin.tsx`
- [ ] `client/src/pages/BoardView.tsx`
- [ ] `client/src/pages/ComponentShowcase.tsx`
- [ ] `client/src/pages/Home.tsx`
- [ ] `client/src/pages/NotFound.tsx`
- [ ] `client/src/pages/Settings.tsx`

## Drizzle (Database)
- [ ] `drizzle/0000_lucky_xavin.sql`
- [ ] `drizzle/0001_secret_payback.sql`
- [ ] `drizzle/0002_cloudy_whirlwind.sql`
- [ ] `drizzle/relations.ts`
- [ ] `drizzle/schema.ts`
- [ ] `drizzle/meta/0000_snapshot.json`
- [ ] `drizzle/meta/0001_snapshot.json`
- [ ] `drizzle/meta/0002_snapshot.json`
- [ ] `drizzle/meta/_journal.json`

## Patches
- [ ] `patches/wouter@3.7.1.patch`

## Server
- [ ] `server/auth.logout.test.ts`
- [ ] `server/boards.test.ts`
- [ ] `server/db.ts`
- [ ] `server/routers.ts`
- [ ] `server/storage.ts`
- [ ] `server/Untitled-1.ts`

### Server Core
- [ ] `server/_core/context.ts`
- [ ] `server/_core/cookies.ts`
- [ ] `server/_core/dataApi.ts`
- [ ] `server/_core/env.ts`
- [ ] `server/_core/imageGeneration.ts`
- [ ] `server/_core/index.ts`
- [ ] `server/_core/llm.ts`
- [ ] `server/_core/map.ts`
- [ ] `server/_core/notification.ts`
- [ ] `server/_core/sdk.ts`
- [ ] `server/_core/supabase.ts`
- [ ] `server/_core/systemRouter.ts`
- [ ] `server/_core/trpc.ts`
- [ ] `server/_core/vite.ts`
- [ ] `server/_core/voiceTranscription.ts`
- [ ] `server/_core/types/cookie.d.ts`
- [ ] `server/_core/types/manusTypes.ts`

## Shared
- [ ] `shared/const.ts`
- [ ] `shared/types.ts`
- [ ] `shared/_core/errors.ts`
