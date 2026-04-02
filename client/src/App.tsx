import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { LanguageProvider } from "./contexts/LanguageContext";
import { BrandingProvider } from "./contexts/BrandingContext";
import Home from "./pages/Home";
import Settings from "./pages/Settings";
import BoardView from "./pages/BoardView";
import Admin from "./pages/Admin";
import MasterDashboard from "./pages/MasterDashboard";
import Onboarding from "./pages/Onboarding";

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/onboarding"} component={Onboarding} />
      <Route path={"/board/:id"} component={BoardView} />
      <Route path={"/settings"} component={Settings} />
      <Route path={"/admin"} component={Admin} />
      <Route path={"/master"} component={MasterDashboard} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light" switchable>
        <LanguageProvider>
          <BrandingProvider>
            <TooltipProvider>
              <Toaster />
              <Router />
            </TooltipProvider>
          </BrandingProvider>
        </LanguageProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
