import { useState, useRef } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Shield, Plus, Pencil, Trash2, ToggleLeft, ToggleRight, Package, Upload, X, Loader2 } from "lucide-react";
import { useProducts, type Product, type ProductCategory } from "@/contexts/ProductsContext";
import { toast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/lib/supabase";

const emptyForm = {
  product_name: "",
  short_description: "",
  status: "active" as "active" | "coming_soon",
  external_link: "",
  icon: "📦",
  highlight_badge: "",
  display_order: 0,
  category: "apps" as ProductCategory,
  display_mode: "icon" as "icon" | "catalog",
  images: [] as string[],
};

export default function ProductsManagerPage() {
  const { products, addProduct, updateProduct, deleteProduct } = useProducts();
  const { t } = useLanguage();
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    const uploaded: string[] = [];
    for (const file of Array.from(files)) {
      const ext = file.name.split(".").pop();
      const path = `products/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("product-images").upload(path, file, { upsert: false });
      if (error) {
        toast({ title: `Erro ao enviar ${file.name}`, variant: "destructive" });
        continue;
      }
      const { data } = supabase.storage.from("product-images").getPublicUrl(path);
      uploaded.push(data.publicUrl);
    }
    setForm((f) => ({ ...f, images: [...f.images, ...uploaded] }));
    setUploading(false);
  };

  const sorted = [...products].sort((a, b) => a.display_order - b.display_order);

  const openNew = () => {
    setForm({ ...emptyForm, display_order: products.length + 1 });
    setEditingId(null);
    setShowModal(true);
  };

  const openEdit = (p: Product) => {
    setForm({
      product_name: p.product_name,
      short_description: p.short_description,
      status: p.status,
      external_link: p.external_link,
      icon: p.icon,
      highlight_badge: p.highlight_badge,
      display_order: p.display_order,
      category: p.category ?? "apps",
      display_mode: p.display_mode ?? "icon",
      images: p.images ?? [],
    });
    setEditingId(p.id);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.product_name.trim()) {
      toast({ title: t("pm.nameRequired"), variant: "destructive" });
      return;
    }

    const data = {
      ...form,
      product_name: form.product_name.trim(),
      short_description: form.short_description.slice(0, 300),
      external_link: form.external_link.trim(),
    };

    try {
      if (editingId) {
        await updateProduct(editingId, data);
        toast({ title: t("pm.productUpdated") });
      } else {
        await addProduct(data);
        toast({ title: t("pm.productCreated") });
      }
      setShowModal(false);
    } catch {
      toast({ title: "Erro ao salvar produto", variant: "destructive" });
    }
  };

  const handleDelete = async (id: string, name: string) => {
    try {
      await deleteProduct(id);
      toast({ title: t("pm.deleted", { name }) });
    } catch {
      toast({ title: "Erro ao excluir produto", variant: "destructive" });
    }
  };

  const toggleStatus = async (p: Product) => {
    const newStatus = p.status === "active" ? "coming_soon" : "active";
    await updateProduct(p.id, { status: newStatus });
    const statusLabel = newStatus === "active" ? t("pm.active") : t("pm.comingSoon");
    toast({ title: t("pm.statusChanged", { status: statusLabel }) });
  };

  return (
    <AppLayout>
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
            <Shield className="h-5 w-5 text-destructive" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t("pm.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("pm.subtitle")}</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Package className="h-5 w-5 text-primary" />
                  {t("pm.products")}
                </CardTitle>
                <CardDescription>{t("pm.productsDesc")}</CardDescription>
              </div>
              <Button size="sm" onClick={openNew}>
                <Plus className="h-4 w-4 mr-1" />
                {t("pm.addProduct")}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {sorted.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                {t("pm.noProducts")}
              </p>
            )}
            {sorted.map((p) => (
              <div
                key={p.id}
                className={`rounded-lg border p-4 space-y-2 transition-colors ${
                  p.status === "active"
                    ? "border-primary/30 bg-primary/5"
                    : "border-border bg-muted/30"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{p.icon}</span>
                    <span className="font-medium text-foreground">{p.product_name}</span>
                    {p.highlight_badge && (
                      <Badge variant="secondary" className="text-xs">
                        {p.highlight_badge}
                      </Badge>
                    )}
                  </div>
                  <Badge
                    variant={p.status === "active" ? "default" : "secondary"}
                    className={`text-xs ${
                      p.status === "active"
                        ? "bg-green-500/20 text-green-400 border-green-500/30"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {p.status === "active" ? t("pm.active") : t("pm.comingSoon")}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{p.short_description}</p>
                <p className="text-xs text-muted-foreground/70 truncate">{p.external_link}</p>
                <div className="flex gap-2 mt-1">
                  <Button size="sm" variant="outline" onClick={() => openEdit(p)}>
                    <Pencil className="h-3.5 w-3.5 mr-1" /> {t("pm.edit")}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => toggleStatus(p)}>
                    {p.status === "active" ? (
                      <ToggleRight className="h-3.5 w-3.5 mr-1" />
                    ) : (
                      <ToggleLeft className="h-3.5 w-3.5 mr-1" />
                    )}
                    {t("pm.toggle")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleDelete(p.id, p.product_name)}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" /> {t("pm.delete")}
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Create/Edit Modal */}
      <Dialog open={showModal} onOpenChange={(open) => !open && setShowModal(false)}>
        <DialogContent className="max-w-md max-h-[90vh] flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>{editingId ? t("pm.editProduct") : t("pm.newProduct")}</DialogTitle>
            <DialogDescription>
              {editingId ? t("pm.editProductDesc") : t("pm.newProductDesc")}
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 pr-1 space-y-4">
            <div className="grid grid-cols-[60px_1fr] gap-3">
              <div className="space-y-2">
                <Label>{t("pm.icon")}</Label>
                <Input
                  value={form.icon}
                  onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))}
                  className="text-center text-xl"
                  maxLength={4}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("pm.productName")}</Label>
                <Input
                  value={form.product_name}
                  onChange={(e) => setForm((f) => ({ ...f, product_name: e.target.value }))}
                  placeholder={t("pm.productNamePlaceholder")}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t("pm.shortDesc")}</Label>
              <Textarea
                value={form.short_description}
                onChange={(e) => setForm((f) => ({ ...f, short_description: e.target.value.slice(0, 300) }))}
                placeholder={t("pm.shortDescPlaceholder")}
                rows={4}
              />
              <p className="text-xs text-muted-foreground text-right">{form.short_description.length}/300</p>
            </div>
            <div className="space-y-2">
              <Label>{t("pm.externalLink")}</Label>
              <Input
                value={form.external_link}
                onChange={(e) => setForm((f) => ({ ...f, external_link: e.target.value }))}
                placeholder="https://example.com"
                type="url"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{t("pm.status")}</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm((f) => ({ ...f, status: v as "active" | "coming_soon" }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">{t("pm.active")}</SelectItem>
                    <SelectItem value="coming_soon">{t("pm.comingSoon")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("pm.displayOrder")}</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.display_order}
                  onChange={(e) => setForm((f) => ({ ...f, display_order: parseInt(e.target.value) || 0 }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select
                value={form.category}
                onValueChange={(v) => setForm((f) => ({ ...f, category: v as ProductCategory }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="apps">Apps</SelectItem>
                  <SelectItem value="financas">Finanças</SelectItem>
                  <SelectItem value="beleza">Beleza</SelectItem>
                  <SelectItem value="performance">Performance</SelectItem>
                  <SelectItem value="sono">Sono</SelectItem>
                  <SelectItem value="emagrecimento">Emagrecimento e Longevidade</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {/* Modo de exibição */}
            <div className="space-y-3">
              <Label>Modo de exibição</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, display_mode: "icon" }))}
                  className={`rounded-lg border-2 p-3 text-center transition-colors ${
                    form.display_mode === "icon"
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border text-muted-foreground hover:border-primary/40"
                  }`}
                >
                  <div className="text-2xl mb-1">🧩</div>
                  <div className="text-xs font-medium">Ícone</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">Emoji + texto</div>
                </button>
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, display_mode: "catalog" }))}
                  className={`rounded-lg border-2 p-3 text-center transition-colors ${
                    form.display_mode === "catalog"
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border text-muted-foreground hover:border-primary/40"
                  }`}
                >
                  <div className="text-2xl mb-1">🖼️</div>
                  <div className="text-xs font-medium">Catálogo</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">Foto + carrossel</div>
                </button>
              </div>
            </div>

            {/* Upload de imagens (só aparece no modo catálogo) */}
            {form.display_mode === "catalog" && (
              <div className="space-y-3">
                <Label>Imagens</Label>

                {/* Previews */}
                {form.images.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {form.images.map((url, i) => (
                      <div key={i} className="relative h-20 w-20 rounded-lg overflow-hidden border border-border">
                        <img src={url} alt="" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setForm((f) => ({ ...f, images: f.images.filter((_, j) => j !== i) }))}
                          className="absolute top-0.5 right-0.5 rounded-full bg-black/70 p-0.5 text-white hover:bg-black"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Botão de upload */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  multiple
                  className="hidden"
                  onChange={(e) => handleImageUpload(e.target.files)}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="w-full"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploading ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                  ) : (
                    <Upload className="h-3.5 w-3.5 mr-1" />
                  )}
                  {uploading ? "Enviando..." : "Selecionar imagens"}
                </Button>
                {form.images.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center">
                    Selecione ao menos uma imagem para o carrossel.
                  </p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label>{t("pm.highlightBadge")}</Label>
              <Select
                value={form.highlight_badge || "_none"}
                onValueChange={(v) => setForm((f) => ({ ...f, highlight_badge: v === "_none" ? "" : v }))}
              >
                <SelectTrigger><SelectValue placeholder={t("pm.none")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">{t("pm.none")}</SelectItem>
                   <SelectItem value="🔥 Popular">{t("pm.badgePopular")}</SelectItem>
                   <SelectItem value="🚀 New">{t("pm.badgeNew")}</SelectItem>
                   <SelectItem value="💰 Monetize more">{t("pm.badgeMonetize")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleSave} className="w-full">
              {editingId ? t("pm.updateProduct") : t("pm.createProduct")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
