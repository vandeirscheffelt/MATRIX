import { useState, useEffect } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { AppHeader } from "@/components/AppHeader";
import { AiModeProvider } from "@/contexts/AiModeContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { useLocation } from "react-router-dom";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  // Close sidebar on route change (mobile)
  useEffect(() => {
    if (isMobile) setSidebarOpen(false);
  }, [location.pathname, isMobile]);

  return (
    <AiModeProvider>
      <div className="min-h-screen bg-background">
        {/* Mobile overlay */}
        {isMobile && sidebarOpen && (
          <div className="fixed inset-0 z-30 bg-black/50" onClick={() => setSidebarOpen(false)} />
        )}

        {/* Sidebar */}
        <div className={isMobile ? (sidebarOpen ? "fixed inset-y-0 left-0 z-40" : "hidden") : ""}>
          <AppSidebar />
        </div>

        <div className={isMobile ? "flex flex-col min-h-screen" : "ml-64 flex flex-col min-h-screen"}>
          {/* Mobile top bar */}
          {isMobile && (
            <div className="flex items-center gap-2 border-b border-border px-4 py-2">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSidebarOpen(true)}>
                <Menu className="h-5 w-5" />
              </Button>
              <span className="text-sm font-bold text-foreground">Schaikron</span>
            </div>
          )}
          <AppHeader />
          <main className={isMobile ? "flex-1 p-3" : "flex-1 p-6"}>{children}</main>
        </div>
      </div>
    </AiModeProvider>
  );
}
