import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, Puzzle } from "lucide-react";
import { useProducts } from "@/contexts/ProductsContext";
import type { ProductCategory, Product } from "@/contexts/ProductsContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

const CATEGORIES: { id: ProductCategory; label: string }[] = [
  { id: "apps",           label: "Apps" },
  { id: "financas",       label: "Finanças" },
  { id: "beleza",         label: "Beleza" },
  { id: "performance",    label: "Performance" },
  { id: "sono",           label: "Sono" },
  { id: "emagrecimento",  label: "Emagrecimento e Longevidade" },
];

const VITALIA_CATEGORIES: ProductCategory[] = [
  "financas", "beleza", "performance", "sono", "emagrecimento",
];

function IconCard({ p, t }: { p: Product; t: (k: string) => string }) {
  return (
    <Card className="group relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:border-primary/30">
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
        <p className="text-sm text-muted-foreground leading-relaxed">{p.short_description}</p>
        {p.status === "active" ? (
          <Button className="w-full" size="sm" onClick={() => window.open(p.external_link, "_blank")}>
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
  );
}

function CatalogCard({ p, t }: { p: Product; t: (k: string) => string }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const imgs = p.images ?? [];
  const hasImages = imgs.length > 0;

  return (
    <Card className="group overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:border-primary/30">
      {/* Foto principal */}
      <div className="relative aspect-square bg-muted overflow-hidden">
        {hasImages ? (
          <img
            src={imgs[activeIdx]}
            alt={p.product_name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-6xl">
            {p.icon}
          </div>
        )}

        <div className="absolute top-2 left-2">
          {p.status === "active" ? (
            <span className="rounded-full bg-emerald-500/90 text-white text-xs font-medium px-2.5 py-0.5 backdrop-blur-sm">
              Disponível
            </span>
          ) : (
            <span className="rounded-full bg-muted/90 text-muted-foreground text-xs font-medium px-2.5 py-0.5 backdrop-blur-sm">
              Em breve
            </span>
          )}
        </div>

        {p.highlight_badge && (
          <div className="absolute top-2 right-2">
            <span className="rounded-full bg-primary/90 text-primary-foreground text-xs font-medium px-2.5 py-0.5 backdrop-blur-sm">
              {p.highlight_badge}
            </span>
          </div>
        )}
      </div>

      {/* Thumbnails */}
      {imgs.length > 1 && (
        <div className="flex gap-1.5 px-3 pt-2">
          {imgs.map((src, i) => (
            <button
              key={i}
              onClick={() => setActiveIdx(i)}
              className={cn(
                "h-12 w-12 rounded-md overflow-hidden border-2 transition-colors flex-shrink-0",
                activeIdx === i
                  ? "border-primary"
                  : "border-transparent opacity-60 hover:opacity-100"
              )}
            >
              <img src={src} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}

      <CardContent className="p-4 space-y-2">
        <h3 className="font-semibold text-foreground">{p.product_name}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
          {p.short_description}
        </p>
        {p.status === "active" ? (
          <Button className="w-full mt-1" size="sm" onClick={() => window.open(p.external_link, "_blank")}>
            <ExternalLink className="h-4 w-4 mr-1.5" />
            {t("products.access")}
          </Button>
        ) : (
          <Button className="w-full mt-1" size="sm" variant="secondary" disabled>
            {t("products.comingSoon")}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export default function OtherProductsPage() {
  const { products } = useProducts();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<ProductCategory>("apps");

  const isVitaliaTab = VITALIA_CATEGORIES.includes(activeTab);

  const visible = [...products]
    .filter((p) => {
      const cat = p.category ?? "apps";
      return cat === activeTab && (p.status === "active" || p.status === "coming_soon");
    })
    .sort((a, b) => a.display_order - b.display_order);

  return (
    <AppLayout>
      <div className="mx-auto max-w-3xl space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Puzzle className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t("products.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("products.subtitle")}</p>
          </div>
        </div>

        {/* Category tabs */}
        <div className="flex flex-wrap gap-2 border-b border-border pb-3">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveTab(cat.id)}
              className={cn(
                "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                activeTab === cat.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* VITALIA coming-soon banner */}
        {isVitaliaTab && (
          <Card className="border-dashed border-primary/30 bg-primary/5">
            <CardContent className="py-6 text-center space-y-2">
              <p className="text-sm font-semibold text-primary tracking-widest uppercase">
                VITALIA — em breve
              </p>
              <p className="text-sm text-muted-foreground">
                Nossa marca de saúde e bem-estar está chegando. Fique de olho!
              </p>
            </CardContent>
          </Card>
        )}

        {/* Empty state */}
        {visible.length === 0 && !isVitaliaTab && (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">{t("products.noProducts")}</p>
            </CardContent>
          </Card>
        )}

        {/* Grid — cada card renderiza pelo seu próprio display_mode */}
        {visible.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            {visible.map((p) =>
              (p.display_mode ?? "icon") === "catalog" ? (
                <CatalogCard key={p.id} p={p} t={t} />
              ) : (
                <IconCard key={p.id} p={p} t={t} />
              )
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
