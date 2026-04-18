import { User, Building2, LogOut } from "lucide-react";
import { useAiMode } from "@/contexts/AiModeContext";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function AppHeader() {
  const { aiActive, toggleAi } = useAiMode();
  const { user, logout } = useAuth();
  const { t } = useLanguage();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/80 backdrop-blur-xl px-6">
      {/* Left: Company */}
      <div className="flex items-center gap-3">
        <Building2 className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium text-foreground">
          {user?.name ?? "My Company"}
        </span>
      </div>

      {/* Right: AI Toggle + Avatar */}
      <div className="flex items-center gap-5">
        {/* AI Status */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span
              className={`h-2 w-2 rounded-full ${
                aiActive ? "bg-success animate-pulse" : "bg-destructive"
              }`}
            />
            <span className="text-xs font-medium text-muted-foreground">
              {aiActive ? t("ai.active") : t("ai.humanMode")}
            </span>
          </div>

          {/* Toggle */}
          <button
            onClick={toggleAi}
            className={`relative h-6 w-11 rounded-full transition-colors duration-300 ${
              aiActive ? "bg-primary glow-blue" : "bg-secondary"
            }`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-foreground transition-transform duration-300 ${
                aiActive ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>

        {/* Avatar with dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-muted-foreground hover:bg-surface-hover transition-colors">
              <User className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {user && (
              <div className="px-2 py-1.5 text-sm border-b border-border mb-1">
                <p className="font-medium text-foreground">{user.name}</p>
                <p className="text-xs text-muted-foreground">{user.email}</p>
              </div>
            )}
            <DropdownMenuItem onClick={logout} className="text-destructive cursor-pointer">
              <LogOut className="mr-2 h-4 w-4" />
              {t("auth.logout")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
