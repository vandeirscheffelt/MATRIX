import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Shield, Package, Plus, Calendar, Info, Tag, TrendingUp } from "lucide-react";
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
    </AppLayout>
  );
}
