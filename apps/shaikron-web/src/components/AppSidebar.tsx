import { LayoutDashboard, CalendarDays, MessageSquare, Settings, UserCircle, Shield, Zap, Puzzle, Package, Settings2, Handshake, GraduationCap, Users } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Separator } from "@/components/ui/separator";

export function AppSidebar() {
  const { isAdmin } = useAuth();
  const { t } = useLanguage();

  const navItems = [
    { title: t("nav.dashboard"), url: "/", icon: LayoutDashboard },
    { title: t("nav.agenda"), url: "/agenda", icon: CalendarDays },
    { title: t("nav.conversations"), url: "/conversations", icon: MessageSquare },
    { title: "CRM", url: "/crm", icon: Users },
    { title: t("nav.settings"), url: "/settings", icon: Settings },
    { title: t("nav.account"), url: "/account", icon: UserCircle },
    { title: t("nav.admin"), url: "/admin", icon: Shield, adminOnly: true },
    { title: t("nav.productsManager"), url: "/admin/products", icon: Package, adminOnly: true },
    { title: t("nav.modulesManager"), url: "/admin/modules", icon: Settings2, adminOnly: true },
    { title: t("nav.affiliatesManager"), url: "/admin/affiliates", icon: Handshake, adminOnly: true },
    { title: t("nav.tutorialsManager"), url: "/admin/tutorials", icon: GraduationCap, adminOnly: true },
  ];

  const bottomItems = [
    { title: t("nav.otherModules"), url: "/modules", icon: Settings2 },
    { title: t("nav.otherProducts"), url: "/products", icon: Puzzle },
    { title: t("nav.affiliates"), url: "/affiliates", icon: Handshake },
    { title: t("nav.tutorials"), url: "/tutorials", icon: GraduationCap },
  ];

  const visibleItems = navItems.filter(item => !item.adminOnly || isAdmin);

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col border-r border-border bg-sidebar">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2.5 border-b border-border px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary glow-blue">
          <Zap className="h-4 w-4 text-primary-foreground" />
        </div>
        <span className="text-lg font-bold text-foreground tracking-tight">
          Schaikron
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {visibleItems.map((item) => (
          <NavLink
            key={item.url}
            to={item.url}
            end
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
              "text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground"
            )}
            activeClassName="bg-primary/10 text-primary glow-blue"
          >
            <item.icon className="h-4.5 w-4.5" />
            <span>{item.title}</span>
          </NavLink>
        ))}
      </nav>

      {/* Bottom section */}
      <div className="px-3 pb-2">
        <Separator className="mb-2" />
        <nav className="space-y-1">
          {bottomItems.map((item) => (
            <NavLink
              key={item.url}
              to={item.url}
              end
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                "text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground"
              )}
              activeClassName="bg-primary/10 text-primary glow-blue"
            >
              <item.icon className="h-4.5 w-4.5" />
              <span>{item.title}</span>
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Footer */}
      <div className="border-t border-border px-6 py-4">
        <p className="text-xs text-muted-foreground">
          Schaikron <span className="text-muted-foreground/60">v1.0</span>
        </p>
      </div>
    </aside>
  );
}
