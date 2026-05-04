import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Settings, Lock } from "lucide-react";
import { useModules } from "@/contexts/ModulesContext";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";

export default function OtherModulesPage() {
  const { modules, loading } = useModules();
  const navigate = useNavigate();
  const { t } = useLanguage();

  const visible = [...modules]
    .filter((m) => m.status === "active" || m.status === "coming_soon")
    .sort((a, b) => a.displayOrder - b.displayOrder);

  return (
    <AppLayout>
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Settings className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t("modules.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("modules.subtitle")}</p>
          </div>
        </div>

        {loading && (
          <p className="text-sm text-muted-foreground text-center py-8">Carregando módulos...</p>
        )}

        {!loading && visible.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">{t("modules.noModules")}</p>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-5 sm:grid-cols-2">
          {visible.map((m) => (
            <Card
              key={m.id}
              className="group relative overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-primary/10 hover:border-primary/40 flex flex-col"
            >
              {/* Banner com ícone */}
              <div className="flex items-center justify-center bg-primary/5 border-b border-border py-8 relative">
                <span className="text-6xl drop-shadow-sm">{m.icon}</span>
                {m.requiresPlan && (
                  <div className="absolute top-3 right-3 bg-background/80 rounded-full p-1">
                    <Lock className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
              </div>

              <CardContent className="p-5 space-y-4 flex flex-col flex-1">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-lg font-bold text-foreground">{m.nome}</h3>
                    {m.highlightBadge && (
                      <Badge
                        variant="secondary"
                        className="text-xs bg-primary/10 text-primary border-primary/20"
                      >
                        {m.highlightBadge}
                      </Badge>
                    )}
                  </div>
                </div>

                <p className="text-sm text-muted-foreground leading-relaxed flex-1 whitespace-pre-wrap">
                  {m.descricao}
                </p>

                {m.requiresPlan ? (
                  <Button className="w-full mt-auto" variant="secondary" disabled>
                    <Lock className="h-4 w-4 mr-2" />
                    {t("modules.upgradeToAccess")}
                  </Button>
                ) : m.status === "active" && m.routePath ? (
                  <Button
                    className="w-full mt-auto"
                    onClick={() => navigate(m.routePath)}
                  >
                    {t("modules.open")}
                  </Button>
                ) : (
                  <Button className="w-full mt-auto" variant="secondary" disabled>
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
