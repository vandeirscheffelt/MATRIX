import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, Puzzle } from "lucide-react";
import { useProducts } from "@/contexts/ProductsContext";
import { useLanguage } from "@/contexts/LanguageContext";

export default function OtherProductsPage() {
  const { products } = useProducts();
  const { t } = useLanguage();
  const visible = [...products]
    .filter((p) => p.status === "active" || p.status === "coming_soon")
    .sort((a, b) => a.display_order - b.display_order);

  return (
    <AppLayout>
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Puzzle className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t("products.title")}</h1>
            <p className="text-sm text-muted-foreground">
              {t("products.subtitle")}
            </p>
          </div>
        </div>

        {visible.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">{t("products.noProducts")}</p>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          {visible.map((p) => (
            <Card
              key={p.id}
              className="group relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:border-primary/30"
            >
              <CardContent className="p-5 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{p.icon}</span>
                    <div>
                      <h3 className="font-semibold text-foreground">{p.product_name}</h3>
                      {p.highlight_badge && (
                        <Badge
                          variant="secondary"
                          className="mt-1 text-xs bg-primary/10 text-primary border-primary/20"
                        >
                          {p.highlight_badge}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {p.short_description}
                </p>
                {p.status === "active" ? (
                  <Button
                    className="w-full"
                    size="sm"
                    onClick={() => window.open(p.external_link, "_blank")}
                  >
                    <ExternalLink className="h-4 w-4 mr-1.5" />
                    {t("products.access")}
                  </Button>
                ) : (
                  <Button className="w-full" size="sm" variant="secondary" disabled>
                    {t("products.comingSoon")}
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
