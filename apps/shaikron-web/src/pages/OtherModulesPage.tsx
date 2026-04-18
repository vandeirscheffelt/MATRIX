import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Settings, Lock } from "lucide-react";
import { useModules } from "@/contexts/ModulesContext";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";

export default function OtherModulesPage() {
  const { modules } = useModules();
  const navigate = useNavigate();
  const { t } = useLanguage();

  const visible = [...modules]
    .filter((m) => m.status === "active" || m.status === "coming_soon")
    .sort((a, b) => a.display_order - b.display_order);

  return (
    <AppLayout>
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Settings className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t("modules.title")}</h1>
            <p className="text-sm text-muted-foreground">
              {t("modules.subtitle")}
            </p>
          </div>
        </div>

        {visible.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">{t("modules.noModules")}</p>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          {visible.map((m) => (
            <Card
              key={m.id}
              className="group relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:border-primary/30"
            >
              <CardContent className="p-5 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{m.icon}</span>
                    <div>
                      <h3 className="font-semibold text-foreground">{m.module_name}</h3>
                      {m.highlight_badge && (
                        <Badge
                          variant="secondary"
                          className="mt-1 text-xs bg-primary/10 text-primary border-primary/20"
                        >
                          {m.highlight_badge}
                        </Badge>
                      )}
                    </div>
                  </div>
                  {m.requires_plan && (
                    <Lock className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {m.short_description}
                </p>
                {m.requires_plan ? (
                  <Button className="w-full" size="sm" variant="secondary" disabled>
                    <Lock className="h-4 w-4 mr-1.5" />
                    {t("modules.upgradeToAccess")}
                  </Button>
                ) : m.status === "active" ? (
                  <Button
                    className="w-full"
                    size="sm"
                    onClick={() => navigate(m.route_path)}
                  >
                    {t("modules.open")}
                  </Button>
                ) : (
                  <Button className="w-full" size="sm" variant="secondary" disabled>
                    {t("modules.comingSoon")}
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
