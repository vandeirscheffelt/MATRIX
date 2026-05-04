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

        <div className="grid gap-4 sm:grid-cols-2">
          {visible.map((a) => (
            <Card
              key={a.id}
              className="group relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:border-primary/30"
            >
              <CardContent className="p-5 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{a.icon}</span>
                    <div>
                      <h3 className="font-semibold text-foreground">{a.productName}</h3>
                      {a.highlightBadge && (
                        <Badge
                          variant="secondary"
                          className="mt-1 text-xs bg-primary/10 text-primary border-primary/20"
                        >
                          {a.highlightBadge}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {a.shortDescription}
                </p>
                {a.status === "active" ? (
                  <Button
                    className="w-full"
                    size="sm"
                    onClick={() => window.open(a.externalLink, "_blank")}
                  >
                    <ExternalLink className="h-4 w-4 mr-1.5" />
                    {t("affiliates.access")}
                  </Button>
                ) : (
                  <Button className="w-full" size="sm" variant="secondary" disabled>
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
