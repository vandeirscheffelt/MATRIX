import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Shield, Plus, Pencil, Trash2, ToggleLeft, ToggleRight, Handshake } from "lucide-react";
import { useAffiliates, type Affiliate } from "@/contexts/AffiliatesContext";
import { toast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";

const emptyForm = {
  product_name: "",
  short_description: "",
  status: "active" as "active" | "coming_soon",
  external_link: "",
  icon: "🤝",
  highlight_badge: "",
  display_order: 0,
};

export default function AffiliatesManagerPage() {
  const { affiliates, addAffiliate, updateAffiliate, deleteAffiliate } = useAffiliates();
  const { t } = useLanguage();
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const sorted = [...affiliates].sort((a, b) => a.display_order - b.display_order);

  const openNew = () => {
    setForm({ ...emptyForm, display_order: affiliates.length + 1 });
    setEditingId(null);
    setShowModal(true);
  };

  const openEdit = (a: Affiliate) => {
    setForm({
      product_name: a.product_name,
      short_description: a.short_description,
      status: a.status,
      external_link: a.external_link,
      icon: a.icon,
      highlight_badge: a.highlight_badge,
      display_order: a.display_order,
    });
    setEditingId(a.id);
    setShowModal(true);
  };

  const handleSave = () => {
    if (!form.product_name.trim()) {
      toast({ title: t("am.nameRequired"), variant: "destructive" });
      return;
    }
    if (!form.external_link.trim()) {
      toast({ title: t("am.linkRequired"), variant: "destructive" });
      return;
    }

    const data = {
      ...form,
      product_name: form.product_name.trim(),
      short_description: form.short_description.slice(0, 120),
      external_link: form.external_link.trim(),
    };

    if (editingId) {
      updateAffiliate(editingId, data);
      toast({ title: t("am.productUpdated") });
    } else {
      addAffiliate(data);
      toast({ title: t("am.productCreated") });
    }
    setShowModal(false);
  };

  const handleDelete = (id: string, name: string) => {
    deleteAffiliate(id);
    toast({ title: t("am.deleted", { name }) });
  };

  const toggleStatus = (a: Affiliate) => {
    const newStatus = a.status === "active" ? "coming_soon" : "active";
    updateAffiliate(a.id, { status: newStatus });
    const statusLabel = newStatus === "active" ? t("am.active") : t("am.comingSoon");
    toast({ title: t("am.statusChanged", { status: statusLabel }) });
  };

  return (
    <AppLayout>
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
            <Shield className="h-5 w-5 text-destructive" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t("am.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("am.subtitle")}</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Handshake className="h-5 w-5 text-primary" />
                  {t("am.products")}
                </CardTitle>
                <CardDescription>{t("am.productsDesc")}</CardDescription>
              </div>
              <Button size="sm" onClick={openNew}>
                <Plus className="h-4 w-4 mr-1" />
                {t("am.addProduct")}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {sorted.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                {t("am.noProducts")}
              </p>
            )}
            {sorted.map((a) => (
              <div
                key={a.id}
                className={`rounded-lg border p-4 space-y-2 transition-colors ${
                  a.status === "active"
                    ? "border-primary/30 bg-primary/5"
                    : "border-border bg-muted/30"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{a.icon}</span>
                    <span className="font-medium text-foreground">{a.product_name}</span>
                    {a.highlight_badge && (
                      <Badge variant="secondary" className="text-xs">
                        {a.highlight_badge}
                      </Badge>
                    )}
                  </div>
                  <Badge
                    variant={a.status === "active" ? "default" : "secondary"}
                    className={`text-xs ${
                      a.status === "active"
                        ? "bg-green-500/20 text-green-400 border-green-500/30"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {a.status === "active" ? t("am.active") : t("am.comingSoon")}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{a.short_description}</p>
                <p className="text-xs text-muted-foreground/70 truncate">{a.external_link}</p>
                <div className="flex gap-2 mt-1">
                  <Button size="sm" variant="outline" onClick={() => openEdit(a)}>
                    <Pencil className="h-3.5 w-3.5 mr-1" /> {t("am.edit")}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => toggleStatus(a)}>
                    {a.status === "active" ? (
                      <ToggleRight className="h-3.5 w-3.5 mr-1" />
                    ) : (
                      <ToggleLeft className="h-3.5 w-3.5 mr-1" />
                    )}
                    {t("am.toggle")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleDelete(a.id, a.product_name)}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" /> {t("am.delete")}
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Dialog open={showModal} onOpenChange={(open) => !open && setShowModal(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? t("am.editProduct") : t("am.newProduct")}</DialogTitle>
            <DialogDescription>
              {editingId ? t("am.editProductDesc") : t("am.newProductDesc")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-[60px_1fr] gap-3">
              <div className="space-y-2">
                <Label>{t("am.icon")}</Label>
                <Input
                  value={form.icon}
                  onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))}
                  className="text-center text-xl"
                  maxLength={4}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("am.productName")}</Label>
                <Input
                  value={form.product_name}
                  onChange={(e) => setForm((f) => ({ ...f, product_name: e.target.value }))}
                  placeholder={t("am.productNamePlaceholder")}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t("am.shortDesc")}</Label>
              <Textarea
                value={form.short_description}
                onChange={(e) => setForm((f) => ({ ...f, short_description: e.target.value.slice(0, 120) }))}
                placeholder={t("am.shortDescPlaceholder")}
                rows={2}
              />
              <p className="text-xs text-muted-foreground text-right">{form.short_description.length}/120</p>
            </div>
            <div className="space-y-2">
              <Label>{t("am.externalLink")}</Label>
              <Input
                value={form.external_link}
                onChange={(e) => setForm((f) => ({ ...f, external_link: e.target.value }))}
                placeholder="https://mastersaas.com/afiliado/seu-codigo"
                type="url"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{t("am.status")}</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm((f) => ({ ...f, status: v as "active" | "coming_soon" }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">{t("am.active")}</SelectItem>
                    <SelectItem value="coming_soon">{t("am.comingSoon")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("am.displayOrder")}</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.display_order}
                  onChange={(e) => setForm((f) => ({ ...f, display_order: parseInt(e.target.value) || 0 }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t("am.highlightBadge")}</Label>
              <Select
                value={form.highlight_badge || "_none"}
                onValueChange={(v) => setForm((f) => ({ ...f, highlight_badge: v === "_none" ? "" : v }))}
              >
                <SelectTrigger><SelectValue placeholder={t("am.none")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">{t("am.none")}</SelectItem>
                  <SelectItem value="🔥 Popular">{t("am.badgePopular")}</SelectItem>
                  <SelectItem value="🚀 New">{t("am.badgeNew")}</SelectItem>
                  <SelectItem value="💰 Monetize more">{t("am.badgeMonetize")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleSave} className="w-full">
              {editingId ? t("am.updateProduct") : t("am.createProduct")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
