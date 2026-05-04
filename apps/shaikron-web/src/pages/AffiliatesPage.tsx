import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, Handshake } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAffiliates } from "@/contexts/AffiliatesContext";

export default function AffiliatesPage() {
  const { affiliates } = useAffiliates();
  const { t } = useLanguage();
  const visible = [...affiliates]
    .filter((a) => a.status === "active" || a.status === "coming_soon")
    .sort((a, b) => a.displayOrder - b.displayOrder);

  return (
    <AppLayout>
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Handshake className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t("affiliates.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("affiliates.subtitle")}</p>
          </div>
        </div>

        {visible.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">{t("affiliates.noItems")}</p>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-5 sm:grid-cols-2">
          {visible.map((a) => (
            <Card
              key={a.id}
              className="group relative overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-primary/10 hover:border-primary/40 flex flex-col"
            >
              {/* Banner de destaque com ícone centralizado */}
              <div className="flex items-center justify-center bg-primary/5 border-b border-border py-8">
                <span className="text-6xl drop-shadow-sm">{a.icon}</span>
              </div>

              <CardContent className="p-5 space-y-4 flex flex-col flex-1">
                {/* Nome + badge */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-lg font-bold text-foreground">{a.productName}</h3>
                    {a.highlightBadge && (
                      <Badge
                        variant="secondary"
                        className="text-xs bg-primary/10 text-primary border-primary/20"
                      >
                        {a.highlightBadge}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Descrição com mais espaço */}
                <p className="text-sm text-muted-foreground leading-relaxed flex-1 whitespace-pre-wrap">
                  {a.shortDescription}
                </p>

                {/* CTA */}
                {a.status === "active" ? (
                  <Button
                    className="w-full mt-auto"
                    onClick={() => window.open(a.externalLink, "_blank")}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    {t("affiliates.access")}
                  </Button>
                ) : (
                  <Button className="w-full mt-auto" variant="secondary" disabled>
                    {t("affiliates.comingSoon")}
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
