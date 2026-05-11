import { useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Shield, Package, Plus, Calendar, Info, Tag, TrendingUp, Ticket } from "lucide-react";
import { api } from "@/lib/apiClient";
import { usePricingContext, getVersionStatus, type PriceVersion, type AdjustmentApplyMode } from "@/contexts/PricingContext";
import { toast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";

export default function AdminPage() {
  const { versions, addVersion, updateVersion, addAdjustment } = usePricingContext();
  const { t } = useLanguage();

  const statusBadge: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
    active: { label: t("admin.active"), variant: "default" },
    scheduled: { label: t("admin.scheduled"), variant: "secondary" },
    expired: { label: t("admin.expired"), variant: "destructive" },
  };
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAdjModal, setShowAdjModal] = useState(false);
  const [adjVersionId, setAdjVersionId] = useState<string | null>(null);
  const [adjForm, setAdjForm] = useState({ type: "percentage" as "percentage" | "fixed", value: "", effectiveDate: "", applyMode: "all_customers" as AdjustmentApplyMode });

  const [coupons, setCoupons] = useState<any[]>([]);
  const [showCouponModal, setShowCouponModal] = useState(false);
  const [couponForm, setCouponForm] = useState({
    code: "",
    description: "",
    discountType: "percent" as "percent" | "fixed",
    discountValue: "",
    duration: "once" as "once" | "forever",
    maxUses: "",
    expiresAt: "",
  });

  useEffect(() => {
    fetchCoupons();
  }, []);

  const fetchCoupons = async () => {
    try {
      const data = await api.get<any[]>("/admin/coupons");
      setCoupons(data);
    } catch (err) {}
  };

  const handleSaveCoupon = async () => {
    if (!couponForm.code || !couponForm.discountValue) {
      toast({ title: "Código e Valor são obrigatórios", variant: "destructive" });
      return;
    }
    try {
      const payload = {
        code: couponForm.code.trim().toUpperCase(),
        description: couponForm.description,
        discountType: couponForm.discountType,
        discountValue: parseFloat(couponForm.discountValue),
        duration: couponForm.duration,
        maxUses: couponForm.maxUses ? parseInt(couponForm.maxUses) : null,
        expiresAt: couponForm.expiresAt || null,
      };
      await api.post("/admin/coupons", payload);
      toast({ title: "Cupom criado com sucesso" });
      setShowCouponModal(false);
      setCouponForm({ code: "", description: "", discountType: "percent", discountValue: "", duration: "once", maxUses: "", expiresAt: "" });
      fetchCoupons();
    } catch (err: any) {
      toast({ title: "Erro ao criar cupom", description: err.response?.data?.error || err.message, variant: "destructive" });
    }
  };

  const toggleCoupon = async (id: string, currentStatus: boolean) => {
    try {
      await api.patch(`/admin/coupons/${id}`, { active: !currentStatus });
      fetchCoupons();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const [form, setForm] = useState({
    label: "",
    basePrice: "",
    additionalPrice: "",
    startDate: "",
    endDate: "",
  });

  const formatCurrency = (value: number) =>
    `R$ ${value.toFixed(2).replace(".", ",")}`;

  const resetForm = () => {
    setForm({ label: "", basePrice: "", additionalPrice: "", startDate: "", endDate: "" });
    setEditingId(null);
  };

  const openNew = () => {
    resetForm();
    setShowModal(true);
  };

  const openEdit = (v: PriceVersion) => {
    setForm({
      label: v.label,
      basePrice: v.basePrice.toString(),
      additionalPrice: v.additionalPrice.toString(),
      startDate: v.startDate,
      endDate: v.endDate || "",
    });
    setEditingId(v.id);
    setShowModal(true);
  };

  const handleSave = () => {
    const data = {
      label: form.label.trim() || "Untitled",
      basePrice: parseFloat(form.basePrice) || 0,
      additionalPrice: parseFloat(form.additionalPrice) || 0,
      startDate: form.startDate,
      endDate: form.endDate || null,
      adjustments: [],
    };

    if (!data.startDate) {
      toast({ title: t("admin.startDateRequired"), variant: "destructive" });
      return;
    }

    let error: string | null;
    if (editingId) {
      error = updateVersion(editingId, data);
    } else {
      error = addVersion(data);
    }

    if (error) {
      toast({ title: t("admin.error"), description: error, variant: "destructive" });
      return;
    }

    toast({ title: editingId ? t("admin.versionUpdated") : t("admin.versionCreated"), description: `"${data.label}" ${t("admin.savedSuccess")}` });
    setShowModal(false);
    resetForm();
  };

  // Sort: active first, then scheduled, then expired (newest first within groups)
  const sorted = [...versions].sort((a, b) => {
    const order = { active: 0, scheduled: 1, expired: 2 };
    const sa = order[getVersionStatus(a)];
    const sb = order[getVersionStatus(b)];
    if (sa !== sb) return sa - sb;
    return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
  });

  return (
    <AppLayout>
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
            <Shield className="h-5 w-5 text-destructive" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t("admin.panel")}</h1>
            <p className="text-sm text-muted-foreground">{t("admin.internalOnly")}</p>
          </div>
        </div>

        {/* Price Versions */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Package className="h-5 w-5 text-primary" />
                  {t("admin.priceVersions")}
                </CardTitle>
                <CardDescription>
                  {t("admin.priceVersionsDesc")}
                </CardDescription>
              </div>
              <Button size="sm" onClick={openNew}>
                <Plus className="h-4 w-4" />
                New Version
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {sorted.map(v => {
              const s = getVersionStatus(v);
              const badge = statusBadge[s];
              const isExpired = s === "expired";

              return (
                <div
                  key={v.id}
                  className={`rounded-lg border p-4 space-y-2 transition-colors ${
                    s === "active" ? "border-primary/30 bg-primary/5" :
                    s === "scheduled" ? "border-secondary/30 bg-secondary/5" :
                    "border-border bg-muted/30 opacity-70"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Tag className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium text-foreground">{v.label}</span>
                    </div>
                    <Badge variant={badge.variant} className="text-xs">
                      {badge.label}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
                    <span>{t("admin.base")}: {formatCurrency(v.basePrice)}</span>
                    <span>{t("admin.perUser")}: {formatCurrency(v.additionalPrice)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>
                      {new Date(v.startDate).toLocaleDateString("pt-BR")}
                      {v.endDate ? ` → ${new Date(v.endDate).toLocaleDateString("pt-BR")}` : " → " + t("admin.ongoing")}
                    </span>
                  </div>
                  {/* Adjustments */}
                  {v.adjustments && v.adjustments.length > 0 && (
                    <div className="space-y-1 pt-1">
                      <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" /> {t("admin.adjustments")}
                      </span>
                      {v.adjustments.map(adj => (
                        <div key={adj.id} className="text-xs text-muted-foreground pl-4">
                         +{adj.value}{adj.type === "percentage" ? "%" : " R$"} from{" "}
                           {new Date(adj.effectiveDate).toLocaleDateString("pt-BR")}
                           {adj.applyMode && (
                             <span className="ml-1 text-muted-foreground/70">
                               ({adj.applyMode === "new_customers_only" ? t("admin.newCustomers") : adj.applyMode === "all_customers" ? t("admin.allCustomers") : t("admin.nextBillingCycle")})
                             </span>
                           )}
                        </div>
                      ))}
                    </div>
                  )}
                  {!isExpired && (
                    <div className="flex gap-2 mt-1">
                      <Button size="sm" variant="outline" onClick={() => openEdit(v)}>
                        Edit
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => {
                        setAdjVersionId(v.id);
                        setAdjForm({ type: "percentage", value: "", effectiveDate: "", applyMode: "all_customers" });
                        setShowAdjModal(true);
                      }}>
                        <TrendingUp className="h-3.5 w-3.5 mr-1" />
                        Apply Adjustment
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}

            {versions.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                {t("admin.noPriceVersions")}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Coupons Panel */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Ticket className="h-5 w-5 text-primary" />
                  Cupons de Desconto
                </CardTitle>
                <CardDescription>
                  Gerencie cupons integrados com AppMax (PIX/Boleto) e Stripe (Cartão).
                </CardDescription>
              </div>
              <Button size="sm" onClick={() => setShowCouponModal(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Novo Cupom
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {coupons.map((c) => (
              <div key={c.id} className={`flex items-center justify-between rounded-lg border p-3 transition-colors ${c.active ? "border-primary/20 bg-primary/5" : "border-border bg-muted/30 opacity-70"}`}>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-foreground">{c.code}</span>
                    <Badge variant={c.active ? "default" : "secondary"} className="text-[10px] h-5 px-1.5">
                      {c.active ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{c.description || "Sem descrição"}</p>
                  <div className="flex gap-3 text-xs text-muted-foreground mt-2">
                    <span>{c.discountType === "percent" ? `${c.discountValue}%` : `R$ ${c.discountValue}`}</span>
                    <span>• {c.duration === "once" ? "1ª Mensalidade" : "Recorrente"}</span>
                    {c.maxUses && <span>• Usos: {c.usedCount}/{c.maxUses}</span>}
                    {!c.maxUses && <span>• Usos: {c.usedCount}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Switch checked={c.active} onCheckedChange={() => toggleCoupon(c.id, c.active)} />
                </div>
              </div>
            ))}
            {coupons.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum cupom cadastrado.</p>
            )}
          </CardContent>
        </Card>

        {/* Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Info className="h-5 w-5 text-primary" />
              How It Works
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t("admin.howItWorksDesc")}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Create / Edit Modal */}
      <Dialog open={showModal} onOpenChange={(open) => { if (!open) { setShowModal(false); resetForm(); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? t("admin.editPriceVersion") : t("admin.newPriceVersion")}</DialogTitle>
            <DialogDescription>
              {editingId ? t("admin.editPriceDesc") : t("admin.newPriceDesc")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="v-label">{t("admin.label")}</Label>
              <Input
                id="v-label"
                value={form.label}
                onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                placeholder="e.g. Black Friday"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="v-base">{t("admin.basePrice")}</Label>
                <Input
                  id="v-base"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.basePrice}
                  onChange={e => setForm(f => ({ ...f, basePrice: e.target.value }))}
                  placeholder="97.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="v-additional">{t("admin.perUserPrice")}</Label>
                <Input
                  id="v-additional"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.additionalPrice}
                  onChange={e => setForm(f => ({ ...f, additionalPrice: e.target.value }))}
                  placeholder="29.90"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="v-start">{t("admin.startDate")}</Label>
                <Input
                  id="v-start"
                  type="date"
                  value={form.startDate}
                  onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="v-end">{t("admin.endDate")}</Label>
                <Input
                  id="v-end"
                  type="date"
                  value={form.endDate}
                  onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                />
              </div>
            </div>
            <Button onClick={handleSave} className="w-full">
              Save Version
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Adjustment Modal */}
      <Dialog open={showAdjModal} onOpenChange={(open) => { if (!open) setShowAdjModal(false); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("admin.applyAdjustmentTitle")}</DialogTitle>
            <DialogDescription>{t("admin.addAdjustmentDesc")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("admin.adjustmentType")}</Label>
              <RadioGroup value={adjForm.type} onValueChange={(v) => setAdjForm(f => ({ ...f, type: v as "percentage" | "fixed" }))}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="percentage" id="adj-pct" />
                  <Label htmlFor="adj-pct">{t("admin.percentage")}</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="fixed" id="adj-fixed" />
                  <Label htmlFor="adj-fixed">{t("admin.fixedAmount")}</Label>
                </div>
              </RadioGroup>
            </div>
            <div className="space-y-2">
              <Label htmlFor="adj-value">{t("admin.value")}</Label>
              <Input
                id="adj-value"
                type="number"
                min="0"
                step="0.01"
                value={adjForm.value}
                onChange={e => setAdjForm(f => ({ ...f, value: e.target.value }))}
                placeholder={adjForm.type === "percentage" ? "10" : "5.00"}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="adj-date">{t("admin.effectiveDate")}</Label>
              <Input
                id="adj-date"
                type="date"
                value={adjForm.effectiveDate}
                onChange={e => setAdjForm(f => ({ ...f, effectiveDate: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("admin.applyMode")}</Label>
              <RadioGroup value={adjForm.applyMode} onValueChange={(v) => setAdjForm(f => ({ ...f, applyMode: v as AdjustmentApplyMode }))}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="all_customers" id="adj-all" />
                  <Label htmlFor="adj-all">{t("admin.allCustomersMode")}</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="new_customers_only" id="adj-new" />
                  <Label htmlFor="adj-new">{t("admin.newCustomersOnly")}</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="next_billing_cycle" id="adj-next" />
                  <Label htmlFor="adj-next">{t("admin.nextBillingCycleMode")}</Label>
                </div>
              </RadioGroup>
            </div>
            <Button className="w-full" onClick={() => {
              if (!adjForm.value || !adjForm.effectiveDate) {
                toast({ title: t("admin.allFieldsRequired"), variant: "destructive" });
                return;
              }
              const error = addAdjustment(adjVersionId!, {
                type: adjForm.type,
                value: parseFloat(adjForm.value),
                applyMode: adjForm.applyMode,
                effectiveDate: adjForm.effectiveDate,
              });
              if (error) {
                toast({ title: t("admin.error"), description: error, variant: "destructive" });
                return;
              }
              toast({ title: t("admin.adjustmentApplied") });
              setShowAdjModal(false);
            }}>
              Save Adjustment
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Coupon Modal */}
      <Dialog open={showCouponModal} onOpenChange={setShowCouponModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Cupom</DialogTitle>
            <DialogDescription>Cria um cupom no banco (AppMax) e no Stripe.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="c-code">Código do Cupom</Label>
              <Input
                id="c-code"
                placeholder="PROMO30"
                value={couponForm.code}
                onChange={e => setCouponForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                className="uppercase font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-desc">Descrição (Opcional)</Label>
              <Input
                id="c-desc"
                placeholder="Ex: 30% na Black Friday"
                value={couponForm.description}
                onChange={e => setCouponForm(f => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Tipo de Desconto</Label>
                <RadioGroup value={couponForm.discountType} onValueChange={(v) => setCouponForm(f => ({ ...f, discountType: v as "percent" | "fixed" }))} className="flex gap-4">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="percent" id="c-pct" />
                    <Label htmlFor="c-pct">%</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="fixed" id="c-fix" />
                    <Label htmlFor="c-fix">R$</Label>
                  </div>
                </RadioGroup>
              </div>
              <div className="space-y-2">
                <Label htmlFor="c-val">Valor do Desconto</Label>
                <Input
                  id="c-val"
                  type="number"
                  placeholder="30"
                  value={couponForm.discountValue}
                  onChange={e => setCouponForm(f => ({ ...f, discountValue: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Duração</Label>
                <RadioGroup value={couponForm.duration} onValueChange={(v) => setCouponForm(f => ({ ...f, duration: v as "once" | "forever" }))} className="flex flex-col gap-2">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="once" id="c-once" />
                    <Label htmlFor="c-once">Apenas 1ª Mensalidade</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="forever" id="c-for" />
                    <Label htmlFor="c-for">Recorrente (Sempre)</Label>
                  </div>
                </RadioGroup>
              </div>
              <div className="space-y-2">
                <Label htmlFor="c-max">Máx. Usos (Opcional)</Label>
                <Input
                  id="c-max"
                  type="number"
                  placeholder="Ex: 100"
                  value={couponForm.maxUses}
                  onChange={e => setCouponForm(f => ({ ...f, maxUses: e.target.value }))}
                />
              </div>
            </div>
            <Button className="w-full" onClick={handleSaveCoupon}>
              Criar Cupom
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
